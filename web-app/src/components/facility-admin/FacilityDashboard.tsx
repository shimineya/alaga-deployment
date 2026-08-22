import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    Users,
    Cpu,
    AlertTriangle,
    Clock,
    RefreshCw,
    Search,
    Wifi,
    WifiOff,
    User,
    Calendar,
    Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API = `${import.meta.env.VITE_API_URL || ''}/api/facility-admin`;
const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

interface FacilityStats {
    online_sensors: number;
    offline_sensors: number;
    battery_warnings: { serial_number: string; device_name: string; battery_level: number; first_name: string; last_name: string }[];
    pending_staff: number;
}

interface DashboardPatient {
    patient_id: number;
    name: string;
    birthdate: string;
    baseline_data: {
        gender?: string;
        diagnosis?: string;
    };
    created_at: string;
    paired_devices: {
        serial_number: string;
        device_name: string;
        status: string;
        last_heartbeat: string | null;
    }[];
}

export default function FacilityDashboard() {
    const [stats, setStats] = useState<FacilityStats | null>(null);
    const [patients, setPatients] = useState<DashboardPatient[]>([]);
    const [loading, setLoading] = useState(true);
    const [isLoadingPatients, setIsLoadingPatients] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/stats`, { headers: getAuth() });
            const data = await res.json();
            if (data.success) setStats(data.data);
        } catch { toast.error('Failed to load ward stats.'); }
        finally { setLoading(false); }
    };

    const fetchPatients = useCallback(async () => {
        setIsLoadingPatients(true);
        try {
            const res = await fetch(`${API}/dashboard/patients`, { headers: getAuth() });
            const data = await res.json();
            if (data.success) {
                setPatients(data.data || []);
            }
        } catch {
            toast.error('Failed to load patient cards.');
        } finally {
            setIsLoadingPatients(false);
        }
    }, []);

    const handleRefreshAll = () => {
        fetchStats();
        fetchPatients();
    };

    useEffect(() => {
        fetchStats();
        fetchPatients();
        const t = setInterval(() => {
            fetchStats();
            fetchPatients();
        }, 30000);
        return () => clearInterval(t);
    }, [fetchPatients]);

    const widgets = [
        { label: 'Online Sensors', value: stats?.online_sensors, icon: Cpu, colorClass: 'border-l-emerald-500', iconColor: 'text-emerald-500' },
        { label: 'Offline Sensors', value: stats?.offline_sensors, icon: Cpu, colorClass: 'border-l-red-500', iconColor: 'text-red-500' },
        { label: 'Pending Staff Approvals', value: stats?.pending_staff, icon: Users, colorClass: 'border-l-amber-500', iconColor: 'text-amber-500' },
        { label: 'Low Battery Alerts', value: stats?.battery_warnings?.length, icon: AlertTriangle, colorClass: 'border-l-orange-500', iconColor: 'text-orange-500', tooltip: 'Shows devices in your ward dropping below 20% battery requiring immediate charging.' },
    ];

    const getAge = (dobString: string) => {
        if (!dobString) return 'N/A';
        const birthDate = new Date(dobString);
        const difference = Date.now() - birthDate.getTime();
        const ageDate = new Date(difference);
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    };

    // Filter patients
    const filteredPatients = patients.filter(p => {
        const query = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(query) ||
            p.patient_id.toString().includes(query) ||
            (p.baseline_data?.diagnosis || '').toLowerCase().includes(query);
    });

    return (
        <div className="space-y-6 flex flex-col min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div>
                    <h2 className="text-lg font-bold text-teal-900 tracking-tight">Ward Dashboard</h2>
                    <p className="text-[10px] font-medium text-slate-500">At-a-glance overview of your facility's sensor network and staffing status.</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleRefreshAll} className="border-slate-200 text-slate-600 cursor-pointer">
                    <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </Button>
            </div>

            {/* Widgets Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
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
                <Card className="bg-white border border-orange-200 shadow-sm shrink-0">
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

            {/* Patient Cards Section */}
            <Card className="border-slate-200 shadow-sm flex-1 flex flex-col min-h-0">
                <CardHeader className="py-4 px-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                    <div>
                        <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-teal-600" />
                            Ward Patients Monitoring List
                        </CardTitle>
                        <CardDescription className="text-[10px] text-slate-400">
                            Patients registered by you or by medical staff you provisioned.
                        </CardDescription>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                            placeholder="Search patients by name or ID..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 h-8 text-xs bg-slate-50 border-slate-200 rounded-lg"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-4 flex-1 overflow-auto min-h-0 bg-slate-50/50">
                    {filteredPatients.length === 0 ? (
                        <div className="text-center py-12 italic text-slate-400 text-xs">
                            {isLoadingPatients ? 'Loading patient list...' : 'No patients found.'}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filteredPatients.map((pat) => (
                                <Card key={pat.patient_id} className="bg-white border-slate-200 hover:shadow-md transition-shadow">
                                    <CardContent className="p-4 space-y-3">
                                        {/* Patient Header */}
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                                                    <User className="w-4 h-4 text-slate-400" />
                                                    {pat.name}
                                                </h4>
                                                <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 font-medium">
                                                    <span>ID: #{pat.patient_id}</span>
                                                    <span>•</span>
                                                    <span>{getAge(pat.birthdate)} yrs</span>
                                                    <span>•</span>
                                                    <span>{pat.baseline_data?.gender || 'N/A'}</span>
                                                </div>
                                            </div>
                                            <Badge className="bg-teal-50 text-teal-700 hover:bg-teal-100 border-none font-semibold text-[9px] px-1.5 py-0.5 h-5">
                                                Monitoring
                                            </Badge>
                                        </div>

                                        {/* Diagnosis */}
                                        <div className="text-[10px] bg-slate-50/80 p-2 rounded-lg border border-slate-100 text-slate-600">
                                            <span className="font-semibold text-slate-700 block mb-0.5">Primary Diagnosis:</span>
                                            {pat.baseline_data?.diagnosis || 'No diagnosis recorded.'}
                                        </div>

                                        {/* Devices Sub-Section */}
                                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Paired Monitoring Hardware</span>
                                            {pat.paired_devices.length === 0 ? (
                                                <span className="text-[10px] text-slate-400 italic">No devices paired.</span>
                                            ) : (
                                                <div className="space-y-1.5">
                                                    {pat.paired_devices.map((dev) => {
                                                        const isOnline = dev.status === 'ACTIVE';
                                                        return (
                                                            <div key={dev.serial_number} className="flex items-center justify-between text-xs bg-slate-50/40 p-1.5 rounded border border-slate-100/60">
                                                                <div className="flex items-center gap-1.5">
                                                                    {isOnline ? (
                                                                        <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                                                                    ) : (
                                                                        <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                                                                    )}
                                                                    <div>
                                                                        <span className="font-bold text-slate-700 block text-[10px]">{dev.serial_number}</span>
                                                                        <span className="text-[8px] text-slate-400 font-medium block leading-none">{dev.device_name}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="text-right">
                                                                    <Badge className={`border-none font-bold text-[8px] px-1 h-4 ${isOnline
                                                                        ? 'bg-emerald-50 text-emerald-700'
                                                                        : 'bg-slate-100 text-slate-500'
                                                                        }`}>
                                                                        {isOnline ? 'Online' : 'Offline'}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>

                                        {/* Footer Creation Date */}
                                        <div className="flex items-center gap-1 text-[9px] text-slate-400 pt-1.5 border-t border-slate-50 font-medium">
                                            <Calendar className="w-3 h-3 text-slate-300" />
                                            <span>Registered on {pat.created_at}</span>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Auto-refresh notice */}
            <div className="flex items-center gap-2 text-xs text-slate-400 shrink-0">
                <Clock className="w-3 h-3" />
                Dashboard refreshes automatically every 30 seconds.
            </div>
        </div>
    );
}
