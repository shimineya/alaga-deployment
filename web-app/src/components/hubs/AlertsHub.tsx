import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { 
    AlertCircle, CheckCircle2, Shield, Activity, HardDrive, Flag, Sparkles, Archive, 
    Volume2, VolumeX, BellRing, Search, Filter, BatteryCharging, Wifi, WifiOff, AlertTriangle, 
    Droplets, HeartPulse, X, Play, Radio 
} from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { AcknowledgeModal } from '../ui/AcknowledgeModal';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { playAlertTone, unlockAudioContext } from '../../lib/alert-sound';
import { useAlertSync } from '../../hooks/useAlertSync';

interface ClinicalAlert {
    alert_id: number;
    patient_id?: number;
    severity: string;
    message: string;
    status: string;
    sent_at: string;
    patient_name: string;
    anomaly_type: string;
    is_anonymized?: boolean;
    flag_count?: number;
    remaining_flags?: number;
    is_suppressed?: boolean;
}

interface SystemAlert {
    sys_alert_id: number;
    alert_type: string;
    severity: string;
    description: string;
    status: string;
    triggered_at: string;
    patient_name: string;
    is_anonymized?: boolean;
    device_serial_number?: string | null;
    device_name?: string | null;
    device_status?: string | null;
    is_device_online?: boolean;
    battery_level?: number | null;
    signal_strength?: string | null;
}

interface SyncedDevice {
    serial_number: string;
    device_name: string;
    status: string;
    is_online?: boolean;
    last_heartbeat: string | null;
    battery_level: number | null;
    signal_strength: string | null;
    assigned_patient_id: number | null;
    assigned_patient_name: string | null;
}

