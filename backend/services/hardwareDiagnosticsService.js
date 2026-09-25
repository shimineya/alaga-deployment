/**
 * Hardware Diagnostics Service
 * ============================
 * Provides automated monitoring, diagnosis, and alerting for IoT diaper & vitals devices:
 * - Low Battery Alerts (<20% Warning, <10% Critical)
 * - Sensor Probe Detachment / Hardware Malfunctions
 * - Weak Signal / High Packet Loss (RSSI < -85 dBm)
 * - Device Disconnected / Heartbeat Timeout (>10 minutes inactive)
 * - Real-time SSE broadcasting to Web & Mobile dashboards
 */

const pool = require('../db');
const { broadcastAlert } = require('./alertRealtimeService');

/**
 * Record a hardware diagnostic alert in hardware_system_alerts
 * Prevents redundant duplicate alerts within 10 minutes.
 */
async function recordHardwareAlert({ patient_id, device_mac_address, alert_type, severity = 'Warning', description }) {
    try {
        // Prevent duplicate spam: check if identical active alert exists within last 10 minutes
        const recentCheck = await pool.query(
            `SELECT sys_alert_id FROM hardware_system_alerts
             WHERE alert_type = $1 AND status = 'Active'
               AND (patient_id = $2 OR ($2 IS NULL AND patient_id IS NULL))
               AND (device_mac_address = $3 OR ($3 IS NULL AND device_mac_address IS NULL))
               AND triggered_at > NOW() - INTERVAL '10 minutes'
             LIMIT 1`,
            [alert_type, patient_id || null, device_mac_address || null]
        );

        if (recentCheck.rowCount > 0) {
            return { skipped: true, existingId: recentCheck.rows[0].sys_alert_id };
        }

        const insertRes = await pool.query(
            `INSERT INTO hardware_system_alerts 
                 (patient_id, device_mac_address, alert_type, severity, description, status, triggered_at)
             VALUES ($1, $2, $3, $4, $5, 'Active', NOW())
             RETURNING sys_alert_id, triggered_at`,
            [patient_id || null, device_mac_address || null, alert_type, severity, description]
        );

        const newAlertId = insertRes.rows[0]?.sys_alert_id;

        // Fetch patient name for richer notification
        let patientName = null;
        if (patient_id) {
            const pRes = await pool.query('SELECT name FROM patients WHERE patient_id = $1', [patient_id]);
            patientName = pRes.rows[0]?.name;
        }

        // Real-time broadcast to Web and Mobile apps
        broadcastAlert('new_alert', {
            sys_alert_id: newAlertId,
            alert_id: newAlertId,
            category: 'Hardware',
            alert_type,
            severity,
            description,
            patient_id,
            patient_name: patientName,
            device_mac_address,
            triggered_at: insertRes.rows[0]?.triggered_at,
            playSound: severity.toLowerCase() === 'critical'
        });

        return { success: true, sys_alert_id: newAlertId };
    } catch (err) {
        console.error('[HARDWARE_DIAGNOSTICS] Error recording alert:', err.message);
        return { success: false, error: err.message };
    }
}

/**
 * Periodically evaluate active devices for offline / disconnection timeouts
 */
async function checkDeviceHeartbeats() {
    try {
        // Query assigned active devices with no sensor reading in past 10 minutes
        const inactiveDevices = await pool.query(
            `SELECT d.serial_number, d.device_name, d.assigned_patient_id, p.name as patient_name,
                    MAX(r.recorded_at) as last_seen
             FROM device_whitelist d
             JOIN patients p ON d.assigned_patient_id = p.patient_id
             LEFT JOIN sensor_readings r ON r.patient_id = p.patient_id
             WHERE d.is_archived IS DISTINCT FROM TRUE
               AND d.status = 'active'
             GROUP BY d.serial_number, d.device_name, d.assigned_patient_id, p.name
             HAVING MAX(r.recorded_at) < NOW() - INTERVAL '10 minutes'
                 OR MAX(r.recorded_at) IS NULL`
        );

        for (const row of inactiveDevices.rows) {
            const lastTimeStr = row.last_seen 
                ? new Date(row.last_seen).toLocaleTimeString() 
                : 'Never';
            await recordHardwareAlert({
                patient_id: row.assigned_patient_id,
                device_mac_address: row.serial_number,
                alert_type: 'Device Disconnected',
                severity: 'Warning',
                description: `IoT Device "${row.device_name || row.serial_number}" appears offline. No telemetry received since ${lastTimeStr}.`
            });
        }
    } catch (err) {
        // Silent catch for background heartbeat probe
    }
}

// Run periodic check every 3 minutes
setInterval(checkDeviceHeartbeats, 3 * 60 * 1000);

module.exports = {
    recordHardwareAlert,
    checkDeviceHeartbeats
};
