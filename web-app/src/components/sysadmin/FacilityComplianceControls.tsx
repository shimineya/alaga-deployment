import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { 
    Shield, 
    ListFilter, 
    Activity, 
    FileText, 
    CheckCircle, 
    RefreshCw, 
    AlertTriangle, 
    Heart, 
    Droplet, 
    Mail 
} from 'lucide-react';

const API = `${import.meta.env.VITE_API_URL || ''}/api/facility-admin`;
const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

interface AuditLog {
    log_id: number;
    staff_name: string;
    staff_role: string;
    action: string;
    patient_viewed: string;
    access_time: string;
}

interface Thresholds {
    spo2_min: string;
    heart_rate_min: string;
    heart_rate_max: string;
    moisture_sensitivity: string;
    escalation_path: string[];
}

export default function FacilityComplianceControls() {
    const [thresholds, setThresholds] = useState<Thresholds>({
        spo2_min: '95',
        heart_rate_min: '60',
        heart_rate_max: '100',
        moisture_sensitivity: '200',
        escalation_path: []
    });

    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [logSearch, setLogSearch] = useState('');
    const [isLoadingLogs, setIsLoadingLogs] = useState(false);
    const [isSavingThresholds, setIsSavingThresholds] = useState(false);
    const [escalationInput, setEscalationInput] = useState('');

    const fetchThresholds = useCallback(async () => {
        try {
            const res = await fetch(`${API}/alerts/thresholds`, { headers: getAuth() });
            const data = await res.json();
            if (data.success && data.data) {
                const fetched = data.data;
                
                // Parse escalation path if it returns as an array
                let emailsArr: string[] = [];
                if (Array.isArray(fetched.escalation_path)) {
                    emailsArr = fetched.escalation_path;
                } else if (typeof fetched.escalation_path === 'string') {
                    try {
                        const parsed = JSON.parse(fetched.escalation_path);
                        if (Array.isArray(parsed)) emailsArr = parsed;
                    } catch {
                        emailsArr = fetched.escalation_path ? [fetched.escalation_path] : [];
                    }
                }

                setThresholds({
                    spo2_min: String(fetched.spo2_min || '95'),
                    heart_rate_min: String(fetched.heart_rate_min || '60'),
                    heart_rate_max: String(fetched.heart_rate_max || '100'),
                    moisture_sensitivity: String(fetched.moisture_sensitivity || '200'),
                    escalation_path: emailsArr
                });
                setEscalationInput(emailsArr.join(', '));
            }
        } catch {
            toast.error('Failed to load alert thresholds.');
        }
    }, []);

    const fetchLogs = useCallback(async () => {
        setIsLoadingLogs(true);
        try {
            const res = await fetch(`${API}/diagnostics/access-log`, { headers: getAuth() });
            const data = await res.json();
            if (data.success) {
                setLogs(data.data || []);
            }
        } catch {
            toast.error('Failed to load compliance access logs.');
        } finally {
            setIsLoadingLogs(false);
        }
    }, []);

    useEffect(() => {
        fetchThresholds();
        fetchLogs();
    }, [fetchThresholds, fetchLogs]);

    const handleSaveThresholds = async () => {
        // Validation
        const spo2 = parseInt(thresholds.spo2_min);
        const hrMin = parseInt(thresholds.heart_rate_min);
        const hrMax = parseInt(thresholds.heart_rate_max);
        const sensitivity = parseInt(thresholds.moisture_sensitivity);

        if (isNaN(spo2) || spo2 < 50 || spo2 > 100) return toast.error('SpO2 threshold must be between 50 and 100.');
        if (isNaN(hrMin) || hrMin < 30 || hrMin > hrMax) return toast.error('Heart Rate Min must be positive and less than max.');
        if (isNaN(hrMax) || hrMax > 220) return toast.error('Heart Rate Max must be reasonable (less than 220).');
        if (isNaN(sensitivity) || sensitivity < 0) return toast.error('Moisture sensitivity must be a valid number.');

        setIsSavingThresholds(true);

        // Convert escalation input back into array
        const emailsArr = escalationInput
            .split(',')
            .map(e => e.trim())
            .filter(e => e.includes('@'));

        try {
            const res = await fetch(`${API}/alerts/thresholds`, {
                method: 'PUT',
                headers: getAuth(),
                body: JSON.stringify({
                    spo2_min: spo2,
                    heart_rate_min: hrMin,
                    heart_rate_max: hrMax,
                    moisture_sensitivity: sensitivity,
                    escalation_path: emailsArr
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || 'Alert thresholds saved successfully.');
                fetchThresholds();
            } else {
                toast.error(data.message || 'Failed to save thresholds.');
            }
        } catch {
            toast.error('Failed to update thresholds.');
        } finally {
            setIsSavingThresholds(false);
        }
    };

    // Filter logs
    const filteredLogs = logs.filter(log => {
        const term = logSearch.toLowerCase();
        return (log.staff_name || '').toLowerCase().includes(term) ||
               (log.action || '').toLowerCase().includes(term) ||
               (log.patient_viewed || '').toLowerCase().includes(term) ||
               (log.staff_role || '').toLowerCase().includes(term);
    });

    return (
        <div className="space-y-6 flex flex-col min-h-0">
            {/* Header */}
            <div>
                <h1 className="text-lg font-bold text-teal-900 tracking-tight flex items-center gap-2">
                    <Shield className="w-5 h-5 text-teal-600 animate-pulse" />
                    Compliance Hub &amp; Security Controls
                </h1>
                <p className="text-[10px] font-medium text-slate-500">
                    Configure clinical threshold alarms and review Data Privacy Act (DPA) proportional access trails.
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start shrink-0">
                {/* Clinical Alarm Threshold Settings */}
                <Card className="xl:col-span-2 bg-white border-slate-200 shadow-sm">
                    <CardHeader className="py-4 border-b border-slate-100 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-teal-600" />
                                Clinical Vital Sign Thresholds
                            </CardTitle>
                            <CardDescription className="text-[10px] text-slate-500">
                                Configure facility-wide limits. Vital levels outside these bounds will trigger alerts.
                            </CardDescription>
                        </div>
                        <Badge className="bg-teal-50 text-teal-700 hover:bg-teal-100 border-none font-semibold text-[10px] px-2 py-0.5">
                            Facility Active Configuration
                        </Badge>
                    </CardHeader>
                    <CardContent className="py-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* SpO2 */}
                            <div className="p-3 border border-slate-100 rounded-lg bg-slate-50/50 space-y-2">
                                <label className="text-[10px] font-bold text-slate-700 flex items-center gap-1.5">
                                    <Heart className="w-3.5 h-3.5 text-rose-500" />
                                    Minimum SpO2 Level (%)
                                </label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        value={thresholds.spo2_min}
                                        onChange={(e) => setThresholds(t => ({ ...t, spo2_min: e.target.value }))}
                                        className="h-8 text-xs bg-white border-slate-200 w-24"
                                    />
                                    <span className="text-[10px] text-slate-400">Alarm triggers below this % value. Default is 95%.</span>
                                </div>
                            </div>

                            {/* Heart Rate Min & Max */}
                            <div className="p-3 border border-slate-100 rounded-lg bg-slate-50/50 space-y-2">
                                <label className="text-[10px] font-bold text-slate-700 flex items-center gap-1.5">
                                    <Heart className="w-3.5 h-3.5 text-red-600" />
                                    Heart Rate Bounds (BPM)
                                </label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        placeholder="Min"
                                        value={thresholds.heart_rate_min}
                                        onChange={(e) => setThresholds(t => ({ ...t, heart_rate_min: e.target.value }))}
                                        className="h-8 text-xs bg-white border-slate-200 w-16"
                                    />
                                    <span className="text-slate-400 text-xs">-</span>
                                    <Input
                                        type="number"
                                        placeholder="Max"
                                        value={thresholds.heart_rate_max}
                                        onChange={(e) => setThresholds(t => ({ ...t, heart_rate_max: e.target.value }))}
                                        className="h-8 text-xs bg-white border-slate-200 w-16"
                                    />
                                    <span className="text-[10px] text-slate-400">Normal BPM range limits.</span>
                                </div>
                            </div>

                            {/* Moisture Sensitivity */}
                            <div className="p-3 border border-slate-100 rounded-lg bg-slate-50/50 space-y-2">
                                <label className="text-[10px] font-bold text-slate-700 flex items-center gap-1.5">
                                    <Droplet className="w-3.5 h-3.5 text-blue-500" />
                                    Smart Diaper Sensitivity
                                </label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="number"
                                        value={thresholds.moisture_sensitivity}
                                        onChange={(e) => setThresholds(t => ({ ...t, moisture_sensitivity: e.target.value }))}
                                        className="h-8 text-xs bg-white border-slate-200 w-24"
                                    />
                                    <span className="text-[10px] text-slate-400">Moisture conductivity value limit.</span>
                                </div>
                            </div>

                            {/* Escalation Path (Alert Recipients) */}
                            <div className="p-3 border border-slate-100 rounded-lg bg-slate-50/50 space-y-2">
                                <label className="text-[10px] font-bold text-slate-700 flex items-center gap-1.5">
                                    <Mail className="w-3.5 h-3.5 text-indigo-500" />
                                    Alert Escalation Recipients
                                </label>
                                <div className="space-y-1">
                                    <Input
                                        type="text"
                                        placeholder="nurse@alaga.local, admin@alaga.local"
                                        value={escalationInput}
                                        onChange={(e) => setEscalationInput(e.target.value)}
                                        className="h-8 text-xs bg-white border-slate-200 w-full"
                                    />
                                    <p className="text-[8px] text-slate-400 font-medium">Comma-separated emails that receive copies of critical alert notifications.</p>
                                </div>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 flex justify-end">
                            <Button 
                                onClick={handleSaveThresholds} 
                                disabled={isSavingThresholds}
                                className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold cursor-pointer"
                            >
                                {isSavingThresholds ? 'Updating Thresholds...' : 'Save Configuration'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Regulatory Indicators */}
                <Card className="bg-white border-slate-200 shadow-sm h-full">
                    <CardHeader className="py-4 border-b border-slate-100">
                        <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Shield className="w-4 h-4 text-emerald-600" />
                            DPA &amp; HIPAA Parameters
                        </CardTitle>
                        <CardDescription className="text-[10px] text-slate-500">Active policy enforcement status.</CardDescription>
                    </CardHeader>
                    <CardContent className="py-4 space-y-3 text-xs">
                        <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                            <span className="font-semibold text-slate-600">Proportionality Trail</span>
                            <Badge className="bg-emerald-50 text-emerald-700 border-none font-semibold text-[8px] px-1.5 py-0 h-4">
                                ACTIVE
                            </Badge>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                            <span className="font-semibold text-slate-600">Soft-Delete Retain</span>
                            <Badge className="bg-emerald-50 text-emerald-700 border-none font-semibold text-[8px] px-1.5 py-0 h-4">
                                1 YEAR
                            </Badge>
                        </div>
                        <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
                            <span className="font-semibold text-slate-600">PHI Logging Granularity</span>
                            <Badge className="bg-blue-50 text-blue-700 border-none font-semibold text-[8px] px-1.5 py-0 h-4">
                                WHO &amp; WHEN
                            </Badge>
                        </div>
                        <div className="p-3 bg-amber-50/50 border border-amber-100 rounded-lg flex gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-[9px] text-amber-800 leading-relaxed font-medium">
                                <strong>DPA Proportionality Enforced:</strong> Under RA 10173 Section 11, data view logs do not store user-agent or IP addresses to minimize secondary risk vectors.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Access Logs Audit Trail */}
            <Card className="border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
                <CardHeader className="py-4 px-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                    <div>
                        <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-teal-600" />
                            DPA Clinical Access Log Trail
                        </CardTitle>
                        <CardDescription className="text-[10px] text-slate-400">
                            Real-time logging of user actions retrieving or altering patient clinical records in this facility.
                        </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative w-full sm:w-60">
                            <ListFilter className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input
                                placeholder="Filter access logs..."
                                value={logSearch}
                                onChange={(e) => setLogSearch(e.target.value)}
                                className="pl-8 h-8 text-xs bg-slate-50 border-slate-200 rounded-lg"
                            />
                        </div>
                        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={isLoadingLogs} className="h-8 gap-1.5 cursor-pointer">
                            <RefreshCw className={`w-3 h-3 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                            Refresh
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-auto min-h-0">
                    {filteredLogs.length === 0 ? (
                        <div className="text-center py-12 italic text-slate-400 text-xs">
                            {isLoadingLogs ? 'Loading compliance logs...' : 'No access records found.'}
                        </div>
                    ) : (
                        <div className="w-full overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                                        <th className="p-3">Log ID</th>
                                        <th className="p-3">Staff Name</th>
                                        <th className="p-3">Staff Role</th>
                                        <th className="p-3">Action</th>
                                        <th className="p-3">PHI Resource Affected</th>
                                        <th className="p-3">Access Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLogs.map((log) => (
                                        <tr key={log.log_id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                            <td className="p-3 font-mono text-[10px] text-slate-400">#{log.log_id}</td>
                                            <td className="p-3 font-bold text-slate-800">{log.staff_name}</td>
                                            <td className="p-3 text-slate-600">
                                                <Badge className="bg-slate-100 text-slate-700 border-none font-medium text-[8px] px-1 py-0 h-4">
                                                    {log.staff_role}
                                                </Badge>
                                            </td>
                                            <td className="p-3 font-medium">
                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                                    log.action === 'PATIENT_UPDATE' 
                                                        ? 'bg-amber-50 text-amber-700' 
                                                        : 'bg-teal-50 text-teal-700'
                                                }`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="p-3 text-slate-600 font-medium">{log.patient_viewed}</td>
                                            <td className="p-3 text-slate-500 font-mono text-[10px]">{log.access_time}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
