const pool = require('../db');

const clients = new Set();
// Map of userId -> { isMuted: boolean, expiresAt: number }
const userMutes = new Map();

/**
 * Set mute status for a user across all their devices (Web & Mobile)
 */
function setMuteStatus(userId, isMuted, durationMinutes = 15) {
    if (!userId) return;
    const uid = String(userId);
    if (!isMuted) {
        userMutes.delete(uid);
    } else {
        const expiresAt = Date.now() + durationMinutes * 60 * 1000;
        userMutes.set(uid, { isMuted: true, expiresAt });
    }
}

/**
 * Check if sound alerts are currently muted for this user
 */
function getMuteStatus(userId) {
    if (!userId) return false;
    const uid = String(userId);
    const entry = userMutes.get(uid);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
        userMutes.delete(uid);
        return false;
    }
    return entry.isMuted;
}

/**
 * Refresh accessible patient IDs for a specific client
 */
async function refreshClientAccess(client) {
    if (!client || !client.userId || client.allAccess) return;
    try {
        let res;
        if (client.role === 'facility_admin') {
            res = await pool.query(`
                SELECT pa.patient_id FROM patient_access pa JOIN users u ON pa.user_id = u.user_id WHERE u.created_by = $1
                UNION
                SELECT pa2.patient_id FROM patient_access pa2 WHERE pa2.invited_by = $1
                UNION
                SELECT p2.patient_id FROM patients p2 WHERE p2.baseline_data->>'created_by' = $1::text
            `, [client.userId]);
        } else {
            // caregiver, medical_staff, parent, nurse, doctor
            res = await pool.query(`
                SELECT pa.patient_id FROM patient_access pa WHERE pa.user_id = $1 AND pa.is_archived IS DISTINCT FROM TRUE
                UNION
                SELECT dw.assigned_patient_id FROM device_whitelist dw WHERE dw.assigned_patient_id IS NOT NULL AND dw.added_by = $1
            `, [client.userId]);
        }
        client.accessiblePatientIds = new Set(res.rows.map(r => String(r.patient_id)));
    } catch (err) {
        console.error(`[Realtime Alert SSE] Error fetching patient access for user ${client.userId}:`, err.message);
    }
}

/**
 * Refresh access for all connected clients (e.g. after assignment or pairing changes)
 */
function refreshAllClientsAccess() {
    for (const client of clients) {
        refreshClientAccess(client).catch(() => {});
    }
}

/**
 * Handle incoming SSE stream connection from Web App or Mobile App
 */
function handleAlertStream(req, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
        res.flushHeaders();
    }

    const userId = req.user?.id;
    const userRole = (req.user?.role || '').toLowerCase();
    const isSysAdmin = req.user?.is_sysadmin || ['system_admin', 'sysadmin', 'admin'].includes(userRole);

    const clientId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const client = {
        id: clientId,
        userId: userId ? String(userId) : null,
        role: userRole,
        facilityId: req.user?.facility_id,
        allAccess: isSysAdmin,
        accessiblePatientIds: new Set(),
        res
    };

    clients.add(client);
    console.log(`[Realtime Alert SSE] Client connected: ${clientId} (User: ${userId || 'anon'}, Role: ${userRole || 'unknown'}). Total active clients: ${clients.size}`);

    // Pre-populate accessible patients for non-sysadmins
    if (!isSysAdmin && userId) {
        refreshClientAccess(client);
    }

    // Initial connection acknowledgment with active mute status
    try {
        const initialPayload = JSON.stringify({ 
            connected: true, 
            clientId,
            isMuted: getMuteStatus(userId),
            timestamp: new Date().toISOString() 
        });
        res.write(`event: connected\ndata: ${initialPayload}\n\n`);
    } catch (_) {}

    // 15-second heartbeat to keep connection alive through any reverse proxy/network/mobile NAT
    const heartbeatTimer = setInterval(() => {
        try {
            res.write(': keepalive\n\n');
        } catch {
            clearInterval(heartbeatTimer);
            clients.delete(client);
        }
    }, 15000);

    req.on('close', () => {
        clearInterval(heartbeatTimer);
        clients.delete(client);
        console.log(`[Realtime Alert SSE] Client disconnected: ${clientId}. Remaining clients: ${clients.size}`);
    });
}

