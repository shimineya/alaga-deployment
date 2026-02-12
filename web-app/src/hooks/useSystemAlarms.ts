import { useState, useEffect } from 'react';
import { Patient, Alert } from '../types';
import { generateAlertsFromDoctorsOrders } from '../lib/alert-generator';

export const useSystemAlarms = (patients: Patient[]) => {
    // [FIX] Initialize as empty array []
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [silencedPatients, setSilencedPatients] = useState<Set<string>>(new Set());
    const [alarmSound, setAlarmSound] = useState<HTMLAudioElement | null>(null);

    // 1. Initialize Audio
    useEffect(() => {
        // Base64 silent/beep sound placeholder
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtjMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUKnl7a1gGgU7k9n3zH4tBSh+zPLajUIKFV644u+nUxQJRp/i8bllHgYugM/y4Y44CBttv/DooEoMDU+t6PKjYB4EOo/Y88B+LQUofM/y14xBCRZmuuPwp1QVCkaf4fK0YyAFLIDP8t2JOQYZ');
        audio.loop = true;
        setAlarmSound(audio);
        return () => {
            audio.pause();
            audio.src = '';
        };
    }, []);

    // 2. Generate Alerts (Every 60s)
    useEffect(() => {
        if (!patients || patients.length === 0) return;

        const interval = setInterval(() => {
            const newAlerts: Alert[] = [];
            if (Array.isArray(patients)) {
                patients.forEach(patient => {
                    const doctorOrderAlerts = generateAlertsFromDoctorsOrders(patient);
                    newAlerts.push(...doctorOrderAlerts);
                });
            }

            if (newAlerts.length > 0) {
                setAlerts(prev => {
                    const existingIds = new Set(prev.map(a => a.id));
                    return [...prev, ...newAlerts.filter(a => !existingIds.has(a.id))];
                });
            }
        }, 60000);

        return () => clearInterval(interval);
    }, [patients]);

    // 3. Play Sound on Critical
    useEffect(() => {
        if (!alarmSound) return;

        const hasCritical = patients.some(p => {
            if (silencedPatients.has(p.id)) return false;
            return alerts.some(a =>
                a.patientId === p.id && !a.acknowledged && a.severity === 'critical'
            );
        });

        if (hasCritical) {
            alarmSound.play().catch(e => console.log("Audio play blocked", e));
        } else {
            alarmSound.pause();
            if (alarmSound.currentTime > 0) alarmSound.currentTime = 0;
        }
    }, [patients, alerts, alarmSound, silencedPatients]);

    const acknowledgeAlert = (alertId: string | number) => {
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a));
    };

    const markAllRead = () => {
        setAlerts(prev => prev.map(a => ({ ...a, acknowledged: true })));
    };

    const silencePatient = (patientId: string) => {
        setSilencedPatients(prev => new Set(prev).add(patientId));
    };

    // [CRITICAL] Must return 'alerts' for the dashboard to use
    return { alerts, acknowledgeAlert, markAllRead, silencePatient };
};