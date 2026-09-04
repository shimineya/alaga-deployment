import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { AlertCircle, CheckCircle2, Shield, Activity, HardDrive } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { AcknowledgeModal } from '../ui/AcknowledgeModal';
import { useLocation } from 'react-router-dom';
import { toast } from 'sonner';

interface ClinicalAlert {
    alert_id: number;
    severity: string;
    message: string;
    status: string;
    sent_at: string;
    patient_name: string;
    anomaly_type: string;
}

interface SystemAlert {
    sys_alert_id: number;
    alert_type: string;
    severity: string;
    description: string;
    status: string;
    triggered_at: string;
    patient_name: string;
}

const AlertsHub: React.FC = () => {
    const { user, token } = useAuth();
    const isSysAdmin = user?.role === 'system_admin' || user?.role === 'admin' || user?.role === 'sysadmin';

    const [activeTab, setActiveTab] = useState(isSysAdmin ? 'system' : 'clinical');
    const [clinicalAlerts, setClinicalAlerts] = useState<ClinicalAlert[]>([]);
    const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [isInactive, setIsInactive] = useState(false);
    const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [audioContext, setAudioContext] = useState<AudioContext | null>(null);

    const [ackModalOpen, setAckModalOpen] = useState(false);
    const [selectedAlert, setSelectedAlert] = useState<ClinicalAlert | null>(null);

    const location = useLocation();
    const initialSelectedId = location.state?.selectedAlertId;
    const [filterAlertId, setFilterAlertId] = useState<string | null>(initialSelectedId || null);

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
        if (filterAlertId && filterAlertId.startsWith('clinical_')) {
            const targetId = parseInt(filterAlertId.replace('clinical_', ''));
            return clinicalAlerts.filter(a => a.alert_id === targetId);
        }
        return clinicalAlerts;
    }, [clinicalAlerts, filterAlertId]);

    const displayedSystemAlerts = useMemo(() => {
        if (filterAlertId && filterAlertId.startsWith('system_')) {
            const targetId = parseInt(filterAlertId.replace('system_', ''));
            return systemAlerts.filter(a => a.sys_alert_id === targetId);
        }
        return systemAlerts;
    }, [systemAlerts, filterAlertId]);

    const API_BASE = import.meta.env.VITE_API_URL || '';
    const getHeaders = () => ({
        headers: { Authorization: `Bearer ${token}` }
    });

    const resetInactivity = () => {
        setIsInactive(false);
        if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
        inactivityTimeoutRef.current = setTimeout(() => setIsInactive(true), 60000);
    };

    useEffect(() => {
        window.addEventListener('mousemove', resetInactivity);
        window.addEventListener('keydown', resetInactivity);
        resetInactivity();
        
        try {
            const actx = new (window.AudioContext || (window as any).webkitAudioContext)();
            setAudioContext(actx);
        } catch(e) {
            console.log("AudioContext not supported immediately");
        }

        return () => {
            window.removeEventListener('mousemove', resetInactivity);
            window.removeEventListener('keydown', resetInactivity);
            if (inactivityTimeoutRef.current) clearTimeout(inactivityTimeoutRef.current);
            if (audioContext) audioContext.close();
        };
    }, []);

    const playAlertSound = () => {
        if (!audioContext) return;
        const osc = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        osc.frequency.setValueAtTime(800, audioContext.currentTime);
        osc.type = 'sine';
        
        gainNode.gain.setValueAtTime(1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 1.5);
        
        osc.start();
        osc.stop(audioContext.currentTime + 1.5);
    };

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
            
            const hasCritical = (clinicalRes.data.data || []).some((a: any) => a.severity === 'Critical' && a.status !== 'Acknowledged');
            if (hasCritical) playAlertSound();
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
            return () => clearInterval(pollId);
        }
    }, [token, isSysAdmin]);

    const handleAcknowledge = async (actionTaken: string) => {
        if (!selectedAlert || !token) return;
        try {
            await axios.put(`${API_BASE}/api/alerts/clinical/${selectedAlert.alert_id}/acknowledge`, {
                action_taken: actionTaken
            }, getHeaders());
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
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Alerts</h1>
                    <p className="text-slate-500 text-sm mt-1">Real-time clinical and hardware alerts monitor</p>
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
                <div className="border-b border-slate-200 mb-6 shrink-0">
                    <TabsList className="bg-transparent h-12 p-0 flex gap-6 justify-start overflow-x-auto">
                        <TabsTrigger 
                            value="clinical" 
                            className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                        >
                            <Activity className="h-4 w-4 mr-1" />
                            Clinical Alerts
                            {clinicalAlerts.filter(a => a.status !== 'Acknowledged').length > 0 && (
                                <span className="ml-1.5 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                    {clinicalAlerts.filter(a => a.status !== 'Acknowledged').length}
                                </span>
                            )}
                        </TabsTrigger>
                        
                        <TabsTrigger 
                            value="system" 
                            className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap data-[state=active]:border-b-2 data-[state=active]:border-teal-600 data-[state=active]:text-teal-700 data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                        >
                            <HardDrive className="h-4 w-4 mr-1" />
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
                            <Card key={alert.alert_id} className={`overflow-hidden transition-all duration-200 bg-white rounded-2xl ${alert.status === 'Acknowledged' ? 'opacity-60 border-slate-200' : 'border-red-100 shadow-sm'}`}>
                                <div className={`h-1.5 w-full ${alert.status === 'Acknowledged' ? 'bg-slate-200' : 'bg-red-500'}`}></div>
                                <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                                    <div className="flex gap-4 items-start">
                                        <div className={`p-3.5 rounded-2xl mt-0.5 ${alert.status === 'Acknowledged' ? 'bg-slate-100 text-slate-400' : 'bg-red-50 text-red-600'}`}>
                                            <Activity className="h-6 w-6" />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="font-bold text-lg text-slate-800">{alert.patient_name}</h3>
                                                <Badge className={getSeverityColor(alert.severity)} variant="outline">
                                                    {alert.severity}
                                                </Badge>
                                            </div>
                                            <p className="text-slate-700 font-medium">{alert.message}</p>
                                            <p className="text-xs text-slate-400 pt-1">
                                                Triggered: {new Date(alert.sent_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
 
                                    <div className="w-full md:w-auto flex items-center justify-end gap-2.5 shrink-0">
                                        {alert.status !== 'Acknowledged' && (
                                            <button 
                                                onClick={() => { setSelectedAlert(alert); setAckModalOpen(true); }}
                                                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition shadow-sm w-full md:w-auto"
                                            >
                                                Review & Acknowledge
                                            </button>
                                        )}
                                        {alert.status === 'Acknowledged' && (
                                            <div className="text-sm font-semibold text-emerald-600 flex items-center gap-1.5">
                                                <CheckCircle2 className="h-4 w-4" /> Acknowledged
                                            </div>
                                        )}
                                        <button 
                                            onClick={() => handleArchiveAlert('clinical_' + alert.alert_id)}
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
 
                <TabsContent value="system" className="space-y-4">
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
                                                    <span className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded-xl font-semibold">Device: {alert.patient_name}</span>
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