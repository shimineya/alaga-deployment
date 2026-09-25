const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');
const { flagAsNormal } = require('../services/alagarAIService');
const { handleAlertStream, broadcastAlert, setMuteStatus, getMuteStatus } = require('../services/alertRealtimeService');
const { recordHardwareAlert } = require('../services/hardwareDiagnosticsService');

// Secure all routes with JWT verification
router.use(verifyToken);

// Real-time SSE Stream for Instant Web and Mobile Sync
router.get('/events', (req, res) => {
    handleAlertStream(req, res);
});

// Synchronized Mute State across Web and Mobile devices
router.get('/sync-mute', (req, res) => {
    const isMuted = getMuteStatus(req.user?.id);
    res.json({ success: true, isMuted });
});

router.post('/sync-mute', (req, res) => {
    const { isMuted, durationMinutes } = req.body;
    const mutedBool = Boolean(isMuted);
    setMuteStatus(req.user?.id, mutedBool, durationMinutes || 15);

    // Broadcast synchronized mute status to both Web App and Mobile App
    broadcastAlert('alert_sound_mute', {
        userId: req.user?.id,
        isMuted: mutedBool,
        durationMinutes: durationMinutes || 15
    });

    res.json({ success: true, isMuted: mutedBool });
});

// Real-time Sound & Notification Synchronization Test Trigger
router.post('/test-broadcast', async (req, res) => {
    const { severity = 'Critical', patientName = 'Maria Santos', message } = req.body;
    const testMsg = message || (severity.toLowerCase() === 'critical'
        ? 'Heart rate spiked to 134 BPM (Threshold: 100 BPM). Room 302.'
        : 'Smart diaper moisture reached 88%. Diaper change recommended.');
    const testAlert = {
        alert_id: Math.floor(Date.now() / 1000),
        patient_name: patientName,
        severity: severity,
        message: testMsg,
        category: 'Clinical',
        anomaly_type: severity.toLowerCase() === 'critical' ? 'rule_heart_rate' : 'rule_moisture',
        timestamp: new Date().toISOString(),
        playSound: true
    };

    broadcastAlert('new_alert', testAlert);
    broadcastAlert('new_clinical_alert', {
        alert_id: testAlert.alert_id,
        patient_name: patientName,
        severity: testAlert.severity,
        message: testAlert.message,
        anomalyType: testAlert.anomaly_type,
        playSound: true
    });

    res.json({ success: true, message: 'Test alert broadcasted in real time to all logged in sessions.', alert: testAlert });
});


