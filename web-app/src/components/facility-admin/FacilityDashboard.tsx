import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, Cpu, AlertTriangle, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const API = `${import.meta.env.VITE_API_URL || ''}/api/facility-admin`;
const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

interface FacilityStats {
    online_sensors: number;
    offline_sensors: number;
    battery_warnings: { serial_number: string; device_name: string; battery_level: number; first_name: string; last_name: string }[];
    pending_staff: number;
}

export default function FacilityDashboard() {
    const [stats, setStats] = useState<FacilityStats | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/stats`, { headers: getAuth() });
            const data = await res.json();
            if (data.success) setStats(data.data);
        } catch { toast.error('Failed to load ward stats.'); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchStats(); const t = setInterval(fetchStats, 30000); return () => clearInterval(t); }, []);

    const widgets = [
        { label: 'Online Sensors', value: stats?.online_sensors, icon: Cpu, colorClass: 'border-l-emerald-500', iconColor: 'text-emerald-500' },
        { label: 'Offline Sensors', value: stats?.offline_sensors, icon: Cpu, colorClass: 'border-l-red-500', iconColor: 'text-red-500' },
        { label: 'Pending Staff Approvals', value: stats?.pending_staff, icon: Users, colorClass: 'border-l-amber-500', iconColor: 'text-amber-500' },
        { label: 'Low Battery Alerts', value: stats?.battery_warnings?.length, icon: AlertTriangle, colorClass: 'border-l-orange-500', iconColor: 'text-orange-500', tooltip: 'Shows devices in your ward dropping below 20% battery requiring immediate charging.' },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-teal-900 tracking-tight">Ward Dashboard</h2>
                    <p className="text-[10px] font-medium text-slate-500">At-a-glance overview of your facility's sensor network and staffing status.</p>
                </div>
                <Button variant="outline" size="sm" onClick={fetchStats} className="border-slate-200 text-slate-600">
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </Button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {widgets.map(w => (
                    <Card key={w.label} className={`bg-white border border-slate-200 border-l-4 ${w.colorClass} shadow-sm`}>
                        <CardHeader className="flex flex-row items-center justify-between py-2 px-4 space-y-0">
                            <CardTitle className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{w.label}</CardTitle>
                            {'tooltip' in w ? <span title={w.tooltip as string}><w.icon className={`w-4 h-4 ${w.iconColor}`} /></span> : <w.icon className={`w-4 h-4 ${w.iconColor}`} />}
                        </CardHeader>
                        <CardContent className="px-4 pb-3 pt-0">
                            <div className="text-xl font-bold text-slate-800">{loading ? '...' : w.value ?? 0}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Battery Warnings */}
            {(stats?.battery_warnings?.length ?? 0) > 0 && (
                <Card className="bg-white border border-orange-200 shadow-sm">
                    <CardHeader className="py-2 px-4">
                        <CardTitle className="text-sm flex items-center gap-2 text-slate-700">
                            <span title="Shows devices in your ward dropping below 20% battery requiring immediate charging."><AlertTriangle className="w-3.5 h-3.5 text-orange-500" /></span> Low Battery Devices
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {stats?.battery_warnings.map(d => (
                                <div key={d.serial_number} className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5">
                                    <div>
                                        <p className="text-sm font-medium text-slate-700">{d.device_name || d.serial_number}</p>
                                        <p className="text-xs text-slate-500">{d.first_name} {d.last_name}</p>
                                    </div>
                                    <Badge variant="outline" className="text-orange-600 border-orange-400 font-bold">
                                        {d.battery_level}%
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Auto-refresh notice */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                Dashboard refreshes automatically every 30 seconds.
            </div>
        </div>
    );
}