const AlertsHub: React.FC = () => {
    const { user, token, isSysAdmin: authIsSysAdmin } = useAuth();
    const isSysAdmin = Boolean(authIsSysAdmin || (user?.role as string) === 'system_admin' || (user?.role as string) === 'admin' || (user?.role as string) === 'sysadmin');

    // System Admins are restricted from viewing alerts to enforce privacy and clinical boundaries
    if (isSysAdmin) {
        return (
            <div className="w-full h-full flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
                        <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-lg font-bold text-slate-800">Access Restricted</h2>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            System Administrators do not have access to patient alerts. Alert monitoring and response are managed exclusively by clinical staff, assigned caregivers, and facility administrators.
                        </p>
                    </div>
                    <div className="pt-2">
                        <a
                            href="/dashboard"
                            className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
                        >
                            Return to Dashboard
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    const [activeTab, setActiveTab] = useState(isSysAdmin ? 'system' : 'clinical');
    const [clinicalAlerts, setClinicalAlerts] = useState<ClinicalAlert[]>([]);
    const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);
    const [devices, setDevices] = useState<SyncedDevice[]>([]);
    const [pingingSerial, setPingingSerial] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [isInactive, setIsInactive] = useState(false);
    const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [ackModalOpen, setAckModalOpen] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState<ClinicalAlert | null>(null);

    const location = useLocation();
    const initialSelectedId = location.state?.selectedAlertId;
    const [filterAlertId, setFilterAlertId] = useState<string | null>(initialSelectedId || null);

    const searchParams = new URLSearchParams(location.search);
    const initialSearch = searchParams.get('search') || '';
    const [searchQuery, setSearchQuery] = useState(initialSearch);
    const [clinicalFilterType, setClinicalFilterType] = useState<'all' | 'ai_anomaly' | 'emergency' | 'wet_diaper' | 'vitals'>('all');
    const [systemFilterType, setSystemFilterType] = useState<'all' | 'low_battery' | 'disconnected' | 'sensor_malfunction' | 'weak_signal'>('all');
    const [sortOrder, setSortOrder] = useState<'severity' | 'chronological'>('severity');

    useEffect(() => {
        if (initialSelectedId) {
            setFilterAlertId(initialSelectedId);
            if (initialSelectedId.startsWith('system_')) {
                setActiveTab('system');
            } else if (initialSelectedId.startsWith('clinical_')) {
                setActiveTab('clinical');
            }
        }
    }, [initialSelectedId]);

    const displayedClinicalAlerts = useMemo(() => {
        let list = clinicalAlerts;
        if (filterAlertId && filterAlertId.startsWith('clinical_')) {
            const targetId = parseInt(filterAlertId.replace('clinical_', ''));
            list = list.filter(a => a.alert_id === targetId);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(a => 
                (a.patient_name && a.patient_name.toLowerCase().includes(q)) ||
                (a.message && a.message.toLowerCase().includes(q)) ||
                (a.anomaly_type && a.anomaly_type.toLowerCase().includes(q))
            );
        }
        if (clinicalFilterType === 'ai_anomaly') {
            list = list.filter(a => {
                const anom = (a.anomaly_type || '').toLowerCase();
                const msg = (a.message || '').toLowerCase();
                return anom.includes('ocsvm') || anom.includes('pattern') || msg.includes('oc-svm') || msg.includes('baseline') || msg.includes('deviation') || msg.includes('abnormal pattern');
            });
        } else if (clinicalFilterType === 'emergency') {
            list = list.filter(a => 
                a.severity?.toLowerCase() === 'critical' || 
                (a.message || '').toLowerCase().includes('emergency') ||
                (a.message || '').toLowerCase().includes('critical')
            );
        } else if (clinicalFilterType === 'wet_diaper') {
            list = list.filter(a => {
                const anom = (a.anomaly_type || '').toLowerCase();
                const msg = (a.message || '').toLowerCase();
                return anom.includes('moisture') || anom.includes('diaper') || msg.includes('wet diaper') || msg.includes('moisture');
            });
        } else if (clinicalFilterType === 'vitals') {
            list = list.filter(a => {
                const anom = (a.anomaly_type || '').toLowerCase();
                const msg = (a.message || '').toLowerCase();
                return anom.includes('heart_rate') || anom.includes('temp') || anom.includes('spo2') ||
                       msg.includes('bpm') || msg.includes('tachycardia') || msg.includes('bradycardia') ||
                       msg.includes('fever') || msg.includes('hypothermia') || msg.includes('spo2') || msg.includes('pulse');
            });
        }

        // Apply user-selected Sort Option:
        // Option 1 ('severity', Default): Severity-First (Critical -> Warning -> Info), then Newest on Top (sent_at DESC)
        // Option 2 ('chronological'): Pure Chronological (sent_at DESC) + Deduplicate Consecutive Identical Alerts per Patient
        const sorted = [...list].sort((a, b) => {
            const timeA = a.sent_at ? new Date(a.sent_at).getTime() : 0;
            const timeB = b.sent_at ? new Date(b.sent_at).getTime() : 0;
            if (sortOrder === 'severity') {
                const getRank = (sev?: string) => {
                    const s = (sev || '').toLowerCase();
                    if (s === 'critical') return 1;
                    if (s === 'high' || s === 'warning') return 2;
                    return 3;
                };
                const rA = getRank(a.severity);
                const rB = getRank(b.severity);
                if (rA !== rB) return rA - rB;
            }
            return timeB - timeA;
        });

        if (sortOrder === 'chronological') {
            const deduped: ClinicalAlert[] = [];
            const lastAnomalyByPatient = new Map<string, string>();
            for (const row of sorted) {
                const pKey = String((row as any).patient_id || row.patient_name || 'unknown');
                const rawAnom = String(row.anomaly_type || row.alert_category || '').toLowerCase();
                const anomFamily = rawAnom.includes('heart_rate') ? 'heart_rate'
                    : rawAnom.includes('temp') ? 'temperature'
                    : rawAnom.includes('spo2') ? 'spo2'
                    : rawAnom.includes('moisture') ? 'moisture'
                    : rawAnom || String(row.message || '').slice(0, 40);
                if (lastAnomalyByPatient.get(pKey) === anomFamily) {
                    continue;
                }
                lastAnomalyByPatient.set(pKey, anomFamily);
                deduped.push(row);
            }
            return deduped;
        }

        return sorted;
    }, [clinicalAlerts, filterAlertId, searchQuery, clinicalFilterType, sortOrder]);

    const displayedSystemAlerts = useMemo(() => {
        let list = systemAlerts;
        if (filterAlertId && filterAlertId.startsWith('system_')) {
            const targetId = parseInt(filterAlertId.replace('system_', ''));
            list = list.filter(a => a.sys_alert_id === targetId);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(a => 
                (a.patient_name && a.patient_name.toLowerCase().includes(q)) ||
                (a.description && a.description.toLowerCase().includes(q)) ||
                (a.alert_type && a.alert_type.toLowerCase().includes(q)) ||
                (a.device_serial_number && a.device_serial_number.toLowerCase().includes(q))
            );
        }
        if (systemFilterType === 'low_battery') {
            list = list.filter(a => 
                (a.alert_type || '').toLowerCase().includes('battery') ||
                (a.description || '').toLowerCase().includes('battery')
            );
        } else if (systemFilterType === 'disconnected') {
            list = list.filter(a => 
                (a.alert_type || '').toLowerCase().includes('disconnect') ||
                (a.alert_type || '').toLowerCase().includes('offline') ||
                (a.description || '').toLowerCase().includes('disconnect') ||
                (a.description || '').toLowerCase().includes('offline')
            );
        } else if (systemFilterType === 'sensor_malfunction') {
            list = list.filter(a => 
                (a.alert_type || '').toLowerCase().includes('sensor') ||
                (a.alert_type || '').toLowerCase().includes('probe') ||
                (a.alert_type || '').toLowerCase().includes('malfunction') ||
                (a.description || '').toLowerCase().includes('probe') ||
                (a.description || '').toLowerCase().includes('fault')
            );
        } else if (systemFilterType === 'weak_signal') {
            list = list.filter(a => 
                (a.alert_type || '').toLowerCase().includes('signal') ||
                (a.alert_type || '').toLowerCase().includes('rssi') ||
                (a.description || '').toLowerCase().includes('signal') ||
                (a.description || '').toLowerCase().includes('rssi')
            );
        }
        return [...list].sort((a, b) => {
            const timeA = a.triggered_at ? new Date(a.triggered_at).getTime() : 0;
            const timeB = b.triggered_at ? new Date(b.triggered_at).getTime() : 0;
            if (sortOrder === 'severity') {
                const getRank = (sev?: string) => {
                    const s = (sev || '').toLowerCase();
                    if (s === 'critical') return 1;
                    if (s === 'high' || s === 'warning') return 2;
                    return 3;
                };
                const rA = getRank(a.severity);
                const rB = getRank(b.severity);
                if (rA !== rB) return rA - rB;
            }
            return timeB - timeA;
        });
    }, [systemAlerts, filterAlertId, searchQuery, systemFilterType, sortOrder]);

    const API_BASE = import.meta.env.VITE_API_URL || '';
    const getHeaders = () => ({
        headers: { Authorization: `Bearer ${token}` }
    });

    const resetInactivity = () => {
        setIsInactive(false);
        if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = setTimeout(() => setIsInactive(true), 60000);
    };

    const { isMuted, toggleMute, testRealtimeSync } = useAlertSync();
    const soundIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Active unacknowledged & unflagged alerts:
    // Only alerts that are NOT acknowledged, NOT suppressed (flag_count < 5), and not archived
    const activeUnacknowledgedAlerts = useMemo(() => {
        return clinicalAlerts.filter(a => 
            a.status !== 'Acknowledged' && 
            (a.flag_count || 0) < 5 && 
            !a.is_suppressed
        );
    }, [clinicalAlerts]);

    const highestEmergency = useMemo<'critical' | 'warning' | 'none'>(() => {
        const hasCritical = activeUnacknowledgedAlerts.some(a => a.severity?.toLowerCase() === 'critical');
        if (hasCritical) return 'critical';
        const hasWarning = activeUnacknowledgedAlerts.some(a => a.severity?.toLowerCase() === 'warning');
        if (hasWarning) return 'warning';
        return 'none';
    }, [activeUnacknowledgedAlerts]);

    const playEmergencySound = (level: 'critical' | 'warning') => {
        if (isMuted) return;
        playAlertTone(level);
    };

    useEffect(() => {
        const handleUnlock = () => {
            unlockAudioContext();
        };

        window.addEventListener('mousemove', resetInactivity);
        window.addEventListener('keydown', resetInactivity);
        window.addEventListener('click', handleUnlock);
        window.addEventListener('touchstart', handleUnlock);
        resetInactivity();

        return () => {
            window.removeEventListener('mousemove', resetInactivity);
            window.removeEventListener('keydown', resetInactivity);
            window.removeEventListener('click', handleUnlock);
            window.removeEventListener('touchstart', handleUnlock);
            if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
            if (soundIntervalRef.current) clearInterval(soundIntervalRef.current);
        };
    }, []);

    // Global continuous alert sound is handled system-wide by useAlertSync / alert-sound engine.
    // AlertsHub updates when alerts are acknowledged/flagged/archived.


    const displayedDevices = useMemo(() => {
        let list = devices;
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(d =>
                (d.serial_number && d.serial_number.toLowerCase().includes(q)) ||
                (d.device_name && d.device_name.toLowerCase().includes(q)) ||
                (d.assigned_patient_name && d.assigned_patient_name.toLowerCase().includes(q)) ||
                (d.status && d.status.toLowerCase().includes(q))
            );
        }
        if (systemFilterType === 'low_battery') {
            list = list.filter(d => d.battery_level !== null && d.battery_level !== undefined && d.battery_level < 20);
        } else if (systemFilterType === 'disconnected') {
            list = list.filter(d => d.status === 'INACTIVE' || (!d.is_online && d.assigned_patient_id !== null));
        } else if (systemFilterType === 'weak_signal') {
            list = list.filter(d => (d.signal_strength || '').toLowerCase() === 'weak');
        }
        return list;
    }, [devices, searchQuery, systemFilterType]);

    const fetchAlerts = async (silent = false) => {
        if (!token) return;
        if (!silent) setIsLoading(true);
        try {
            const [clinicalRes, sysRes, devRes] = await Promise.all([
                axios.get(`${API_BASE}/api/alerts/clinical?sort=${sortOrder}`, getHeaders()),
                axios.get(`${API_BASE}/api/alerts/system?sort=${sortOrder}`, getHeaders()),
                axios.get(`${API_BASE}/api/caregiver/devices`, getHeaders()).catch(() => ({ data: { data: [] } }))
            ]);
            const activeClinical = (clinicalRes.data.data || []).filter((a: any) =>
                a.status !== 'Acknowledged' &&
                a.status !== 'Reviewed' &&
                a.status !== 'Flagged' &&
                !a.acknowledged_at &&
                (a.flag_count || 0) < 5 &&
                !a.is_suppressed
            );
            const activeSystem = (sysRes.data.data || []).filter((a: any) => a.status === 'Active');
            setClinicalAlerts(activeClinical);
            setSystemAlerts(activeSystem);
            if (Array.isArray(devRes.data?.data)) {
                setDevices(devRes.data.data);
            }
        } catch (error) {
            console.error("Failed to load alerts", error);
        } finally {
            if (!silent) setIsLoading(false);
        }
    };

    const handlePingDevice = async (serialNumber: string) => {
        if (!token) return;
        setPingingSerial(serialNumber);
        try {
            const res = await axios.post(`${API_BASE}/api/caregiver/devices/${encodeURIComponent(serialNumber)}/ping`, {}, getHeaders());
            if (res.data?.is_online) {
                toast.success(res.data.message || `Device ${serialNumber} is Online.`);
            } else {
                toast.warning(res.data?.message || `Device ${serialNumber} is Offline.`);
            }
            fetchAlerts(true);
        } catch (err: any) {
            toast.error(err.response?.data?.message || `Failed to ping ${serialNumber}.`);
        } finally {
            setPingingSerial(null);
        }
    };

    useEffect(() => {
        if (token) {
            fetchAlerts(false);
            const pollId = setInterval(() => fetchAlerts(true), 3000);

            const handleRealtimeSync = (e: Event) => {
                const detail = (e as CustomEvent)?.detail;
                const eventType = detail?.type;
                const payload = detail?.data;

                if (eventType === 'device_status_update' && payload) {
                    const targetSerial = payload.serial_number || payload.serialNumber;
                    if (targetSerial) {
                        const isOnline = payload.status === 'ACTIVE' || payload.is_online === true;
                        setDevices(prev => prev.map(d => {
                            if (d.serial_number.toLowerCase() === String(targetSerial).toLowerCase()) {
                                return {
                                    ...d,
                                    status: payload.status || (isOnline ? 'ACTIVE' : 'INACTIVE'),
                                    is_online: isOnline,
                                    battery_level: payload.battery_level !== undefined && payload.battery_level !== null ? Number(payload.battery_level) : d.battery_level,
                                    signal_strength: isOnline ? (payload.signal_strength || (d.signal_strength !== 'Offline' ? d.signal_strength : 'Good') || 'Good') : 'Offline',
                                    last_heartbeat: isOnline ? (payload.timestamp || new Date().toISOString()) : d.last_heartbeat
                                };
                            }
                            return d;
                        }));
                    }
                } else if (eventType === 'patient_telemetry_update' && payload) {
                    const targetSerial = payload.serial_number;
                    setDevices(prev => prev.map(d => {
                        if (targetSerial && d.serial_number.toLowerCase() === String(targetSerial).toLowerCase()) {
                            return {
                                ...d,
                                status: 'ACTIVE',
                                is_online: true,
                                battery_level: payload.battery_level !== undefined && payload.battery_level !== null ? Number(payload.battery_level) : d.battery_level,
                                signal_strength: payload.signal_strength || (d.signal_strength !== 'Offline' ? d.signal_strength : 'Good') || 'Good',
                                last_heartbeat: payload.recorded_at || new Date().toISOString()
                            };
                        }
                        return d;
                    }));
                }

                fetchAlerts(true);
            };
            window.addEventListener('alaga_alert_update', handleRealtimeSync);
            window.addEventListener('alaga_manual_refresh', handleRealtimeSync);

            return () => {
                clearInterval(pollId);
                window.removeEventListener('alaga_alert_update', handleRealtimeSync);
                window.removeEventListener('alaga_manual_refresh', handleRealtimeSync);
            };
        }
    }, [token, isSysAdmin]);

    const handleAcknowledge = async (actionTaken: string) => {
        if (!selectedAlert || !token) return;
        try {
            await axios.put(`${API_BASE}/api/alerts/clinical/${selectedAlert.alert_id}/acknowledge`, {
                action_taken: actionTaken
            }, getHeaders());
            // Single removal only for Acknowledge (saved to Care Logs & AI Insights)
            setClinicalAlerts(prev => prev.filter(a => a.alert_id !== selectedAlert.alert_id));
            toast.success('Alert acknowledged and saved to Care Logs & AI Insights.');
            window.dispatchEvent(new CustomEvent('alaga_manual_refresh'));
            await fetchAlerts();
        } catch (error) {
            console.error("Failed to acknowledge alert", error);
        }
    };

    const handleResolveSystemAlert = async (sysAlertId: number) => {
        if (!token) return;
        try {
            await axios.put(`${API_BASE}/api/alerts/system/${sysAlertId}/resolve`, {}, getHeaders());
            setSystemAlerts(prev => prev.filter(a => a.sys_alert_id !== sysAlertId));
            toast.success('Hardware diagnostic alert resolved.');
            window.dispatchEvent(new CustomEvent('alaga_manual_refresh'));
            await fetchAlerts();
        } catch (error) {
            console.error("Failed to resolve system alert", error);
        }
    };

    const [flaggingIds, setFlaggingIds] = useState<Record<number, boolean>>({});

    const handleFlagAsNormal = async (alert: ClinicalAlert) => {
        if (!token) return;
        setFlaggingIds(prev => ({ ...prev, [alert.alert_id]: true }));
        try {
            const res = await axios.post(
                `${API_BASE}/api/alerts/clinical/${alert.alert_id}/flag-normal`,
                {},
                getHeaders()
            );
            if (res.data.success) {
                const clearedIds: number[] = Array.isArray(res.data.cleared_alert_ids)
                    ? res.data.cleared_alert_ids.map((id: any) => Number(id))
                    : [alert.alert_id];
                const getAnomFamily = (anom?: string) => {
                    const s = (anom || '').toLowerCase();
                    if (s.includes('heart_rate')) return 'heart_rate';
                    if (s.includes('temp')) return 'temperature';
                    if (s.includes('spo2')) return 'spo2';
                    if (s.includes('moisture')) return 'moisture';
                    return s;
                };
                const targetFamily = getAnomFamily(alert.anomaly_type);
                const targetPatientKey = String((alert as any).patient_id || alert.patient_name || '');

                // Bulk removal: remove this alert AND all previous similar alerts for that patient
                setClinicalAlerts(prev => prev.filter(a => {
                    if (clearedIds.includes(Number(a.alert_id))) return false;
                    const aPatientKey = String((a as any).patient_id || a.patient_name || '');
                    if (targetPatientKey && aPatientKey === targetPatientKey && getAnomFamily(a.anomaly_type) === targetFamily) {
                        return false;
                    }
                    return true;
                }));
                toast.info(`${res.data.message} Saved to Care Logs & AI Insights.`);
                window.dispatchEvent(new CustomEvent('alaga_manual_refresh'));
                fetchAlerts();
            } else {
                toast.error(res.data.message || "Failed to flag alert.");
            }
        } catch (error: any) {
            console.error("Failed to flag alert as normal", error);
            toast.error(error.response?.data?.message || "Failed to flag alert as normal.");
        } finally {
            setFlaggingIds(prev => ({ ...prev, [alert.alert_id]: false }));
        }
    };

    const handleArchiveAlert = async (combinedId: string) => {
        if (!window.confirm("Are you sure you want to archive this alert?")) return;
        try {
            const res = await axios.put(`${API_BASE}/api/alerts/archive-unified-bulk`, {
                ids: [combinedId]
            }, getHeaders());
            if (res.data.success) {
                toast.success("Alert archived successfully.");
                fetchAlerts();
            } else {
                toast.error(res.data.message || "Failed to archive alert.");
            }
        } catch (error) {
            console.error("Failed to archive alert", error);
            toast.error("Failed to archive alert.");
        }
    };

    const [isTriggeringTest, setIsTriggeringTest] = useState(false);
    const handleTriggerHardwareTest = async (testType: string = 'Low Battery Warning') => {
        setIsTriggeringTest(true);
        try {
            const res = await axios.post(`${API_BASE}/api/alerts/system/test-trigger`, {
                alert_type: testType,
                severity: testType.includes('Critical') ? 'Critical' : 'Warning',
                description: testType === 'Low Battery Warning' 
                    ? 'Diagnostic Test: IoT Device battery dropped to 14%. Recharging required.'
                    : testType === 'Sensor Malfunction'
                    ? 'Diagnostic Test: Pulse oximeter probe detached from patient.'
                    : 'Diagnostic Test: IoT Device heartbeat timeout (>10 minutes inactive).'
            }, getHeaders());
            if (res.data.success) {
                toast.success('Hardware diagnostic test event broadcasted!');
                fetchAlerts();
            }
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to trigger hardware diagnostic test.');
        } finally {
            setIsTriggeringTest(false);
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity?.toLowerCase()) {
            case 'critical': return 'bg-red-50 text-red-700 border-red-200';
            case 'warning': return 'bg-amber-50 text-amber-700 border-amber-200';
            default: return 'bg-blue-50 text-blue-700 border-blue-200';
        }
    };

    if (isInactive) {
        return (
            <div className="h-full flex items-center justify-center bg-slate-100/50 backdrop-blur-md absolute inset-0 z-50 rounded-lg shadow-inner">
                <div className="text-center space-y-4 p-6">
                    <Shield className="h-16 w-16 text-slate-400 mx-auto" />
                    <h2 className="text-2xl font-semibold text-slate-700">Display Locked for Privacy</h2>
                    <p className="text-slate-500 max-w-sm mx-auto">This dashboard has been blurred due to inactivity to protect Patient Health Information (PHI) under the Data Privacy Act.</p>
                    <button 
                        onClick={resetInactivity}
                        className="px-6 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition font-medium shadow-sm"
                    >
                        Click to resume
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50/90 border border-rose-200/90 text-rose-800 text-[11px] font-black uppercase tracking-wider mb-2 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                        Live Clinical Monitoring
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                        Critical Alarms & <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600">Diagnostics</span>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Real-time anomaly monitoring, automated clinical triggers, and sensor diagnostics.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {highestEmergency === 'critical' && !isMuted && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold animate-pulse shadow-sm">
                            <BellRing className="w-3.5 h-3.5 text-red-600 animate-bounce" />
                            <span>Critical Alarm (repeats every 3.5s)</span>
                        </div>
                    )}
                    {highestEmergency === 'warning' && !isMuted && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold shadow-sm">
                            <BellRing className="w-3.5 h-3.5 text-amber-600" />
                            <span>Warning Chime (repeats every 8s)</span>
                        </div>
                    )}
                    {(highestEmergency === 'none' || isMuted) && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{isMuted ? 'Alarm Audio Muted' : 'Alert Sounds Idle'}</span>
                        </div>
                    )}

                    <button
                        onClick={() => toggleMute()}
                        title={isMuted ? "Unmute alarm sound on all synced devices" : "Mute alarm sound on all synced devices"}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition ${
                            isMuted 
                                ? 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100' 
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 shadow-sm'
                        }`}
                    >
                        {isMuted ? <VolumeX className="w-3.5 h-3.5 text-amber-500" /> : <Volume2 className="w-3.5 h-3.5 text-teal-600" />}
                        {isMuted ? 'Unmute Audio (All Devices)' : 'Mute Audio (All Devices)'}
                    </button>

                    <button
                        onClick={() => testRealtimeSync('Critical')}
                        title="Test synchronized audio chime and notification across both Web App and Mobile App simultaneously"
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100 transition shadow-xs"
                    >
                        <BellRing className="w-3.5 h-3.5 text-teal-600" />
                        <span>Test Sound Sync</span>
                    </button>
                </div>
            </div>

            {filterAlertId && (
                <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 flex items-center justify-between shadow-sm animate-in slide-in-from-top-1 duration-200">
                    <p className="text-xs text-teal-800 font-semibold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4 text-teal-600" />
                        Showing isolated notification details.
                    </p>
                    <button
                        onClick={() => setFilterAlertId(null)}
                        className="text-[10px] bg-teal-600 hover:bg-teal-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer border-none outline-none shadow"
                    >
                        Show All Alerts
                    </button>
                </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4 sm:space-y-6">
                <div className="shrink-0 overflow-x-auto no-scrollbar touch-scroll -mx-1 px-1 sm:mx-0 sm:px-0">
                    <TabsList className="bg-teal-50/60 p-1.5 rounded-2xl border border-teal-100/90 inline-flex gap-2 flex-nowrap w-max max-w-none">
                        <TabsTrigger 
                            value="clinical" 
                            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                        >
                            <Activity className="h-3.5 w-3.5 text-rose-600" />
                            Clinical Alerts
                            {clinicalAlerts.filter(a => a.status !== 'Acknowledged').length > 0 && (
                                <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                    {clinicalAlerts.filter(a => a.status !== 'Acknowledged').length}
                                </span>
                            )}
                        </TabsTrigger>
                        
                        <TabsTrigger 
                            value="system" 
                            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                        >
                            <HardDrive className="h-3.5 w-3.5 text-amber-600" />
                            Hardware Diagnostics
                            {systemAlerts.filter(a => a.status === 'Active').length > 0 && (
                                <span className="ml-1.5 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                    {systemAlerts.filter(a => a.status === 'Active').length}
                                </span>
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>
 
                <TabsContent value="clinical" className="space-y-4">
                    {/* Clinical Search & Filter Bar */}
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search clinical alerts by patient name, pattern, or vital..."
                                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium text-slate-700"
                            />
                            {searchQuery && (
                                <button 
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* Filter Pills & 2-Option Sort Selector */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 pt-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                                    <Filter className="w-3 h-3 text-slate-400" /> Filter:
                                </span>
                                <button
                                    onClick={() => setClinicalFilterType('all')}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${clinicalFilterType === 'all' ? 'bg-teal-700 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    All Alerts ({clinicalAlerts.length})
                                </button>
                                <button
                                    onClick={() => setClinicalFilterType('ai_anomaly')}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${clinicalFilterType === 'ai_anomaly' ? 'bg-teal-700 text-white shadow-2xs' : 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'}`}
                                >
                                    <Sparkles className="w-3 h-3" /> AI Anomaly Detected
                                </button>
                                <button
                                    onClick={() => setClinicalFilterType('emergency')}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${clinicalFilterType === 'emergency' ? 'bg-red-600 text-white shadow-2xs' : 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'}`}
                                >
                                    <AlertTriangle className="w-3 h-3" /> Emergency
                                </button>
                                <button
                                    onClick={() => setClinicalFilterType('wet_diaper')}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${clinicalFilterType === 'wet_diaper' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'}`}
                                >
                                    <Droplets className="w-3 h-3" /> Wet Diaper
                                </button>
                                <button
                                    onClick={() => setClinicalFilterType('vitals')}
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${clinicalFilterType === 'vitals' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'}`}
                                >
                                    <HeartPulse className="w-3 h-3" /> Vital Signs Anomaly
                                </button>
                            </div>

                            {/* 2 Sorting Options for User */}
                            <div className="flex items-center gap-1.5 flex-wrap border-t lg:border-t-0 pt-2 lg:pt-0 border-slate-100">
                                <span className="text-[11px] font-bold text-slate-500 mr-0.5">Sort Priority:</span>
                                <button
                                    onClick={() => setSortOrder('severity')}
                                    title="Option 1 (Default Recommended Clinical Standard): Critical alerts pinned at the top, then Warning, then Info — ordered newest first within each tier"
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${sortOrder === 'severity' ? 'bg-teal-700 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    1. Severity First (Default)
                                </button>
                                <button
                                    onClick={() => setSortOrder('chronological')}
                                    title="Option 2: Pure Chronological (Newest on Top) with consecutive identical alerts per patient deduplicated"
                                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${sortOrder === 'chronological' ? 'bg-teal-700 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                    2. Latest First (Deduplicated)
                                </button>
                            </div>
                        </div>
                    </div>
                    {displayedClinicalAlerts.length === 0 && !isLoading ? (
                        <Card className="border-dashed border-slate-200 bg-white shadow-sm rounded-2xl">
                            <CardContent className="flex flex-col items-center justify-center p-12 text-slate-500">
                                <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3 opacity-80" />
                                <p className="font-bold text-slate-800 text-lg">No Clinical Alerts</p>
                                <p className="text-sm text-slate-500 mt-0.5">All patients are stable.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        displayedClinicalAlerts.map(alert => (
                            <Card key={alert.alert_id} className={`overflow-hidden transition-all duration-200 bg-white rounded-2xl border ${alert.status === 'Acknowledged' ? 'opacity-80 bg-slate-50/50 border-slate-200' : 'border-red-200 shadow-sm ring-1 ring-red-100 hover:shadow-md'}`}>
                                <div className={`h-1.5 w-full ${alert.status === 'Acknowledged' ? 'bg-slate-300' : 'bg-red-500'}`}></div>
                                <CardContent className="p-4 sm:p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-6">
                                    <div className="flex gap-3 sm:gap-4 items-start flex-1">
                                        <div className={`p-3 rounded-2xl mt-0.5 shrink-0 ${alert.status === 'Acknowledged' ? 'bg-slate-100 text-slate-500' : 'bg-red-50 text-red-600 ring-1 ring-red-100'}`}>
                                            <Activity className="h-6 w-6" />
                                        </div>
                                        <div className="space-y-1.5 flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-bold text-base sm:text-lg text-slate-800">{alert.patient_name}</h3>
                                                {alert.is_anonymized && (
                                                    <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 text-[10px] font-mono">
                                                        De-identified Governance
                                                    </Badge>
                                                )}
                                                <Badge className={getSeverityColor(alert.severity)} variant="outline">
                                                    {alert.severity}
                                                </Badge>
                                                {alert.status === 'Acknowledged' && (
                                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs flex items-center gap-1 font-semibold">
                                                        <CheckCircle2 className="w-3 h-3" /> Acknowledged
                                                    </Badge>
                                                )}
                                                {(alert.flag_count || 0) >= 5 && (
                                                    <Badge variant="outline" className="bg-teal-50 text-teal-800 border-teal-200 text-xs flex items-center gap-1 font-semibold">
                                                        <Sparkles className="w-3 h-3 text-teal-600" /> AI Baseline Learned
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-slate-800 font-semibold text-sm leading-relaxed">{alert.message}</p>
                                            <p className="text-xs text-slate-600 font-medium">
                                                Triggered: {new Date(alert.sent_at).toLocaleString()}
                                            </p>

                                            {/* AI Model Baseline Condition Box */}
                                            <div className="mt-2.5 flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 max-w-xl">
                                                <Sparkles className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="font-semibold text-slate-700">AI Adaptive Baseline: </span>
                                                    {(alert.flag_count || 0) >= 5 ? (
                                                        <span className="text-emerald-700 font-medium">
                                                            The AI model has learned this patient's pattern. Baseline updated (0 more flags needed). Alerts for this pattern are now suppressed.
                                                        </span>
                                                    ) : (
                                                        <span>
                                                            The AI model learns from the patient's pattern. Modifying it's baseline needs to be learned repeatedly. ({Math.max(0, 5 - (alert.flag_count || 0))} more flags needed)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="w-full lg:w-auto flex flex-wrap items-center justify-end gap-2.5 shrink-0">
                                        <button 
                                            onClick={() => { setSelectedAlert(alert); setAckModalOpen(true); }}
                                            className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition shadow-sm w-full sm:w-auto flex items-center justify-center gap-1.5 ${
                                                alert.status === 'Acknowledged' 
                                                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' 
                                                    : 'bg-red-600 hover:bg-red-700 text-white'
                                            }`}
                                        >
                                            {alert.status === 'Acknowledged' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                                            Review & Acknowledge
                                        </button>

                                        <button 
                                            onClick={() => handleFlagAsNormal(alert)}
                                            disabled={(alert.flag_count || 0) >= 5 || flaggingIds[alert.alert_id]}
                                            title={`The AI model learns from the patient's pattern. Modifying it's baseline needs to be learned repeatedly. (${Math.max(0, 5 - (alert.flag_count || 0))} more flags needed)`}
                                            className={`px-3.5 py-2.5 text-xs font-semibold rounded-xl transition border flex items-center justify-center gap-1.5 w-full sm:w-auto ${
                                                (alert.flag_count || 0) >= 5 
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default opacity-90' 
                                                    : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 shadow-sm'
                                            }`}
                                        >
                                            <Flag className="w-3.5 h-3.5" />
                                            {(alert.flag_count || 0) >= 5 ? 'Normal (Learned 5/5)' : `Flag as Normal (${alert.flag_count || 0}/5)`}
                                        </button>

                                        <button 
                                            onClick={() => handleArchiveAlert('clinical_' + alert.alert_id)}
                                            className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition flex items-center justify-center gap-1.5 w-full sm:w-auto"
                                        >
                                            <Archive className="w-3.5 h-3.5" />
                                            Archive
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>
 
                <TabsContent value="system" className="space-y-4">
                    {/* Hardware Diagnostics Search & Controls */}
                    <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
                        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input 
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search hardware diagnostics by patient, device serial, or error..."
                                    className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-medium text-slate-700"
                                />
                                {searchQuery && (
                                    <button 
                                        onClick={() => setSearchQuery('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Trigger Diagnostic Test Buttons */}
                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                                <button
                                    onClick={() => handleTriggerHardwareTest('Low Battery Warning')}
                                    disabled={isTriggeringTest}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 transition flex items-center gap-1.5 shadow-2xs"
                                    title="Simulate low battery alert on IoT device"
                                >
                                    <BatteryCharging className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Test Low Battery</span>
                                </button>
                                <button
                                    onClick={() => handleTriggerHardwareTest('Sensor Malfunction')}
                                    disabled={isTriggeringTest}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 transition flex items-center gap-1.5 shadow-2xs"
                                    title="Simulate probe detached / sensor error on IoT device"
                                >
                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Test Sensor Fault</span>
                                </button>
                                <button
                                    onClick={() => handleTriggerHardwareTest('Device Disconnected')}
                                    disabled={isTriggeringTest}
                                    className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition flex items-center gap-1.5 shadow-2xs"
                                    title="Simulate device disconnected timeout"
                                >
                                    <WifiOff className="w-3.5 h-3.5 text-slate-600" />
                                    <span>Test Disconnect</span>
                                </button>
                            </div>
                        </div>

                        {/* Filter Pills for Hardware Diagnostics */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
                                <Filter className="w-3 h-3 text-slate-400" /> Filter:
                            </span>
                            <button
                                onClick={() => setSystemFilterType('all')}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${systemFilterType === 'all' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                            >
                                All Diagnostics ({systemAlerts.length})
                            </button>
                            <button
                                onClick={() => setSystemFilterType('low_battery')}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${systemFilterType === 'low_battery' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'}`}
                            >
                                <BatteryCharging className="w-3.5 h-3.5" /> Low Battery
                            </button>
                            <button
                                onClick={() => setSystemFilterType('disconnected')}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${systemFilterType === 'disconnected' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'}`}
                            >
                                <WifiOff className="w-3.5 h-3.5" /> Offline / Disconnected
                            </button>
                            <button
                                onClick={() => setSystemFilterType('sensor_malfunction')}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${systemFilterType === 'sensor_malfunction' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'}`}
                            >
                                <AlertTriangle className="w-3.5 h-3.5" /> Sensor Malfunction
                            </button>
                            <button
                                onClick={() => setSystemFilterType('weak_signal')}
                                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition flex items-center gap-1 ${systemFilterType === 'weak_signal' ? 'bg-amber-600 text-white shadow-2xs' : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'}`}
                            >
                                <Activity className="w-3.5 h-3.5" /> Weak Signal
                            </button>
                        </div>
                    </div>
                    {/* Live Synced Patient Devices Telemetry & Diagnostics Matrix */}
                    <Card className="bg-white border-slate-200 shadow-2xs rounded-2xl overflow-hidden">
                        <CardContent className="p-4 sm:p-5 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                                <div>
                                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                        <HardDrive className="w-4 h-4 text-teal-600" />
                                        Patient Devices Live Diagnostics (Synced with Patients&apos; Devices)
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Real-time status, battery level, and WiFi signal strength synchronized with registered patient sensors.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] font-semibold">
                                    <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                                        {devices.filter(d => d.status === 'ACTIVE').length} Active
                                    </Badge>
                                    <Badge className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px]">
                                        {devices.filter(d => d.status === 'INACTIVE').length} Inactive
                                    </Badge>
                                    <Badge className="bg-amber-50 text-amber-800 border border-amber-200 text-[10px]">
                                        {devices.filter(d => d.battery_level !== null && d.battery_level < 20).length} Low Battery
                                    </Badge>
                                </div>
                            </div>

                            {displayedDevices.length === 0 ? (
                                <div className="text-center py-6 text-xs text-slate-400 italic">
                                    No patient devices match the current filter.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {displayedDevices.map(dev => {
                                        const isOnline = dev.status === 'ACTIVE' || dev.is_online === true;
                                        const bat = dev.battery_level !== null && dev.battery_level !== undefined ? Number(dev.battery_level) : null;
                                        const sig = isOnline ? (dev.signal_strength || 'Good') : 'Offline';
                                        return (
                                            <div
                                                key={dev.serial_number}
                                                className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                                                    isOnline
                                                        ? 'bg-emerald-50/20 border-emerald-200/80'
                                                        : dev.status === 'INACTIVE'
                                                        ? 'bg-slate-50/70 border-slate-200'
                                                        : 'bg-white border-slate-200'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-bold text-xs text-slate-800 truncate">{dev.device_name}</span>
                                                            <Badge variant="outline" className="font-mono text-[10px] bg-white text-slate-700 border-slate-200 px-1.5 py-0">
                                                                {dev.serial_number}
                                                            </Badge>
                                                        </div>
                                                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                                            Patient: <span className="font-semibold text-slate-700">{dev.assigned_patient_name || 'Unassigned'}</span>
                                                        </p>
                                                    </div>
                                                    <Badge
                                                        className={`text-[10px] font-bold px-2 py-0.5 border shrink-0 ${
                                                            dev.status === 'ACTIVE'
                                                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                                : dev.status === 'STANDBY'
                                                                ? 'bg-amber-100 text-amber-800 border-amber-300'
                                                                : dev.status === 'AVAILABLE'
                                                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                                : 'bg-rose-50 text-rose-700 border-rose-200'
                                                        }`}
                                                    >
                                                        {dev.status}
                                                    </Badge>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 text-[11px]">
                                                    <div className="flex items-center gap-1.5">
                                                        <BatteryCharging className={`w-3.5 h-3.5 ${bat !== null && bat < 20 ? 'text-rose-600' : 'text-teal-600'}`} />
                                                        <span className="text-slate-500">Battery:</span>
                                                        <span className={`font-bold ${bat !== null && bat < 20 ? 'text-rose-600' : 'text-slate-800'}`}>
                                                            {bat !== null ? `${bat}%` : '--'}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        {isOnline ? (
                                                            <Wifi className={`w-3.5 h-3.5 ${sig.toLowerCase() === 'weak' ? 'text-amber-600' : 'text-emerald-600'}`} />
                                                        ) : (
                                                            <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                                                        )}
                                                        <span className="text-slate-500">Signal:</span>
                                                        <span className={`font-bold ${!isOnline ? 'text-slate-500' : sig.toLowerCase() === 'weak' ? 'text-amber-700' : 'text-emerald-700'}`}>
                                                            {sig}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400">
                                                    <span>
                                                        Last Heartbeat: {dev.last_heartbeat ? new Date(dev.last_heartbeat).toLocaleTimeString() : 'Never'}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePingDevice(dev.serial_number)}
                                                        disabled={pingingSerial === dev.serial_number}
                                                        className="px-2 py-1 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 font-semibold flex items-center gap-1 transition cursor-pointer"
                                                    >
                                                        <Radio className="w-3 h-3" />
                                                        {pingingSerial === dev.serial_number ? 'Pinging...' : 'Ping'}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {displayedSystemAlerts.length === 0 && !isLoading ? (
                        <Card className="border-dashed border-slate-200 bg-white shadow-sm rounded-2xl">
                            <CardContent className="flex flex-col items-center justify-center p-12 text-slate-500">
                                <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3 opacity-80" />
                                <p className="font-bold text-slate-800 text-lg">No System Alerts</p>
                                <p className="text-sm text-slate-500 mt-0.5">All devices operating normally.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        displayedSystemAlerts.map(alert => {
                            const matchedDev = devices.find(d =>
                                alert.device_serial_number &&
                                d.serial_number.toLowerCase() === alert.device_serial_number.toLowerCase()
                            );
                            const liveStatus = matchedDev?.status || alert.device_status || null;
                            const liveBattery = matchedDev?.battery_level ?? alert.battery_level ?? null;
                            const liveSignal = matchedDev
                                ? ((matchedDev.status === 'ACTIVE' || matchedDev.is_online) ? (matchedDev.signal_strength || 'Good') : 'Offline')
                                : (alert.signal_strength || null);
                            const serialNum = matchedDev?.serial_number || alert.device_serial_number || null;

                            return (
                                <Card key={alert.sys_alert_id} className={`overflow-hidden bg-white border-slate-200 rounded-2xl ${alert.status !== 'Active' ? 'opacity-60 border-slate-200' : 'shadow-sm'}`}>
                                    <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                        <div className="flex gap-4 items-start">
                                            <div className={`p-3.5 rounded-2xl ${alert.status === 'Active' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                                                <HardDrive className="h-6 w-6" />
                                            </div>
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <h3 className="font-bold text-slate-800 text-lg">{alert.alert_type}</h3>
                                                    <Badge className={getSeverityColor(alert.severity)} variant="outline">{alert.severity}</Badge>
                                                    {serialNum && (
                                                        <Badge variant="outline" className="font-mono text-xs bg-slate-50 text-slate-700 border-slate-200">
                                                            SN: {serialNum}
                                                        </Badge>
                                                    )}
                                                    {alert.patient_name && (
                                                        <span className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded-xl font-semibold">
                                                            {alert.is_anonymized ? alert.patient_name : `Patient: ${alert.patient_name}`}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-slate-700 font-medium">{alert.description}</p>
                                                {(liveStatus || liveBattery !== null || liveSignal) && (
                                                    <div className="flex items-center gap-2 flex-wrap pt-1">
                                                        {liveStatus && (
                                                            <Badge className={`text-[10px] font-bold border ${
                                                                liveStatus === 'ACTIVE'
                                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                                            }`}>
                                                                Status: {liveStatus}
                                                            </Badge>
                                                        )}
                                                        <Badge variant="outline" className="text-[10px] font-semibold bg-slate-50 text-slate-700 border-slate-200">
                                                            Battery: {liveBattery !== null && liveBattery !== undefined ? `${liveBattery}%` : '--'}
                                                        </Badge>
                                                        {liveSignal && (
                                                            <Badge variant="outline" className="text-[10px] font-semibold bg-slate-50 text-slate-700 border-slate-200">
                                                                Signal: {liveSignal}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                )}
                                                <p className="text-xs text-slate-400 pt-1">Logged: {new Date(alert.triggered_at).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="w-full md:w-auto flex items-center justify-end gap-2.5 shrink-0">
                                            {alert.status === 'Active' && (
                                                <button 
                                                    onClick={() => handleResolveSystemAlert(alert.sys_alert_id)}
                                                    className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-semibold transition shadow-sm w-full md:w-auto"
                                                >
                                                    Resolve Alert
                                                </button>
                                            )}
                                            {alert.status !== 'Active' && (
                                                <div className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5">
                                                    <CheckCircle2 className="h-4 w-4" /> Resolved
                                                </div>
                                            )}
                                            <button 
                                                onClick={() => handleArchiveAlert('system_' + alert.sys_alert_id)}
                                                className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold rounded-xl transition"
                                            >
                                                Archive
                                            </button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })
                    )}
                </TabsContent>
            </Tabs>

            <AcknowledgeModal 
                isOpen={ackModalOpen} 
                onClose={() => setAckModalOpen(false)}
                onAcknowledge={handleAcknowledge}
                alertDetails={selectedAlert ? {
                    message: selectedAlert.message,
                    patient_name: selectedAlert.patient_name,
                    severity: selectedAlert.severity
                } : undefined}
            />
        </div>
    );
};

export default AlertsHub;