import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { playAlertTone, unlockAudioContext } from '@/lib/alert-sound';
import { toast } from 'sonner';

export interface AlertSyncEvent {
  type: string;
  alert_id?: number | string;
  alertId?: number | string;
  patient_id?: number | string;
  patientId?: number | string;
  patient_name?: string;
  severity?: string;
  message?: string;
  anomaly_type?: string;
  anomalyType?: string;
  category?: string;
  timestamp?: string;
  playSound?: boolean;
  isMuted?: boolean;
  userId?: number | string;
  acknowledgedBy?: number | string;
  action_taken?: string;
  [key: string]: any;
}

export function useAlertSync() {
  const { user } = useAuth();
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const isMutedRef = useRef(false);
  isMutedRef.current = isMuted;

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const API_BASE = import.meta.env.VITE_API_URL || '';

  // 1. Fetch initial mute state from server
  const fetchMuteStatus = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/alerts/sync-mute`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && typeof data.isMuted === 'boolean') {
        setIsMuted(data.isMuted);
      }
    } catch (_) {}
  }, [API_BASE]);

  // 2. Toggle mute state and broadcast to all devices (Web & Mobile)
  const toggleMute = useCallback(async (durationMinutes: number = 15) => {
    const token = localStorage.getItem('token');
    const newMuted = !isMutedRef.current;
    setIsMuted(newMuted);

    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/api/alerts/sync-mute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isMuted: newMuted, durationMinutes })
      });
      const data = await res.json();
      if (data.success) {
        toast.info(newMuted 
          ? `Alert audio muted on all devices for ${durationMinutes} minutes` 
          : 'Alert audio unmuted on all devices'
        );
      }
    } catch (e) {
      console.error('Failed to sync mute state:', e);
    }
  }, [API_BASE]);

  // 3. Test synchronized alert & sound across Web and Mobile
  const testRealtimeSync = useCallback(async (severity: 'Critical' | 'Warning' = 'Critical') => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/api/alerts/test-broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          severity,
          patientName: 'Maria Santos',
          message: severity === 'Critical'
            ? 'Heart rate spiked to 134 BPM (Threshold: 100 BPM). Room 302.'
            : 'Smart diaper moisture reached 88%. Diaper change recommended.'
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Live ${severity} Alert dispatched to both Web and Mobile devices!`);
      }
    } catch (e) {
      console.error('Failed to broadcast test alert:', e);
      toast.error('Failed to trigger test alert broadcast');
    }
  }, [API_BASE]);

  // 4. Unlock AudioContext on first user interaction to satisfy browser autoplay policy
  useEffect(() => {
    const handleUserInteraction = () => {
      unlockAudioContext();
    };

    window.addEventListener('click', handleUserInteraction, { once: false });
    window.addEventListener('keydown', handleUserInteraction, { once: false });
    window.addEventListener('touchstart', handleUserInteraction, { once: false });

    return () => {
      window.removeEventListener('click', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
    };
  }, []);

  // 5. Connect and maintain SSE connection
  useEffect(() => {
    if (!user) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    fetchMuteStatus();

    const connectSSE = () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const streamUrl = `${API_BASE}/api/alerts/events?token=${encodeURIComponent(token)}`;
      const es = new EventSource(streamUrl);
      eventSourceRef.current = es;

      es.addEventListener('connected', (e: MessageEvent) => {
        setIsConnected(true);
        try {
          const d = JSON.parse(e.data);
          if (typeof d.isMuted === 'boolean') {
            setIsMuted(d.isMuted);
          }
        } catch (_) {}
      });

      const handleAlertEvent = (eventData: AlertSyncEvent) => {
        // Dispatch custom event to notify all components in the web app
        window.dispatchEvent(new CustomEvent('alaga_alert_update', { detail: eventData }));

        const eventType = eventData.type;

        // Sound Mute Synchronization
        if (eventType === 'alert_sound_mute') {
          if (eventData.userId == null || String(eventData.userId) === String(user.id)) {
            const nextMuted = Boolean(eventData.isMuted);
            setIsMuted(nextMuted);
          }
          return;
        }

        // New Clinical or System Alert
        if (eventType === 'new_alert' || eventType === 'new_clinical_alert') {
          const severity = (eventData.severity || 'warning').toLowerCase();
          const patientName = eventData.patient_name || eventData.patientName || 'Patient';
          const msg = eventData.message || 'Abnormal vital telemetry detected.';

          // 1. Play Synchronized Sound if not muted
          if (!isMutedRef.current && eventData.playSound !== false) {
            playAlertTone(severity === 'critical' ? 'critical' : 'warning');
          }

          // 2. Display Toast Notification
          if (severity === 'critical') {
            toast.error(`🚨 CRITICAL: ${patientName}`, {
              description: msg,
              duration: 8000,
              action: {
                label: 'View',
                onClick: () => {
                  window.location.href = '/alerts';
                }
              }
            });
          } else {
            toast.warning(`⚠️ Alert: ${patientName}`, {
              description: msg,
              duration: 6000,
              action: {
                label: 'View',
                onClick: () => {
                  window.location.href = '/alerts';
                }
              }
            });
          }
          return;
        }

        // Alert Acknowledged on any device
        if (eventType === 'alert_acknowledged') {
          const ackUser = eventData.acknowledgedBy ? `by staff #${eventData.acknowledgedBy}` : '';
          toast.success(`Alert #${eventData.alertId || ''} Acknowledged ${ackUser}`.trim());
          return;
        }

        // Announcement / Broadcast
        if (eventType === 'new_announcement') {
          toast.info(eventData.title || 'New Announcement', {
            description: eventData.message,
            duration: 6000
          });
          if (!isMutedRef.current) {
            playAlertTone('warning');
          }
        }
      };

      // Listen to generic alert_update
      es.addEventListener('alert_update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          handleAlertEvent(data);
        } catch (err) {
          console.error('[useAlertSync] Error parsing alert_update data:', err);
        }
      });

      // Listen to specific event types
      const specificEvents = [
        'new_alert', 
        'new_clinical_alert', 
        'alert_acknowledged', 
        'alert_archived', 
        'alert_archived_bulk',
        'alert_sound_mute',
        'system_alert_resolved',
        'schedule_completed',
        'new_announcement',
        'device_status_update',
        'patient_telemetry_update'
      ];

      specificEvents.forEach(evt => {
        es.addEventListener(evt, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            handleAlertEvent(data);
          } catch (_) {}
        });
      });

      es.onerror = () => {
        setIsConnected(false);
        es.close();
        // Exponential backoff reconnect
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = setTimeout(connectSSE, 4000);
      };
    };

    connectSSE();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [user, API_BASE, fetchMuteStatus]);

  return {
    isMuted,
    isConnected,
    toggleMute,
    testRealtimeSync,
    fetchMuteStatus
  };
}