/**
 * Broadcast an alert or notification change event to appropriately scoped clients
 * @param {string} eventType - e.g. 'new_alert', 'new_clinical_alert', 'alert_acknowledged', 'alert_archived', 'alert_sound_mute', 'system_alert'
 * @param {object} payload - event details
 */
async function broadcastAlert(eventType, payload = {}) {
    const enrichedPayload = {
        type: eventType,
        ...payload,
        timestamp: payload.timestamp || new Date().toISOString()
    };
    const messageData = JSON.stringify(enrichedPayload);

    // Extract target patient ID if present
    const rawPatientId = payload.patient_id ?? payload.patientId ?? payload.target_patient_id;
    const targetPatientId = rawPatientId != null ? String(rawPatientId) : null;

    // Extract target user ID if present (e.g. for personal notifications, sound mute sync)
    const rawUserId = payload.userId ?? payload.user_id ?? payload.target_user_id;
    const targetUserId = rawUserId != null ? String(rawUserId) : null;

    console.log(`[Realtime Alert SSE] Broadcasting '${eventType}' (Patient: ${targetPatientId || 'N/A'}, TargetUser: ${targetUserId || 'All'}) to ${clients.size} connected client(s)`);

    for (const client of clients) {
        try {
            // 1. Direct user targeting (e.g. mute toggle or specific user notification)
            if (targetUserId && eventType === 'alert_sound_mute') {
                if (client.userId !== targetUserId) {
                    continue; // Skip clients that do not belong to this user
                }
            }

            // 2. Patient access restriction for patient-specific alerts/events
            if (targetPatientId && !client.allAccess) {
                // If client does not have this patient in cached access set, check on-demand
                if (!client.accessiblePatientIds || !client.accessiblePatientIds.has(targetPatientId)) {
                    let allowed = false;
                    try {
                        let chk;
                        if (client.role === 'facility_admin') {
                            chk = await pool.query(`
                                SELECT 1 FROM patient_access pa JOIN users u ON pa.user_id = u.user_id WHERE u.created_by = $1 AND pa.patient_id = $2
                                UNION
                                SELECT 1 FROM patient_access pa2 WHERE pa2.invited_by = $1 AND pa2.patient_id = $2
                                UNION
                                SELECT 1 FROM patients p2 WHERE p2.baseline_data->>'created_by' = $1::text AND p2.patient_id = $2
                            `, [client.userId, targetPatientId]);
                        } else {
                            chk = await pool.query(`
                                SELECT 1 FROM patient_access pa WHERE pa.user_id = $1 AND pa.patient_id = $2 AND pa.is_archived IS DISTINCT FROM TRUE
                                UNION
                                SELECT 1 FROM device_whitelist dw WHERE dw.assigned_patient_id = $2 AND dw.added_by = $1
                            `, [client.userId, targetPatientId]);
                        }
                        if (chk.rows.length > 0) {
                            if (!client.accessiblePatientIds) client.accessiblePatientIds = new Set();
                            client.accessiblePatientIds.add(targetPatientId);
                            allowed = true;
                        }
                    } catch (_) {}

                    if (!allowed) {
                        // Client is not authorized to see alerts for this patient! Skip sending!
                        continue;
                    }
                }
            }

            // Send both generic 'alert_update' and specific eventType for maximum compatibility
            client.res.write(`event: alert_update\ndata: ${messageData}\n\n`);
            if (eventType !== 'alert_update') {
                client.res.write(`event: ${eventType}\ndata: ${messageData}\n\n`);
            }
        } catch {
            clients.delete(client);
        }
    }
}

module.exports = {
    handleAlertStream,
    broadcastAlert,
    setMuteStatus,
    getMuteStatus,
    refreshClientAccess,
    refreshAllClientsAccess,
    getActiveClientCount: () => clients.size
};
