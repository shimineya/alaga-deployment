/**
 * Sensor Data Route
 * =================
 * Handles all inbound data from ESP32 devices and exposes the
 * Caregiver "Flag as Normal" endpoint.
 *
 * Mount point: /api/sensor  (registered in index.js)
 *
 * Endpoints:
 *   POST /api/sensor/reading      <- ESP32 vital signs + moisture
 *   POST /api/sensor/flag-normal  <- Caregiver flags a reading (JWT required)
 *   GET  /api/sensor/status/:id   <- Latest reading for a patient (JWT required)
 *   GET  /api/sensor/ai-health    <- Internal AI service health probe (Admin only)
 *   GET  /api/sensor/history/:id  <- Telemetry history for graphing (JWT required)
 */

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { body, param, validationResult } = require('express-validator');
const pool    = require('../db');
const { verifyToken } = require('../middleware/authMiddleware');

// ---------------------------------------------------------------------------
// [CHANGE] Import AI service — uses PythonShell directly instead of HTTP axios
// ---------------------------------------------------------------------------
const { runPrediction, flagAsNormal } = require('../services/alagarAIService');

// ---------------------------------------------------------------------------
// Helper: Validate the X-Device-Key header against the device_whitelist table.
// [OWASP A07] Per-device token authentication.
// ---------------------------------------------------------------------------
async function authenticateDevice(serialNumber, providedToken) {
    if (!serialNumber || !providedToken) return null;

    const tokenHash = crypto
        .createHash('sha256')
        .update(providedToken)
        .digest('hex');

    const result = await pool.query(
        `SELECT serial_number, device_name, status, assigned_patient_id
         FROM device_whitelist
         WHERE serial_number = $1
           AND device_token_hash = $2
           AND status = 'ACTIVE'
           AND is_archived IS DISTINCT FROM TRUE`,
        [serialNumber, tokenHash]
    );

    return result.rows.length > 0 ? result.rows[0] : null;
}

// ---------------------------------------------------------------------------
// Helper: Load a patient's baseline rows from PostgreSQL
// ---------------------------------------------------------------------------
async function loadPatientBaseline(patientId) {
    const result = await pool.query(
        `SELECT vital_name, flag_count, flagged_values,
                mean_value, upper_bound, lower_bound
         FROM patient_baselines
         WHERE patient_id = $1`,
        [patientId]
    );
    return result.rows;
}

// ---------------------------------------------------------------------------
// Helper: Write a structured entry to access_logs for the PHI audit trail.
// [HIPAA / OWASP A09]
// ---------------------------------------------------------------------------
async function logPhiAccess(action, patientId, ipAddress, details = {}) {
    await pool.query(
        `INSERT INTO access_logs
             (user_id, target_patient_id, action, ip_address, severity, status, details)
         VALUES (NULL, $1, $2, $3, 'INFO', 'SUCCESS', $4)`,
        [patientId, action, ipAddress, JSON.stringify(details)]
    ).catch(err => {
        console.error('[SENSOR] Failed to write PHI access log:', err.message);
    });
}


// ===========================================================================
// ENDPOINT 1: Receive vital signs + moisture from an ESP32 device
// POST /api/sensor/reading
// ===========================================================================
const readingValidation = [
    body('heart_rate')
        .isFloat({ min: 0, max: 300 })
        .withMessage('heart_rate must be a number between 0 and 300'),
    body('temperature')
        .isFloat({ min: 25, max: 50 })
        .withMessage('temperature must be between 25 and 50 degrees Celsius'),
    body('spo2')
        .isFloat({ min: 0, max: 100 })
        .withMessage('spo2 must be a percentage between 0 and 100'),
    body('moisture')
        .isInt({ min: 0, max: 1 })
        .withMessage('moisture must be 0 (dry) or 1 (wet)')
];

