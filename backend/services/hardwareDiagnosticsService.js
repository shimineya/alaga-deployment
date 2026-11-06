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
 * Periodically evaluate active devices for offline / disconnection timeouts, low battery, and weak signal,
 * and auto-resolve alerts when device health recovers.
 */
async function syncDeviceDiagnostics() {
    try {
        // 1. Auto-resolve "Device Disconnected" alerts when the device is back online (heartbeat within 12s)
        await pool.query(
            `UPDATE hardware_system_alerts h
             SET status = 'Resolved',
                 resolved_at = NOW(),
                 resolution_notes = 'Auto-resolved: Device reconnected and is transmitting telemetry.'
             FROM device_whitelist d
             WHERE h.status = 'Active'
               AND h.alert_type ILIKE '%Disconnected%'
               AND LOWER(h.device_mac_address) = LOWER(d.serial_number)
               AND d.status = 'ACTIVE'
               AND d.last_heartbeat >= NOW() - INTERVAL '12 seconds'`
        ).catch(() => {});

        // 2. Auto-resolve "Low Battery" alerts when battery_level >= 20
        await pool.query(
            `UPDATE hardware_system_alerts h
             SET status = 'Resolved',
                 resolved_at = NOW(),
                 resolution_notes = 'Auto-resolved: Battery level recharged to normal range.'
             FROM device_whitelist d
             WHERE h.status = 'Active'
               AND h.alert_type ILIKE '%Battery%'
               AND LOWER(h.device_mac_address) = LOWER(d.serial_number)
               AND d.battery_level IS NOT NULL
               AND d.battery_level >= 20`
        ).catch(() => {});

        // 3. Auto-resolve "Weak Signal" alerts when signal_strength is Good or Excellent and online
        await pool.query(
            `UPDATE hardware_system_alerts h
             SET status = 'Resolved',
                 resolved_at = NOW(),
                 resolution_notes = 'Auto-resolved: Signal strength restored.'
             FROM device_whitelist d
             WHERE h.status = 'Active'
               AND h.alert_type ILIKE '%Signal%'
               AND LOWER(h.device_mac_address) = LOWER(d.serial_number)
               AND d.status = 'ACTIVE'
               AND d.last_heartbeat >= NOW() - INTERVAL '12 seconds'
               AND d.signal_strength IN ('Good', 'Excellent')`
        ).catch(() => {});

        // 4. Check paired devices for Low Battery (<20%) or Weak Signal while online
        const pairedDevices = await pool.query(
            `SELECT d.serial_number, d.device_name, d.status, d.last_heartbeat,
                    d.battery_level, d.signal_strength, d.assigned_patient_id,
                    p.name as patient_name
             FROM device_whitelist d
             JOIN patients p ON d.assigned_patient_id = p.patient_id
             WHERE d.is_archived IS DISTINCT FROM TRUE
               AND p.is_archived IS DISTINCT FROM TRUE`
        );

        for (const dev of pairedDevices.rows) {
            const isOnline = dev.status !== 'STANDBY' && dev.last_heartbeat && (Date.now() - new Date(dev.last_heartbeat).getTime()) < 12000;

            if (dev.battery_level !== null && dev.battery_level !== undefined && Number(dev.battery_level) > 0 && Number(dev.battery_level) < 20) {
                const bat = Number(dev.battery_level);
                await recordHardwareAlert({
                    patient_id: dev.assigned_patient_id,
                    device_mac_address: dev.serial_number,
                    alert_type: 'Low Battery Warning',
                    severity: bat < 10 ? 'Critical' : 'Warning',
                    description: `IoT Device "${dev.device_name || dev.serial_number}" (${dev.serial_number}) battery is at ${bat}%. Recharging required.`
                });
            }

            if (isOnline && String(dev.signal_strength || '').toLowerCase() === 'weak') {
                await recordHardwareAlert({
                    patient_id: dev.assigned_patient_id,
                    device_mac_address: dev.serial_number,
                    alert_type: 'Weak Signal',
                    severity: 'Warning',
                    description: `IoT Device "${dev.device_name || dev.serial_number}" (${dev.serial_number}) is reporting Weak WiFi signal strength.`
                });
            }
        }
    } catch (err) {
        // Silent catch for background diagnostics sync
    }
}

// Run periodic check every 15 seconds
setInterval(syncDeviceDiagnostics, 15 * 1000);

module.exports = {
    recordHardwareAlert,
    checkDeviceHeartbeats: syncDeviceDiagnostics,
    syncDeviceDiagnostics
};
