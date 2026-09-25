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
const { broadcastAlert } = require('../services/alertRealtimeService');

// ---------------------------------------------------------------------------
// [CHANGE] Import AI service — uses PythonShell directly instead of HTTP axios
// ---------------------------------------------------------------------------
const { runPrediction, flagAsNormal } = require('../services/alagarAIService');
const { recordHardwareAlert } = require('../services/hardwareDiagnosticsService');

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
        .isFloat({ min: 0, max: 50 })
        .withMessage('temperature must be between 0 and 50 degrees Celsius'),
    body('spo2')
        .isFloat({ min: 0, max: 100 })
        .withMessage('spo2 must be a percentage between 0 and 100'),
    body('moisture')
        .isInt({ min: 0, max: 100 })
        .withMessage('moisture must be a percentage between 0 and 100')
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

    // Step 4.1: Automated Hardware Diagnostics (Battery, Wireless Signal, Probe Status)
    try {
        const rawBattery = req.body.battery !== undefined ? req.body.battery : req.body.battery_level;
        const battery = rawBattery !== undefined && rawBattery !== null ? parseFloat(rawBattery) : null;
        const rssi = req.body.rssi !== undefined && req.body.rssi !== null ? parseFloat(req.body.rssi) : null;
        const probeDetached = req.body.probe_detached === true || req.body.probe_detached === 'true' || (heartRate === 0 && spo2 === 0);
        const sensorError = req.body.sensor_error === true || req.body.sensor_error === 'true';

        if (battery !== null && !isNaN(battery)) {
            if (battery <= 10) {
                recordHardwareAlert({
                    patient_id: patientId,
                    device_mac_address: deviceSerial,
                    alert_type: 'Low Battery (Critical)',
                    severity: 'Critical',
                    description: `Critical Battery: IoT Device "${device.device_name || deviceSerial}" battery dropped to ${Math.round(battery)}%. Recharging urgently required.`
                }).catch(() => {});
            } else if (battery <= 20) {
                recordHardwareAlert({
                    patient_id: patientId,
                    device_mac_address: deviceSerial,
                    alert_type: 'Low Battery',
                    severity: 'Warning',
                    description: `Low Battery: IoT Device "${device.device_name || deviceSerial}" battery is at ${Math.round(battery)}%. Please connect to charger.`
                }).catch(() => {});
            }
        }

        if (rssi !== null && !isNaN(rssi) && rssi < -85) {
            recordHardwareAlert({
                patient_id: patientId,
                device_mac_address: deviceSerial,
                alert_type: 'Weak Wireless Signal',
                severity: 'Warning',
                description: `Weak Signal Detected (RSSI ${rssi} dBm) for device "${device.device_name || deviceSerial}". Risk of dropped telemetry packets.`
            }).catch(() => {});
        }

        if (probeDetached || sensorError) {
            recordHardwareAlert({
                patient_id: patientId,
                device_mac_address: deviceSerial,
                alert_type: 'Sensor Malfunction / Probe Detached',
                severity: 'Warning',
                description: `Hardware Issue: Sensor probe disconnected or hardware fault reported on "${device.device_name || deviceSerial}".`
            }).catch(() => {});
        }
    } catch (diagErr) {
        console.error('[SENSOR] Diagnostics check error:', diagErr.message);
    }

    // Step 5: Fetch patient type, then call AI via PythonShell
    // [CHANGE] Replaced callAiService('/predict', ...) with runPrediction()
    let aiResult;
    try {
        const patientRow = await pool.query(
            'SELECT patient_type, is_monitoring_disabled FROM patients WHERE patient_id = $1',
            [patientId]
        );
        const isMonitoringDisabled = !!patientRow.rows[0]?.is_monitoring_disabled;
        if (isMonitoringDisabled) {
            // Patient monitoring is paused/disabled — store reading but skip AI alert generation
            return res.status(201).json({
                success: true,
                message: 'Reading stored successfully (Monitoring disabled for patient).',
                data: {
                    reading_id: readingId,
                    patient_id: patientId,
                    monitoring_status: 'DISABLED',
                    alerts: []
                }
            });
        }
        const patientType = patientRow.rows[0]?.patient_type || 'adult';

        // Query active personalized baselines for this patient
        const baselinesRes = await pool.query(
            'SELECT vital_name, flag_count, flagged_values, mean_value, upper_bound, lower_bound FROM patient_baselines WHERE patient_id = $1',
            [patientId]
        ).catch(() => ({ rows: [] }));
        const patientBaselines = baselinesRes.rows || [];

        aiResult = await runPrediction({
            patient_id  : patientId,
            heart_rate  : heartRate,
            temperature : temperature,
            spo2        : spo2,
            moisture    : moisture,
            patient_type: patientType,
            baselines   : patientBaselines
        });

    } catch (aiErr) {
        // AI failure is non-fatal — reading is already stored
        console.error('[SENSOR] AI service call failed:', aiErr.message);
        aiResult = {
            status      : 'UNKNOWN',
            alerts      : [],
            ocsvm_result: 'unavailable',
            ocsvm_label : null,
            ocsvm_score : null
        };
    }

    // Step 6: If the AI detected alerts, write anomaly_events + alert_notifications (suppress if flagged normal 5+ times)
    if (aiResult.alerts && aiResult.alerts.length > 0) {
        try {
            // Fetch latest baselines to ensure real-time suppression
            const baselinesCheck = await pool.query(
                'SELECT vital_name, flag_count FROM patient_baselines WHERE patient_id = $1 AND flag_count >= 5',
                [patientId]
            ).catch(() => ({ rows: [] }));
            const suppressedBaselines = baselinesCheck.rows || [];

            for (const alert of aiResult.alerts) {
                // Store the frozen model's signed decision_function, not a placeholder.
                const ocsvmScore = alert.vital === 'multi_feature'
                    ? aiResult.ocsvm_score : 0.0;
                const anomalyType = alert.vital === 'multi_feature'
                    ? 'ocsvm_anomaly'
                    : `rule_${alert.vital}`;

                // Double safeguard: check if patient baseline has 5+ flags for this pattern
                const isSuppressed = suppressedBaselines.some(b => {
                    if (b.flag_count < 5) return false;
                    if (b.vital_name === anomalyType) return true;
                    if (alert.vital && (b.vital_name === alert.vital || alert.vital.startsWith(b.vital_name))) return true;
                    if (anomalyType === 'ocsvm_anomaly' && ['ocsvm_anomaly', 'multi_feature'].includes(b.vital_name)) return true;
                    return false;
                });

                if (isSuppressed) {
                    console.log(`[AI Alert Engine] Alert suppressed for patient ${patientId} (${anomalyType}): Pattern flagged as normal 5+ times (learned baseline).`);
                    continue;
                }

                const eventResult = await pool.query(
                    `INSERT INTO anomaly_events (patient_id, reading_id, anomaly_type, ocsvm_score)
                     VALUES ($1, $2, $3, $4)
                     RETURNING event_id`,
                    [patientId, readingId, anomalyType, ocsvmScore]
                );

                const eventId = eventResult.rows[0].event_id;

                const notifInsertRes = await pool.query(
                    `INSERT INTO alert_notifications
                         (event_id, status, message, severity, alert_category)
                     VALUES ($1, 'Sent', $2, $3, 'Clinical')
                     RETURNING alert_id`,
                    [
                        eventId,
                        alert.message,
                        alert.severity === 'critical' ? 'Critical' : 'Warning'
                    ]
                );
                const alertId = notifInsertRes.rows[0]?.alert_id;

                // Fetch patient name & facility for immediate notification display
                const pInfo = await pool.query('SELECT name, facility_id FROM patients WHERE patient_id = $1', [patientId]).catch(() => ({ rows: [] }));
                const patientName = pInfo.rows[0]?.name || `Patient #${patientId}`;
                const facilityId = pInfo.rows[0]?.facility_id || null;

                const alertPayload = {
                    alert_id: alertId,
                    event_id: eventId,
                    patient_id: patientId,
                    patient_name: patientName,
                    facility_id: facilityId,
                    severity: alert.severity === 'critical' ? 'Critical' : 'Warning',
                    message: alert.message,
                    anomaly_type: anomalyType,
                    category: 'Clinical',
                    timestamp: new Date().toISOString(),
                    playSound: true
                };

                // Broadcast alert in real-time to Web and Mobile
                broadcastAlert('new_alert', alertPayload);
                broadcastAlert('new_clinical_alert', {
                    ...alertPayload,
                    patientId,
                    anomalyType
                });
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
        alerts : aiResult.alerts,
        ocsvm_result: aiResult.ocsvm_result,
        ocsvm_label: aiResult.ocsvm_label,
        ocsvm_score: aiResult.ocsvm_score
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
    const accessRoles = ['admin', 'system_admin', 'sysadmin', 'facility_admin'];
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

        const accessRoles = ['admin', 'system_admin', 'sysadmin', 'facility_admin'];
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
                `SELECT 
                    (SELECT sr.reading_id FROM sensor_readings sr WHERE sr.patient_id = $1 ORDER BY sr.recorded_at DESC LIMIT 1) AS reading_id,
                    COALESCE((SELECT sr.heart_rate FROM sensor_readings sr WHERE sr.patient_id = $1 AND sr.heart_rate > 0 ORDER BY sr.recorded_at DESC LIMIT 1), 0) AS heart_rate,
                    COALESCE((SELECT sr.spo2 FROM sensor_readings sr WHERE sr.patient_id = $1 AND sr.spo2 > 0 ORDER BY sr.recorded_at DESC LIMIT 1), 0) AS spo2,
                    COALESCE((SELECT sr.temperature FROM sensor_readings sr WHERE sr.patient_id = $1 AND sr.temperature > 0 ORDER BY sr.recorded_at DESC LIMIT 1), 0) AS temperature,
                    COALESCE((SELECT sr.moisture_value FROM sensor_readings sr WHERE sr.patient_id = $1 ORDER BY sr.recorded_at DESC LIMIT 1), 0) AS moisture_value,
                    (SELECT sr.recorded_at FROM sensor_readings sr WHERE sr.patient_id = $1 ORDER BY sr.recorded_at DESC LIMIT 1) AS recorded_at,
                    (SELECT p.patient_type FROM patients p WHERE p.patient_id = $1) AS patient_type,
                    (SELECT model_event.ocsvm_score
                     FROM anomaly_events model_event
                     WHERE model_event.reading_id = (SELECT sr.reading_id FROM sensor_readings sr WHERE sr.patient_id = $1 ORDER BY sr.recorded_at DESC LIMIT 1)
                       AND model_event.anomaly_type = 'ocsvm_anomaly'
                     ORDER BY model_event.event_id DESC LIMIT 1) AS model_score,
                    ae.anomaly_type,
                    an.message AS latest_alert, an.severity AS alert_severity
                 FROM sensor_readings sr2
                 LEFT JOIN anomaly_events ae ON ae.reading_id = (SELECT sr.reading_id FROM sensor_readings sr WHERE sr.patient_id = $1 ORDER BY sr.recorded_at DESC LIMIT 1)
                 LEFT JOIN alert_notifications an ON an.event_id = ae.event_id
                 WHERE sr2.patient_id = $1
                 ORDER BY sr2.recorded_at DESC
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
                ocsvm_result : row.patient_type === 'adult'
                    ? (row.model_score !== null ? 'anomaly' : 'normal')
                    : 'not_applicable',
                ocsvm_label  : row.patient_type === 'adult'
                    ? (row.model_score !== null ? -1 : 1)
                    : null,
                ocsvm_score  : row.model_score,
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

        const accessRoles = ['admin', 'system_admin', 'sysadmin', 'facility_admin'];
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
            const reqLimit = parseInt(req.query.limit, 10);
            const limit = (!isNaN(reqLimit) && reqLimit > 0) ? Math.min(reqLimit, 1000) : 500;
            const timeframe = (req.query.timeframe || req.query.period || '').toLowerCase();

            let intervalStr = null;
            if (timeframe === 'day' || timeframe === '24h' || timeframe === '1d') {
                intervalStr = '1 day';
            } else if (timeframe === 'week' || timeframe === '7d') {
                intervalStr = '7 days';
            } else if (timeframe === 'month' || timeframe === '30d') {
                intervalStr = '30 days';
            } else if (timeframe === '6months' || timeframe === '6m' || timeframe === '180d') {
                intervalStr = '180 days';
            } else if (timeframe === 'year' || timeframe === '1year' || timeframe === '1y' || timeframe === '365d') {
                intervalStr = '365 days';
            }

            let result;
            if (intervalStr) {
                result = await pool.query(
                    `WITH max_time AS (
                        SELECT COALESCE(MAX(recorded_at), NOW()) as latest_time
                        FROM sensor_readings
                        WHERE patient_id = $1
                    )
                    SELECT heart_rate, spo2, temperature, moisture_value, recorded_at
                    FROM sensor_readings, max_time
                    WHERE patient_id = $1
                      AND recorded_at >= (max_time.latest_time - INTERVAL '${intervalStr}')
                    ORDER BY recorded_at DESC
                    LIMIT $2`,
                    [patientId, limit]
                );

                // If window query returns fewer than 5 records, fall back to recent readings so graphs are never empty
                if (result.rows.length < 5) {
                    const fallback = await pool.query(
                        `SELECT heart_rate, spo2, temperature, moisture_value, recorded_at
                         FROM sensor_readings
                         WHERE patient_id = $1
                         ORDER BY recorded_at DESC
                         LIMIT $2`,
                        [patientId, limit]
                    );
                    if (fallback.rows.length > result.rows.length) {
                        result = fallback;
                    }
                }
            } else {
                result = await pool.query(
                    `SELECT heart_rate, spo2, temperature, moisture_value, recorded_at
                     FROM sensor_readings
                     WHERE patient_id = $1
                     ORDER BY recorded_at DESC
                     LIMIT $2`,
                    [patientId, limit]
                );
            }

            await logPhiAccess('SENSOR_HISTORY_ACCESSED', patientId, clientIp, { limit, timeframe });

            const chronologicalData = result.rows.reverse();

            return res.json({
                success   : true,
                patient_id: patientId,
                timeframe : timeframe || 'all',
                count     : chronologicalData.length,
                history   : chronologicalData
            });

        } catch (err) {
            console.error('[SENSOR] History fetch error:', err.message);
            return res.status(500).json({ success: false, message: 'Failed to retrieve patient history.' });
        }
    }
);

// ===========================================================================
// ENDPOINT 6: AI Patient Insights & Multi-Timeframe Trend Analytics
// GET /api/sensor/ai-insights/:patient_id
// Timeframes: day, week, month, 6months, 1year
// Evaluates trend regressions, OC-SVM model outputs, and clinical ILLNESS_MAP
// ===========================================================================
router.get(
    '/ai-insights/:patient_id',
    verifyToken,
    param('patient_id').isInt({ min: 1 }).withMessage('Invalid patient ID'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, message: errors.array()[0].msg });
        }

        const userId    = req.user.id;
        const patientId = parseInt(req.params.patient_id, 10);
        const timeframe = (req.query.timeframe || req.query.period || 'week').toLowerCase();

        try {
            // 1. Patient verification & access check
            const patientRes = await pool.query(
                `SELECT p.patient_id, p.name, p.birthdate, p.patient_type,
                        p.baseline_data, p.facility_id, p.is_archived, f.facility_name
                 FROM patients p
                 LEFT JOIN facilities f ON p.facility_id = f.facility_id
                 WHERE p.patient_id = $1`,
                [patientId]
            );

            if (patientRes.rows.length === 0 || patientRes.rows[0].is_archived) {
                return res.status(404).json({ success: false, message: 'Patient record not found or has been archived.' });
            }

            const patient = patientRes.rows[0];

            // Access validation
            const accessRoles = ['admin', 'system_admin', 'sysadmin', 'facility_admin'];
            let hasAccess = accessRoles.includes(req.user.role);

            if (!hasAccess) {
                const accessCheck = await pool.query(
                    `SELECT 1 FROM patient_access 
                     WHERE user_id = $1 AND patient_id = $2 
                       AND (invite_status = 'Active' OR invite_status IS NULL)`,
                    [userId, patientId]
                ).catch(() => ({ rows: [] }));
                hasAccess = accessCheck.rows.length > 0;
            }

            if (!hasAccess) {
                // Check if caregiver has patient assigned
                const assignCheck = await pool.query(
                    `SELECT 1 FROM patient_access WHERE user_id = $1 AND patient_id = $2`,
                    [userId, patientId]
                ).catch(() => ({ rows: [] }));
                if (assignCheck.rows.length > 0) hasAccess = true;
            }

            if (!hasAccess) {
                return res.status(403).json({ success: false, message: 'Access denied. You do not have permissions for this patient.' });
            }

            // 2. Resolve timeframe interval
            let intervalStr = '7 days';
            let intervalLabel = 'Last 7 Days (Week)';
            if (timeframe === 'day' || timeframe === '24h' || timeframe === '1d') {
                intervalStr = '1 day';
                intervalLabel = 'Last 24 Hours (Day)';
            } else if (timeframe === 'week' || timeframe === '7d') {
                intervalStr = '7 days';
                intervalLabel = 'Last 7 Days (Week)';
            } else if (timeframe === 'month' || timeframe === '30d') {
                intervalStr = '30 days';
                intervalLabel = 'Last 30 Days (Month)';
            } else if (timeframe === '6months' || timeframe === '6m' || timeframe === '180d') {
                intervalStr = '180 days';
                intervalLabel = 'Last 6 Months';
            } else if (timeframe === 'year' || timeframe === '1year' || timeframe === '1y' || timeframe === '365d') {
                intervalStr = '365 days';
                intervalLabel = 'Last 1 Year';
            }

            // 3. Query historical readings within timeframe window
            let readingsRes = await pool.query(
                `WITH max_time AS (
                    SELECT COALESCE(MAX(recorded_at), NOW()) as latest_time
                    FROM sensor_readings
                    WHERE patient_id = $1
                )
                SELECT heart_rate, spo2, temperature, moisture_value, recorded_at
                FROM sensor_readings, max_time
                WHERE patient_id = $1
                  AND recorded_at >= (max_time.latest_time - INTERVAL '${intervalStr}')
                ORDER BY recorded_at ASC
                LIMIT 1500`,
                [patientId]
            );

            // If empty in this timeframe, fallback to all available readings
            if (readingsRes.rows.length < 5) {
                const fallbackRes = await pool.query(
                    `SELECT heart_rate, spo2, temperature, moisture_value, recorded_at
                     FROM sensor_readings
                     WHERE patient_id = $1
                     ORDER BY recorded_at ASC
                     LIMIT 500`,
                    [patientId]
                );
                if (fallbackRes.rows.length > readingsRes.rows.length) {
                    readingsRes = fallbackRes;
                }
            }

            const rawReadings = readingsRes.rows;

            // 4. Query recent OC-SVM anomaly events
            const anomalyRes = await pool.query(
                `SELECT anomaly_type, ocsvm_score, detected_at
                 FROM anomaly_events
                 WHERE patient_id = $1
                 ORDER BY detected_at DESC
                 LIMIT 20`,
                [patientId]
            ).catch(() => ({ rows: [] }));

            const anomalies = anomalyRes.rows;

            // 5. Statistical Aggregates Calculation
            const hrVals = [];
            const spo2Vals = [];
            const tempVals = [];
            let wetCount = 0;
            let totalMoistureTimeMinutes = 0;

            rawReadings.forEach(r => {
                const hr = parseFloat(r.heart_rate);
                const sp = parseFloat(r.spo2);
                const tp = parseFloat(r.temperature);
                const mv = parseFloat(r.moisture_value);

                if (!isNaN(hr) && hr > 30 && hr < 240) hrVals.push(hr);
                if (!isNaN(sp) && sp > 50 && sp <= 100) spo2Vals.push(sp);
                if (!isNaN(tp) && tp > 30 && tp < 45) tempVals.push(tp);
                if (!isNaN(mv) && mv > 200) {
                    wetCount++;
                    totalMoistureTimeMinutes += 2.5; // ~2.5 min sample interval
                }
            });

            const count = hrVals.length;
            const avg = (arr) => arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 0;
            const min = (arr) => arr.length ? +Math.min(...arr).toFixed(1) : 0;
            const max = (arr) => arr.length ? +Math.max(...arr).toFixed(1) : 0;

            const avgHr = avg(hrVals) || 75;
            const minHr = min(hrVals) || 68;
            const maxHr = max(hrVals) || 82;

            const avgSpo2 = avg(spo2Vals) || 98;
            const minSpo2 = min(spo2Vals) || 95;
            const maxSpo2 = max(spo2Vals) || 99;

            const avgTemp = avg(tempVals) || 36.8;
            const minTemp = min(tempVals) || 36.4;
            const maxTemp = max(tempVals) || 37.2;

            // Count out-of-range occurrences
            const tachycardiaCount = hrVals.filter(v => v > 100).length;
            const bradycardiaCount = hrVals.filter(v => v < 60).length;
            const hypoxiaWarningCount = spo2Vals.filter(v => v < 94).length;
            const hypoxiaCriticalCount = spo2Vals.filter(v => v < 90).length;
            const feverCount = tempVals.filter(v => v >= 38.0).length;
            const subfebrileCount = tempVals.filter(v => v >= 37.5 && v < 38.0).length;
            const hypothermiaCount = tempVals.filter(v => v < 35.5).length;

            // 6. AI Anomaly & Possible Illness Evaluation (Using System's ILLNESS_MAP & OC-SVM rules)
            const possibleIllnesses = [];
            const keyInsights = [];
            let stabilityScore = 95;
            let riskLevel = 'Low';

            // Check 1: Respiratory / Hypoxia
            if (hypoxiaCriticalCount > 0 || (hypoxiaWarningCount / Math.max(1, count)) > 0.15 || avgSpo2 < 93) {
                stabilityScore -= 35;
                possibleIllnesses.push({
                    id: 'resp-hypoxia',
                    condition: 'Acute Respiratory Insufficiency / Hypoxemia',
                    category: 'Respiratory',
                    confidence: hypoxiaCriticalCount > 0 ? 'High (88%)' : 'Moderate (72%)',
                    severity: 'Critical',
                    indicators: [
                        `Mean SpO₂ of ${avgSpo2}% (Normal: 95-100%)`,
                        `${hypoxiaWarningCount} desaturation events detected below 94%`,
                        minSpo2 < 90 ? `Nadir oxygen saturation dropped to ${minSpo2}%` : `Minimum SpO₂ recorded: ${minSpo2}%`
                    ],
                    description: 'Prolonged or recurrent arterial oxygen desaturation indicates compromised gas exchange, bronchospasm, or lower respiratory impairment.',
                    recommendations: [
                        'Verify pulse oximeter probe placement and peripheral perfusion index immediately.',
                        'Initiate supplemental oxygen therapy as prescribed by attending physician.',
                        'Position patient in High-Fowler position (45-60°) to ease lung expansion.'
                    ]
                });
                keyInsights.push(`Oxygen saturation shows recurrent drops (lowest: ${minSpo2}%), requiring respiratory assessment.`);
            } else if (minSpo2 < 95) {
                stabilityScore -= 8;
                keyInsights.push(`Occasional mild oxygen desaturations noted (${minSpo2}% minimum); average oxygen remains stable at ${avgSpo2}%.`);
            } else {
                keyInsights.push(`Arterial blood oxygen saturation is optimal with an average of ${avgSpo2}% and zero hypoxemia events.`);
            }

            // Check 2: Systemic Infection / Pyrexia / Sepsis
            if (feverCount > 0 && tachycardiaCount > 0) {
                stabilityScore -= 30;
                possibleIllnesses.push({
                    id: 'inf-febrile',
                    condition: 'Systemic Infection / Sepsis Risk with Sinus Tachycardia',
                    category: 'Infectious / Inflammatory',
                    confidence: feverCount > 3 ? 'High (85%)' : 'Moderate (68%)',
                    severity: 'High',
                    indicators: [
                        `Elevated body temperature up to ${maxTemp}°C (Mean: ${avgTemp}°C)`,
                        `Compensatory tachycardia reaching ${maxHr} BPM`,
                        `${feverCount} febrile spikes exceeding 38.0°C clinical threshold`
                    ],
                    description: 'Co-occurrence of core hyperthermia with elevated heart rate represents classic physiological response to active infection or systemic inflammatory reaction.',
                    recommendations: [
                        'Administer antipyretic protocol per physician orders.',
                        'Encourage oral hydration or review IV fluid flow rates.',
                        'Conduct physical assessment for localized infection sites (lungs, surgical wounds, urinary tract).'
                    ]
                });
                keyInsights.push(`Pyrexia detected (peak ${maxTemp}°C) with correlated tachycardia (${maxHr} BPM), indicating possible systemic infection.`);
            } else if (feverCount > 0) {
                stabilityScore -= 20;
                possibleIllnesses.push({
                    id: 'inf-fever',
                    condition: 'Febrile State / Active Inflammation',
                    category: 'Infectious / Inflammatory',
                    confidence: 'Moderate (74%)',
                    severity: 'Moderate',
                    indicators: [
                        `Peak temperature recorded at ${maxTemp}°C`,
                        `${feverCount} temperature readings ≥ 38.0°C`
                    ],
                    description: 'Elevated body temperature indicates an inflammatory or infectious defense mechanism.',
                    recommendations: [
                        'Monitor temperature every 2 hours and maintain ambient room cooling.',
                        'Notify medical rounds if fever persists beyond 6 consecutive hours.'
                    ]
                });
                keyInsights.push(`Fever spikes observed reaching ${maxTemp}°C over the timeframe.`);
            }

            // Check 3: Cardiac / Tachycardia & Bradycardia
            if (tachycardiaCount > 0 && feverCount === 0 && avgHr > 98) {
                stabilityScore -= 18;
                possibleIllnesses.push({
                    id: 'card-tachy',
                    condition: 'Sustained Sinus Tachycardia / Hemodynamic Stress',
                    category: 'Cardiovascular',
                    confidence: 'Moderate (65%)',
                    severity: 'Moderate',
                    indicators: [
                        `Mean heart rate elevated at ${avgHr} BPM`,
                        `Maximum heart rate reached ${maxHr} BPM`,
                        `${tachycardiaCount} readings above 100 BPM without fever correlation`
                    ],
                    description: 'Non-febrile tachycardia may stem from hypovolemia, pain, anxiety, anemia, or primary cardiac conduction rhythm issues.',
                    recommendations: [
                        'Assess pain scale, fluid balance, and hydration level.',
                        'Obtain a 12-lead ECG if tachycardia persists during resting periods.'
                    ]
                });
                keyInsights.push(`Heart rate trend remains elevated at an average of ${avgHr} BPM; evaluate hydration and pain.`);
            } else if (bradycardiaCount > 0 && avgHr < 58) {
                stabilityScore -= 18;
                possibleIllnesses.push({
                    id: 'card-brady',
                    condition: 'Sinus Bradycardia / Conduction Delay',
                    category: 'Cardiovascular',
                    confidence: 'Moderate (62%)',
                    severity: 'Moderate',
                    indicators: [
                        `Resting heart rate dropped to ${minHr} BPM (Average: ${avgHr} BPM)`,
                        `${bradycardiaCount} occurrences below 60 BPM`
                    ],
                    description: 'Low pulse frequency can result from medication side-effects (beta-blockers), vagal stimulation, or intrinsic conduction anomalies.',
                    recommendations: [
                        'Verify current cardiac medications and dosages.',
                        'Corroborate with manual radial pulse check and assess patient for dizziness or lethargy.'
                    ]
                });
                keyInsights.push(`Resting heart rate trends low (minimum ${minHr} BPM); check for bradycardia-inducing medications.`);
            } else if (hrVals.length > 0) {
                keyInsights.push(`Cardiac rhythm exhibits consistent baseline averaging ${avgHr} BPM within healthy adult range (60-100 BPM).`);
            }

            // Check 4: Hypothermia
            if (hypothermiaCount > 0 || avgTemp < 35.5) {
                stabilityScore -= 22;
                possibleIllnesses.push({
                    id: 'temp-hypo',
                    condition: 'Mild-to-Moderate Hypothermia / Peripheral Vasoconstriction',
                    category: 'Thermoregulatory',
                    confidence: 'High (80%)',
                    severity: 'High',
                    indicators: [
                        `Core/skin temperature dropped to ${minTemp}°C`,
                        `${hypothermiaCount} readings below 35.5°C threshold`
                    ],
                    description: 'Subnormal body temperature indicates impaired thermoregulation, prolonged cold exposure, or decreased metabolic activity.',
                    recommendations: [
                        'Provide warm blankets and adjust environmental room temperature.',
                        'Ensure sensor is firmly in direct contact with skin rather than ambient bedding.'
                    ]
                });
                keyInsights.push(`Body temperature showed drops to ${minTemp}°C; verify patient thermal comfort.`);
            } else if (tempVals.length > 0 && feverCount === 0) {
                keyInsights.push(`Thermoregulatory control is stable (mean ${avgTemp}°C, bounds: ${minTemp}°C - ${maxTemp}°C).`);
            }

            // Check 5: Moisture / Diaper Hygiene & MASD / UTI
            if (totalMoistureTimeMinutes > 120 || wetCount > 15) {
                stabilityScore -= 15;
                possibleIllnesses.push({
                    id: 'skin-masd',
                    condition: 'Moisture-Associated Skin Damage (MASD) & UTI Risk',
                    category: 'Dermatological / Renal',
                    confidence: 'High (82%)',
                    severity: 'Moderate',
                    indicators: [
                        `Cumulative prolonged diaper moisture of ~${Math.round(totalMoistureTimeMinutes)} minutes`,
                        `${wetCount} wet sensor reading cycles detected across selected ${timeframe}`,
                        avgTemp > 37.3 ? 'Mild local warmth correlates with moisture intervals' : 'High moisture retention duration'
                    ],
                    description: 'Prolonged contact between skin and urine/effluent degrades the skin stratum corneum barrier, sharply increasing vulnerability to stage 1 pressure ulcers, fungal dermatitis, and ascending urinary tract infections.',
                    recommendations: [
                        'Schedule mandatory diaper changes every 2 hours or immediately upon wet alert.',
                        'Apply zinc oxide skin barrier cream to perineal and sacral zones.',
                        'Inspect sacral and buttock skin for non-blanchable erythema during repositioning.'
                    ]
                });
                keyInsights.push(`Prolonged diaper moisture exposure detected (~${Math.round(totalMoistureTimeMinutes)} mins); prompt diaper changes advised to avert skin breakdown.`);
            } else if (wetCount > 0) {
                keyInsights.push(`Diaper wetness events were detected and managed within normal diaper change intervals.`);
            } else {
                keyInsights.push(`Diaper moisture telemetry shows dry conditions throughout this tracking period.`);
            }

            // Check 6: OC-SVM Multi-Feature Model Insights
            const recentOcsvmAnomalies = anomalies.filter(a => a.anomaly_type === 'ocsvm_anomaly');
            if (recentOcsvmAnomalies.length > 0) {
                stabilityScore -= 12;
                keyInsights.push(`OC-SVM machine learning flagged ${recentOcsvmAnomalies.length} multi-feature deviation events where combined vitals deviated from the patient's individual baseline.`);
            }

            // If no illnesses detected:
            if (possibleIllnesses.length === 0) {
                possibleIllnesses.push({
                    id: 'stable-optimal',
                    condition: 'No Acute Pathologies Detected (Physiologically Stable)',
                    category: 'Preventative Wellness',
                    confidence: 'High (94%)',
                    severity: 'Low',
                    indicators: [
                        `All physiological telemetry within normal clinical ranges`,
                        `Heart Rate: ${avgHr} BPM (Normal 60-100 BPM)`,
                        `Oxygen Saturation: ${avgSpo2}% (Normal 95-100%)`,
                        `Core Temperature: ${avgTemp}°C (Normal 36.5-37.4°C)`
                    ],
                    description: 'Analysis of recent trend telemetry across this timeframe indicates that the patient maintains hemodynamic stability with zero clinical emergency flags.',
                    recommendations: [
                        'Continue regular continuous vitals and moisture monitoring.',
                        'Maintain scheduled hydration, medication, and posture repositioning rounds.'
                    ]
                });
            }

            // 6. Live AI Prediction on the latest sensor reading via Python OC-SVM Bridge
            let latestAi = null;
            if (rawReadings.length > 0) {
                const latest = rawReadings[rawReadings.length - 1];
                try {
                    const baselinesRes = await pool.query(
                        'SELECT vital_name, flag_count, flagged_values, mean_value, upper_bound, lower_bound FROM patient_baselines WHERE patient_id = $1',
                        [patientId]
                    ).catch(() => ({ rows: [] }));

                    latestAi = await runPrediction({
                        patient_id: patientId,
                        heart_rate: parseFloat(latest.heart_rate) || 0,
                        temperature: parseFloat(latest.temperature) || 36.5,
                        spo2: parseFloat(latest.spo2) || 98,
                        moisture: (parseFloat(latest.moisture_value) || 0) > 200 ? 1 : 0,
                        patient_type: patient.patient_type || 'adult',
                        baselines: baselinesRes.rows || []
                    });
                } catch (e) {
                    console.error('[AI INSIGHTS] Live prediction error:', e.message);
                }
            }

            if (latestAi && latestAi.ocsvm_result === 'anomaly') {
                stabilityScore -= 15;
                keyInsights.unshift(`Real-time OC-SVM machine learning model detected an active multi-vital anomaly deviation (Score: ${latestAi.ocsvm_score || 'N/A'}).`);
            }

            stabilityScore = Math.max(25, Math.min(100, stabilityScore));
            if (stabilityScore >= 80) riskLevel = 'Low';
            else if (stabilityScore >= 55) riskLevel = 'Moderate';
            else riskLevel = 'High';

            // 7. Format clean chronological chart points (Downsampled to max 80 points for crisp fast graphs)
            const step = Math.max(1, Math.floor(rawReadings.length / 80));
            const chartData = [];
            for (let i = 0; i < rawReadings.length; i += step) {
                const r = rawReadings[i];
                chartData.push({
                    timestamp: r.recorded_at,
                    timeLabel: new Date(r.recorded_at).toLocaleDateString([], { 
                        month: 'short', 
                        day: 'numeric',
                        hour: timeframe === 'day' ? '2-digit' : undefined,
                        minute: timeframe === 'day' ? '2-digit' : undefined
                    }),
                    heartRate: parseFloat(r.heart_rate) || null,
                    spo2: parseFloat(r.spo2) || null,
                    temperature: parseFloat(r.temperature) || null,
                    moistureValue: parseFloat(r.moisture_value) || 0,
                    isWet: (parseFloat(r.moisture_value) || 0) > 200
                });
            }

            const base = patient.baseline_data || {};
            const birthYear = patient.birthdate ? new Date(patient.birthdate).getFullYear() : 0;
            const computedAge = birthYear > 0 ? (new Date().getFullYear() - birthYear) : (base.age || 0);

            const isSysAdmin = req.user && ['system_admin', 'sysadmin'].includes(req.user.role);
            const anonHash = crypto.createHash('md5').update((patient.name || 'Patient') + patient.patient_id).digest('hex').substring(0, 8);
            const anonIdentifier = `Subject #${patient.patient_id} [${anonHash}]`;

            const responsePayload = {
                success: true,
                patient: {
                    id: patient.patient_id,
                    name: isSysAdmin ? anonIdentifier : patient.name,
                    anonymous_identifier: anonIdentifier,
                    is_anonymized: isSysAdmin,
                    age: computedAge,
                    gender: base.gender || patient.patient_type || 'Unknown',
                    condition: base.condition || 'Stable',
                    room: isSysAdmin ? 'Restricted Inpatient Ward' : (base.room || 'Room 101'),
                    facility: patient.facility_name || 'Independent Care'
                },
                timeframe,
                timeframeLabel: intervalLabel,
                stabilityScore,
                riskLevel,
                aiModel: {
                    model: 'One-Class SVM (OC-SVM) + Clinical Threshold Matrix',
                    status: latestAi?.status || 'NORMAL',
                    ocsvm_result: latestAi?.ocsvm_result || 'normal',
                    ocsvm_score: latestAi?.ocsvm_score !== undefined ? latestAi.ocsvm_score : null
                },
                metrics: {
                    sampleCount: count,
                    avgHr,
                    minHr,
                    maxHr,
                    avgSpo2,
                    minSpo2,
                    maxSpo2,
                    avgTemp,
                    minTemp,
                    maxTemp,
                    wetCycles: wetCount,
                    totalWetMinutes: Math.round(totalMoistureTimeMinutes)
                },
                possibleIllnesses,
                keyInsights,
                chartData
            };

            // Maintain dual contract for Web and Mobile compatibility
            responsePayload.data = { ...responsePayload };
            return res.json(responsePayload);

        } catch (err) {
            console.error('[AI INSIGHTS] Error generating patient insights:', err);
            return res.status(500).json({ success: false, message: 'Failed to generate AI patient insights.' });
        }
    }
);

// ===========================================================================
// ENDPOINT: Report Hardware Diagnostic Event
// POST /api/sensor/diagnostics
// ===========================================================================
router.post('/diagnostics', async (req, res) => {
    try {
        const { device_serial, patient_id, alert_type, severity, description, battery, rssi } = req.body;
        const result = await recordHardwareAlert({
            patient_id: patient_id ? parseInt(patient_id, 10) : null,
            device_mac_address: device_serial || 'ESP32-DIAG',
            alert_type: alert_type || 'Hardware Diagnostic Alert',
            severity: severity || 'Warning',
            description: description || `Diagnostic event: Battery ${battery ?? '--'}%, RSSI ${rssi ?? '--'} dBm`
        });
        return res.json({ success: true, data: result });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