router.post('/reading', readingValidation, async (req, res) => {
    // Step 1: Validate input fields
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    // Step 2: Authenticate the device
    const deviceSerial = req.headers['x-device-serial'] || '';
    const deviceToken  = req.headers['x-device-token']  || '';
    const clientIp     = req.ip || req.connection.remoteAddress;

    let device;
    try {
        device = await authenticateDevice(deviceSerial, deviceToken);
    } catch (authErr) {
        console.error('[SENSOR] Device auth DB error:', authErr.message);
        return res.status(500).json({ success: false, message: 'Authentication check failed.' });
    }

    if (!device) {
        await pool.query(
            `INSERT INTO access_logs (action, ip_address, severity, status, details)
             VALUES ('DEVICE_AUTH_FAILURE', $1, 'WARNING', 'FAILURE', $2)`,
            [clientIp, JSON.stringify({ serial: deviceSerial })]
        ).catch(() => {});
        return res.status(401).json({ success: false, message: 'Device not authorized.' });
    }

    const patientId = device.assigned_patient_id;
    if (!patientId) {
        return res.status(422).json({ success: false, message: 'Device is not assigned to a patient.' });
    }

    // Step 3: Extract and sanitize readings
    const heartRate   = parseFloat(req.body.heart_rate);
    const temperature = parseFloat(req.body.temperature);
    const spo2        = parseFloat(req.body.spo2);
    const moisture    = parseInt(req.body.moisture, 10);

    let readingId;

    // Step 4: Write raw reading to sensor_readings
    try {
        const readingResult = await pool.query(
            `INSERT INTO sensor_readings (patient_id, heart_rate, spo2, temperature, moisture_value)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING reading_id`,
            [patientId, Math.round(heartRate), Math.round(spo2), temperature, moisture]
        );
        readingId = readingResult.rows[0].reading_id;
    } catch (dbErr) {
        console.error('[SENSOR] Reading insert error:', dbErr.message);
        return res.status(500).json({ success: false, message: 'Failed to store reading.' });
    }

    // Step 5: Fetch patient type, then call AI via PythonShell
    // [CHANGE] Replaced callAiService('/predict', ...) with runPrediction()
    let aiResult;
    try {
        const patientRow = await pool.query(
            'SELECT patient_type FROM patients WHERE patient_id = $1',
            [patientId]
        );
        const patientType = patientRow.rows[0]?.patient_type || 'adult';

        aiResult = await runPrediction({
            patient_id  : patientId,
            heart_rate  : heartRate,
            temperature : temperature,
            spo2        : spo2,
            moisture    : moisture,
            patient_type: patientType
        });

    } catch (aiErr) {
        // AI failure is non-fatal — reading is already stored
        console.error('[SENSOR] AI service call failed:', aiErr.message);
        aiResult = {
            status      : 'UNKNOWN',
            alerts      : [],
            ocsvm_result: 'unknown'
        };
    }

    // Step 6: If the AI detected alerts, write anomaly_events + alert_notifications
    if (aiResult.alerts && aiResult.alerts.length > 0) {
        try {
            for (const alert of aiResult.alerts) {
                const ocsvmScore = alert.vital === 'multi_feature' ? -1.0 : 0.0;
                const anomalyType = alert.vital === 'multi_feature'
                    ? 'ocsvm_anomaly'
                    : `rule_${alert.vital}`;

                const eventResult = await pool.query(
                    `INSERT INTO anomaly_events (patient_id, reading_id, anomaly_type, ocsvm_score)
                     VALUES ($1, $2, $3, $4)
                     RETURNING event_id`,
                    [patientId, readingId, anomalyType, ocsvmScore]
                );

                const eventId = eventResult.rows[0].event_id;

                await pool.query(
                    `INSERT INTO alert_notifications
                         (event_id, status, message, severity, alert_category)
                     VALUES ($1, 'Sent', $2, $3, 'Clinical')`,
                    [
                        eventId,
                        alert.message,
                        alert.severity === 'critical' ? 'Critical' : 'Warning'
                    ]
                );
            }
        } catch (alertErr) {
            console.error('[SENSOR] Alert insert error:', alertErr.message);
        }
    }

    // Step 7: Write PHI access log
    await logPhiAccess('SENSOR_READING_RECEIVED', patientId, clientIp, {
        device_serial: deviceSerial,
        reading_id   : readingId,
        ai_status    : aiResult.status
    });

    // Step 8: Update device heartbeat timestamp & auto-apply pending firmware update when it connects online
    await pool.query(
        `UPDATE device_whitelist 
         SET last_heartbeat = NOW(),
             status = 'ACTIVE',
             firmware_version = COALESCE(pending_firmware_version, firmware_version),
             pending_firmware_version = NULL
         WHERE serial_number = $1`,
        [deviceSerial]
    ).catch(() => {});

    // Step 9: Respond to ESP32
    return res.status(200).json({
        success: true,
        status : aiResult.status,
        alerts : aiResult.alerts
    });
});


// ===========================================================================
// ENDPOINT 2: Caregiver flags a reading as normal (updates adaptive baseline)
// POST /api/sensor/flag-normal
// ===========================================================================
const flagValidation = [
    body('patient_id').isInt({ min: 1 }).withMessage('patient_id must be a positive integer'),
    body('vital')
        .isIn(['heart_rate', 'temperature', 'spo2'])
        .withMessage('vital must be heart_rate, temperature, or spo2'),
    body('value').isFloat().withMessage('value must be a number')
];

