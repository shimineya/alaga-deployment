import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Activity, Wifi, WifiOff, Search, BatteryCharging, HardDrive, Radio } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';
const API = `${API_BASE}/api/facility-admin`;
const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

interface DevicePing {
    serial_number: string;
    device_name: string;
    status: string;
    last_heartbeat: string;
    is_online: boolean;
    battery_level: number | null;
    signal_strength: string | null;
    patient: string;
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

interface AccessLogEntry { log_id: number; staff_name: string; staff_role: string; action: string; patient_viewed: string; access_time: string; }

export default function ReadOnlyDiagnostics() {
    const [pingSerial, setPingSerial] = useState('');
    const [pingResult, setPingResult] = useState<DevicePing | null>(null);
    const [pinging, setPinging] = useState(false);
    const [devices, setDevices] = useState<SyncedDevice[]>([]);
    const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([]);
    const [logLoading, setLogLoading] = useState(true);

    const fetchDiagnosticsData = useCallback(async (silent = false) => {
        if (!silent) setLogLoading(true);
        try {
            const [logRes, devRes] = await Promise.all([
                fetch(`${API}/diagnostics/access-log`, { headers: getAuth() }),
                fetch(`${API_BASE}/api/caregiver/devices`, { headers: getAuth() })
            ]);
            const logData = await logRes.json().catch(() => ({}));
            if (logData.success) setAccessLog(logData.data || []);

            const devData = await devRes.json().catch(() => ({}));
            if (devData.success && Array.isArray(devData.data)) {
                setDevices(devData.data);
            }
        } catch {
            if (!silent) toast.error('Failed to fetch diagnostics data.');
        } finally {
            if (!silent) setLogLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDiagnosticsData(false);
        const pollId = setInterval(() => fetchDiagnosticsData(true), 3000);

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

            fetchDiagnosticsData(true);
        };

        window.addEventListener('alaga_alert_update', handleRealtimeSync);
        window.addEventListener('alaga_manual_refresh', handleRealtimeSync);
        return () => {
            clearInterval(pollId);
            window.removeEventListener('alaga_alert_update', handleRealtimeSync);
            window.removeEventListener('alaga_manual_refresh', handleRealtimeSync);
        };
    }, [fetchDiagnosticsData]);

    const handlePing = async (targetSerial?: string) => {
        const serialToPing = (targetSerial ?? pingSerial).trim();
        if (!serialToPing) return toast.error('Enter a serial number.');
        if (targetSerial) setPingSerial(targetSerial);
        setPinging(true);
        try {
            const res = await fetch(`${API}/diagnostics/ping/${encodeURIComponent(serialToPing)}`, { headers: getAuth() });
            const data = await res.json();
            if (data.success) {
                setPingResult(data.data);
                fetchDiagnosticsData(true);
            } else {
                toast.error(data.message);
            }
        } catch { toast.error('Ping failed.'); }
        finally { setPinging(false); }
    };

    return (
        <div className="space-y-4">
            <div>
                <h2 className="text-lg font-bold text-teal-900 tracking-tight">Hardware Diagnostics &amp; Logs</h2>
                <p className="text-[10px] font-medium text-slate-500">Real-time visibility into patient devices&apos; status, battery level, WiFi signal strength, and staff data access patterns.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Device Ping */}
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-slate-800 text-base flex items-center gap-2">
                            <Activity className="w-4 h-4 text-teal-600" /> Device Connectivity Check
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                            Checks real-time device status, battery level, and WiFi signal strength synchronized with Patients&apos; Devices.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex gap-2">
                            <Input
                                value={pingSerial}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPingSerial(e.target.value)}
                                placeholder="Serial Number (SD-2026-0001 or VS-2026-0001)"
                                className="h-8 text-xs font-mono placeholder:text-[10px]"
                            />
                            <Button onClick={() => handlePing()} disabled={pinging} className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-sm shrink-0">
                                <Search className="w-4 h-4 mr-1.5" /> {pinging ? 'Checking...' : 'Ping'}
                            </Button>
                        </div>
                        {pingResult && (
                            <div className={`rounded-lg p-3 border ${pingResult.is_online ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                    {pingResult.is_online
                                        ? <Wifi className="w-4 h-4 text-emerald-600" />
                                        : <WifiOff className="w-4 h-4 text-red-500" />}
                                    <span className={`text-sm font-semibold ${pingResult.is_online ? 'text-emerald-700' : 'text-red-700'}`}>
                                        {pingResult.is_online ? 'Device Online' : 'Device Offline'}
                                    </span>
                                    <Badge variant={pingResult.is_online ? 'secondary' : 'destructive'} className="text-xs">
                                        {pingResult.status}
                                    </Badge>
                                </div>
                                <p className="text-xs text-slate-600 mt-1"><strong>Device:</strong> {pingResult.device_name} ({pingResult.serial_number})</p>
                                <p className="text-xs text-slate-600"><strong>Patient:</strong> {pingResult.patient}</p>
                                <p className="text-xs text-slate-600">
                                    <strong>Battery:</strong> {pingResult.battery_level !== null && pingResult.battery_level !== undefined ? `${pingResult.battery_level}%` : '--'}
                                    {' | '}
                                    <strong>Signal:</strong> {pingResult.signal_strength || (pingResult.is_online ? 'Good' : 'Offline')}
                                </p>
                                <p className="text-xs text-slate-500">
                                    <strong>Last Signal:</strong> {pingResult.last_heartbeat ? new Date(pingResult.last_heartbeat).toLocaleString() : 'Never received'}
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Privacy note */}
                <div className="space-y-3">
                    <Card className="bg-blue-50 border-blue-200">
                        <CardContent className="p-4">
                            <p className="text-xs text-blue-800 font-medium mb-1">Data Privacy Notice (DPA § 11 — Proportionality)</p>
                            <p className="text-xs text-blue-700">
                                This access log shows who viewed patient data and when. It intentionally does not show IP addresses or browser/device information — those details are only available to the System Administrator. This design limits Facility Admins to the minimum information necessary for operational oversight.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Live Patient Devices Hardware Diagnostics Matrix */}
            <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                            <CardTitle className="text-slate-800 text-base flex items-center gap-2">
                                <HardDrive className="w-4 h-4 text-teal-600" />
                                Patient Devices Live Hardware Diagnostics
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500">
                                Live synchronized status, battery health, and signal strength for all registered patient devices.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                                {devices.filter(d => d.status === 'ACTIVE').length} Active
                            </Badge>
                            <Badge className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px]">
                                {devices.filter(d => d.status === 'INACTIVE').length} Inactive
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        {devices.length === 0 ? (
                            <p className="text-xs text-slate-400 p-4">No registered devices found.</p>
                        ) : (
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50 border-y border-slate-200">
                                    <tr>
                                        <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">Device &amp; Serial</th>
                                        <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">Assigned Patient</th>
                                        <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">Status</th>
                                        <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">Battery</th>
                                        <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">Signal</th>
                                        <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">Last Heartbeat</th>
                                        <th className="text-right px-4 py-2.5 text-slate-500 font-semibold">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {devices.map(dev => {
                                        const isOnline = dev.status === 'ACTIVE' || dev.is_online === true;
                                        const bat = dev.battery_level !== null && dev.battery_level !== undefined ? Number(dev.battery_level) : null;
                                        const sig = isOnline ? (dev.signal_strength || 'Good') : 'Offline';
                                        return (
                                            <tr key={dev.serial_number} className="border-b border-slate-100 hover:bg-slate-50/70">
                                                <td className="px-4 py-2.5">
                                                    <div className="font-semibold text-slate-800">{dev.device_name}</div>
                                                    <div className="font-mono text-[10px] text-slate-500">{dev.serial_number}</div>
                                                </td>
                                                <td className="px-4 py-2.5 font-medium text-slate-700">
                                                    {dev.assigned_patient_name || <span className="text-slate-400 italic">Unassigned</span>}
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <Badge className={`text-[10px] font-bold border ${
                                                        dev.status === 'ACTIVE'
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : dev.status === 'STANDBY'
                                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                                            : dev.status === 'AVAILABLE'
                                                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                            : 'bg-rose-50 text-rose-700 border-rose-200'
                                                    }`}>
                                                        {dev.status}
                                                    </Badge>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`inline-flex items-center gap-1 font-bold ${bat !== null && bat < 20 ? 'text-rose-600' : 'text-slate-700'}`}>
                                                        <BatteryCharging className="w-3.5 h-3.5" />
                                                        {bat !== null ? `${bat}%` : '--'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5">
                                                    <span className={`inline-flex items-center gap-1 font-semibold ${!isOnline ? 'text-slate-400' : sig.toLowerCase() === 'weak' ? 'text-amber-600' : 'text-emerald-700'}`}>
                                                        {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                                                        {sig}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-slate-500">
                                                    {dev.last_heartbeat ? new Date(dev.last_heartbeat).toLocaleString() : 'Never'}
                                                </td>
                                                <td className="px-4 py-2.5 text-right">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handlePing(dev.serial_number)}
                                                        disabled={pinging}
                                                        className="h-7 text-[11px] border-teal-200 text-teal-700 hover:bg-teal-50"
                                                    >
                                                        <Radio className="w-3 h-3 mr-1" /> Ping
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Patient Access Log */}
            <Card className="bg-white border-slate-200 shadow-sm">
                <CardHeader>
                    <CardTitle className="text-slate-800 text-base">Patient Data Access Log</CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                        DPA-compliant view: Shows staff name, role, action, and timestamp only. IP address and browser details are hidden from this view.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-80 overflow-y-auto">
                        {logLoading
                            ? <p className="text-xs text-slate-400 p-4">Loading...</p>
                            : accessLog.length === 0
                                ? <p className="text-xs text-slate-400 p-4">No access events recorded yet.</p>
                                : (
                                    <table className="w-full text-xs">
                                        <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                                            <tr>
                                                <th className="text-left px-4 py-2 text-slate-500 font-medium">Staff Member</th>
                                                <th className="text-left px-4 py-2 text-slate-500 font-medium">Role</th>
                                                <th className="text-left px-4 py-2 text-slate-500 font-medium">Action</th>
                                                <th className="text-left px-4 py-2 text-slate-500 font-medium">Patient</th>
                                                <th className="text-left px-4 py-2 text-slate-500 font-medium">Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {accessLog.map(log => (
                                                <tr key={log.log_id} className="border-b border-slate-50 hover:bg-slate-50">
                                                    <td className="px-4 py-2 font-medium text-slate-700">{log.staff_name}</td>
                                                    <td className="px-4 py-2 text-slate-500 capitalize">{log.staff_role?.replace('_', ' ')}</td>
                                                    <td className="px-4 py-2 text-slate-600 font-mono">{log.action}</td>
                                                    <td className="px-4 py-2 text-slate-500 truncate max-w-xs">{log.patient_viewed}</td>
                                                    <td className="px-4 py-2 text-slate-400">{log.access_time}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )
                        }
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
