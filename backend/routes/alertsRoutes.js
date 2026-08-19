const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// Secure all routes with JWT verification
router.use(verifyToken);

// ==========================================
// 1. GET /clinical - Fetch Patient Alerts
// [HIPAA] Minimum Necessary Rule Enforced
// ==========================================
router.get('/clinical', async (req, res) => {
    try {
        const { role, id: userId } = req.user;
        let query;
        let params;

        // [OWASP A01] Role-Based Data Scoping
        if (role === 'admin' || role === 'medical_staff' || role === 'sysadmin' || role === 'system_admin' || role === 'facility_admin') {
            // High-level staff see all active clinical alerts
            query = `
                SELECT a.alert_id, a.alert_category, a.severity, a.status, a.message, a.sent_at, 
                       a.acknowledged_by, a.acknowledged_at, a.action_taken,
                       p.patient_id, p.name as patient_name,
                       e.anomaly_type, e.ocsvm_score
                FROM alert_notifications a
                JOIN anomaly_events e ON a.event_id = e.event_id
                JOIN patients p ON e.patient_id = p.patient_id
                ORDER BY a.sent_at DESC
                LIMIT 100
            `;
            params = [];
        } else {
            // Caregivers ONLY see alerts for assigned patients
            query = `
                SELECT a.alert_id, a.alert_category, a.severity, a.status, a.message, a.sent_at, 
                       a.acknowledged_by, a.acknowledged_at, a.action_taken,
                       p.patient_id, p.name as patient_name,
                       e.anomaly_type, e.ocsvm_score
                FROM alert_notifications a
                JOIN anomaly_events e ON a.event_id = e.event_id
                JOIN patients p ON e.patient_id = p.patient_id
                JOIN patient_access pa ON p.patient_id = pa.patient_id
                WHERE pa.user_id = $1
                ORDER BY a.sent_at DESC
                LIMIT 50
            `;
            params = [userId];
        }

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Clinical Alerts Error:", err.message);
        // [OWASP A10] Generic Error Message
        res.status(500).json({ success: false, message: 'Failed to fetch clinical alerts' });
    }
});

// ==========================================
// 2. PUT /clinical/:id/acknowledge
// [HIPAA] Non-Repudiable Audit Trail
// ==========================================
router.put('/clinical/:id/acknowledge', async (req, res) => {
    try {
        const alertId = req.params.id;
        const userId = req.user.id;
        const { action_taken, resolution_notes } = req.body;

        if (!action_taken || action_taken.trim() === '') {
            return res.status(400).json({ success: false, message: 'An action taken text is required for clinical audit compliance.' });
        }

        const result = await pool.query(
            `UPDATE alert_notifications 
             SET status = 'Acknowledged',
                 acknowledged_by = $1,
                 acknowledged_at = NOW(),
                 action_taken = $2,
                 resolution_notes = $3
             WHERE alert_id = $4 AND status != 'Acknowledged'
             RETURNING alert_id`,
            [userId, action_taken, resolution_notes || null, alertId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Alert not found or already acknowledged.' });
        }

        res.json({ success: true, message: 'Alert acknowledged successfully. Audit trail updated.' });
    } catch (err) {
        console.error("Acknowledge Alert Error:", err.message);
        res.status(500).json({ success: false, message: 'Server Error during acknowledgment' });
    }
});

// ==========================================
// 3. GET /system - Fetch IoT/Hardware Alerts
// ==========================================
router.get('/system', async (req, res) => {
    try {
        const { role } = req.user;
        if (!['admin', 'sysadmin', 'system_admin'].includes(role)) {
            return res.status(403).json({ success: false, message: 'Forbidden. Admin access required.' });
        }

        const query = `
            SELECT h.sys_alert_id, h.alert_type, h.severity, h.description, h.triggered_at, 
                   h.status, h.resolved_at, h.resolution_notes,
                   p.patient_id, p.name as patient_name
            FROM hardware_system_alerts h
            LEFT JOIN patients p ON h.patient_id = p.patient_id
            ORDER BY h.triggered_at DESC
            LIMIT 100
        `;
        const result = await pool.query(query);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("System Alerts Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch system hardware alerts' });
    }
});

// ==========================================
// 4. PUT /system/:id/resolve
// ==========================================
router.put('/system/:id/resolve', async (req, res) => {
    try {
        const alertId = req.params.id;
        const userId = req.user.id;
        const { role } = req.user;
        const { resolution_notes } = req.body;

        if (!['admin', 'sysadmin', 'system_admin'].includes(role)) {
            return res.status(403).json({ success: false, message: 'Forbidden. Admin access required.' });
        }

        const result = await pool.query(
            `UPDATE hardware_system_alerts 
             SET status = 'Resolved',
                 resolved_by = $1,
                 resolved_at = NOW(),
                 resolution_notes = $2
             WHERE sys_alert_id = $3
             RETURNING sys_alert_id`,
            [userId, resolution_notes || 'Resolved by admin', alertId]
        );

        res.json({ success: true, message: 'System alert resolved successfully.' });
    } catch (err) {
        console.error("Resolve System Alert Error:", err.message);
        res.status(500).json({ success: false, message: 'Server Error during resolution' });
    }
});

// ==========================================
// 5. GET /audit - Fetch Security Access Logs
// [OWASP A09] Security Logging Monitor
// ==========================================
router.get('/audit', async (req, res) => {
    try {
        const { role } = req.user;
        if (!['admin', 'sysadmin', 'system_admin'].includes(role)) {
            return res.status(403).json({ success: false, message: 'Forbidden. Admin access required.' });
        }

        const query = `
            SELECT l.log_id, l.action, l.timestamp, l.ip_address, l.status,
                   u.username, u.role
            FROM access_logs l
            LEFT JOIN users u ON l.user_id = u.user_id
            ORDER BY l.timestamp DESC
            LIMIT 200
        `;
        const result = await pool.query(query);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Audit Logs Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch security audit logs' });
    }
});

module.exports = router;
