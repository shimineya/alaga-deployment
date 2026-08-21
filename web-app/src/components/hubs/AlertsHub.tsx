import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Card, CardContent } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Badge } from '../ui/badge';
import { AlertCircle, CheckCircle2, Shield, Activity, HardDrive } from 'lucide-react';
import { useAuth } from '../../lib/auth-context';
import { AcknowledgeModal } from '../ui/AcknowledgeModal';

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
    const { user } = useAuth();
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
        setIsLoading(true);
        try {
            const [clinicalRes, sysRes] = await Promise.all([
                axios.get('/api/alerts/clinical'),
                axios.get('/api/alerts/system')
            ]);
            setClinicalAlerts(clinicalRes.data.data);
            setSystemAlerts(sysRes.data.data);
            
            const hasCritical = clinicalRes.data.data.some((a: any) => a.severity === 'Critical' && a.status !== 'Acknowledged');
            if (hasCritical) playAlertSound();
        } catch (error) {
            console.error("Failed to load alerts", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
        const pollId = setInterval(fetchAlerts, 10000);
        return () => clearInterval(pollId);
    }, [isSysAdmin]);

    const handleAcknowledge = async (actionTaken: string) => {
        if (!selectedAlert) return;
        try {
            await axios.put(`/api/alerts/clinical/${selectedAlert.alert_id}/acknowledge`, {
                action_taken: actionTaken
            });
            await fetchAlerts();
        } catch (error) {
            console.error("Failed to acknowledge alert", error);
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
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Alerts & Triage</h1>
                <p className="text-slate-500 text-sm mt-1">Real-time clinical and hardware alerts monitor</p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                <TabsList className="bg-white border border-slate-200 p-1.5 rounded-2xl h-auto flex flex-wrap gap-2 shadow-sm">
                    <TabsTrigger value="clinical" className="data-[state=active]:bg-red-50 data-[state=active]:text-red-700 font-semibold rounded-xl px-4 py-2.5 transition-all">
                        <Activity className="h-4 w-4 mr-2" />
                        Clinical Alerts
                        {clinicalAlerts.filter(a => a.status !== 'Acknowledged').length > 0 && (
                            <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                                {clinicalAlerts.filter(a => a.status !== 'Acknowledged').length}
                            </span>
                        )}
                    </TabsTrigger>
                    
                    <TabsTrigger value="system" className="data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700 font-semibold rounded-xl px-4 py-2.5 transition-all">
                        <HardDrive className="h-4 w-4 mr-2" />
                        Hardware Diagnostics
                        {systemAlerts.filter(a => a.status === 'Active').length > 0 && (
                            <span className="ml-2 bg-amber-500 text-white text-xs px-2 py-0.5 rounded-full font-bold">
                                {systemAlerts.filter(a => a.status === 'Active').length}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="clinical" className="space-y-4">
                    {clinicalAlerts.length === 0 && !isLoading ? (
                        <Card className="border-dashed border-slate-200 bg-white shadow-sm rounded-2xl">
                            <CardContent className="flex flex-col items-center justify-center p-12 text-slate-500">
                                <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3 opacity-80" />
                                <p className="font-bold text-slate-800 text-lg">No Clinical Alerts</p>
                                <p className="text-sm text-slate-500 mt-0.5">All patients are stable.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        clinicalAlerts.map(alert => (
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

                                    <div className="w-full md:w-auto flex justify-end">
                                        {alert.status !== 'Acknowledged' ? (
                                            <button 
                                                onClick={() => { setSelectedAlert(alert); setAckModalOpen(true); }}
                                                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition shadow-sm w-full md:w-auto"
                                            >
                                                Review & Acknowledge
                                            </button>
                                        ) : (
                                            <div className="text-right">
                                                <div className="text-sm font-semibold text-emerald-600 flex items-center justify-end gap-1.5">
                                                    <CheckCircle2 className="h-4 w-4" /> Acknowledged
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </TabsContent>

                <TabsContent value="system" className="space-y-4">
                    {systemAlerts.map(alert => (
                        <Card key={alert.sys_alert_id} className={`overflow-hidden bg-white border-slate-200 rounded-2xl ${alert.status !== 'Active' ? 'opacity-60' : 'shadow-sm'}`}>
                            <CardContent className="p-6 flex items-start gap-4">
                                <div className={`p-3.5 rounded-2xl ${alert.status === 'Active' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
                                    <HardDrive className="h-6 w-6" />
                                </div>
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <h3 className="font-bold text-slate-800 text-lg">{alert.alert_type}</h3>
                                        <Badge className={getSeverityColor(alert.severity)} variant="outline">{alert.severity}</Badge>
                                        {alert.patient_name && (
                                            <span className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded-xl font-semibold">Device: {alert.patient_name}</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-slate-600">{alert.description}</p>
                                    <p className="text-xs text-slate-400 pt-1">Logged: {new Date(alert.triggered_at).toLocaleString()}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
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