// Helper: Sanitize/anonymize patient names in notification messages for System Administrators (HIPAA/DPA compliance)
function anonymizeMessageForSysAdmin(message, realName, patientId) {
    if (!message) return message;
    if (!realName || !patientId) return message;
    const anonId = `Subject #${patientId} (De-identified)`;
    const escaped = String(realName).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!escaped) return message;
    return message.replace(new RegExp(escaped, 'gi'), anonId);
}

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
                const insertRes = await pool.query(
                    `INSERT INTO alert_notifications (event_id, status, message, severity, alert_category)
                     VALUES ($1, 'Sent', $2, 'Warning', 'Clinical')
                     RETURNING alert_id`,
                    [eventId, msg]
                );
                const alertId = insertRes.rows[0]?.alert_id;

                // Broadcast in real-time to both Web and Mobile apps
                broadcastAlert('new_alert', {
                    alert_id: alertId,
                    patient_id: s.patient_id,
                    patient_name: s.patient_name,
                    severity: 'Warning',
                    message: msg,
                    category: 'Clinical',
                    anomaly_type: 'schedule_due',
                    playSound: true
                });
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
                       e.anomaly_type, e.ocsvm_score,
                       COALESCE(pb.flag_count, pb2.flag_count, 0) as flag_count
                FROM alert_notifications a
                JOIN anomaly_events e ON a.event_id = e.event_id
                JOIN patients p ON e.patient_id = p.patient_id
                LEFT JOIN patient_baselines pb ON pb.patient_id = p.patient_id AND pb.vital_name = e.anomaly_type
                LEFT JOIN patient_baselines pb2 ON pb2.patient_id = p.patient_id AND (
                    (e.anomaly_type LIKE '%heart_rate%' AND pb2.vital_name = 'heart_rate') OR
                    (e.anomaly_type LIKE '%temp%' AND pb2.vital_name = 'temperature') OR
                    (e.anomaly_type LIKE '%spo2%' AND pb2.vital_name = 'spo2') OR
                    (e.anomaly_type LIKE '%moisture%' AND pb2.vital_name = 'moisture') OR
                    (e.anomaly_type = 'ocsvm_anomaly' AND pb2.vital_name IN ('ocsvm_anomaly', 'multi_feature'))
                )
                WHERE a.status IS DISTINCT FROM 'Archived'
                  AND p.is_archived IS DISTINCT FROM TRUE
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
                       e.anomaly_type, e.ocsvm_score,
                       COALESCE(pb.flag_count, pb2.flag_count, 0) as flag_count
                FROM alert_notifications a
                JOIN anomaly_events e ON a.event_id = e.event_id
                JOIN patients p ON e.patient_id = p.patient_id
                LEFT JOIN patient_baselines pb ON pb.patient_id = p.patient_id AND pb.vital_name = e.anomaly_type
                LEFT JOIN patient_baselines pb2 ON pb2.patient_id = p.patient_id AND (
                    (e.anomaly_type LIKE '%heart_rate%' AND pb2.vital_name = 'heart_rate') OR
                    (e.anomaly_type LIKE '%temp%' AND pb2.vital_name = 'temperature') OR
                    (e.anomaly_type LIKE '%spo2%' AND pb2.vital_name = 'spo2') OR
                    (e.anomaly_type LIKE '%moisture%' AND pb2.vital_name = 'moisture') OR
                    (e.anomaly_type = 'ocsvm_anomaly' AND pb2.vital_name IN ('ocsvm_anomaly', 'multi_feature'))
                )
                WHERE a.status IS DISTINCT FROM 'Archived'
                  AND p.is_archived IS DISTINCT FROM TRUE
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
                       e.anomaly_type, e.ocsvm_score,
                       COALESCE(pb.flag_count, pb2.flag_count, 0) as flag_count
                FROM alert_notifications a
                JOIN anomaly_events e ON a.event_id = e.event_id
                JOIN patients p ON e.patient_id = p.patient_id
                LEFT JOIN patient_baselines pb ON pb.patient_id = p.patient_id AND pb.vital_name = e.anomaly_type
                LEFT JOIN patient_baselines pb2 ON pb2.patient_id = p.patient_id AND (
                    (e.anomaly_type LIKE '%heart_rate%' AND pb2.vital_name = 'heart_rate') OR
                    (e.anomaly_type LIKE '%temp%' AND pb2.vital_name = 'temperature') OR
                    (e.anomaly_type LIKE '%spo2%' AND pb2.vital_name = 'spo2') OR
                    (e.anomaly_type LIKE '%moisture%' AND pb2.vital_name = 'moisture') OR
                    (e.anomaly_type = 'ocsvm_anomaly' AND pb2.vital_name IN ('ocsvm_anomaly', 'multi_feature'))
                )
                WHERE a.status IS DISTINCT FROM 'Archived'
                  AND p.is_archived IS DISTINCT FROM TRUE
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

        const isSysAdmin = ['sysadmin', 'system_admin'].includes(role?.toLowerCase());
        const result = await pool.query(query, params);
        const data = result.rows.map(r => {
            const flagCount = parseInt(r.flag_count || 0, 10);
            const remainingFlags = Math.max(0, 5 - flagCount);
            const baseObj = {
                ...r,
                flag_count: flagCount,
                remaining_flags: remainingFlags,
                is_suppressed: flagCount >= 5
            };
            if (isSysAdmin) {
                const anonId = r.patient_id ? `Subject #${r.patient_id} (De-identified)` : 'De-identified Subject';
                const sanitizedMsg = r.patient_name && r.patient_id 
                    ? anonymizeMessageForSysAdmin(r.message, r.patient_name, r.patient_id) 
                    : r.message;
                return {
                    ...baseObj,
                    patient_name: anonId,
                    message: sanitizedMsg,
                    is_anonymized: true
                };
            }
            return baseObj;
        });
        res.json({ success: true, data });
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

        const actorId = req.user ? req.user.id : null;

        // Fetch alert details to log them in archives table
        const detailsRes = await pool.query(
            `SELECT a.alert_id, a.alert_category, a.message, p.facility_id, p.name as patient_name
             FROM alert_notifications a
             LEFT JOIN anomaly_events e ON a.event_id = e.event_id
             LEFT JOIN patients p ON e.patient_id = p.patient_id
             WHERE a.alert_id = ANY($1)`,
            [alertIds]
        );

        await pool.query(
            `UPDATE alert_notifications 
             SET status = 'Archived'
             WHERE alert_id = ANY($1)`,
            [alertIds]
        );

        for (const row of detailsRes.rows) {
            await pool.query(
                `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
                 VALUES ('Clinical Alert', $1, $2, $3, NOW(), 'Archived', $4)`,
                [row.alert_id.toString(), `${row.patient_name || 'System'} - ${row.alert_category || 'Clinical Alert'}: ${row.message || ''}`.substring(0, 255), actorId, row.facility_id]
            );
        }

        // Real-time broadcast to Web and Mobile
        broadcastAlert('alert_archived', { alertIds, type: 'clinical' });

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

        // Real-time broadcast to Web and Mobile
        broadcastAlert('alert_acknowledged', { alertId, userId, action: 'acknowledge' });

        res.json({ success: true, message: 'Alert acknowledged successfully. Audit trail updated.' });
    } catch (err) {
        console.error("Acknowledge Alert Error:", err.message);
        res.status(500).json({ success: false, message: 'Server Error during acknowledgment' });
    }
});

