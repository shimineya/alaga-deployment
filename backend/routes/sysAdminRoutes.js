const router = require('express').Router();
const pool = require('../db');
const { verifyToken, verifySuperAdmin } = require('../middleware/authMiddleware');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Apply security middleware to ALL routes in this file
// [OWASP A01] Requires system_admin or legacy admin role
router.use(verifyToken);
router.use(verifySuperAdmin);

// --- Multer for firmware uploads (strict .bin validation) ---
const firmwareStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/firmware';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, `firmware_${Date.now()}${path.extname(file.originalname)}`);
    }
});

// [OWASP A08] Strict firmware upload validation
const firmwareUpload = multer({
    storage: firmwareStorage,
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname).toLowerCase() !== '.bin') {
            return cb(new Error('Only .bin firmware files are accepted.'));
        }
        cb(null, true);
    }
});

// =================================================================
// MODULE A: COMMAND CENTER — GLOBAL INFRASTRUCTURE
// Mandate: ISO 25010 Reliability & Observability
// =================================================================
router.get('/stats', async (req, res) => {
    try {
        const [patientCount, alertCount, deviceCount, userCount, facilityCount] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM patients WHERE is_archived = FALSE"),
            pool.query("SELECT COUNT(*) FROM alert_notifications WHERE severity = 'critical' AND status = 'unread'"),
            pool.query("SELECT COUNT(*) FROM device_whitelist WHERE status = 'ACTIVE'"),
            pool.query("SELECT COUNT(*) FROM users WHERE account_status = 'Pending_Review'"),
            pool.query("SELECT COUNT(*) FROM facilities")
        ]);

        res.json({
            success: true,
            data: {
                total_patients: parseInt(patientCount.rows[0].count),
                critical_alerts: parseInt(alertCount.rows[0].count),
                online_devices: parseInt(deviceCount.rows[0].count),
                pending_users: parseInt(userCount.rows[0].count),
                total_facilities: parseInt(facilityCount.rows[0].count),
                system_status: 'OPERATIONAL',
                uptime: process.uptime()
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch system stats.' });
    }
});

// Recent security events for the Command Center threat feed
router.get('/security-events', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.timestamp, a.action, a.severity, a.resource_affected,
                    u.username, a.ip_address
             FROM access_logs a
             LEFT JOIN users u ON a.user_id = u.user_id
             WHERE a.severity IN ('CRITICAL', 'WARNING')
             ORDER BY a.timestamp DESC
             LIMIT 10`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch security events.' });
    }
});

// Locked and suspended accounts summary
router.get('/locked-accounts', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT user_id, username, email, role, account_status, is_locked,
                    facility_id
             FROM users
             WHERE is_locked = TRUE OR account_status = 'Suspended'
             ORDER BY username`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch locked accounts.' });
    }
});

// =================================================================
// MODULE B: KILL SWITCHES
// Mandate: HIPAA Incident Response — Immediate containment capability
// =================================================================

