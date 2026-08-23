const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// Secure all routes with JWT verification
router.use(verifyToken);

// Helper: Checks for pending schedules that are due and writes permanent alert_notifications records for them.
const recordDueSchedules = async () => {
    try {
        const dueSchedules = await pool.query(`
            SELECT s.schedule_id, s.patient_name, s.event_type, s.custom_event_name, s.scheduled_at, p.patient_id
            FROM schedules s
            JOIN patients p ON LOWER(p.name) = LOWER(s.patient_name)
            WHERE s.status = 'Pending' AND s.scheduled_at <= NOW()
        `);

        for (const s of dueSchedules.rows) {
            const existing = await pool.query(
                `SELECT event_id FROM anomaly_events WHERE anomaly_type = 'schedule_due' AND reading_id = $1`,
                [s.schedule_id]
            );

            if (existing.rowCount === 0) {
                const eventResult = await pool.query(
                    `INSERT INTO anomaly_events (patient_id, reading_id, anomaly_type, ocsvm_score)
                     VALUES ($1, $2, 'schedule_due', 0.0)
                     RETURNING event_id`,
                    [s.patient_id, s.schedule_id]
                );
                const eventId = eventResult.rows[0].event_id;

                const msg = `Scheduled task due: ${s.event_type}${s.custom_event_name ? ` - ${s.custom_event_name}` : ''}`;
                await pool.query(
                    `INSERT INTO alert_notifications (event_id, status, message, severity, alert_category)
                     VALUES ($1, 'Sent', $2, 'Warning', 'Clinical')`,
                    [eventId, msg]
                );
            }
        }
    } catch (err) {
        console.error("Error recording due schedules:", err.message);
    }
};

// ==========================================
// 1. GET /clinical - Fetch Patient Alerts
// [HIPAA] Minimum Necessary Rule Enforced
// ==========================================
router.get('/clinical', async (req, res) => {
    try {
        const { role, id: userId } = req.user;
        const patientId = req.query.patientId;
        let query;
        let params = [];

        // Auto-record due schedules first
        await recordDueSchedules();

        // [OWASP A01] Role-Based Data Scoping
        if (role === 'admin' || role === 'sysadmin' || role === 'system_admin') {
            // High-level staff see all active clinical alerts
            query = `
                SELECT a.alert_id, a.alert_category, a.severity, a.status, a.message, a.sent_at, 
                       a.acknowledged_by, a.acknowledged_at, a.action_taken,
                       p.patient_id, p.name as patient_name,
                       e.anomaly_type, e.ocsvm_score
                FROM alert_notifications a
                JOIN anomaly_events e ON a.event_id = e.event_id
                JOIN patients p ON e.patient_id = p.patient_id
                WHERE a.status IS DISTINCT FROM 'Archived'
            `;
            if (patientId) {
                query += ` AND p.patient_id = $1`;
                params.push(parseInt(patientId));
            }
            query += ` ORDER BY a.sent_at DESC LIMIT 100`;
        } else if (role === 'facility_admin') {
            // Facility admin sees alerts from patients they added, assignments they created, or staff they provisioned
            query = `
                SELECT a.alert_id, a.alert_category, a.severity, a.status, a.message, a.sent_at, 
                       a.acknowledged_by, a.acknowledged_at, a.action_taken,
                       p.patient_id, p.name as patient_name,
                       e.anomaly_type, e.ocsvm_score
                FROM alert_notifications a
                JOIN anomaly_events e ON a.event_id = e.event_id
                JOIN patients p ON e.patient_id = p.patient_id
                WHERE a.status IS DISTINCT FROM 'Archived'
                  AND (
                      p.patient_id IN (
                          -- Patients assigned to users they gave an account to
                          SELECT pa.patient_id 
                          FROM patient_access pa
                          JOIN users u ON pa.user_id = u.user_id
                          WHERE u.created_by = $1
                          
                          UNION
                          
                          -- Patients where the admin invited/assigned caregivers
                          SELECT pa2.patient_id
                          FROM patient_access pa2
                          WHERE pa2.invited_by = $1
                          
                          UNION
                          
                          -- Patients registered by this admin
                          SELECT p2.patient_id
                          FROM patients p2
                          WHERE p2.baseline_data->>'created_by' = $1::text
                      )
                  )
            `;
            params = [userId];
            if (patientId) {
                query += ` AND p.patient_id = $2`;
                params.push(parseInt(patientId));
            }
            query += ` ORDER BY a.sent_at DESC LIMIT 100`;
        } else {
            // Caregivers see alerts for assigned patients OR patients paired with their registered devices
            query = `
                SELECT a.alert_id, a.alert_category, a.severity, a.status, a.message, a.sent_at, 
                       a.acknowledged_by, a.acknowledged_at, a.action_taken,
                       p.patient_id, p.name as patient_name,
                       e.anomaly_type, e.ocsvm_score
                FROM alert_notifications a
                JOIN anomaly_events e ON a.event_id = e.event_id
                JOIN patients p ON e.patient_id = p.patient_id
                WHERE a.status IS DISTINCT FROM 'Archived'
                  AND p.patient_id IN (
                    SELECT pa.patient_id FROM patient_access pa WHERE pa.user_id = $1
                    UNION
                    SELECT dw.assigned_patient_id FROM device_whitelist dw WHERE dw.assigned_patient_id IS NOT NULL AND dw.added_by = $1
                  )
            `;
            params = [userId];
            if (patientId) {
                query += ` AND p.patient_id = $2`;
                params.push(parseInt(patientId));
            }
            query += ` ORDER BY a.sent_at DESC LIMIT 50`;
        }

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Clinical Alerts Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch clinical alerts' });
    }
});

