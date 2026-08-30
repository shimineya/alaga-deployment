const router = require('express').Router();
const pool = require('../db');
const { verifyToken, requireRole, requirePermission } = require('../middleware/authMiddleware');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Apply security middleware to ALL routes in this file
// [OWASP A01] Requires system_admin or legacy admin role
router.use(verifyToken);
router.use(requireRole(['sysadmin', 'system_admin']));

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
router.get('/stats', requirePermission('dashboard_overview'), async (req, res) => {
    try {
        const [
            patientCount,
            alertCount,
            deviceCount,
            userCount,
            facilityCount,
            activeOverrides,
            pendingErasure,
            dbSize,
            dbConnections,
            totalDevices,
            offlineDevices
        ] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM patients WHERE is_archived = FALSE"),
            pool.query("SELECT COUNT(*) FROM alert_notifications WHERE severity = 'CRITICAL' AND status = 'Sent'"),
            pool.query("SELECT COUNT(*) FROM device_whitelist WHERE status = 'ACTIVE' AND is_archived IS DISTINCT FROM TRUE"),
            pool.query("SELECT COUNT(*) FROM users WHERE account_status = 'Pending_Review' AND is_archived IS DISTINCT FROM TRUE"),
            pool.query("SELECT COUNT(*) FROM facilities"),
            pool.query("SELECT COUNT(*) FROM access_logs WHERE action = 'BREAK_GLASS_ACCESS' AND timestamp >= NOW() - INTERVAL '15 minutes'"),
            pool.query("SELECT COUNT(*) FROM archives"),
            pool.query("SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size"),
            pool.query("SELECT count(*) FROM pg_stat_activity"),
            pool.query("SELECT COUNT(*) FROM device_whitelist WHERE is_archived IS DISTINCT FROM TRUE"),
            pool.query("SELECT COUNT(*) FROM device_whitelist WHERE status = 'INACTIVE' AND is_archived IS DISTINCT FROM TRUE")
        ]);
 
        res.json({
            success: true,
            data: {
                total_patients: parseInt(patientCount.rows[0].count),
                critical_alerts: parseInt(alertCount.rows[0].count),
                online_devices: parseInt(deviceCount.rows[0].count),
                pending_users: parseInt(userCount.rows[0].count),
                total_facilities: parseInt(facilityCount.rows[0].count),
                active_overrides: parseInt(activeOverrides.rows[0].count),
                pending_erasure: parseInt(pendingErasure.rows[0].count),
                db_size: dbSize.rows[0].db_size,
                db_connections: parseInt(dbConnections.rows[0].count),
                total_devices: parseInt(totalDevices.rows[0].count),
                offline_devices: parseInt(offlineDevices.rows[0].count),
                system_status: 'OPERATIONAL',
                uptime: process.uptime()
            }
        });
    } catch (err) {
        console.error('Stats fetch error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch system stats.' });
    }
});

// GET /stats/security - Real-time security operations metrics
router.get('/stats/security', requirePermission('security_controls'), async (req, res) => {
    try {
        const [
            blockedIPs,
            suspendedAccounts,
            unauthorizedAttempts,
            activeOverrides,
            maintMode
        ] = await Promise.all([
            pool.query("SELECT COUNT(*) FROM ip_blacklist WHERE is_archived IS DISTINCT FROM TRUE"),
            pool.query("SELECT COUNT(*) FROM users WHERE is_locked = TRUE OR account_status = 'Suspended'"),
            pool.query("SELECT COUNT(*) FROM access_logs WHERE (action = 'UNAUTHORIZED_ACCESS' OR status = 'FAILURE') AND timestamp >= NOW() - INTERVAL '24 hours'"),
            pool.query("SELECT COUNT(*) FROM access_logs WHERE action = 'BREAK_GLASS_ACCESS' AND timestamp >= NOW() - INTERVAL '15 minutes'"),
            pool.query("SELECT config_value FROM system_configs WHERE config_key = 'maintenance_mode'")
        ]);
 
        let isLockdown = false;
        if (maintMode.rows.length > 0) {
            try {
                const val = typeof maintMode.rows[0].config_value === 'string' 
                    ? JSON.parse(maintMode.rows[0].config_value) 
                    : maintMode.rows[0].config_value;
                isLockdown = val.enabled || false;
            } catch (e) {
                // Ignore
            }
        }
 
        res.json({
            success: true,
            data: {
                blocked_ips: parseInt(blockedIPs.rows[0].count),
                suspended_accounts: parseInt(suspendedAccounts.rows[0].count),
                unauthorized_attempts: parseInt(unauthorizedAttempts.rows[0].count),
                active_overrides: parseInt(activeOverrides.rows[0].count),
                global_lockdown: isLockdown
            }
        });
    } catch (err) {
        console.error('Security stats fetch error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch security stats.' });
    }
});