// ==========================================
// 2.1 POST /clinical/:id/flag-normal
// Allows caregivers to flag an alert's pattern as normal.
// After 5 flags, updates the baseline and suppresses future identical alerts.
// ==========================================
router.post('/clinical/:id/flag-normal', async (req, res) => {
    try {
        const alertId = parseInt(req.params.id);
        const userId = req.user.id;
        const clientIp = req.ip || req.connection.remoteAddress;

        // Fetch the alert with anomaly event and patient details
        const alertQuery = await pool.query(
            `SELECT a.alert_id, a.message, a.severity, a.status,
                    e.anomaly_type, e.patient_id, e.reading_id,
                    p.name as patient_name
             FROM alert_notifications a
             JOIN anomaly_events e ON a.event_id = e.event_id
             JOIN patients p ON e.patient_id = p.patient_id
             WHERE a.alert_id = $1`,
            [alertId]
        );

        if (alertQuery.rowCount === 0) {
            return res.status(404).json({ success: false, message: 'Alert not found.' });
        }

        const alert = alertQuery.rows[0];
        const patientId = alert.patient_id;
        const anomalyType = alert.anomaly_type || 'unknown_anomaly';

        // Determine vital name and initial value
        let vitalName = anomalyType;
        let vitalValue = null;

        if (alert.reading_id) {
            const readingRes = await pool.query(
                `SELECT heart_rate, temperature, spo2, moisture FROM sensor_readings WHERE reading_id = $1`,
                [alert.reading_id]
            ).catch(() => ({ rowCount: 0, rows: [] }));

            if (readingRes.rowCount > 0) {
                const r = readingRes.rows[0];
                if (anomalyType.includes('heart_rate')) {
                    vitalName = 'heart_rate';
                    vitalValue = parseFloat(r.heart_rate);
                } else if (anomalyType.includes('temp')) {
                    vitalName = 'temperature';
                    vitalValue = parseFloat(r.temperature);
                } else if (anomalyType.includes('spo2')) {
                    vitalName = 'spo2';
                    vitalValue = parseFloat(r.spo2);
                } else if (anomalyType.includes('moisture')) {
                    vitalName = 'moisture';
                    vitalValue = parseFloat(r.moisture);
                }
            }
        }

        if (vitalValue === null && alert.message) {
            const numMatch = alert.message.match(/(\d+(\.\d+)?)/);
            if (numMatch) {
                vitalValue = parseFloat(numMatch[1]);
            }
        }

        if (anomalyType.includes('heart_rate') && vitalName !== 'heart_rate') vitalName = 'heart_rate';
        if (anomalyType.includes('temp') && vitalName !== 'temperature') vitalName = 'temperature';
        if (anomalyType.includes('spo2') && vitalName !== 'spo2') vitalName = 'spo2';
        if (anomalyType.includes('moisture') && vitalName !== 'moisture') vitalName = 'moisture';

        const toleranceMap = {
            heart_rate: 10.0,
            temperature: 0.5,
            spo2: 2.0,
            moisture: 0.0
        };

        // Query existing baseline for this patient and vital
        const existingRes = await pool.query(
            `SELECT flag_count, flagged_values, mean_value, upper_bound, lower_bound 
             FROM patient_baselines 
             WHERE patient_id = $1 AND vital_name = $2`,
            [patientId, vitalName]
        );

        let newFlagCount = 1;
        let flaggedValues = vitalValue !== null ? [vitalValue] : [1];
        let meanVal = vitalValue;
        let upperVal = vitalValue !== null ? parseFloat((vitalValue + (toleranceMap[vitalName] || 5.0)).toFixed(2)) : null;
        let lowerVal = vitalValue !== null ? parseFloat((vitalValue - (toleranceMap[vitalName] || 5.0)).toFixed(2)) : null;

        if (existingRes.rowCount > 0) {
            const row = existingRes.rows[0];
            newFlagCount = (parseInt(row.flag_count, 10) || 0) + 1;
            const existingList = Array.isArray(row.flagged_values) ? row.flagged_values : [];
            if (vitalValue !== null) {
                existingList.push(vitalValue);
            }
            flaggedValues = existingList;
            const numericVals = flaggedValues.filter(v => typeof v === 'number');
            if (numericVals.length > 0) {
                const sum = numericVals.reduce((a, b) => a + b, 0);
                meanVal = parseFloat((sum / numericVals.length).toFixed(2));
                const tol = toleranceMap[vitalName] || 5.0;
                upperVal = parseFloat((meanVal + tol).toFixed(2));
                lowerVal = parseFloat((meanVal - tol).toFixed(2));
            }
        }

        // Upsert into patient_baselines
        await pool.query(
            `INSERT INTO patient_baselines 
                 (patient_id, vital_name, flag_count, flagged_values, mean_value, upper_bound, lower_bound, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
             ON CONFLICT (patient_id, vital_name) DO UPDATE
             SET flag_count = $3,
                 flagged_values = $4,
                 mean_value = $5,
                 upper_bound = $6,
                 lower_bound = $7,
                 updated_at = NOW()`,
            [patientId, vitalName, newFlagCount, JSON.stringify(flaggedValues), meanVal, upperVal, lowerVal]
        );

        // Also track anomalyType in patient_baselines if different from vitalName
        if (anomalyType && anomalyType !== vitalName) {
            await pool.query(
                `INSERT INTO patient_baselines 
                     (patient_id, vital_name, flag_count, flagged_values, mean_value, upper_bound, lower_bound, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                 ON CONFLICT (patient_id, vital_name) DO UPDATE
                 SET flag_count = $3,
                     flagged_values = $4,
                     mean_value = $5,
                     upper_bound = $6,
                     lower_bound = $7,
                     updated_at = NOW()`,
                [patientId, anomalyType, newFlagCount, JSON.stringify(flaggedValues), meanVal, upperVal, lowerVal]
            ).catch(() => {});
        }

        // Also notify python AI service if standard vital
        if (vitalValue !== null && ['heart_rate', 'temperature', 'spo2'].includes(vitalName)) {
            flagAsNormal(String(patientId), vitalName, vitalValue).catch(() => {});
        }

        const remainingFlags = Math.max(0, 5 - newFlagCount);

        // If reached 5 flags, auto-acknowledge this alert
        if (newFlagCount >= 5) {
            await pool.query(
                `UPDATE alert_notifications
                 SET status = 'Acknowledged',
                     action_taken = 'AI Baseline Updated - Flagged as Normal (5/5). Pattern learned and future alerts suppressed.',
                     acknowledged_by = $1,
                     acknowledged_at = NOW()
                 WHERE alert_id = $2 AND status != 'Acknowledged'`,
                [userId, alertId]
            ).catch(() => {});

            broadcastAlert('alert_acknowledged', {
                alertId,
                patientId,
                acknowledgedBy: userId,
                action: 'flag_normal_learned',
                action_taken: 'AI Baseline Updated - Flagged as Normal (5/5)'
            });
        }

        broadcastAlert('alert_flagged_normal', {
            alertId,
            patientId,
            vitalName,
            flag_count: newFlagCount,
            remaining_flags: remainingFlags,
            suppressed: newFlagCount >= 5
        });

        // Audit log for HIPAA/DPA
        await pool.query(
            `INSERT INTO access_logs 
                 (user_id, target_patient_id, action, ip_address, severity, status, details)
             VALUES ($1, $2, 'FLAG_ALERT_AS_NORMAL', $3, 'INFO', 'SUCCESS', $4)`,
            [
                userId,
                patientId,
                clientIp,
                JSON.stringify({
                    alert_id: alertId,
                    vital: vitalName,
                    anomaly_type: anomalyType,
                    flag_count: newFlagCount,
                    remaining_flags: remainingFlags
                })
            ]
        ).catch(() => {});

        const conditionMessage = newFlagCount >= 5
            ? "The AI model has learned this patient's pattern. Baseline updated (0 more flags needed). Alerts for this pattern are now suppressed."
            : `The AI model learns from the patient's pattern. Modifying it's baseline needs to be learned repeatedly. (${remainingFlags} more flags needed)`;

        // Real-time broadcast to Web and Mobile
        broadcastAlert('alert_flagged_normal', { alertId, newFlagCount, remainingFlags });

        return res.json({
            success: true,
            message: conditionMessage,
            flag_count: newFlagCount,
            remaining_flags: remainingFlags,
            suppressed: newFlagCount >= 5
        });
    } catch (err) {
        console.error("Flag Alert As Normal Error:", err.message);
        res.status(500).json({ success: false, message: 'Server error while flagging alert.' });
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
                LEFT JOIN device_whitelist dw ON LOWER(h.device_mac_address) = LOWER(dw.serial_number)
                WHERE pa.user_id = $1 OR dw.added_by = $1
                ORDER BY h.triggered_at DESC
                LIMIT 50
            `;
            params = [userId];
        }

        const isSysAdmin = ['sysadmin', 'system_admin'].includes(role?.toLowerCase());
        const result = await pool.query(query, params);
        const data = result.rows.map(r => {
            if (isSysAdmin) {
                const anonId = r.patient_id ? `Subject #${r.patient_id} (De-identified)` : null;
                const sanitizedDesc = r.patient_name && r.patient_id 
                    ? anonymizeMessageForSysAdmin(r.description, r.patient_name, r.patient_id) 
                    : r.description;
                return {
                    ...r,
                    patient_name: anonId,
                    description: sanitizedDesc,
                    is_anonymized: Boolean(r.patient_id)
                };
            }
            return r;
        });
        res.json({ success: true, data });
    } catch (err) {
        console.error("System Alerts Error:", err.message);
        res.json({ success: true, data: [] });
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

        if (!['admin', 'sysadmin', 'system_admin', 'facility_admin', 'caregiver', 'medical_staff', 'parent'].includes(role)) {
            return res.status(403).json({ success: false, message: 'Forbidden. Authorized clinical/admin access required.' });
        }

        const result = await pool.query(
            `UPDATE hardware_system_alerts 
             SET status = 'Resolved',
                 resolved_by = $1,
                 resolved_at = NOW(),
                 resolution_notes = $2
             WHERE sys_alert_id = $3
             RETURNING sys_alert_id`,
            [userId, resolution_notes || 'Resolved by user', alertId]
        );

        // Real-time broadcast to Web and Mobile
        broadcastAlert('system_alert_resolved', { sysAlertId: alertId });

        res.json({ success: true, message: 'System alert resolved successfully.' });
    } catch (err) {
        console.error("Resolve System Alert Error:", err.message);
        res.status(500).json({ success: false, message: 'Server Error during resolution' });
    }
});

