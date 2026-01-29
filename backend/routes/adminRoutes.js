const router = require('express').Router();
const pool = require('../db');
const { verifyToken, verifyAdmin } = require('../middleware/authMiddleware');
const PDFDocument = require('pdfkit');
const nodemailer = require('nodemailer');

// Apply Security Middleware to ALL routes in this file
router.use(verifyToken);
router.use(verifyAdmin);

// =================================================================
// MODULE A: COMPLIANCE HUB (Audit Logs)
// MANDATE: HIPAA "Audit Controls" & Forensics
// =================================================================
router.get('/audit-logs', async (req, res) => {
    try {
        // [OWASP A05] No injection risk here, but we use LIMIT for performance
        const logs = await pool.query(
            `SELECT a.*, u.username, u.email 
             FROM access_logs a 
             LEFT JOIN users u ON a.user_id = u.user_id 
             ORDER BY a.timestamp DESC 
             LIMIT 100`
        );
        res.json({ success: true, data: logs.rows });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// =================================================================
// MODULE B: DEVICE GOVERNANCE (Whitelist)
// MANDATE: Prevent Rogue IoT Devices
// =================================================================
router.post('/whitelist-device', async (req, res) => {
    try {
        const { mac_address, device_name } = req.body;

        // [OWASP A05] Parameterized Query
        await pool.query(
            `INSERT INTO device_whitelist (mac_address, device_name, added_by)
             VALUES ($1, $2, $3)`,
            [mac_address, device_name, req.user.id]
        );

        // [OWASP A09] Log the action
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected) VALUES ($1, 'DEVICE_WHITELIST_ADD', $2)`,
            [req.user.id, `MAC: ${mac_address}`]
        );

        res.json({ success: true, message: 'Device whitelisted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =================================================================
// MODULE C: IAM (User Management)
// MANDATE: Admin capability to Lock/Unlock compromised users
// =================================================================
router.post('/users/:id/lock', async (req, res) => {
    try {
        const { id } = req.params;
        const { lock } = req.body; // true = lock, false = unlock

        await pool.query(
            'UPDATE users SET is_locked = $1, account_status = $2 WHERE user_id = $3',
            [lock, lock ? 'Locked' : 'Active', id]
        );

        // [Compliance] Log who locked whom
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity) 
             VALUES ($1, $2, $3, 'CRITICAL')`,
            [req.user.id, lock ? 'USER_LOCK' : 'USER_UNLOCK', `Target User: ${id}`]
        );

        res.json({ success: true, message: `User ${lock ? 'Locked' : 'Unlocked'}` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =================================================================
// MODULE D: SYSTEM CONFIG (Dynamic Thresholds)
// =================================================================
router.post('/system-config', async (req, res) => {
    try {
        const { config_key, config_value } = req.body;

        // [DPA] Ensure configurations are traceable
        await pool.query(
            `INSERT INTO system_configs (config_key, config_value, updated_by)
             VALUES ($1, $2, $3)
             ON CONFLICT (config_key) 
             DO UPDATE SET config_value = $2, updated_by = $3, updated_at = NOW()`,
            [config_key, config_value, req.user.id]
        );

        res.json({ success: true, message: 'System configuration updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =================================================================
// MODULE E: SYSTEM HEALTH STATS (Dashboard Widgets)
// MANDATE: ISO 25010 "Operational Reliability" & Observability
// =================================================================
router.get('/stats', async (req, res) => {
    try {
        // Run queries in parallel for performance
        const [patientCount, alertCount, deviceCount, userCount] = await Promise.all([
            // 1. Total Active Patients
            pool.query("SELECT COUNT(*) FROM patients WHERE is_archived = FALSE"),
            
            // 2. Unresolved Critical Alerts (Patient Safety)
            pool.query("SELECT COUNT(*) FROM alert_notifications WHERE severity = 'critical' AND status = 'unread'"),
            
            // 3. Online IoT Devices (Connectivity Check)
            // Note: Assuming you have a 'status' or 'last_heartbeat' column. 
            // If not, we count total whitelisted devices for now.
            pool.query("SELECT COUNT(*) FROM device_whitelist WHERE status = 'ACTIVE'"),

            // 4. Pending User Verifications (Admin Workload)
            pool.query("SELECT COUNT(*) FROM users WHERE account_status = 'Pending_Review'")
        ]);

        res.json({
            success: true,
            data: {
                total_patients: parseInt(patientCount.rows[0].count),
                critical_alerts: parseInt(alertCount.rows[0].count),
                online_devices: parseInt(deviceCount.rows[0].count),
                pending_users: parseInt(userCount.rows[0].count),
                system_status: 'OPERATIONAL', // Logic can be added later
                uptime: process.uptime() // Server uptime in seconds
            }
        });
    } catch (err) {
        console.error("Stats Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch system stats' });
    }
});

// =================================================================
// MODULE F: IAM (User List)
// MANDATE: HIPAA "Workforce Security" & ISO 27001 Access Control
// =================================================================
router.get('/users', async (req, res) => {
    try {
        // [Privacy] We DO NOT select password_hashes
        const result = await pool.query(
            `SELECT user_id, username, email, role, 
                    account_status, is_locked, 
                    to_char(created_at, 'YYYY-MM-DD HH24:MI') as joined_at
             FROM users 
             WHERE role != 'admin' -- Admins cannot delete other Admins via UI (Safety)
             ORDER BY created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("IAM Fetch Error:", err.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// =================================================================
// MODULE G: DYNAMIC CONFIGURATION (GET Routes)
// =================================================================
router.get('/system-config', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM system_configs');
        // Convert rows to a simple object { key: value }
        const configMap = {};
        result.rows.forEach(row => {
            configMap[row.config_key] = row.config_value;
        });
        res.json({ success: true, data: configMap });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =================================================================
// MODULE H: LEGAL CMS (Privacy Policy Management)
// MANDATE: DPA 2012 "Right to be Informed" (Versioning)
// =================================================================
router.get('/legal-docs', async (req, res) => {
    try {
        // Fetch the latest active version of each document type
        const result = await pool.query(
            `SELECT DISTINCT ON (doc_type) * FROM legal_documents 
             WHERE is_active = TRUE 
             ORDER BY doc_type, published_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/legal-docs', async (req, res) => {
    const client = await pool.connect();
    try {
        const { doc_type, title, content, version } = req.body;
        
        await client.query('BEGIN');

        // 1. Deactivate old versions
        await client.query(
            "UPDATE legal_documents SET is_active = FALSE WHERE doc_type = $1",
            [doc_type]
        );

        // 2. Insert new version
        await client.query(
            `INSERT INTO legal_documents (doc_type, title, content, version, is_active, created_by)
             VALUES ($1, $2, $3, $4, TRUE, $5)`,
            [doc_type, title, content, version, req.user.id]
        );

        // 3. Log the update (Compliance)
        await client.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity) 
             VALUES ($1, 'LEGAL_DOC_UPDATE', $2, 'WARNING')`,
            [req.user.id, `${doc_type} updated to ${version}`]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'Legal document published successfully' });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
});

// =================================================================
// MODULE I: IOT FLEET MANAGEMENT
// MANDATE: OWASP IoT Top 10 (Device Management)
// =================================================================
router.get('/devices', async (req, res) => {
    try {
        // Fetch all devices + name of the admin who added them
        const result = await pool.query(
            `SELECT d.*, u.username as added_by_name 
             FROM device_whitelist d
             LEFT JOIN users u ON d.added_by = u.user_id
             ORDER BY d.created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// [Security] The IoT Kill Switch
router.put('/devices/:mac/status', async (req, res) => {
    try {
        const { mac } = req.params;
        const { status } = req.body; // 'ACTIVE', 'REVOKED', 'MAINTENANCE'

        await pool.query(
            'UPDATE device_whitelist SET status = $1 WHERE mac_address = $2',
            [status, mac]
        );

        // [Compliance] Log the revocation
        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected, severity) 
             VALUES ($1, 'DEVICE_STATUS_CHANGE', $2, 'CRITICAL')`,
            [req.user.id, `Device ${mac} set to ${status}`]
        );

        res.json({ success: true, message: `Device status updated to ${status}` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =================================================================
// MODULE J: FORENSIC EXPORT (PDF Generation)
// MANDATE: HIPAA § 164.312(b) "Audit Controls" (Documentation)
// =================================================================
router.get('/audit-logs/export', async (req, res) => {
    try {
        // 1. Fetch Logs
        const result = await pool.query(
            `SELECT a.timestamp, a.action, a.severity, a.ip_address, 
                    u.username, a.resource_affected 
             FROM access_logs a 
             LEFT JOIN users u ON a.user_id = u.user_id 
             ORDER BY a.timestamp DESC 
             LIMIT 1000` // Cap at 1000 for performance
        );

        // 2. Setup PDF Stream
        const doc = new PDFDocument({ margin: 50 });

        // Set headers to force download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Alaga_Audit_Report_${Date.now()}.pdf`);

        doc.pipe(res);

        // 3. Document Header
        doc.fontSize(20).text('Alaga System: Forensic Audit Report', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Generated by: ${req.user.role === 'admin' ? 'Administrator' : 'System'}`, { align: 'left' });
        doc.text(`Date: ${new Date().toLocaleString()}`, { align: 'left' });
        doc.moveDown();

        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke(); // Horizontal Line
        doc.moveDown();

        // 4. Draw Table Rows
        doc.fontSize(10);

        result.rows.forEach((log, i) => {
            const y = doc.y;

            // Color code critical events
            if (log.severity === 'CRITICAL') {
                doc.fillColor('red');
            } else if (log.severity === 'WARNING') {
                doc.fillColor('orange');
            } else {
                doc.fillColor('black');
            }

            // Columns: Time | Action | User | IP
            doc.text(new Date(log.timestamp).toLocaleString(), 50, y, { width: 130 });
            doc.text(log.action, 180, y, { width: 120 });
            doc.text(log.username || 'System', 300, y, { width: 100 });
            doc.text(log.ip_address || 'N/A', 400, y, { width: 100 });

            doc.moveDown(0.5); // Spacing

            // Reset color
            doc.fillColor('black');

            // Check for page break
            if (doc.y > 700) {
                doc.addPage();
            }
        });

        // 5. Finalize
        doc.end();

    } catch (err) {
        console.error("PDF Error:", err);
        res.status(500).json({ success: false, message: "Export Failed" });
    }
});

// =================================================================
// MODULE K: INVENTORY & ASSIGNMENT
// MANDATE: ISO 27001 "Asset Management"
// =================================================================

// 1. Get Inventory with Patient Details
router.get('/inventory', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT d.*, p.first_name, p.last_name 
             FROM device_whitelist d
             LEFT JOIN patients p ON d.assigned_patient_id = p.patient_id
             ORDER BY d.created_at DESC`
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. Assign Device to Patient
router.post('/inventory/assign', async (req, res) => {
    const client = await pool.connect();
    try {
        const { mac_address, patient_id } = req.body;

        await client.query('BEGIN');

        // Check if device is already assigned
        const check = await client.query(
            "SELECT * FROM device_whitelist WHERE mac_address = $1 AND assigned_patient_id IS NOT NULL",
            [mac_address]
        );

        if (check.rows.length > 0) {
            throw new Error("Device is already assigned to another patient");
        }

        // Assign
        await client.query(
            "UPDATE device_whitelist SET assigned_patient_id = $1, status = 'ACTIVE' WHERE mac_address = $2",
            [patient_id, mac_address]
        );

        // Update Patient Record (Redundant but useful for quick access)
        await client.query(
            "UPDATE patients SET device_mac_address = $1 WHERE patient_id = $2",
            [mac_address, patient_id]
        );

        // Log it
        await client.query(
            `INSERT INTO access_logs (user_id, action, resource_affected) VALUES ($1, 'DEVICE_ASSIGN', $2)`,
            [req.user.id, `Assigned ${mac_address} to Patient ${patient_id}`]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: "Device assigned successfully" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
});

// 3. Unassign Device (Discharge)
router.post('/inventory/unassign', async (req, res) => {
    const client = await pool.connect();
    try {
        const { mac_address } = req.body;

        await client.query('BEGIN');

        // Get patient ID before removing
        const dev = await client.query("SELECT assigned_patient_id FROM device_whitelist WHERE mac_address = $1", [mac_address]);
        const patient_id = dev.rows[0]?.assigned_patient_id;

        // Unlink
        await client.query(
            "UPDATE device_whitelist SET assigned_patient_id = NULL, status = 'MAINTENANCE' WHERE mac_address = $1",
            [mac_address]
        );

        if (patient_id) {
            await client.query(
                "UPDATE patients SET device_mac_address = NULL WHERE patient_id = $1",
                [patient_id]
            );
        }

        // Log it
        await client.query(
            `INSERT INTO access_logs (user_id, action, resource_affected) VALUES ($1, 'DEVICE_UNASSIGN', $2)`,
            [req.user.id, `Unassigned ${mac_address}`]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: "Device unassigned and set to Maintenance" });
    } catch (err) {
        await client.query('ROLLBACK');
        res.status(500).json({ success: false, message: err.message });
    } finally {
        client.release();
    }
});

// 4. Fetch Active Patients (For Dropdown)
router.get('/patients/active', async (req, res) => {
    try {
        // Only return patients who DO NOT have a device yet
        const result = await pool.query(
            "SELECT patient_id, first_name, last_name FROM patients WHERE device_mac_address IS NULL AND is_archived = FALSE"
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =================================================================
// MODULE L: DISASTER RECOVERY (Backup & Maintenance)
// MANDATE: ISO 25010 "Recoverability"
// =================================================================

// 1. Generate Full System Backup (JSON Snapshot)
router.get('/backup', async (req, res) => {
    try {
        // Fetch data from all critical tables in parallel
        const [users, patients, devices, logs, configs] = await Promise.all([
            pool.query('SELECT * FROM users'),
            pool.query('SELECT * FROM patients'),
            pool.query('SELECT * FROM device_whitelist'),
            pool.query('SELECT * FROM access_logs ORDER BY timestamp DESC LIMIT 5000'),
            pool.query('SELECT * FROM system_configs')
        ]);

        const backupData = {
            timestamp: new Date(),
            version: '1.0',
            tables: {
                users: users.rows,
                patients: patients.rows,
                devices: devices.rows,
                access_logs: logs.rows,
                system_configs: configs.rows
            }
        };

        // Stream response as a file
        const filename = `Alaga_Full_Backup_${Date.now()}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        res.send(JSON.stringify(backupData, null, 2));

        // Audit the backup event
        await pool.query(
            `INSERT INTO access_logs (user_id, action, severity, resource_affected) 
             VALUES ($1, 'SYSTEM_BACKUP', 'WARNING', 'Full Database Export')`,
            [req.user.id]
        );

    } catch (err) {
        console.error("Backup Error:", err);
        res.status(500).json({ success: false, message: "Backup generation failed" });
    }
});

// 2. Toggle Maintenance Mode
router.post('/maintenance', async (req, res) => {
    try {
        const { enabled } = req.body; // true or false

        await pool.query(
            `INSERT INTO system_configs (config_key, config_value, updated_by)
             VALUES ('maintenance_mode', $1, $2)
             ON CONFLICT (config_key) 
             DO UPDATE SET config_value = $1, updated_by = $2, updated_at = NOW()`,
            [JSON.stringify({ enabled }), req.user.id]
        );

        // Audit it
        await pool.query(
            `INSERT INTO access_logs (user_id, action, severity, resource_affected) 
             VALUES ($1, 'MAINTENANCE_TOGGLE', 'CRITICAL', $2)`,
            [req.user.id, enabled ? "System Put into Maintenance Mode" : "System Live"]
        );

        res.json({ success: true, message: `Maintenance Mode ${enabled ? 'ENABLED' : 'DISABLED'}` });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =================================================================
// MODULE M: USER SUPPORT (MFA Reset)
// MANDATE: IT Support Workflow
// =================================================================
router.post('/users/:id/reset-mfa', async (req, res) => {
    try {
        const { id } = req.params;

        await pool.query(
            'UPDATE users SET mfa_secret = NULL, is_mfa_enabled = FALSE WHERE user_id = $1',
            [id]
        );

        // Audit the security event
        await pool.query(
            `INSERT INTO access_logs (user_id, action, severity, resource_affected) 
             VALUES ($1, 'MFA_RESET', 'WARNING', $2)`,
            [req.user.id, `Reset MFA for User ID: ${id}`]
        );

        res.json({ success: true, message: 'MFA credentials cleared. User must re-enroll.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =================================================================
// MODULE N: BROADCAST SYSTEM (Announcements)
// =================================================================
router.get('/announcements', async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM announcements ORDER BY created_at DESC LIMIT 10"
        );
        res.json({ success: true, data: result.rows });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/announcements', async (req, res) => {
    try {
        const { title, message } = req.body;
        
        // Deactivate old active announcements (Optional rule: Only 1 active at a time?)
        // For now, let's just insert a new one.
        
        await pool.query(
            "INSERT INTO announcements (title, message, created_by) VALUES ($1, $2, $3)",
            [title, message, req.user.id]
        );

        res.json({ success: true, message: "Announcement Posted" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/announcements/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM announcements WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "Announcement Deleted" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Edit User Details
router.put('/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { username, email, role } = req.body; // Password change is separate flow

        await pool.query(
            'UPDATE users SET username = COALESCE($1, username), email = COALESCE($2, email), role = COALESCE($3, role) WHERE user_id = $4',
            [username, email, role, id]
        );

        await pool.query(
            `INSERT INTO access_logs (user_id, action, resource_affected) VALUES ($1, 'USER_UPDATE', $2)`,
            [req.user.id, `Updated profile for User ID ${id}`]
        );

        res.json({ success: true, message: "User updated successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =================================================================
// MODULE O: NETWORK SECURITY (IP Ban & Rate Limits)
// MANDATE: ISO 27001 "Network Security Management"
// =================================================================

// 1. Get Security Configs (IPs + Rate Limits)
router.get('/security', async (req, res) => {
    try {
        const [ips, limitConfig] = await Promise.all([
            pool.query("SELECT * FROM ip_blacklist ORDER BY banned_at DESC"),
            pool.query("SELECT config_value FROM system_configs WHERE config_key = 'rate_limit'")
        ]);
        
        res.json({
            success: true,
            data: {
                blacklist: ips.rows,
                rateLimit: limitConfig.rows[0]?.config_value || { windowMs: 15 * 60 * 1000, max: 100 }
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. Ban an IP
router.post('/security/ip-ban', async (req, res) => {
    try {
        const { ip, reason } = req.body;
        await pool.query(
            "INSERT INTO ip_blacklist (ip_address, reason, banned_by) VALUES ($1, $2, $3)",
            [ip, reason, req.user.id]
        );
        res.json({ success: true, message: `IP ${ip} has been banned.` });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to ban IP (Duplicate?)" });
    }
});

// 3. Unban an IP
router.delete('/security/ip-ban/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM ip_blacklist WHERE id = $1", [req.params.id]);
        res.json({ success: true, message: "IP Unbanned." });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4. Update Rate Limits
router.post('/security/rate-limit', async (req, res) => {
    try {
        const { windowMs, max } = req.body;
        await pool.query(
            "UPDATE system_configs SET config_value = $1 WHERE config_key = 'rate_limit'",
            [JSON.stringify({ windowMs, max })]
        );
        res.json({ success: true, message: "Rate limits updated (Requires Server Restart to Apply)" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// =================================================================
// MODULE P: NOTIFICATION GATEWAY (SMTP)
// =================================================================

// 1. Send Test Email (Verifies Credentials)
router.post('/notifications/test-email', async (req, res) => {
    try {
        const { host, port, user, pass, to } = req.body;

        // Create Transporter
        const transporter = nodemailer.createTransport({
            host: host,
            port: port,
            secure: port === 465, // true for 465, false for other ports
            auth: { user, pass }
        });

        // Send Mail
        await transporter.sendMail({
            from: `"Alaga System" <${user}>`,
            to: to,
            subject: "Alaga System: Test Alert",
            text: "If you are reading this, your SMTP configuration is correct. The system can now send critical alerts.",
            html: "<b>Success!</b><br>Your SMTP configuration is valid. The system is ready to send critical alerts."
        });

        // If successful, save these settings to DB so we remember them
        await pool.query(
            `INSERT INTO system_configs (config_key, config_value)
             VALUES ('smtp_config', $1)
             ON CONFLICT (config_key) DO UPDATE SET config_value = $1`,
            [JSON.stringify({ host, port, user, pass })] // Note: Storing pass in plain text for thesis prototype. In prod, encrypt this.
        );

        res.json({ success: true, message: "Test email sent & settings saved!" });

    } catch (err) {
        console.error("SMTP Error:", err);
        res.status(500).json({ success: false, message: "Email Failed: " + err.message });
    }
});

// 2. Get Saved SMTP Config
router.get('/notifications/config', async (req, res) => {
    try {
        const result = await pool.query("SELECT config_value FROM system_configs WHERE config_key = 'smtp_config'");
        res.json({ success: true, data: result.rows[0]?.config_value || {} });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
module.exports = router;