// Revoke a specific user's sessions instantly
router.post('/kill-switch/revoke-user', async (req, res) => {
    const { user_id, reason } = req.body;
    if (!user_id) return res.status(400).json({ success: false, message: 'user_id is required.' });

    try {
        // [OWASP A05] Parameterized upsert
        await pool.query(
            `INSERT INTO session_revocations (user_id, revoked_before, revoked_by, reason)
             VALUES ($1, NOW(), $2, $3)
             ON CONFLICT (user_id) DO UPDATE
             SET revoked_before = NOW(), revoked_by = $2, reason = $3`,
            [user_id, req.user.id, reason || 'Revoked by System Admin']
        );

        // [OWASP A09] Log as CRITICAL security event
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'SESSION_REVOKE_GLOBAL', $2, 'CRITICAL')`,
            [req.user.id, `Force-revoked sessions for User ID ${user_id}`]
        );

        res.json({ success: true, message: 'User sessions revoked. They will be logged out on their next request.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Session revocation failed.' });
    }
});

// Global Lockdown: Enable maintenance mode + lock all non-admin accounts
router.post('/kill-switch/global-lockdown', async (req, res) => {
    const { enabled } = req.body;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Toggle maintenance mode
        await client.query(
            `INSERT INTO system_configs (config_key, config_value, updated_by)
             VALUES ('maintenance_mode', $1, $2)
             ON CONFLICT (config_key) DO UPDATE
             SET config_value = $1, updated_by = $2, updated_at = NOW()`,
            [JSON.stringify({ enabled }), req.user.id]
        );

        if (enabled) {
            // 2. Lock all non-admin accounts
            await client.query(
                `UPDATE users SET is_locked = TRUE, account_status = 'Locked'
                 WHERE role NOT IN ('admin', 'system_admin')`
            );

            // 3. Revoke all active sessions for non-admin users
            await client.query(
                `INSERT INTO session_revocations (user_id, revoked_before, revoked_by, reason)
                 SELECT user_id, NOW(), $1, 'Global Lockdown triggered'
                 FROM users
                 WHERE role NOT IN ('admin', 'system_admin')
                 ON CONFLICT (user_id) DO UPDATE
                 SET revoked_before = NOW(), revoked_by = $1`,
                [req.user.id]
            );
        } else {
            // Unlock all accounts that were locked by a previous lockdown
            await client.query(
                `UPDATE users SET is_locked = FALSE, account_status = 'Active'
                 WHERE account_status = 'Locked'
                   AND role NOT IN ('admin', 'system_admin')`
            );
        }

        // [OWASP A09] Audit the lockdown event
        await client.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, $2, 'Entire System', 'CRITICAL')`,
            [req.user.id, enabled ? 'GLOBAL_LOCKDOWN_ENABLED' : 'GLOBAL_LOCKDOWN_DISABLED']
        );

        await client.query('COMMIT');
        res.json({ success: true, message: `Global lockdown ${enabled ? 'ACTIVATED' : 'DEACTIVATED'}.` });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: 'Lockdown operation failed.' });
    } finally {
        client.release();
    }
});

// =================================================================
// MODULE C: GLOBAL USER MANAGEMENT
// Mandate: HIPAA Workforce Security
// =================================================================

// Get all users (all facilities, full visibility)
router.get('/users', async (req, res) => {
    try {
        // [Privacy] password_hash excluded
        const result = await pool.query(
            `SELECT u.user_id, u.username, u.email, u.role,
                    u.account_status, u.is_locked,
                    u.facility_id, f.facility_name,
                    to_char(u.created_at, 'YYYY-MM-DD HH24:MI') as joined_at
             FROM users u
             LEFT JOIN facilities f ON u.facility_id = f.facility_id
             WHERE u.role NOT IN ('system_admin', 'admin')
             ORDER BY u.created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch users.' });
    }
});

// Lock or unlock a user
router.post('/users/:id/lock', async (req, res) => {
    const { id } = req.params;
    const { lock } = req.body;
    try {
        await pool.query(
            'UPDATE users SET is_locked = $1, account_status = $2 WHERE user_id = $3',
            [lock, lock ? 'Locked' : 'Active', id]
        );
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, $2, $3, 'CRITICAL')`,
            [req.user.id, lock ? 'USER_LOCK' : 'USER_UNLOCK', `Target User ID: ${id}`]
        );
        res.json({ success: true, message: `User ${lock ? 'locked' : 'unlocked'}.` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update user lock status.' });
    }
});

// Update user profile and role
router.put('/users/:id', async (req, res) => {
    const { id } = req.params;
    const { username, email, role } = req.body;
    try {
        await pool.query(
            `UPDATE users
             SET username = COALESCE($1, username),
                 email = COALESCE($2, email),
                 role = COALESCE($3, role)
             WHERE user_id = $4`,
            [username, email, role, id]
        );
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected)
             VALUES ($1, 'USER_UPDATE', $2)`,
            [req.user.id, `Updated profile for User ID ${id}`]
        );
        res.json({ success: true, message: 'User updated.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Update failed.' });
    }
});

// Reset MFA for a user
router.post('/users/:id/reset-mfa', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query(
            'UPDATE users SET mfa_secret = NULL, is_mfa_enabled = FALSE WHERE user_id = $1',
            [id]
        );
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'MFA_RESET', $2, 'WARNING')`,
            [req.user.id, `Reset MFA for User ID ${id}`]
        );
        res.json({ success: true, message: 'MFA cleared. User must re-enroll.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'MFA reset failed.' });
    }
});

// =================================================================
// MODULE D: GRANULAR RBAC
// Mandate: OWASP A01 — Server-side permission enforcement
// =================================================================

// Get all module permissions for a role
router.get('/rbac/roles/:role', async (req, res) => {
    const { role } = req.params;
    try {
        const result = await pool.query(
            'SELECT module_id, is_enabled FROM role_permissions WHERE role = $1',
            [role]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch role permissions.' });
    }
});

// Bulk update module permissions for a role (replaces localStorage pattern)
router.put('/rbac/roles/:role', async (req, res) => {
    const { role } = req.params;
    const { permissions } = req.body; // Array of { module_id, is_enabled }

    const allowedRoles = ['caregiver', 'medical_staff', 'facility_admin'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role target.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        for (const perm of permissions) {
            await client.query(
                `INSERT INTO role_permissions (role, module_id, is_enabled, updated_by)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (role, module_id) DO UPDATE
                 SET is_enabled = $3, updated_by = $4, updated_at = NOW()`,
                [role, perm.module_id, perm.is_enabled, req.user.id]
            );
        }
        await client.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'RBAC_ROLE_UPDATE', $2, 'WARNING')`,
            [req.user.id, `Updated ${permissions.length} permissions for role: ${role}`]
        );
        await client.query('COMMIT');
        res.json({ success: true, message: `Permissions updated for role: ${role}` });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: 'Failed to save permissions.' });
    } finally {
        client.release();
    }
});

// Get per-user permission overrides
router.get('/rbac/users/:userId/overrides', async (req, res) => {
    const { userId } = req.params;
    try {
        const result = await pool.query(
            'SELECT module_id, is_granted, override_reason, overridden_at FROM user_permission_overrides WHERE user_id = $1',
            [userId]
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch overrides.' });
    }
});

// Set a per-user module override
router.post('/rbac/users/:userId/overrides', async (req, res) => {
    const { userId } = req.params;
    const { module_id, is_granted, override_reason } = req.body;

    if (!override_reason || override_reason.trim() === '') {
        return res.status(400).json({ success: false, message: 'A reason is required for all permission overrides.' });
    }

    try {
        await pool.query(
            `INSERT INTO user_permission_overrides (user_id, module_id, is_granted, override_reason, overridden_by)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id, module_id) DO UPDATE
             SET is_granted = $3, override_reason = $4, overridden_by = $5, overridden_at = NOW()`,
            [userId, module_id, is_granted, override_reason, req.user.id]
        );
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'RBAC_OVERRIDE_SET', $2, 'WARNING')`,
            [req.user.id, `Override for User ${userId}, module ${module_id}: ${is_granted ? 'GRANTED' : 'DENIED'}. Reason: ${override_reason}`]
        );
        res.json({ success: true, message: 'Permission override saved.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to save override.' });
    }
});