router.post('/flag-normal', verifyToken, flagValidation, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const userId    = req.user.id;
    const { patient_id: patientId, vital, value } = req.body;
    const clientIp  = req.ip || req.connection.remoteAddress;

    // [OWASP A01] IDOR Prevention
    const accessRoles = ['admin', 'system_admin', 'sysadmin', 'medical_staff', 'facility_admin'];
    let hasAccess = accessRoles.includes(req.user.role);

    if (!hasAccess) {
        const accessCheck = await pool.query(
            "SELECT 1 FROM patient_access WHERE user_id = $1 AND patient_id = $2 AND (invite_status = 'Active' OR invite_status IS NULL)",
            [userId, patientId]
        ).catch(() => ({ rows: [] }));
        hasAccess = accessCheck.rows.length > 0;
    }

    if (!hasAccess) {
        return res.status(403).json({
            success: false,
            message: 'You are not assigned to this patient.'
        });
    }

    // [CHANGE] Replaced callAiService('/baseline/flag', ...) with flagAsNormal()
    let aiResponse;
    try {
        const message = await flagAsNormal(patientId, vital, parseFloat(value));
        aiResponse = { message };
    } catch (aiErr) {
        console.error('[SENSOR] Baseline flag AI call failed:', aiErr.message);
        return res.status(502).json({
            success: false,
            message: 'AI service is temporarily unavailable. Please try again.'
        });
    }

    // Persist updated baseline to PostgreSQL
    // NOTE: flagAsNormal() via PythonShell only returns a message string.
    // Extended baseline stats (mean, bounds) are managed inside the Python model's memory.
    // If you need to persist them, upgrade alaga_predict.py to return full stats on flag.
    try {
        await pool.query(
            `INSERT INTO patient_baselines
                 (patient_id, vital_name, flag_count, flagged_values,
                  mean_value, upper_bound, lower_bound, updated_at)
             VALUES ($1, $2, 1, $3, NULL, NULL, NULL, NOW())
             ON CONFLICT (patient_id, vital_name) DO UPDATE
                SET flag_count  = patient_baselines.flag_count + 1,
                    updated_at  = NOW()`,
            [
                patientId,
                vital,
                JSON.stringify([parseFloat(value)])
            ]
        );
    } catch (dbErr) {
        console.error('[SENSOR] Baseline persist error:', dbErr.message);
        // Non-fatal — in-memory baseline is updated; DB sync failed
    }

    // [HIPAA / OWASP A09] Log the caregiver action
    await pool.query(
        `INSERT INTO access_logs
             (user_id, target_patient_id, action, ip_address, severity, status, details)
         VALUES ($1, $2, 'FLAG_AS_NORMAL', $3, 'INFO', 'SUCCESS', $4)`,
        [userId, patientId, clientIp, JSON.stringify({ vital, value })]
    ).catch(() => {});

    return res.json({
        success: true,
        message: aiResponse.message
    });
});


// ===========================================================================
// ENDPOINT 3: Get latest reading and AI status for a patient
// GET /api/sensor/status/:patient_id
// ===========================================================================
router.get(
    '/status/:patient_id',
    verifyToken,
    param('patient_id').isInt({ min: 1 }).withMessage('Invalid patient ID'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: errors.array()[0].msg });
        }

        const userId    = req.user.id;
        const patientId = parseInt(req.params.patient_id, 10);

        // Check if patient is archived
        const patientCheck = await pool.query('SELECT is_archived FROM patients WHERE patient_id = $1', [patientId]);
        if (patientCheck.rows.length === 0 || patientCheck.rows[0].is_archived) {
            return res.status(403).json({ success: false, message: 'Access denied. This patient record has been archived.' });
        }

        const accessRoles = ['admin', 'system_admin', 'sysadmin', 'medical_staff', 'facility_admin'];
        let hasAccess = accessRoles.includes(req.user.role);

        if (!hasAccess) {
            const accessCheck = await pool.query(
                "SELECT 1 FROM patient_access WHERE user_id = $1 AND patient_id = $2 AND (invite_status = 'Active' OR invite_status IS NULL)",
                [userId, patientId]
            ).catch(() => ({ rows: [] }));
            hasAccess = accessCheck.rows.length > 0;
        }

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'You are not assigned to this patient.'
            });
        }

        try {
            const readingResult = await pool.query(
                `SELECT sr.reading_id, sr.heart_rate, sr.spo2, sr.temperature,
                        sr.moisture_value, sr.recorded_at,
                        ae.anomaly_type, ae.ocsvm_score,
                        an.message AS latest_alert, an.severity AS alert_severity
                 FROM sensor_readings sr
                 LEFT JOIN anomaly_events ae ON ae.reading_id = sr.reading_id
                 LEFT JOIN alert_notifications an ON an.event_id = ae.event_id
                 WHERE sr.patient_id = $1
                 ORDER BY sr.recorded_at DESC
                 LIMIT 1`,
                [patientId]
            );

            if (readingResult.rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No readings recorded for this patient yet.'
                });
            }

            const row = readingResult.rows[0];

            return res.json({
                success      : true,
                patient_id   : patientId,
                reading_id   : row.reading_id,
                heart_rate   : row.heart_rate,
                spo2         : row.spo2,
                temperature  : row.temperature,
                moisture     : row.moisture_value,
                recorded_at  : row.recorded_at,
                ocsvm_result : row.anomaly_type ? 'anomaly' : 'normal',
                ocsvm_score  : row.ocsvm_score,
                latest_alert : row.latest_alert,
                alert_severity: row.alert_severity
            });

        } catch (err) {
            console.error('[SENSOR] Status fetch error:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to retrieve patient status.' });
        }
    }
);