// ==========================================
// 1.1. PUT /clinical/archive-bulk - Archive one or many clinical alerts
// ==========================================
router.put('/clinical/archive-bulk', async (req, res) => {
    try {
        const { alertIds } = req.body;
        if (!Array.isArray(alertIds) || alertIds.length === 0) {
            return res.status(400).json({ success: false, message: 'An array of alertIds is required.' });
        }

        await pool.query(
            `UPDATE alert_notifications 
             SET status = 'Archived'
             WHERE alert_id = ANY($1)`,
            [alertIds]
        );

        res.json({ success: true, message: 'Alerts archived successfully.' });
    } catch (err) {
        console.error("Archive Alerts Error:", err.message);
        res.status(500).json({ success: false, message: 'Server Error during archiving' });
    }
});

// ==========================================
// 2. PUT /clinical/:id/acknowledge
// [HIPAA] Non-Repudiable Audit Trail
// ==========================================
router.put('/clinical/:id/acknowledge', async (req, res) => {
    try {
        const alertId = parseInt(req.params.id);
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
             RETURNING alert_id, event_id`,
            [userId, action_taken, resolution_notes || null, alertId]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Alert not found or already acknowledged.' });
        }

        const eventId = result.rows[0].event_id;

        const eventCheck = await pool.query(
            `SELECT anomaly_type, reading_id FROM anomaly_events WHERE event_id = $1`,
            [eventId]
        );

        if (eventCheck.rowCount > 0 && eventCheck.rows[0].anomaly_type === 'schedule_due') {
            const scheduleId = eventCheck.rows[0].reading_id;
            await pool.query(
                `UPDATE schedules SET status = 'Completed' WHERE schedule_id = $1`,
                [scheduleId]
            );
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
        const { role, id: userId } = req.user;
        let query;
        let params;

        if (role === 'admin' || role === 'sysadmin' || role === 'system_admin') {
            query = `
                SELECT h.sys_alert_id, h.alert_type, h.severity, h.description, h.triggered_at, 
                       h.status, h.resolved_at, h.resolution_notes,
                       p.patient_id, p.name as patient_name
                FROM hardware_system_alerts h
                LEFT JOIN patients p ON h.patient_id = p.patient_id
                ORDER BY h.triggered_at DESC
                LIMIT 100
            `;
            params = [];
        } else if (role === 'facility_admin') {
            // Scoped to facility admin's provisioned users, assignments, and their patients and devices
            query = `
                SELECT DISTINCT h.sys_alert_id, h.alert_type, h.severity, h.description, h.triggered_at, 
                       h.status, h.resolved_at, h.resolution_notes,
                       p.patient_id, p.name as patient_name
                FROM hardware_system_alerts h
                LEFT JOIN patients p ON h.patient_id = p.patient_id
                WHERE (
                    p.patient_id IN (
                        -- Patients assigned to users they gave an account to
                        SELECT pa.patient_id 
                        FROM patient_access pa
                        JOIN users u ON pa.user_id = u.user_id
                        WHERE u.created_by = $1
                        
                        UNION
                        
                        -- Patients where the admin invited/assigned caregivers
                        SELECT pa2.patient_id
                        FROM patient_access pa2
                        WHERE pa2.invited_by = $1
                        
                        UNION
                        
                        -- Patients registered by this admin
                        SELECT p2.patient_id
                        FROM patients p2
                        WHERE p2.baseline_data->>'created_by' = $1::text
                    )
                    OR
                    h.device_mac_address IN (
                        SELECT serial_number FROM device_whitelist 
                        WHERE added_by = $1 OR added_by IN (SELECT user_id FROM users WHERE created_by = $1)
                    )
                )
                ORDER BY h.triggered_at DESC
                LIMIT 100
            `;
            params = [userId];
        } else {
            // Scoped to caregiver's/medical staff's/parent's assigned patients or registered devices
            query = `
                SELECT DISTINCT h.sys_alert_id, h.alert_type, h.severity, h.description, h.triggered_at, 
                       h.status, h.resolved_at, h.resolution_notes,
                       p.patient_id, p.name as patient_name
                FROM hardware_system_alerts h
                LEFT JOIN patients p ON h.patient_id = p.patient_id
                LEFT JOIN patient_access pa ON p.patient_id = pa.patient_id
                LEFT JOIN device_whitelist dw ON LOWER(h.device_serial) = LOWER(dw.serial_number)
                WHERE pa.user_id = $1 OR dw.added_by = $1
                ORDER BY h.triggered_at DESC
                LIMIT 50
            `;
            params = [userId];
        }

        const result = await pool.query(query, params);
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
// ==========================================
// 6. GET /schedules - Fetch Patient Schedules
// ==========================================
router.get('/schedules', async (req, res) => {
    try {
        const { role, id: userId } = req.user;
        let query;
        let params;

        // Auto-record due schedules first
        await recordDueSchedules();

        if (role === 'admin' || role === 'sysadmin' || role === 'system_admin' || role === 'facility_admin') {
            query = `
                SELECT a.alert_id, a.alert_category, a.severity, a.status, a.message, a.sent_at, 
                       a.acknowledged_by, a.acknowledged_at, a.action_taken, a.resolution_notes,
                       p.patient_id, p.name as patient_name,
                       e.reading_id as schedule_id
                FROM alert_notifications a
                JOIN anomaly_events e ON a.event_id = e.event_id
                JOIN patients p ON e.patient_id = p.patient_id
                WHERE e.anomaly_type = 'schedule_due'
                ORDER BY a.sent_at DESC
                LIMIT 100
            `;
            params = [];
        } else {
            query = `
                SELECT a.alert_id, a.alert_category, a.severity, a.status, a.message, a.sent_at, 
                       a.acknowledged_by, a.acknowledged_at, a.action_taken, a.resolution_notes,
                       p.patient_id, p.name as patient_name,
                       e.reading_id as schedule_id
                FROM alert_notifications a
                JOIN anomaly_events e ON a.event_id = e.event_id
                JOIN patients p ON e.patient_id = p.patient_id
                WHERE e.anomaly_type = 'schedule_due' AND p.patient_id IN (
                    SELECT pa.patient_id FROM patient_access pa WHERE pa.user_id = $1
                    UNION
                    SELECT dw.assigned_patient_id FROM device_whitelist dw WHERE dw.assigned_patient_id IS NOT NULL AND dw.added_by = $1
                )
                ORDER BY a.sent_at DESC
                LIMIT 50
            `;
            params = [userId];
        }

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("Fetch Alert Schedules Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch schedules' });
    }
});

// ==========================================
// 7. PUT /schedules/:id/acknowledge
// ==========================================
router.put('/schedules/:id/acknowledge', async (req, res) => {
    try {
        const scheduleId = parseInt(req.params.id);
        const userId = req.user.id;
        const { action_taken } = req.body;

        // Find corresponding alert notification
        const alertRes = await pool.query(
            `SELECT a.alert_id FROM alert_notifications a
             JOIN anomaly_events e ON a.event_id = e.event_id
             WHERE e.anomaly_type = 'schedule_due' AND e.reading_id = $1 AND a.status != 'Acknowledged'`,
            [scheduleId]
        );

        if (alertRes.rowCount > 0) {
            const alertId = alertRes.rows[0].alert_id;
            await pool.query(
                `UPDATE alert_notifications 
                 SET status = 'Acknowledged',
                     acknowledged_by = $1,
                     acknowledged_at = NOW(),
                     action_taken = $2
                 WHERE alert_id = $3`,
                [userId, action_taken || 'Completed via schedule tab', alertId]
            );
        }

        // Update the schedule itself
        const result = await pool.query(
            `UPDATE schedules 
             SET status = 'Completed' 
             WHERE schedule_id = $1 AND status != 'Completed'
             RETURNING schedule_id`,
            [scheduleId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Schedule not found or already completed.' });
        }
        res.json({ success: true, message: 'Schedule completed successfully.' });
    } catch (err) {
        console.error("Acknowledge Schedule Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to complete schedule.' });
    }
});

// ==========================================
// 6. GET /unified - Fetch Unified Notifications (Clinical, Hardware, and Broadcasts)
// ==========================================
router.get('/unified', async (req, res) => {
    try {
        const { role, id: userId } = req.user;
        
        // 1. Fetch clinical alerts
        let clinicalQuery;
        let clinicalParams = [];
        if (role === 'admin' || role === 'sysadmin' || role === 'system_admin') {
            clinicalQuery = `
                SELECT a.alert_id, a.alert_category, a.severity, a.status, a.message, a.sent_at as timestamp, 
                       p.name as patient_name
                FROM alert_notifications a
                JOIN anomaly_events e ON a.event_id = e.event_id
                JOIN patients p ON e.patient_id = p.patient_id
                WHERE a.status IS DISTINCT FROM 'Archived'
                ORDER BY a.sent_at DESC LIMIT 50
            `;
        } else if (role === 'facility_admin') {
            clinicalQuery = `
                SELECT a.alert_id, a.alert_category, a.severity, a.status, a.message, a.sent_at as timestamp, 
                       p.name as patient_name
                FROM alert_notifications a
                JOIN anomaly_events e ON a.event_id = e.event_id
                JOIN patients p ON e.patient_id = p.patient_id
                WHERE a.status IS DISTINCT FROM 'Archived'
                  AND p.patient_id IN (
                      SELECT pa.patient_id FROM patient_access pa JOIN users u ON pa.user_id = u.user_id WHERE u.created_by = $1
                      UNION
                      SELECT pa2.patient_id FROM patient_access pa2 WHERE pa2.invited_by = $1
                      UNION
                      SELECT p2.patient_id FROM patients p2 WHERE p2.baseline_data->>'created_by' = $1::text
                  )
                ORDER BY a.sent_at DESC LIMIT 50
            `;
            clinicalParams = [userId];
        } else {
            clinicalQuery = `
                SELECT a.alert_id, a.alert_category, a.severity, a.status, a.message, a.sent_at as timestamp, 
                       p.name as patient_name
                FROM alert_notifications a
                JOIN anomaly_events e ON a.event_id = e.event_id
                JOIN patients p ON e.patient_id = p.patient_id
                WHERE a.status IS DISTINCT FROM 'Archived'
                  AND p.patient_id IN (
                      SELECT pa.patient_id FROM patient_access pa WHERE pa.user_id = $1
                      UNION
                      SELECT dw.assigned_patient_id FROM device_whitelist dw WHERE dw.assigned_patient_id IS NOT NULL AND dw.added_by = $1
                  )
                ORDER BY a.sent_at DESC LIMIT 50
            `;
            clinicalParams = [userId];
        }
        
        // 2. Fetch system hardware alerts
        let systemQuery;
        let systemParams = [];
        if (role === 'admin' || role === 'sysadmin' || role === 'system_admin') {
            systemQuery = `
                SELECT h.sys_alert_id, h.severity, h.status, h.description as message, h.triggered_at as timestamp,
                       p.name as patient_name
                FROM hardware_system_alerts h
                LEFT JOIN patients p ON h.patient_id = p.patient_id
                WHERE h.status IS DISTINCT FROM 'Archived'
                ORDER BY h.triggered_at DESC LIMIT 50
            `;
        } else if (role === 'facility_admin') {
            systemQuery = `
                SELECT DISTINCT h.sys_alert_id, h.severity, h.status, h.description as message, h.triggered_at as timestamp,
                       p.name as patient_name
                FROM hardware_system_alerts h
                LEFT JOIN patients p ON h.patient_id = p.patient_id
                WHERE h.status IS DISTINCT FROM 'Archived'
                  AND (
                      p.patient_id IN (
                          SELECT pa.patient_id FROM patient_access pa JOIN users u ON pa.user_id = u.user_id WHERE u.created_by = $1
                          UNION
                          SELECT pa2.patient_id FROM patient_access pa2 WHERE pa2.invited_by = $1
                          UNION
                          SELECT p2.patient_id FROM patients p2 WHERE p2.baseline_data->>'created_by' = $1::text
                      )
                      OR
                      h.device_mac_address IN (
                          SELECT serial_number FROM device_whitelist 
                          WHERE added_by = $1 OR added_by IN (SELECT user_id FROM users WHERE created_by = $1)
                      )
                  )
                ORDER BY h.triggered_at DESC LIMIT 50
            `;
            systemParams = [userId];
        } else {
            systemQuery = `
                SELECT DISTINCT h.sys_alert_id, h.severity, h.status, h.description as message, h.triggered_at as timestamp,
                       p.name as patient_name
                FROM hardware_system_alerts h
                LEFT JOIN patients p ON h.patient_id = p.patient_id
                LEFT JOIN patient_access pa ON p.patient_id = pa.patient_id
                LEFT JOIN device_whitelist dw ON LOWER(h.device_mac_address) = LOWER(dw.serial_number)
                WHERE h.status IS DISTINCT FROM 'Archived'
                  AND (pa.user_id = $1 OR dw.added_by = $1)
                ORDER BY h.triggered_at DESC LIMIT 50
            `;
            systemParams = [userId];
        }

        // 3. Fetch Broadcast Announcements
        let announcementsQuery;
        let announcementsParams = [];
        if (role === 'admin' || role === 'sysadmin' || role === 'system_admin') {
            announcementsQuery = `
                SELECT a.id as announcement_id, a.title, a.message, a.created_at as timestamp,
                       'announcement' as alert_category
                FROM announcements a
                ORDER BY a.created_at DESC LIMIT 100
            `;
            announcementsParams = [];
        } else {
            announcementsQuery = `
                SELECT a.id as announcement_id, a.title, a.message, a.created_at as timestamp,
                       'announcement' as alert_category
                FROM announcements a
                LEFT JOIN users u ON a.created_by = u.user_id
                WHERE 
                    -- Rule 1: System Admin announcements are global
                    u.role IN ('system_admin', 'sysadmin', 'admin')
                    
                    -- Rule 2: Announcement creator is the user themselves
                    OR a.created_by = $1
                    
                    -- Rule 3: Announcement creator is the user's provisioner (Facility Admin created this caregiver/medstaff/parent)
                    OR a.created_by = (SELECT created_by FROM users WHERE user_id = $1)
                    
                    -- Rule 4: User is a staff member (caregiver/medstaff) sharing the same non-null facility as the announcement creator
                    OR (
                        (SELECT role FROM users WHERE user_id = $1) IN ('caregiver', 'medical_staff')
                        AND u.facility_id IS NOT NULL 
                        AND u.facility_id = (SELECT facility_id FROM users WHERE user_id = $1)
                    )
                    
                    -- Rule 5: User has clinical access to patients registered by the creator or in their facility
                    OR $1 IN (
                        SELECT pa.user_id 
                        FROM patient_access pa 
                        JOIN patients p ON pa.patient_id = p.patient_id 
                        WHERE p.baseline_data->>'created_by' = a.created_by::text
                           OR (p.facility_id IS NOT NULL AND p.facility_id = u.facility_id)
                    )
                ORDER BY a.created_at DESC LIMIT 50
            `;
            announcementsParams = [userId];
        }

        const [clinicalRes, systemRes, announcementsRes] = await Promise.all([
            pool.query(clinicalQuery, clinicalParams),
            pool.query(systemQuery, systemParams),
            pool.query(announcementsQuery, announcementsParams)
        ]);

        // Format & Merge
        const notifications = [
            ...clinicalRes.rows.map(r => ({
                id: `clinical_${r.alert_id}`,
                type: 'clinical',
                title: `${r.alert_category} Alert`,
                message: r.message,
                severity: r.severity.toLowerCase(),
                timestamp: r.timestamp,
                status: r.status,
                patientName: r.patient_name
            })),
            ...systemRes.rows.map(r => ({
                id: `system_${r.sys_alert_id}`,
                type: 'system',
                title: `Device Issue`,
                message: r.message,
                severity: r.severity.toLowerCase(),
                timestamp: r.timestamp,
                status: r.status,
                patientName: r.patient_name
            })),
            ...announcementsRes.rows.map(r => ({
                id: `announcement_${r.announcement_id}`,
                type: 'announcement',
                title: r.title,
                message: r.message,
                severity: 'normal',
                timestamp: r.timestamp,
                status: 'Sent',
                patientName: null
            }))
        ];

        // Sort latest to oldest
        notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        res.json({ success: true, data: notifications });
    } catch (err) {
        console.error("Unified Notifications Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to fetch unified notifications' });
    }
});

// ==========================================
// 7. PUT /archive-unified-bulk - Archive one or many unified alerts
// ==========================================
router.put('/archive-unified-bulk', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ success: false, message: 'An array of ids is required.' });
        }

        const clinicalIds = [];
        const systemIds = [];
        
        for (const combinedId of ids) {
            if (combinedId.startsWith('clinical_')) {
                clinicalIds.push(parseInt(combinedId.replace('clinical_', '')));
            } else if (combinedId.startsWith('system_')) {
                systemIds.push(parseInt(combinedId.replace('system_', '')));
            }
        }

        const queries = [];
        if (clinicalIds.length > 0) {
            queries.push(pool.query(`UPDATE alert_notifications SET status = 'Archived' WHERE alert_id = ANY($1)`, [clinicalIds]));
        }
        if (systemIds.length > 0) {
            queries.push(pool.query(`UPDATE hardware_system_alerts SET status = 'Archived' WHERE sys_alert_id = ANY($1)`, [systemIds]));
        }

        await Promise.all(queries);
        res.json({ success: true, message: 'Notifications archived successfully.' });
    } catch (err) {
        console.error("Archive Unified Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to archive notifications.' });
    }
});

module.exports = router;