// Remove a specific override
router.delete('/rbac/users/:userId/overrides/:moduleId', async (req, res) => {
    const { userId, moduleId } = req.params;
    try {
        await pool.query(
            'DELETE FROM user_permission_overrides WHERE user_id = $1 AND module_id = $2',
            [userId, moduleId]
        );
        res.json({ success: true, message: 'Override removed. User will now follow role defaults.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to remove override.' });
    }
});

// =================================================================
// MODULE E: FORENSIC AUDIT TRAILS
// Mandate: HIPAA § 164.312(b) — Full technical detail for CISO
// =================================================================

router.get('/audit-logs', async (req, res) => {
    const { severity, action, limit = 100 } = req.query;
    try {
        let query = `SELECT a.*, u.username, u.email
                     FROM access_logs a
                     LEFT JOIN users u ON a.user_id = u.user_id
                     WHERE 1=1`;
        const params = [];

        if (severity) {
            params.push(severity);
            query += ` AND a.severity = $${params.length}`;
        }
        if (action) {
            params.push(`%${action}%`);
            query += ` AND a.action ILIKE $${params.length}`;
        }

        params.push(Math.min(parseInt(String(limit)), 1000));
        query += ` ORDER BY a.timestamp DESC LIMIT $${params.length}`;

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch audit logs.' });
    }
});

// Role change audit log
router.get('/audit-logs/role-changes', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.timestamp, a.action, a.resource_affected,
                    u.username AS performed_by, a.ip_address
             FROM access_logs a
             LEFT JOIN users u ON a.user_id = u.user_id
             WHERE a.action IN ('USER_UPDATE', 'RBAC_ROLE_UPDATE', 'RBAC_OVERRIDE_SET', 'USER_LOCK', 'USER_UNLOCK')
             ORDER BY a.timestamp DESC
             LIMIT 200`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch role change log.' });
    }
});

// Authentication failure log (brute force monitoring)
router.get('/audit-logs/auth-failures', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.timestamp, a.action, a.resource_affected,
                    a.ip_address, a.user_agent
             FROM access_logs a
             WHERE a.action IN ('LOGIN_FAILURE', 'UNAUTHORIZED_ACCESS')
             ORDER BY a.timestamp DESC
             LIMIT 200`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch auth failure log.' });
    }
});