// ===========================================================================
// ENDPOINT 4: AI service health probe (Admin only)
// GET /api/sensor/ai-health
// [CHANGE] Instead of pinging a Python HTTP server, runs a test prediction
//          via PythonShell and reports success/failure.
// ===========================================================================
router.get('/ai-health', verifyToken, async (req, res) => {
    const adminRoles = ['admin', 'system_admin', 'sysadmin'];
    if (!adminRoles.includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Admin access required.' });
    }

    try {
        // Run a dummy prediction to verify Python + model are reachable
        const testResult = await runPrediction({
            patient_id  : 'HEALTH_CHECK',
            heart_rate  : 75,
            temperature : 36.5,
            spo2        : 98,
            moisture    : 0,
            patient_type: 'adult'
        });

        return res.json({
            success   : true,
            ai_service: {
                status : 'ok',
                result : testResult.status,
                message: 'PythonShell AI bridge is responding.'
            }
        });
    } catch (err) {
        return res.status(503).json({
            success   : false,
            message   : 'AI service (PythonShell) is not responding.',
            error_code: err.code || 'UNREACHABLE'
        });
    }
});


// ===========================================================================
// ENDPOINT 5: Fetch Telemetry History for Graphing
// GET /api/sensor/history/:patient_id
// ===========================================================================
router.get(
    '/history/:patient_id',
    verifyToken,
    param('patient_id').isInt({ min: 1 }).withMessage('Invalid patient ID'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: errors.array()[0].msg });
        }

        const userId    = req.user.id;
        const patientId = parseInt(req.params.patient_id, 10);
        const clientIp  = req.ip || req.connection.remoteAddress;

        // Check if patient is archived
        const patientCheck = await pool.query('SELECT is_archived FROM patients WHERE patient_id = $1', [patientId]);
        if (patientCheck.rows.length === 0 || patientCheck.rows[0].is_archived) {
            return res.status(403).json({ success: false, message: 'Access denied. This patient record has been archived.' });
        }

        const accessRoles = ['admin', 'system_admin', 'sysadmin', 'medical_staff', 'facility_admin'];
        let hasAccess = accessRoles.includes(req.user.role);

        if (!hasAccess) {
            const accessCheck = await pool.query(
                "SELECT 1 FROM patient_access WHERE user_id = $1 AND patient_id = $2 AND (invite_status = 'Active' OR invite_status IS NULL)",
                [userId, patientId]
            ).catch(() => ({ rows: [] }));
            hasAccess = accessCheck.rows.length > 0;
        }

        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'You are not assigned to this patient.'
            });
        }

        try {
            const result = await pool.query(
                `SELECT heart_rate, spo2, temperature, moisture_value, recorded_at
                 FROM sensor_readings
                 WHERE patient_id = $1
                 ORDER BY recorded_at DESC
                 LIMIT 20`,
                [patientId]
            );

            await logPhiAccess('SENSOR_HISTORY_ACCESSED', patientId, clientIp, { limit: 20 });

            const chronologicalData = result.rows.reverse();

            return res.json({
                success   : true,
                patient_id: patientId,
                history   : chronologicalData
            });

        } catch (err) {
            console.error('[SENSOR] History fetch error:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to retrieve patient history.' });
        }
    }
);

module.exports = router;