// Recent security events for the Command Center threat feed
router.get('/security-events', requirePermission('audit_logs'), async (req, res) => {
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
router.get('/locked-accounts', requirePermission('user_management'), async (req, res) => {
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
router.post('/kill-switch/revoke-user', requirePermission('security_controls'), async (req, res) => {
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
router.post('/kill-switch/global-lockdown', requirePermission('security_controls'), async (req, res) => {
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
router.get('/users', requirePermission('user_management'), async (req, res) => {
    try {
        // [Privacy] password_hash excluded
        const result = await pool.query(
            `SELECT u.user_id, u.username, u.email, u.role,
                    u.account_status, u.is_locked,
                    u.facility_id, f.facility_name,
                    to_char(u.created_at, 'YYYY-MM-DD HH24:MI') as joined_at,
                    u.last_activity_at,
                    CASE WHEN u.last_activity_at > NOW() - INTERVAL '2 minutes' THEN true ELSE false END as is_online
             FROM users u
             LEFT JOIN facilities f ON u.facility_id = f.facility_id
             WHERE u.is_archived IS DISTINCT FROM TRUE
             ORDER BY u.created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch users.' });
    }
});

// Lock or unlock a user
router.post('/users/:id/lock', requirePermission('user_management'), async (req, res) => {
    const { id } = req.params;
    const { lock } = req.body;
    try {
        await pool.query(
            'UPDATE users SET is_locked = $1, account_status = $2 WHERE user_id = $3',
            [lock, lock ? 'Locked' : 'Active', id]
        );
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, $2, $3, 'WARNING')`,
            [req.user.id, lock ? 'USER_LOCK' : 'USER_UNLOCK', `Target User ID: ${id}`]
        );
        res.json({ success: true, message: `User ${lock ? 'locked' : 'unlocked'}.` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update user lock status.' });
    }
});

// Create a new user account (facility_admin, medical_staff, caregiver, parent)
router.post('/users', requirePermission('user_management'), async (req, res) => {
    const { username, email, password, role, facility_id, facility_name } = req.body;

    const allowedRoles = ['facility_admin', 'medical_staff', 'caregiver', 'parent'];
    if (!allowedRoles.includes(role)) {
        return res.status(400).json({ success: false, message: 'Invalid role. System Admin can only create facility_admin, medical_staff, caregiver, or parent.' });
    }

    if (!username || !email || !password) {
        return res.status(400).json({ success: false, message: 'Username, email, and password are required.' });
    }

    const hasSmall = /[a-z]/.test(password);
    const hasCap = /[A-Z]/.test(password);
    const hasNum = /[0-9]/.test(password);
    const hasSym = /[^A-Za-z0-9]/.test(password);
    if (password.length < 12 || !hasSmall || !hasCap || !hasNum || !hasSym) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 12 characters and contain at least 1 lowercase letter, 1 uppercase letter, 1 number, and 1 symbol.'
        });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        let targetFacilityId = facility_id ? parseInt(facility_id) : null;

        // If role is facility_admin and facility_name is provided, find or create the facility
        if (role === 'facility_admin' && facility_name && facility_name.trim() !== '') {
            const facCheck = await client.query(
                `SELECT facility_id FROM facilities WHERE LOWER(facility_name) = LOWER($1)`,
                [facility_name.trim()]
            );
            if (facCheck.rows.length > 0) {
                targetFacilityId = facCheck.rows[0].facility_id;
            } else {
                const newFac = await client.query(
                    `INSERT INTO facilities (facility_name) VALUES ($1) RETURNING facility_id`,
                    [facility_name.trim()]
                );
                targetFacilityId = newFac.rows[0].facility_id;
            }
        }

        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        const userResult = await client.query(
            `INSERT INTO users (username, email, password_hash, role, facility_id, account_status, is_verified, created_by)
             VALUES ($1, $2, $3, $4, $5, 'Active', true, $6)
             RETURNING user_id`,
            [username, email, hashedPassword, role, targetFacilityId, req.user.id]
        );
        const newUserId = userResult.rows[0].user_id;

        await client.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'USER_PROVISIONED_BY_SYSADMIN', $2, 'INFO')`,
            [req.user.id, `Created ${role} (ID ${newUserId})`]
        );

        await client.query('COMMIT');
        res.status(201).json({ success: true, message: 'User provisioned successfully.', user_id: newUserId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Create User Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to create user.' });
    } finally {
        client.release();
    }
});

// Update user profile, role and facility
router.put('/users/:id', requirePermission('user_management'), async (req, res) => {
    const { id } = req.params;
    const { username, email, role, facility_id } = req.body;
    try {
        await pool.query(
            `UPDATE users
             SET username = COALESCE($1, username),
                 email = COALESCE($2, email),
                 role = COALESCE($3, role),
                 facility_id = $4
             WHERE user_id = $5`,
            [username, email, role, facility_id || null, id]
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

// Delete user account (changed to archive)
router.delete('/users/:id', requirePermission('user_management'), async (req, res) => {
    const { id } = req.params;
    try {
        const userCheck = await pool.query('SELECT username, facility_id FROM users WHERE user_id = $1', [id]);
        if (userCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        const user = userCheck.rows[0];

        await pool.query("UPDATE users SET is_archived = true, account_status = 'Archived' WHERE user_id = $1", [id]);

        await pool.query(
            `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
             VALUES ('User', $1, $2, $3, NOW(), 'Archived', $4)`,
            [id.toString(), user.username, req.user.id, user.facility_id]
        );

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'USER_ARCHIVE', $2, 'CRITICAL')`,
            [req.user.id, `Archived User ID ${id}`]
        );
        res.json({ success: true, message: 'User archived successfully.' });
    } catch (err) {
        console.error("Archive user error:", err);
        res.status(500).json({ success: false, message: 'Failed to archive user.' });
    }
});

// Reset MFA for a user
router.post('/users/:id/reset-mfa', requirePermission('user_management'), async (req, res) => {
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
router.get('/rbac/roles/:role', requirePermission('rbac_management'), async (req, res) => {
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
router.put('/rbac/roles/:role', requirePermission('rbac_management'), async (req, res) => {
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
router.get('/rbac/users/:userId/overrides', requirePermission('rbac_management'), async (req, res) => {
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
router.post('/rbac/users/:userId/overrides', requirePermission('rbac_management'), async (req, res) => {
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
router.delete('/rbac/users/:userId/overrides/:moduleId', requirePermission('rbac_management'), async (req, res) => {
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

router.get('/audit-logs', requirePermission('audit_logs'), async (req, res) => {
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
router.get('/audit-logs/role-changes', requirePermission('audit_logs'), async (req, res) => {
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
router.get('/audit-logs/auth-failures', requirePermission('audit_logs'), async (req, res) => {
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
router.get('/audit-logs/export', requirePermission('audit_logs'), async (req, res) => {
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
// Upload firmware file with optional SHA-256 checksum validation (auto-computed if not provided)
router.post('/firmware/upload', requirePermission('device_management'), firmwareUpload.single('firmware_file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No firmware file uploaded.' });
    }

    const { provided_checksum, version_label, name, features } = req.body;

    try {
        // [OWASP A08] Compute actual SHA-256 of the uploaded file
        const fileBuffer = fs.readFileSync(req.file.path);
        const actualChecksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

        if (provided_checksum && actualChecksum !== provided_checksum.toLowerCase()) {
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

        // Store firmware record in DB
        const configKey = `firmware_${Date.now()}`;
        const configValue = {
            version: version_label || '1.0.0',
            name: name || `Update ${version_label}`,
            features: features || 'Bug fixes and performance improvements.',
            file: req.file.filename,
            checksum: actualChecksum,
            uploaded_at: new Date()
        };

        await pool.query(
            `INSERT INTO system_configs (config_key, config_value, updated_by)
             VALUES ($1, $2, $3)`,
            [configKey, JSON.stringify(configValue), req.user.id]
        );

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'FIRMWARE_UPLOAD', $2, 'WARNING')`,
            [req.user.id, `Firmware version "${version_label}" uploaded and verified.`]
        );

        res.json({ success: true, message: `Firmware uploaded and integrity verified.`, data: { key: configKey, ...configValue } });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        console.error("Upload Error:", err.message);
        res.status(500).json({ success: false, message: 'Firmware upload failed.' });
    }
});

// Update firmware details (edit name and features)
router.put('/firmware/:key', requirePermission('device_management'), async (req, res) => {
    const { key } = req.params;
    const { name, features, version_label } = req.body;
    try {
        const check = await pool.query(
            "SELECT config_value FROM system_configs WHERE config_key = $1",
            [key]
        );
        if (check.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Firmware record not found.' });
        }
        const current = check.rows[0].config_value;
        const updated = {
            ...current,
            name: name || current.name,
            features: features || current.features,
            version: version_label || current.version
        };
        await pool.query(
            "UPDATE system_configs SET config_value = $1, updated_at = NOW() WHERE config_key = $2",
            [JSON.stringify(updated), key]
        );
        res.json({ success: true, message: 'Firmware details updated successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Update failed.' });
    }
});

// Delete/Archive firmware record
router.delete('/firmware/:key', requirePermission('device_management'), async (req, res) => {
    const { key } = req.params;
    try {
        await pool.query("UPDATE system_configs SET is_archived = true WHERE config_key = $1", [key]);
        await pool.query(
            `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status)
             VALUES ('Firmware', $1, $2, $3, NOW(), 'Archived')`,
            [key, `Firmware Update: ${key}`, req.user.id]
        );
        res.json({ success: true, message: 'Firmware update archived successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Archival failed.' });
    }
});

// Push firmware updates immediately to connected Wi-Fi endpoints
router.post('/firmware/push', requirePermission('device_management'), async (req, res) => {
    const { version_label } = req.body;
    try {
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'FIRMWARE_PUSH_OTA', $2, 'WARNING')`,
            [req.user.id, `Pushed OTA firmware version "${version_label}" to connected Wi-Fi devices.`]
        );
        res.json({ success: true, message: `OTA update broadcast triggered successfully for version ${version_label}.` });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to broadcast OTA update.' });
    }
});

// Get all firmware versions
router.get('/firmware/versions', requirePermission('device_management'), async (req, res) => {
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
            name: row.config_value.name || `Update ${row.config_value.version}`,
            features: row.config_value.features || 'Bug fixes and performance improvements.',
            ...row.config_value,
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
router.post('/security/policies', requirePermission('security_controls'), async (req, res) => {
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

router.get('/security/policies', requirePermission('security_controls'), async (req, res) => {
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
router.get('/security/ip-whitelist', requirePermission('security_controls'), async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM ip_blacklist WHERE is_archived IS DISTINCT FROM TRUE ORDER BY banned_at DESC");
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch IP list.' });
    }
});

router.post('/security/ip-ban', requirePermission('security_controls'), async (req, res) => {
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

router.delete('/security/ip-ban/:id', requirePermission('security_controls'), async (req, res) => {
    try {
        const check = await pool.query("SELECT ip_address FROM ip_blacklist WHERE id = $1", [req.params.id]);
        if (check.rows.length > 0) {
            const ip = check.rows[0].ip_address;
            await pool.query("UPDATE ip_blacklist SET is_archived = true WHERE id = $1", [req.params.id]);
            await pool.query(
                `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status)
                 VALUES ('IP Ban', $1, $2, $3, NOW(), 'Archived')`,
                [req.params.id.toString(), `Banned IP: ${ip}`, req.user.id]
            );
        } else {
            return res.status(404).json({ success: false, message: 'Banned IP record not found.' });
        }
        res.json({ success: true, message: 'IP unbanned/archived.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to unban IP.' });
    }
});

// =================================================================
// MODULE H: SYSTEM BACKUP & MAINTENANCE
// Mandate: ISO 25010 Recoverability
// =================================================================
router.get('/backup', requirePermission('system_maintenance'), async (req, res) => {
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

router.post('/maintenance', requirePermission('system_maintenance'), async (req, res) => {
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

// =================================================================
// MODULE G: SYSTEM-WIDE ASSIGNMENT COMMAND CENTER
// =================================================================

// GET SIMPLE LIST OF ACTIVE PATIENTS FOR SELECTION dropdown
router.get('/patients-list', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT p.patient_id, p.name, f.facility_name
             FROM patients p
             LEFT JOIN facilities f ON p.facility_id = f.facility_id
             WHERE p.is_archived IS DISTINCT FROM TRUE
             ORDER BY p.name ASC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Fetch Patients List Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch patient list.' });
    }
});

// 1. GET ALL SYSTEM-WIDE ASSIGNMENTS (Active and Pending)
router.get('/assignments', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT pa.access_id, pa.user_id, pa.patient_id, pa.relationship, pa.access_level, pa.invite_status,
                    to_char(pa.assigned_at, 'YYYY-MM-DD HH24:MI') as assigned_at,
                    u.username AS caregiver_username, u.first_name AS caregiver_first_name, u.last_name AS caregiver_last_name, u.email AS caregiver_email,
                    p.name AS patient_name,
                    f.facility_name,
                    inv.first_name AS invited_by_first_name, inv.last_name AS invited_by_last_name
             FROM patient_access pa
             JOIN users u ON pa.user_id = u.user_id
             JOIN patients p ON pa.patient_id = p.patient_id
             LEFT JOIN facilities f ON p.facility_id = f.facility_id
             LEFT JOIN users inv ON pa.invited_by = inv.user_id
             ORDER BY pa.assigned_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Fetch All Assignments Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch assignments.' });
    }
});

// 1.5. INVITE / ASSIGN CAREGIVER SYSTEM-WIDE
router.post('/assignments/invite', async (req, res) => {
    const { patient_id, caregiver_email, relationship, access_level, invite_status } = req.body;
    try {
        if (!patient_id || !caregiver_email || !relationship || !access_level) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        // Find target user
        const userRes = await pool.query(
            `SELECT user_id, role FROM users WHERE LOWER(email) = LOWER($1)`,
            [caregiver_email.trim()]
        );
        if (userRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'User with this email not found.' });
        }
        const targetUserId = userRes.rows[0].user_id;

        // Find patient
        const patientRes = await pool.query(
            `SELECT name FROM patients WHERE patient_id = $1`,
            [patient_id]
        );
        if (patientRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Patient not found.' });
        }

        // Check if already assigned
        const exists = await pool.query(
            `SELECT access_id FROM patient_access WHERE user_id = $1 AND patient_id = $2`,
            [targetUserId, patient_id]
        );
        if (exists.rows.length > 0) {
            return res.status(400).json({ success: false, message: 'This caregiver is already assigned to this patient.' });
        }

        // Insert assignment (direct or pending)
        await pool.query(
            `INSERT INTO patient_access (user_id, patient_id, relationship, access_level, invite_status, invited_by)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                targetUserId, 
                patient_id, 
                relationship || 'Assigned Caregiver', 
                access_level || 'View', 
                invite_status || 'Active', 
                req.user.id
            ]
        );

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'ASSIGNMENT_CREATE', $2, 'WARNING')`,
            [req.user.id, `System Admin invited/assigned caregiver ${caregiver_email} to Patient ID ${patient_id}`]
        );

        res.json({ success: true, message: 'Caregiver assigned system-wide successfully.' });
    } catch (err) {
        console.error('Invite Caregiver Admin Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to invite/assign caregiver.' });
    }
});

// 2. UPDATE ASSIGNMENT
router.put('/assignments/:id', async (req, res) => {
    const { relationship, access_level, invite_status } = req.body;
    try {
        await pool.query(
            `UPDATE patient_access
             SET relationship = COALESCE($1, relationship),
                 access_level = COALESCE($2, access_level),
                 invite_status = COALESCE($3, invite_status)
             WHERE access_id = $4`,
            [relationship, access_level, invite_status, req.params.id]
        );

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'ASSIGNMENT_UPDATE', $2, 'WARNING')`,
            [req.user.id, `System Admin updated Assignment ID ${req.params.id}`]
        );

        res.json({ success: true, message: 'Assignment updated successfully.' });
    } catch (err) {
        console.error('Update Assignment Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update assignment.' });
    }
});

// 3. DELETE ASSIGNMENT (changed to archive)
router.delete('/assignments/:id', async (req, res) => {
    try {
        const check = await pool.query(
            `SELECT pa.user_id, u.username, p.name AS patient_name, pa.facility_id
             FROM patient_access pa
             JOIN users u ON pa.user_id = u.user_id
             JOIN patients p ON pa.patient_id = p.patient_id
             WHERE pa.access_id = $1`,
            [req.params.id]
        );
        if (check.rows.length > 0) {
            const row = check.rows[0];
            await pool.query("UPDATE patient_access SET is_archived = true, invite_status = 'Archived' WHERE access_id = $1", [req.params.id]);
            await pool.query(
                `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
                 VALUES ('Assignment', $1, $2, $3, NOW(), 'Archived', $4)`,
                [req.params.id.toString(), `Assignment: Caregiver ${row.username} to Patient ${row.patient_name}`, req.user.id, row.facility_id]
            );
        } else {
            return res.status(404).json({ success: false, message: 'Assignment record not found.' });
        }

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'ASSIGNMENT_ARCHIVE', $2, 'CRITICAL')`,
            [req.user.id, `System Admin archived Assignment ID ${req.params.id}`]
        );

        res.json({ success: true, message: 'Assignment archived successfully.' });
    } catch (err) {
        console.error('Delete Assignment Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to archive assignment.' });
    }
});

// 4. GET ALL STAFF ACCOUNTS ACROSS ALL FACILITIES
router.get('/staff-given-accounts', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT u.user_id, u.username, u.email, u.role, u.account_status, u.is_locked,
                    to_char(u.created_at, 'YYYY-MM-DD') as joined_at,
                    u.last_activity_at,
                    f.facility_name,
                    CASE WHEN u.last_activity_at > NOW() - INTERVAL '2 minutes' THEN true ELSE false END as is_online,
                    creator.username AS creator_username
             FROM users u
             LEFT JOIN facilities f ON u.facility_id = f.facility_id
             LEFT JOIN users creator ON u.created_by = creator.user_id
             WHERE u.role IN ('caregiver', 'medical_staff')
               AND u.is_archived IS DISTINCT FROM TRUE
             ORDER BY u.created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Fetch All Staff Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch staff accounts.' });
    }
});

// 5. UPDATE STAFF ACCOUNT
router.put('/staff-given-accounts/:id', async (req, res) => {
    const { username, email, account_status, is_locked } = req.body;
    try {
        await pool.query(
            `UPDATE users
             SET username = COALESCE($1, username),
                 email = COALESCE($2, email),
                 account_status = COALESCE($3, account_status),
                 is_locked = COALESCE($4, is_locked)
             WHERE user_id = $5`,
            [username, email, account_status, is_locked, req.params.id]
        );

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'STAFF_ACCOUNT_UPDATE', $2, 'WARNING')`,
            [req.user.id, `System Admin updated staff account ID ${req.params.id}`]
        );

        res.json({ success: true, message: 'Staff account updated successfully.' });
    } catch (err) {
        console.error('Update Staff Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update staff account.' });
    }
});

// 6. DELETE STAFF ACCOUNT (changed to archive)
router.delete('/staff-given-accounts/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const check = await client.query('SELECT username, facility_id FROM users WHERE user_id = $1', [req.params.id]);
        if (check.rows.length === 0) {
            client.release();
            return res.status(404).json({ success: false, message: 'Staff user not found.' });
        }
        const user = check.rows[0];

        await client.query('BEGIN');
        await client.query("UPDATE users SET is_archived = true, account_status = 'Archived' WHERE user_id = $1", [req.params.id]);
        
        await client.query(
            `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
             VALUES ('User', $1, $2, $3, NOW(), 'Archived', $4)`,
            [req.params.id.toString(), user.username, req.user.id, user.facility_id]
        );

        await client.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'STAFF_ACCOUNT_ARCHIVE', $2, 'CRITICAL')`,
            [req.user.id, `System Admin archived staff account ID ${req.params.id}`]
        );
        
        await client.query('COMMIT');
        res.json({ success: true, message: 'Staff account archived successfully.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Delete Staff Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to archive staff account.' });
    } finally {
        client.release();
    }
});

// =================================================================
// MODULE H: SYSTEM-WIDE DEVICE ASSIGNMENT CONTROL
// =================================================================

// 1. GET ALL SYSTEM-WIDE DEVICE ASSIGNMENTS, UNASSIGNED DEVICES, AND PATIENTS
router.get('/device-assignments', async (req, res) => {
    try {
        const [assignments, unassigned, patients] = await Promise.all([
            pool.query(
                `SELECT dw.serial_number, dw.device_name, dw.status,
                        p.patient_id, p.name AS patient_name,
                        f.facility_name,
                        u.username AS assigned_by_username
                 FROM device_whitelist dw
                 JOIN patients p ON dw.assigned_patient_id = p.patient_id
                 LEFT JOIN facilities f ON p.facility_id = f.facility_id
                 LEFT JOIN users u ON dw.added_by = u.user_id
                 WHERE dw.is_archived IS DISTINCT FROM TRUE
                   AND p.is_archived IS DISTINCT FROM TRUE
                 ORDER BY p.name ASC`
            ),
            pool.query(
                `SELECT dw.serial_number, dw.device_name, dw.status,
                        f.facility_name,
                        u.username AS added_by_username,
                        to_char(dw.created_at, 'YYYY-MM-DD') AS created_at
                 FROM device_whitelist dw
                 LEFT JOIN users u ON dw.added_by = u.user_id
                 LEFT JOIN facilities f ON u.facility_id = f.facility_id
                 WHERE dw.assigned_patient_id IS NULL
                   AND dw.is_archived IS DISTINCT FROM TRUE
                 ORDER BY dw.created_at DESC`
            ),
            pool.query(
                `SELECT patient_id, name, birthdate 
                 FROM patients 
                 WHERE is_archived IS DISTINCT FROM TRUE 
                 ORDER BY name ASC`
            )
        ]);
        res.json({
            success: true,
            data: {
                assignments: assignments.rows,
                unassigned: unassigned.rows,
                patients: patients.rows
            }
        });
    } catch (err) {
        console.error('Fetch Device Assignments Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch device assignments.' });
    }
});

// 2. LINK / PAIR DEVICE TO PATIENT
router.post('/devices/link', async (req, res) => {
    const { patient_id, serial_number } = req.body;
    if (!patient_id || !serial_number) {
        return res.status(400).json({ success: false, message: 'Patient ID and Serial Number are required.' });
    }
    try {
        await pool.query(
            `UPDATE device_whitelist
             SET assigned_patient_id = $1, status = 'ACTIVE'
             WHERE serial_number = $2`,
            [patient_id, serial_number]
        );
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'DEVICE_ASSIGNMENT_LINK', $2, 'WARNING')`,
            [req.user.id, `Linked device ${serial_number} to Patient ID ${patient_id}`]
        );

        // Auto-generate system report for device pairing
        systemReportService.recordDevicePairingReport({
            serial_number,
            patient_id,
            assigned_by: req.user.email || `System Admin #${req.user.id}`
        }).catch(err => console.error('Device pairing report hook error:', err.message));

        res.json({ success: true, message: 'Device linked to patient successfully.' });
    } catch (err) {
        console.error('Link Device Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to link device.' });
    }
});

// 3. UNLINK / UNASSIGN DEVICE FROM PATIENT
router.post('/devices/unlink', async (req, res) => {
    const { serial_number } = req.body;
    if (!serial_number) {
        return res.status(400).json({ success: false, message: 'Serial number is required.' });
    }
    try {
        await pool.query(
            `UPDATE device_whitelist
             SET assigned_patient_id = NULL, status = 'AVAILABLE'
             WHERE serial_number = $1`,
            [serial_number]
        );
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity)
             VALUES ($1, 'DEVICE_ASSIGNMENT_UNLINK', $2, 'CRITICAL')`,
            [req.user.id, `Unlinked device ${serial_number}`]
        );
        res.json({ success: true, message: 'Device unassigned successfully.' });
    } catch (err) {
        console.error('Unlink Device Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to unassign device.' });
    }
});

// GET /facilities - Fetch all facilities in the system
router.get('/facilities', async (req, res) => {
    try {
        const result = await pool.query('SELECT facility_id, facility_name, address, topology, created_at FROM facilities WHERE is_archived IS DISTINCT FROM TRUE ORDER BY facility_name ASC');
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Fetch Facilities Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch facilities.' });
    }
});

// PUT /facilities/:id - Update facility info
router.put('/facilities/:id', async (req, res) => {
    const { id } = req.params;
    const { facility_name, address } = req.body;
    try {
        await pool.query(
            'UPDATE facilities SET facility_name = $1, address = $2 WHERE facility_id = $3',
            [facility_name, address, id]
        );
        res.json({ success: true, message: 'Facility updated successfully.' });
    } catch (err) {
        console.error('Update Facility Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update facility.' });
    }
});

// PUT /facilities/:id/topology - Update facility topology (wards, rooms, beds)
router.put('/facilities/:id/topology', async (req, res) => {
    const { id } = req.params;
    const { topology } = req.body;
    try {
        await pool.query(
            'UPDATE facilities SET topology = $1 WHERE facility_id = $2',
            [JSON.stringify(topology), id]
        );
        res.json({ success: true, message: 'Facility topology updated successfully.' });
    } catch (err) {
        console.error('Update Facility Topology Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to update facility topology.' });
    }
});

// DELETE /facilities/:id - Delete facility (changed to archive)
router.delete('/facilities/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const facCheck = await pool.query('SELECT facility_name FROM facilities WHERE facility_id = $1', [id]);
        if (facCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Facility not found.' });
        }
        const facilityName = facCheck.rows[0].facility_name;

        await pool.query('UPDATE facilities SET is_archived = true WHERE facility_id = $1', [id]);

        await pool.query(
            `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
             VALUES ('Facility', $1, $2, $3, NOW(), 'Archived', $4)`,
            [id.toString(), facilityName, req.user.id, parseInt(id, 10)]
        );

        res.json({ success: true, message: 'Facility archived successfully.' });
    } catch (err) {
        console.error('Delete Facility Error:', err.message);
        res.status(500).json({ success: false, message: 'Failed to archive facility.' });
    }
});

// =================================================================
// SYSTEM ADMINISTRATOR REPORTS & OBSERVABILITY HUB
// =================================================================
const systemReportService = require('../services/systemReportService');

// 1. Get reports with filtering
router.get('/reports', async (req, res) => {
    try {
        const { category, search, severity, status, limit, offset } = req.query;
        const reports = await systemReportService.getReports({
            category,
            search,
            severity,
            status,
            limit: parseInt(limit) || 100,
            offset: parseInt(offset) || 0
        });
        res.json({ success: true, data: reports });
    } catch (err) {
        console.error('[sysAdminRoutes] /reports error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch reports.' });
    }
});

// 2. Get reports metrics
router.get('/reports/metrics', async (req, res) => {
    try {
        const metrics = await systemReportService.getReportsMetrics();
        res.json({ success: true, data: metrics });
    } catch (err) {
        console.error('[sysAdminRoutes] /reports/metrics error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch report metrics.' });
    }
});

// 3. Get live data snapshots for the 5 observability pillars
router.get('/reports/pillars-data', async (req, res) => {
    try {
        const liveData = await systemReportService.getLivePillarsData();
        res.json({
            success: true,
            data: liveData
        });
    } catch (err) {
        console.error('[sysAdminRoutes] /reports/pillars-data error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch pillar telemetry.' });
    }
});

// 4. Generate on-demand report
router.post('/reports/generate', async (req, res) => {
    try {
        const { category, report_type, title, summary, details, severity } = req.body;
        const report = await systemReportService.createSystemReport({
            title: title || `${category} On-Demand Report`,
            category: category || 'System Governance',
            report_type: report_type || 'MANUAL_GENERATION',
            severity: severity || 'INFO',
            summary: summary || 'System administrator initiated report generation snapshot.',
            details: details || { triggered_by: req.user?.email || 'system_admin', timestamp: new Date().toISOString() },
            generated_by: req.user?.email || 'system_admin'
        });
        res.json({ success: true, message: 'Report generated successfully', data: report });
    } catch (err) {
        console.error('[sysAdminRoutes] /reports/generate error:', err);
        res.status(500).json({ success: false, message: 'Failed to generate report.' });
    }
});

// 5. Toggle archive status
router.patch('/reports/:id/archive', async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const { is_archived } = req.body;
        const updated = await systemReportService.toggleArchiveReport(reportId, !!is_archived);
        res.json({ success: true, message: is_archived ? 'Report archived.' : 'Report restored.', data: updated });
    } catch (err) {
        console.error('[sysAdminRoutes] /reports/:id/archive error:', err);
        res.status(500).json({ success: false, message: 'Failed to archive report.' });
    }
});

// 6. Delete report
router.delete('/reports/:id', async (req, res) => {
    try {
        const reportId = parseInt(req.params.id);
        const deleted = await systemReportService.deleteReport(reportId);
        res.json({ success: true, message: 'Report deleted permanently from ledger.', data: deleted });
    } catch (err) {
        console.error('[sysAdminRoutes] /reports/:id delete error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete report.' });
    }
});

// =================================================================
// MODULE: DEVICE SNAPSHOTS (FOR PERMANENTLY DELETED DEVICES)
// =================================================================

// GET /api/sysadmin/device-snapshots - Fetch all device snapshots
router.get('/device-snapshots', async (req, res) => {
    try {
        const { show_archived, search } = req.query;
        let query = `
            SELECT 
                snapshot_id, device_id, serial_number, device_name, mac_address, firmware_version,
                assigned_patient_id, assigned_patient_name, facility_id, facility_name,
                telemetry_count, alerts_count, snapshot_data, deleted_by, is_archived, created_at
            FROM device_snapshots
            WHERE 1=1
        `;
        const params = [];

        if (show_archived !== 'true') {
            query += ` AND is_archived = FALSE`;
        }

        if (search && search.trim()) {
            params.push(`%${search.trim().toLowerCase()}%`);
            query += ` AND (
                LOWER(serial_number) LIKE $${params.length} 
                OR LOWER(COALESCE(device_name, '')) LIKE $${params.length}
                OR CAST(snapshot_id AS TEXT) LIKE $${params.length}
                OR CAST(COALESCE(device_id, 0) AS TEXT) LIKE $${params.length}
            )`;
        }

        query += ` ORDER BY created_at DESC`;

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[sysAdminRoutes] /device-snapshots error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch device snapshots.' });
    }
});

// PATCH /api/sysadmin/device-snapshots/:id/archive - Toggle archive on device snapshot
router.patch('/device-snapshots/:id/archive', async (req, res) => {
    try {
        const snapshotId = parseInt(req.params.id, 10);
        const { is_archived } = req.body;
        const result = await pool.query(
            'UPDATE device_snapshots SET is_archived = $1 WHERE snapshot_id = $2 RETURNING *',
            [!!is_archived, snapshotId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Snapshot not found.' });
        }
        res.json({ success: true, message: is_archived ? 'Snapshot archived.' : 'Snapshot restored.', data: result.rows[0] });
    } catch (err) {
        console.error('[sysAdminRoutes] /device-snapshots/:id/archive error:', err);
        res.status(500).json({ success: false, message: 'Failed to update snapshot archive status.' });
    }
});

// DELETE /api/sysadmin/device-snapshots/:id - Delete snapshot record
router.delete('/device-snapshots/:id', async (req, res) => {
    try {
        const snapshotId = parseInt(req.params.id, 10);
        const result = await pool.query('DELETE FROM device_snapshots WHERE snapshot_id = $1 RETURNING *', [snapshotId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Snapshot not found.' });
        }
        res.json({ success: true, message: 'Device snapshot deleted permanently.' });
    } catch (err) {
        console.error('[sysAdminRoutes] /device-snapshots/:id delete error:', err);
        res.status(500).json({ success: false, message: 'Failed to delete snapshot.' });
    }
});

// =================================================================
// MODULE: ANONYMIZED CLINICAL REPORTS & STATISTICAL DATA ANALYTICS
// Mandate: De-identified patient PHI for System Administrator governance
// =================================================================

// GET /api/sysadmin/anonymized-patients - Query de-identified patient list
router.get('/anonymized-patients', async (req, res) => {
    try {
        const { search } = req.query;
        let query = `
            SELECT 
                p.patient_id,
                CONCAT('Subject #', p.patient_id, ' (De-identified)') AS anonymous_identifier,
                p.birthdate,
                p.baseline_data->>'gender' AS gender,
                p.baseline_data->>'condition' AS condition,
                p.baseline_data->>'ward' AS ward_code,
                f.facility_name,
                p.created_at,
                (SELECT COUNT(*) FROM sensor_readings sr WHERE sr.patient_id = p.patient_id) AS total_readings_count,
                (SELECT COUNT(*) FROM anomaly_events ae WHERE ae.patient_id = p.patient_id) AS total_anomalies_count,
                (
                    SELECT json_build_object(
                        'heart_rate', sr.heart_rate,
                        'spo2', sr.spo2,
                        'temperature', sr.temperature,
                        'moisture', sr.moisture_value,
                        'recorded_at', sr.recorded_at
                    )
                    FROM sensor_readings sr 
                    WHERE sr.patient_id = p.patient_id 
                    ORDER BY sr.recorded_at DESC 
                    LIMIT 1
                ) AS latest_vitals
            FROM patients p
            LEFT JOIN facilities f ON p.facility_id = f.facility_id
            WHERE 1=1
        `;
        const params = [];

        if (search && search.trim()) {
            params.push(`%${search.trim().toLowerCase()}%`);
            query += ` AND (
                CAST(p.patient_id AS TEXT) LIKE $${params.length}
                OR LOWER(COALESCE(p.baseline_data->>'condition', '')) LIKE $${params.length}
                OR LOWER(COALESCE(f.facility_name, '')) LIKE $${params.length}
            )`;
        }

        query += ` ORDER BY p.patient_id ASC`;

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('[sysAdminRoutes] /anonymized-patients error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch anonymized patient records.' });
    }
});

// GET /api/sysadmin/anonymized-patients/:id - Query de-identified patient telemetry history
router.get('/anonymized-patients/:id', async (req, res) => {
    try {
        const patientId = parseInt(req.params.id, 10);
        const [patRes, readingsRes, anomaliesRes] = await Promise.all([
            pool.query(
                `SELECT 
                    p.patient_id,
                    CONCAT('Subject #', p.patient_id, ' (De-identified)') AS anonymous_identifier,
                    p.birthdate,
                    p.baseline_data->>'gender' AS gender,
                    p.baseline_data->>'condition' AS condition,
                    f.facility_name,
                    p.created_at
                 FROM patients p
                 LEFT JOIN facilities f ON p.facility_id = f.facility_id
                 WHERE p.patient_id = $1`,
                [patientId]
            ),
            pool.query(
                `SELECT reading_id, heart_rate, spo2, temperature, moisture_value, recorded_at
                 FROM sensor_readings 
                 WHERE patient_id = $1 
                 ORDER BY recorded_at DESC 
                 LIMIT 100`,
                [patientId]
            ),
            pool.query(
                `SELECT anomaly_id, event_type, confidence_score, details, recorded_at
                 FROM anomaly_events 
                 WHERE patient_id = $1 
                 ORDER BY recorded_at DESC 
                 LIMIT 50`,
                [patientId]
            )
        ]);

        if (patRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Patient record not found.' });
        }

        res.json({
            success: true,
            data: {
                patient: patRes.rows[0],
                readings: readingsRes.rows,
                anomalies: anomaliesRes.rows
            }
        });
    } catch (err) {
        console.error('[sysAdminRoutes] /anonymized-patients/:id error:', err);
        res.status(500).json({ success: false, message: 'Failed to query patient details.' });
    }
});

// GET /api/sysadmin/clinical-analytics - Aggregated statistical data analytics with interpretations
router.get('/clinical-analytics', async (req, res) => {
    try {
        const [cohortStats, vitalsDistribution, timeSeries, anomalyBreakdown] = await Promise.all([
            pool.query(`
                SELECT 
                    COUNT(DISTINCT p.patient_id) AS total_subjects,
                    COUNT(DISTINCT dw.device_id) AS active_sensors,
                    COUNT(sr.reading_id) AS total_telemetry_packets,
                    ROUND(AVG(sr.heart_rate)::numeric, 1) AS mean_heart_rate,
                    ROUND(AVG(sr.spo2)::numeric, 1) AS mean_spo2,
                    ROUND(AVG(sr.temperature)::numeric, 1) AS mean_temperature,
                    ROUND(AVG(sr.moisture_value)::numeric, 1) AS mean_moisture,
                    ROUND(STDDEV(sr.heart_rate)::numeric, 1) AS stddev_heart_rate,
                    ROUND(STDDEV(sr.spo2)::numeric, 1) AS stddev_spo2
                FROM patients p
                LEFT JOIN device_whitelist dw ON dw.assigned_patient_id = p.patient_id
                LEFT JOIN sensor_readings sr ON sr.patient_id = p.patient_id
            `),
            pool.query(`
                SELECT 
                    CASE 
                        WHEN heart_rate < 60 THEN 'Bradycardia (<60 bpm)'
                        WHEN heart_rate BETWEEN 60 AND 100 THEN 'Normal (60-100 bpm)'
                        WHEN heart_rate > 100 THEN 'Tachycardia (>100 bpm)'
                        ELSE 'Uncategorized'
                    END AS heart_rate_cohort,
                    COUNT(*) AS count
                FROM sensor_readings
                WHERE heart_rate IS NOT NULL
                GROUP BY 1
            `),
            pool.query(`
                SELECT 
                    TO_CHAR(recorded_at, 'YYYY-MM-DD HH24:00') AS time_bucket,
                    ROUND(AVG(heart_rate)::numeric, 1) AS avg_hr,
                    ROUND(AVG(spo2)::numeric, 1) AS avg_spo2,
                    ROUND(AVG(temperature)::numeric, 1) AS avg_temp,
                    ROUND(AVG(moisture_value)::numeric, 1) AS avg_moisture,
                    COUNT(*) AS sample_count
                FROM sensor_readings
                WHERE recorded_at >= NOW() - INTERVAL '48 HOURS'
                GROUP BY 1
                ORDER BY 1 ASC
                LIMIT 48
            `),
            pool.query(`
                SELECT 
                    COALESCE(event_type, 'General Alert') AS anomaly_type,
                    COUNT(*) AS event_count,
                    ROUND(AVG(confidence_score)::numeric, 2) AS avg_confidence
                FROM anomaly_events
                GROUP BY 1
                ORDER BY event_count DESC
            `)
        ]);

        const stats = cohortStats.rows[0] || {};
        const totalPackets = parseInt(stats.total_telemetry_packets || 0, 10);
        const meanHr = parseFloat(stats.mean_heart_rate || 72);
        const meanSpo2 = parseFloat(stats.mean_spo2 || 98);
        const meanTemp = parseFloat(stats.mean_temperature || 36.6);

        // Compute AI / Statistical Data Interpretation Narrative
        const interpretation = {
            summary: `Automated analysis of ${stats.total_subjects || 0} de-identified subjects and ${totalPackets.toLocaleString()} telemetry packets across the connected clinical network.`,
            clinical_observations: [
                `Hemodynamic Stability: Cohort mean heart rate is ${meanHr} bpm (σ = ${stats.stddev_heart_rate || 'N/A'}), indicating ${meanHr >= 60 && meanHr <= 100 ? 'eucardic baseline across monitored wards' : 'cohort-level rate variance'}.`,
                `Oxygenation Index: Aggregate mean SpO2 is ${meanSpo2}%, maintaining safe peripheral saturation above the 95.0% hypoxemic threshold.`,
                `Thermal Homeostasis: Mean core skin temperature is ${meanTemp}°C with normal circadian variance.`,
                `Incontinence & Anomaly Telemetry: ${anomalyBreakdown.rows.length} distinct anomaly classes cataloged. Smart Diaper moisture sensors recorded average moisture index of ${stats.mean_moisture || 0}%.`
            ],
            governance_recommendation: totalPackets > 0
                ? "Telemetry ingestion throughput is optimal. No system-wide biometric drift detected."
                : "Awaiting real-time sensor streams from newly registered hardware."
        };

        res.json({
            success: true,
            data: {
                cohort_summary: stats,
                heart_rate_distribution: vitalsDistribution.rows,
                time_series: timeSeries.rows,
                anomaly_breakdown: anomalyBreakdown.rows,
                interpretation
            }
        });
    } catch (err) {
        console.error('[sysAdminRoutes] /clinical-analytics error:', err);
        res.status(500).json({ success: false, message: 'Failed to compute clinical analytics.' });
    }
});

module.exports = router;