// PDF export of audit logs
router.get('/audit-logs/export', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT a.timestamp, a.action, a.severity, a.ip_address,
                    u.username, a.resource_affected
             FROM access_logs a
             LEFT JOIN users u ON a.user_id = u.user_id
             ORDER BY a.timestamp DESC LIMIT 1000`
        );

        const doc = new PDFDocument({ margin: 50 });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Alaga_Audit_Report_${Date.now()}.pdf`);
        doc.pipe(res);

        doc.fontSize(20).text('Alaga System: Forensic Audit Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Generated Date: ${new Date().toLocaleString()}`);
        doc.text('CLASSIFICATION: CONFIDENTIAL - For Data Protection Officer use only.');
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();
        doc.fontSize(10);

        result.rows.forEach(log => {
            const y = doc.y;
            doc.fillColor(log.severity === 'CRITICAL' ? 'red' : log.severity === 'WARNING' ? 'orange' : 'black');
            doc.text(new Date(log.timestamp).toLocaleString(), 50, y, { width: 130 });
            doc.text(log.action, 180, y, { width: 120 });
            doc.text(log.username || 'System', 300, y, { width: 100 });
            doc.text(log.ip_address || 'N/A', 400, y, { width: 100 });
            doc.moveDown(0.5);
            doc.fillColor('black');
            if (doc.y > 700) doc.addPage();
        });

        // [OWASP A09] Audit the export itself
        await pool.query(
            `INSERT INTO access_logs (user_id, action, severity, resource_affected)
             VALUES ($1, 'AUDIT_LOG_EXPORT', 'WARNING', 'PDF Export triggered — notify DPO')`,
            [req.user.id]
        );

        doc.end();
    } catch (err) {
        res.status(500).json({ success: false, message: 'Export failed.' });
    }
});

// =================================================================
// MODULE F: FIRMWARE MANAGEMENT (OTA)
// Mandate: OWASP A08 — Software and Data Integrity
// =================================================================

// Upload firmware file with SHA-256 checksum validation
router.post('/firmware/upload', firmwareUpload.single('firmware_file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No firmware file uploaded.' });
    }

    const { provided_checksum, version_label } = req.body;

    if (!provided_checksum) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ success: false, message: 'SHA-256 checksum is required for firmware integrity verification.' });
    }

    try {
        // [OWASP A08] Compute actual SHA-256 of the uploaded file
        const fileBuffer = fs.readFileSync(req.file.path);
        const actualChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        if (actualChecksum !== provided_checksum.toLowerCase()) {
            // Integrity check failed — delete file and log as CRITICAL
            fs.unlinkSync(req.file.path);
            await pool.query(
                `INSERT INTO access_logs (user_id, action, resource_affected, severity)
                 VALUES ($1, 'FIRMWARE_INTEGRITY_FAIL', $2, 'CRITICAL')`,
                [req.user.id, `Checksum mismatch for firmware version "${version_label}"`]
            );
            return res.status(400).json({
                success: false,
                message: 'Firmware integrity check FAILED. Checksums do not match. File rejected and event logged.'
            });
        }

        // [OWASP A05] Store firmware record in DB
        await pool.query(
            `INSERT INTO system_configs (config_key, config_value, updated_by)
             VALUES ($1, $2, $3)`,
            [
                `firmware_${Date.now()}`,
                JSON.stringify({ version: version_label, file: req.file.filename, checksum: actualChecksum, uploaded_at: new Date() }),
                req.user.id
            ]
        );

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'FIRMWARE_UPLOAD', $2, 'WARNING')`,
            [req.user.id, `Firmware version "${version_label}" uploaded and verified.`]
        );

        res.json({ success: true, message: `Firmware "${version_label}" uploaded and integrity verified.`, checksum: actualChecksum });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(500).json({ success: false, message: 'Firmware upload failed.' });
    }
});

// Get all firmware versions
router.get('/firmware/versions', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT config_key, config_value, updated_at
             FROM system_configs
             WHERE config_key LIKE 'firmware_%'
               AND config_key != 'firmware_versions'
             ORDER BY updated_at DESC`
        );
        const versions = result.rows.map(row => ({
            key: row.config_key,
            ...JSON.parse(row.config_value),
            uploaded_at: row.updated_at
        }));
        res.json({ success: true, data: versions });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch firmware versions.' });
    }
});

