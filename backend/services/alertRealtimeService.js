/**
 * Real-time SSE (Server-Sent Events) Service for ALAGA Notifications & Alerts
 * 
 * Provides an instant real-time synchronization bridge between:
 * - Web App (GlobalNotificationBell, AlertsHub, useAlertSync)
 * - Mobile App (AlertNotificationService, NotificationScreen, Dashboard badge)
 * - Hardware / Sensor Ingestion & AI anomaly pipeline
 */

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
    const clientId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const client = {
        id: clientId,
        userId: userId ? String(userId) : null,
        role: req.user?.role,
        facilityId: req.user?.facility_id,
        res
    };

    clients.add(client);
    console.log(`[Realtime Alert SSE] Client connected: ${clientId} (User: ${userId || 'anon'}, Role: ${req.user?.role || 'unknown'}). Total active clients: ${clients.size}`);

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
 * Broadcast an alert or notification change event to all connected clients
 * @param {string} eventType - e.g. 'new_alert', 'alert_acknowledged', 'alert_archived', 'alert_sound_mute', 'system_alert'
 * @param {object} payload - event details
 */
function broadcastAlert(eventType, payload = {}) {
    const enrichedPayload = {
        type: eventType,
        ...payload,
        timestamp: payload.timestamp || new Date().toISOString()
    };
    const messageData = JSON.stringify(enrichedPayload);

    console.log(`[Realtime Alert SSE] Broadcasting '${eventType}' to ${clients.size} connected client(s):`, payload.message || payload.alertId || payload.alert_id || '');

    for (const client of clients) {
        try {
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
    getActiveClientCount: () => clients.size
};
