import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Activity, Wifi, WifiOff, Search } from 'lucide-react';

const API = `${import.meta.env.VITE_API_URL || ''}/api/facility-admin`;
const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

interface DevicePing { serial_number: string; device_name: string; status: string; last_heartbeat: string; is_online: boolean; patient: string; }
interface AccessLogEntry { log_id: number; staff_name: string; staff_role: string; action: string; patient_viewed: string; access_time: string; }

export default function ReadOnlyDiagnostics() {
    const [pingSerial, setPingSerial] = useState('');
    const [pingResult, setPingResult] = useState<DevicePing | null>(null);
    const [pinging, setPinging] = useState(false);
    const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([]);
    const [logLoading, setLogLoading] = useState(true);

    const fetchAccessLog = async () => {
        setLogLoading(true);
        try {
            const res = await fetch(`${API}/diagnostics/access-log`, { headers: getAuth() });
            const data = await res.json();
            if (data.success) setAccessLog(data.data);
        } catch { toast.error('Failed to fetch access log.'); }
        finally { setLogLoading(false); }
    };

    useEffect(() => { fetchAccessLog(); }, []);

    const handlePing = async () => {
        if (!pingSerial) return toast.error('Enter a serial number.');
        setPinging(true);
        setPingResult(null);
        try {
            const res = await fetch(`${API}/diagnostics/ping/${encodeURIComponent(pingSerial)}`, { headers: getAuth() });
            const data = await res.json();
            if (data.success) setPingResult(data.data);
            else toast.error(data.message);
        } catch { toast.error('Ping failed.'); }
        finally { setPinging(false); }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold text-slate-800">Diagnostics &amp; Logs</h2>
                <p className="text-slate-500 text-sm mt-1">Read-only visibility into device connectivity and staff data access patterns. No configuration changes can be made here.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Device Ping */}
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-slate-800 text-base flex items-center gap-2">
                            <Activity className="w-4 h-4 text-teal-600" /> Device Connectivity Check
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500">
                            Tooltip: Checks when this device last sent a signal to the server. If it has been more than 60 seconds, the device is considered offline.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex gap-2">
                            <Input
                                value={pingSerial}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPingSerial(e.target.value)}
                                placeholder="Serial Number (e.g. ALA-001)"
                                className="h-8 text-sm font-mono"
                            />
                            <Button onClick={handlePing} disabled={pinging} className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-sm shrink-0">
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
