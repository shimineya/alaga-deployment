import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { 
    AlertCircle, CheckCircle2, Shield, Activity, HardDrive, Flag, Sparkles, Archive, 
    Volume2, VolumeX, BellRing, Search, Filter, BatteryCharging, WifiOff, AlertTriangle, 
    Droplets, HeartPulse, X, Play 
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
        return list;
    }, [clinicalAlerts, filterAlertId, searchQuery, clinicalFilterType]);

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
                (a.alert_type && a.alert_type.toLowerCase().includes(q))
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
        return list;
    }, [systemAlerts, filterAlertId, searchQuery, systemFilterType]);

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

    // Repeating sound effect synced with active unacknowledged & unflagged notifications
    useEffect(() => {
        if (soundIntervalRef.current) {
            clearInterval(soundIntervalRef.current);
            soundIntervalRef.current = null;
        }

        if (highestEmergency === 'none' || isMuted) {
            return;
        }

        // Play sound immediately on trigger/change
        playEmergencySound(highestEmergency);

        // Repeat frequency varies by level of emergency:
        // - Critical: repeats every 3.5 seconds (urgent, rapid clinical pulse)
        // - Warning: repeats every 8.0 seconds (cautionary chime)
        const repeatInterval = highestEmergency === 'critical' ? 3500 : 8000;
        soundIntervalRef.current = setInterval(() => {
            playEmergencySound(highestEmergency);
        }, repeatInterval);

        return () => {
            if (soundIntervalRef.current) {
                clearInterval(soundIntervalRef.current);
                soundIntervalRef.current = null;
            }
        };
    }, [highestEmergency, isMuted]);

    const fetchAlerts = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const [clinicalRes, sysRes] = await Promise.all([
                axios.get(`${API_BASE}/api/alerts/clinical`, getHeaders()),
                axios.get(`${API_BASE}/api/alerts/system`, getHeaders())
            ]);
            setClinicalAlerts(clinicalRes.data.data || []);
            setSystemAlerts(sysRes.data.data || []);
        } catch (error) {
            console.error("Failed to load alerts", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchAlerts();
            const pollId = setInterval(fetchAlerts, 10000);

            const handleRealtimeSync = () => {
                fetchAlerts();
            };
            window.addEventListener('alaga_alert_update', handleRealtimeSync);

            return () => {
                clearInterval(pollId);
                window.removeEventListener('alaga_alert_update', handleRealtimeSync);
            };
        }
    }, [token, isSysAdmin]);

    const handleAcknowledge = async (actionTaken: string) => {
        if (!selectedAlert || !token) return;
        try {
            await axios.put(`${API_BASE}/api/alerts/clinical/${selectedAlert.alert_id}/acknowledge`, {
                action_taken: actionTaken
            }, getHeaders());
            // Immediately mark as Acknowledged in local state so the repeating sound stops without delay
            setClinicalAlerts(prev => prev.map(a => a.alert_id === selectedAlert.alert_id ? { ...a, status: 'Acknowledged' } : a));
            await fetchAlerts();
        } catch (error) {
            console.error("Failed to acknowledge alert", error);
        }
    };

    const handleResolveSystemAlert = async (sysAlertId: number) => {
        if (!token) return;
        try {
            await axios.put(`${API_BASE}/api/alerts/system/${sysAlertId}/resolve`, {}, getHeaders());
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
                toast.info(res.data.message);
                setClinicalAlerts(prev => prev.map(a => {
                    if (a.alert_id === alert.alert_id || (alert.patient_id && a.patient_id === alert.patient_id && a.anomaly_type === alert.anomaly_type)) {
                        return {
                            ...a,
                            flag_count: res.data.flag_count,
                            remaining_flags: res.data.remaining_flags,
                            is_suppressed: res.data.suppressed,
                            status: res.data.suppressed ? 'Acknowledged' : a.status
                        };
                    }
                    return a;
                }));
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
                        Live Clinical Telemetry
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

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                <div className="shrink-0">
                    <TabsList className="bg-teal-50/60 p-1.5 rounded-2xl border border-teal-100/90 inline-flex gap-2 overflow-x-auto h-auto">
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

                        {/* Filter Pills */}
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
                    {displayedSystemAlerts.length === 0 && !isLoading ? (
                        <Card className="border-dashed border-slate-200 bg-white shadow-sm rounded-2xl">
                            <CardContent className="flex flex-col items-center justify-center p-12 text-slate-500">
                                <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3 opacity-80" />
                                <p className="font-bold text-slate-800 text-lg">No System Alerts</p>
                                <p className="text-sm text-slate-500 mt-0.5">All devices operating normally.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        displayedSystemAlerts.map(alert => (
                            <Card key={alert.sys_alert_id} className={`overflow-hidden bg-white border-slate-200 rounded-2xl ${alert.status !== 'Active' ? 'opacity-60 border-slate-200' : 'shadow-sm'}`}>
                                <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                    <div className="flex gap-4 items-start">
                                        <div className={`p-3.5 rounded-2xl ${alert.status === 'Active' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                                            <HardDrive className="h-6 w-6" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap mb-1">
                                                <h3 className="font-bold text-slate-800 text-lg">{alert.alert_type}</h3>
                                                <Badge className={getSeverityColor(alert.severity)} variant="outline">{alert.severity}</Badge>
                                                {alert.patient_name && (
                                                    <span className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded-xl font-semibold">
                                                        {alert.is_anonymized ? alert.patient_name : `Device: ${alert.patient_name}`}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-700 font-medium">{alert.description}</p>
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
                        ))
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