// =================================================================
// MODULE G: GLOBAL SECURITY POLICIES
// Mandate: OWASP A07 (Auth Failures) — Enforce MFA, password policy
// =================================================================
router.post('/security/policies', async (req, res) => {
    const { password_rotation_days, mfa_required_roles, session_timeout_minutes } = req.body;
    try {
        const policies = {
            password_rotation_days: password_rotation_days || 90,
            mfa_required_roles: mfa_required_roles || [],
            session_timeout_minutes: session_timeout_minutes || 480
        };

        await pool.query(
            `INSERT INTO system_configs (config_key, config_value, updated_by)
             VALUES ('global_security_policies', $1, $2)
             ON CONFLICT (config_key) DO UPDATE
             SET config_value = $1, updated_by = $2, updated_at = NOW()`,
            [JSON.stringify(policies), req.user.id]
        );

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'SECURITY_POLICY_UPDATE', 'Global Security Policies', 'WARNING')`,
            [req.user.id]
        );

        res.json({ success: true, message: 'Global security policies updated.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update security policies.' });
    }
});

router.get('/security/policies', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT config_value FROM system_configs WHERE config_key = 'global_security_policies'"
        );
        res.json({ success: true, data: result.rows[0]?.config_value || {} });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch policies.' });
    }
});

// IP whitelist management
router.get('/security/ip-whitelist', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM ip_blacklist ORDER BY banned_at DESC");
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch IP list.' });
    }
});

router.post('/security/ip-ban', async (req, res) => {
    const { ip, reason } = req.body;
    try {
        await pool.query(
            "INSERT INTO ip_blacklist (ip_address, reason, banned_by) VALUES ($1, $2, $3)",
            [ip, reason || 'Manual ban by System Admin', req.user.id]
        );
        res.json({ success: true, message: `IP ${ip} banned.` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to ban IP.' });
    }
});

router.delete('/security/ip-ban/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM ip_blacklist WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: 'IP unbanned.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to unban IP.' });
    }
});

// =================================================================
// MODULE H: SYSTEM BACKUP & MAINTENANCE
// Mandate: ISO 25010 Recoverability
// =================================================================
router.get('/backup', async (req, res) => {
    try {
        const [users, patients, devices, logs, configs] = await Promise.all([
            pool.query('SELECT user_id, username, email, role, facility_id, account_status, created_at FROM users'),
            pool.query('SELECT * FROM patients'),
            pool.query('SELECT * FROM device_whitelist'),
            pool.query('SELECT * FROM access_logs ORDER BY timestamp DESC LIMIT 5000'),
            pool.query('SELECT * FROM system_configs')
        ]);

        const filename = `Alaga_Full_Backup_${Date.now()}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(JSON.stringify({ timestamp: new Date(), version: '2.0', tables: { users: users.rows, patients: patients.rows, devices: devices.rows, access_logs: logs.rows, system_configs: configs.rows } }, null, 2));

        await pool.query(
            `INSERT INTO access_logs (user_id, action, severity, resource_affected)
             VALUES ($1, 'SYSTEM_BACKUP', 'WARNING', 'Full Database Export')`,
            [req.user.id]
        );
    } catch (err) {
        res.status(500).json({ success: false, message: 'Backup generation failed.' });
    }
});

router.post('/maintenance', async (req, res) => {
    const { enabled } = req.body;
    try {
        await pool.query(
            `INSERT INTO system_configs (config_key, config_value, updated_by)
             VALUES ('maintenance_mode', $1, $2)
             ON CONFLICT (config_key) DO UPDATE SET config_value = $1, updated_by = $2, updated_at = NOW()`,
            [JSON.stringify({ enabled }), req.user.id]
        );
        await pool.query(
            `INSERT INTO access_logs (user_id, action, severity, resource_affected)
             VALUES ($1, 'MAINTENANCE_TOGGLE', 'CRITICAL', $2)`,
            [req.user.id, enabled ? 'System placed into Maintenance Mode' : 'System returned to Live']
        );
        res.json({ success: true, message: `Maintenance Mode ${enabled ? 'ENABLED' : 'DISABLED'}` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to toggle maintenance mode.' });
    }
});

module.exports = router;