// ==========================================
// 4.1 POST /system/test-trigger
// Allows triggering a hardware diagnostic test alert
// ==========================================
router.post('/system/test-trigger', async (req, res) => {
    try {
        const { patient_id, alert_type, severity, description, device_mac_address } = req.body;
        const result = await recordHardwareAlert({
            patient_id: patient_id ? parseInt(patient_id, 10) : null,
            device_mac_address: device_mac_address || 'ESP32-HARDWARE-TEST',
            alert_type: alert_type || 'Low Battery Warning',
            severity: severity || 'Warning',
            description: description || 'Diagnostic Alert: Device battery is at 14%. Recharging required.'
        });
        res.json({ success: true, message: 'Hardware diagnostic alert broadcasted.', data: result });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
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

        const isSysAdmin = ['sysadmin', 'system_admin'].includes(role?.toLowerCase());
        const result = await pool.query(query, params);
        const data = result.rows.map(r => {
            if (isSysAdmin) {
                const anonId = r.patient_id ? `Subject #${r.patient_id} (De-identified)` : 'De-identified Patient';
                const sanitizedMsg = r.patient_name && r.patient_id 
                    ? anonymizeMessageForSysAdmin(r.message, r.patient_name, r.patient_id) 
                    : r.message;
                return {
                    ...r,
                    patient_name: anonId,
                    message: sanitizedMsg,
                    is_anonymized: true
                };
            }
            return r;
        });
        res.json({ success: true, data });
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

            broadcastAlert('alert_acknowledged', {
                alertId,
                acknowledgedBy: userId,
                action: 'schedule_completed'
            });
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

        broadcastAlert('schedule_completed', {
            scheduleId,
            completedBy: userId
        });

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
        
        const isSysAdmin = ['sysadmin', 'system_admin'].includes(role?.toLowerCase());
        
        // 1. Fetch clinical alerts
        let clinicalQuery;
        let clinicalParams = [];
        if (role === 'admin' || role === 'sysadmin' || role === 'system_admin') {
            clinicalQuery = `
                SELECT a.alert_id, a.alert_category, a.severity, a.status, a.message, a.sent_at as timestamp, 
                       p.patient_id, p.name as patient_name
                FROM alert_notifications a
                JOIN anomaly_events e ON a.event_id = e.event_id
                JOIN patients p ON e.patient_id = p.patient_id
                WHERE a.status IS DISTINCT FROM 'Archived'
                ORDER BY a.sent_at DESC LIMIT 50
            `;
        } else if (role === 'facility_admin') {
            clinicalQuery = `
                SELECT a.alert_id, a.alert_category, a.severity, a.status, a.message, a.sent_at as timestamp, 
                       p.patient_id, p.name as patient_name
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
                       p.patient_id, p.name as patient_name
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
                       p.patient_id, p.name as patient_name
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
                       p.patient_id, p.name as patient_name
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
                WHERE (a.is_archived IS NULL OR a.is_archived = false)
                  AND (a.is_active IS NULL OR a.is_active = true)
                ORDER BY a.created_at DESC LIMIT 100
            `;
            announcementsParams = [];
        } else {
            announcementsQuery = `
                SELECT a.id as announcement_id, a.title, a.message, a.created_at as timestamp,
                       'announcement' as alert_category
                FROM announcements a
                LEFT JOIN users u ON a.created_by = u.user_id
                WHERE (a.is_archived IS NULL OR a.is_archived = false)
                  AND (a.is_active IS NULL OR a.is_active = true)
                  AND (
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
                  )
                ORDER BY a.created_at DESC LIMIT 50
            `;
            announcementsParams = [userId];
        }

        // 4. Fetch Care Schedules
        let schedulesQuery;
        let schedulesParams = [];
        if (role === 'admin' || role === 'sysadmin' || role === 'system_admin') {
            schedulesQuery = `
                SELECT s.schedule_id, s.patient_name, s.event_type, s.custom_event_name, s.scheduled_at as timestamp, s.status,
                       p.patient_id
                FROM schedules s
                LEFT JOIN patients p ON LOWER(p.name) = LOWER(s.patient_name)
                WHERE s.status IS DISTINCT FROM 'Archived'
                  AND (s.is_archived IS NULL OR s.is_archived = false)
                ORDER BY s.scheduled_at DESC LIMIT 50
            `;
        } else if (role === 'facility_admin') {
            schedulesQuery = `
                SELECT s.schedule_id, s.patient_name, s.event_type, s.custom_event_name, s.scheduled_at as timestamp, s.status,
                       p.patient_id
                FROM schedules s
                JOIN patients p ON LOWER(p.name) = LOWER(s.patient_name)
                WHERE s.status IS DISTINCT FROM 'Archived'
                  AND (s.is_archived IS NULL OR s.is_archived = false)
                  AND p.is_archived IS DISTINCT FROM TRUE
                  AND p.patient_id IN (
                      SELECT pa.patient_id FROM patient_access pa JOIN users u ON pa.user_id = u.user_id WHERE u.created_by = $1
                      UNION
                      SELECT pa2.patient_id FROM patient_access pa2 WHERE pa2.invited_by = $1
                      UNION
                      SELECT p2.patient_id FROM patients p2 WHERE p2.baseline_data->>'created_by' = $1::text
                  )
                ORDER BY s.scheduled_at DESC LIMIT 50
            `;
            schedulesParams = [userId];
        } else {
            schedulesQuery = `
                SELECT s.schedule_id, s.patient_name, s.event_type, s.custom_event_name, s.scheduled_at as timestamp, s.status,
                       p.patient_id
                FROM schedules s
                JOIN patients p ON LOWER(p.name) = LOWER(s.patient_name)
                WHERE s.status IS DISTINCT FROM 'Archived'
                  AND (s.is_archived IS NULL OR s.is_archived = false)
                  AND p.is_archived IS DISTINCT FROM TRUE
                  AND p.patient_id IN (
                      SELECT pa.patient_id FROM patient_access pa WHERE pa.user_id = $1
                      UNION
                      SELECT dw.assigned_patient_id FROM device_whitelist dw WHERE dw.assigned_patient_id IS NOT NULL AND dw.added_by = $1
                  )
                ORDER BY s.scheduled_at DESC LIMIT 50
            `;
            schedulesParams = [userId];
        }

        const [clinicalRes, systemRes, announcementsRes, schedulesRes] = await Promise.all([
            pool.query(clinicalQuery, clinicalParams),
            pool.query(systemQuery, systemParams),
            pool.query(announcementsQuery, announcementsParams),
            pool.query(schedulesQuery, schedulesParams)
        ]);

        // Retrieve latest firmware files to match with update announcements
        const latestFirmwares = await pool.query(
            `SELECT config_key, config_value FROM system_configs 
             WHERE config_key LIKE 'firmware_%' 
             ORDER BY config_key DESC`
        );
        const firmwareMap = {};
        latestFirmwares.rows.forEach(fw => {
            try {
                const val = typeof fw.config_value === 'string' ? JSON.parse(fw.config_value) : fw.config_value;
                if (val && val.version) {
                    firmwareMap[val.version] = val;
                }
            } catch (e) { /* ignore parse error */ }
        });

        // Format & Merge
        const notifications = [
            ...clinicalRes.rows.map(r => {
                const anonId = isSysAdmin && r.patient_id ? `Subject #${r.patient_id} (De-identified)` : r.patient_name;
                const msg = isSysAdmin && r.patient_name && r.patient_id 
                    ? anonymizeMessageForSysAdmin(r.message, r.patient_name, r.patient_id) 
                    : r.message;
                return {
                    id: `clinical_${r.alert_id}`,
                    type: 'clinical',
                    title: `${r.alert_category} Alert`,
                    message: msg,
                    severity: r.severity.toLowerCase(),
                    timestamp: r.timestamp,
                    status: r.status,
                    patientId: r.patient_id,
                    patientName: anonId,
                    isAnonymized: isSysAdmin
                };
            }),
            ...systemRes.rows.map(r => {
                const anonId = isSysAdmin && r.patient_id ? `Subject #${r.patient_id} (De-identified)` : r.patient_name;
                const msg = isSysAdmin && r.patient_name && r.patient_id 
                    ? anonymizeMessageForSysAdmin(r.message, r.patient_name, r.patient_id) 
                    : r.message;
                return {
                    id: `system_${r.sys_alert_id}`,
                    type: 'system',
                    title: `Device Issue`,
                    message: msg,
                    severity: r.severity.toLowerCase(),
                    timestamp: r.timestamp,
                    status: r.status,
                    patientId: r.patient_id,
                    patientName: anonId,
                    isAnonymized: isSysAdmin && Boolean(r.patient_id)
                };
            }),
            ...schedulesRes.rows.map(r => {
                const anonId = isSysAdmin ? (r.patient_id ? `Subject #${r.patient_id} (De-identified)` : 'De-identified Patient') : r.patient_name;
                return {
                    id: `schedule_${r.schedule_id}`,
                    type: 'schedule',
                    title: `Care Task Scheduled`,
                    message: `${r.event_type}${r.custom_event_name ? ` - ${r.custom_event_name}` : ''} for ${anonId}`,
                    severity: 'normal',
                    timestamp: r.timestamp,
                    status: r.status,
                    patientId: r.patient_id,
                    patientName: anonId,
                    isAnonymized: isSysAdmin
                };
            }),
            ...announcementsRes.rows.map(r => {
                const isFirmwareUpdate = r.title.toLowerCase().includes('firmware') || r.message.toLowerCase().includes('firmware') || r.title.toLowerCase().includes('ota') || r.message.toLowerCase().includes('ota');
                
                let matchedFile = null;
                let matchedVersion = null;
                let smartDiaperPkg = null;
                let vitalSignsPkg = null;

                if (isFirmwareUpdate) {
                    // Check for Smart Diaper specific firmware in message
                    const sdMatch = r.message.match(/Smart Diaper Firmware:\s*([^\s(]+)(?:\s*\(([^)]+)\))?/i);
                    if (sdMatch) {
                        const ver = sdMatch[1];
                        const fl = sdMatch[2] || (firmwareMap[ver] ? firmwareMap[ver].file : `smart_diaper_${ver}.bin`);
                        smartDiaperPkg = {
                            version: ver,
                            file: fl,
                            downloadUrl: `/uploads/firmware/${fl}`
                        };
                    }

                    // Check for Vital Signs specific firmware in message
                    const vsMatch = r.message.match(/Vital Signs(?: Monitor)? Firmware:\s*([^\s(]+)(?:\s*\(([^)]+)\))?/i);
                    if (vsMatch) {
                        const ver = vsMatch[1];
                        const fl = vsMatch[2] || (firmwareMap[ver] ? firmwareMap[ver].file : `vital_signs_${ver}.bin`);
                        vitalSignsPkg = {
                            version: ver,
                            file: fl,
                            downloadUrl: `/uploads/firmware/${fl}`
                        };
                    }

                    // General / fallback version
                    const versionMatch = r.title.match(/(\d+\.\d+\.\d+)/) || r.message.match(/(\d+\.\d+\.\d+)/);
                    if (versionMatch && firmwareMap[versionMatch[1]]) {
                        matchedFile = firmwareMap[versionMatch[1]].file;
                        matchedVersion = firmwareMap[versionMatch[1]].version;
                    } else if (smartDiaperPkg) {
                        matchedFile = smartDiaperPkg.file;
                        matchedVersion = smartDiaperPkg.version;
                    } else if (vitalSignsPkg) {
                        matchedFile = vitalSignsPkg.file;
                        matchedVersion = vitalSignsPkg.version;
                    } else {
                        const latestKey = Object.keys(firmwareMap)[0];
                        if (latestKey && firmwareMap[latestKey]) {
                            matchedFile = firmwareMap[latestKey].file;
                            matchedVersion = firmwareMap[latestKey].version;
                        } else {
                            matchedVersion = 'v2.4.0';
                            matchedFile = 'smart_diaper_v2.4.0.bin';
                        }
                    }
                }

                return {
                    id: `announcement_${r.announcement_id}`,
                    type: 'announcement',
                    title: r.title,
                    message: r.message,
                    severity: 'normal',
                    timestamp: r.timestamp,
                    status: 'Sent',
                    patientName: null,
                    isFirmwareUpdate,
                    downloadUrl: isFirmwareUpdate && matchedFile ? `/uploads/firmware/${matchedFile}` : null,
                    firmwareVersion: isFirmwareUpdate ? matchedVersion : null,
                    smartDiaperFirmware: smartDiaperPkg,
                    vitalSignsFirmware: vitalSignsPkg
                };
            })
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
        const scheduleIds = [];
        const announcementIds = [];
        
        for (const combinedId of ids) {
            if (typeof combinedId !== 'string') continue;
            if (combinedId.startsWith('clinical_')) {
                const val = parseInt(combinedId.replace('clinical_', ''), 10);
                if (!isNaN(val)) clinicalIds.push(val);
            } else if (combinedId.startsWith('system_')) {
                const val = parseInt(combinedId.replace('system_', ''), 10);
                if (!isNaN(val)) systemIds.push(val);
            } else if (combinedId.startsWith('schedule_')) {
                const val = parseInt(combinedId.replace('schedule_', ''), 10);
                if (!isNaN(val)) scheduleIds.push(val);
            } else if (combinedId.startsWith('announcement_')) {
                const val = parseInt(combinedId.replace('announcement_', ''), 10);
                if (!isNaN(val)) announcementIds.push(val);
            }
        }

        // 1. Primary Status Updates - Execute reliably
        if (clinicalIds.length > 0) {
            await pool.query(`UPDATE alert_notifications SET status = 'Archived' WHERE alert_id = ANY($1)`, [clinicalIds]);
        }
        if (systemIds.length > 0) {
            await pool.query(`UPDATE hardware_system_alerts SET status = 'Archived' WHERE sys_alert_id = ANY($1)`, [systemIds]);
        }
        if (scheduleIds.length > 0) {
            await pool.query(`UPDATE schedules SET status = 'Archived', is_archived = true WHERE schedule_id = ANY($1)`, [scheduleIds]);
        }
        if (announcementIds.length > 0) {
            await pool.query(`UPDATE announcements SET is_archived = true, is_active = false WHERE id = ANY($1)`, [announcementIds]);
        }

        // Real-time broadcast to Web and Mobile
        broadcastAlert('alert_archived', { ids, clinicalIds, systemIds, scheduleIds, announcementIds });

        // 2. Audit Trail Logging - Safe and non-blocking
        try {
            const actorId = req.user ? req.user.id : null;
            let validActorId = null;
            if (actorId) {
                const uCheck = await pool.query('SELECT user_id FROM users WHERE user_id = $1', [actorId]);
                if (uCheck.rows.length > 0) validActorId = actorId;
            }

            const facRes = await pool.query('SELECT facility_id FROM facilities');
            const validFacilityIds = new Set(facRes.rows.map(r => r.facility_id));

            if (clinicalIds.length > 0) {
                const detailsRes = await pool.query(
                    `SELECT a.alert_id, a.alert_category, a.message, p.facility_id, p.name as patient_name
                     FROM alert_notifications a
                     LEFT JOIN anomaly_events e ON a.event_id = e.event_id
                     LEFT JOIN patients p ON e.patient_id = p.patient_id
                     WHERE a.alert_id = ANY($1)`,
                    [clinicalIds]
                );
                for (const row of detailsRes.rows) {
                    const targetName = `${row.patient_name || 'System'} - ${row.alert_category || 'Clinical Alert'}: ${row.message || ''}`.trim().substring(0, 255) || 'Clinical Alert';
                    const targetFac = row.facility_id && validFacilityIds.has(row.facility_id) ? row.facility_id : null;
                    await pool.query(
                        `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
                         VALUES ('Clinical Alert', $1, $2, $3, NOW(), 'Archived', $4)`,
                        [row.alert_id.toString(), targetName, validActorId, targetFac]
                    ).catch(e => console.warn('Audit insert clinical error:', e.message));
                }
            }

            if (systemIds.length > 0) {
                const detailsRes = await pool.query(
                    `SELECT h.sys_alert_id, h.description, p.facility_id, p.name as patient_name
                     FROM hardware_system_alerts h
                     LEFT JOIN patients p ON h.patient_id = p.patient_id
                     WHERE h.sys_alert_id = ANY($1)`,
                    [systemIds]
                );
                for (const row of detailsRes.rows) {
                    const targetName = `${row.patient_name || 'System'} - Hardware: ${row.description || ''}`.trim().substring(0, 255) || 'System Alert';
                    const targetFac = row.facility_id && validFacilityIds.has(row.facility_id) ? row.facility_id : null;
                    await pool.query(
                        `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
                         VALUES ('System Alert', $1, $2, $3, NOW(), 'Archived', $4)`,
                        [row.sys_alert_id.toString(), targetName, validActorId, targetFac]
                    ).catch(e => console.warn('Audit insert system error:', e.message));
                }
            }

            if (scheduleIds.length > 0) {
                const detailsRes = await pool.query(
                    `SELECT s.schedule_id, s.patient_name, s.event_type
                     FROM schedules s
                     WHERE s.schedule_id = ANY($1)`,
                    [scheduleIds]
                );
                for (const row of detailsRes.rows) {
                    const patientCheck = await pool.query('SELECT facility_id FROM patients WHERE LOWER(name) = LOWER($1) LIMIT 1', [row.patient_name]);
                    const rawFac = patientCheck.rows[0]?.facility_id || null;
                    const targetFac = rawFac && validFacilityIds.has(rawFac) ? rawFac : null;
                    const targetName = `${row.patient_name || 'Patient'} - ${row.event_type || 'Care Task'}`.trim().substring(0, 255) || 'Schedule';
                    await pool.query(
                        `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
                         VALUES ('Schedule', $1, $2, $3, NOW(), 'Archived', $4)`,
                        [row.schedule_id.toString(), targetName, validActorId, targetFac]
                    ).catch(e => console.warn('Audit insert schedule error:', e.message));
                }
            }

            if (announcementIds.length > 0) {
                const annRes = await pool.query(
                    `SELECT id, title FROM announcements WHERE id = ANY($1)`,
                    [announcementIds]
                );
                for (const row of annRes.rows) {
                    await pool.query(
                        `INSERT INTO archives (entity_type, target_id, target_name, archived_by, archived_at, status, facility_id)
                         VALUES ('Announcement', $1, $2, $3, NOW(), 'Archived', NULL)`,
                        [row.id.toString(), (row.title || 'Announcement').substring(0, 255), validActorId]
                    ).catch(e => console.warn('Audit insert announcement error:', e.message));
                }
            }
        } catch (auditErr) {
            console.warn("Audit archiving background notice:", auditErr.message);
        }

        res.json({ success: true, message: 'Notifications archived successfully.' });
    } catch (err) {
        console.error("Archive Unified Error:", err.message);
        res.status(500).json({ success: false, message: 'Failed to archive notifications.' });
    }
});

module.exports = router;
