import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
    Globe, Cpu, Users, AlertTriangle, Server, Lock,
    ShieldOff, RefreshCw, CheckCircle
} from 'lucide-react';

interface SystemStats {
    total_patients: number;
    critical_alerts: number;
    online_devices: number;
    pending_users: number;
    total_facilities: number;
    system_status: string;
    uptime: number;
}

interface SecurityEvent {
    timestamp: string;
    action: string;
    severity: string;
    resource_affected: string;
    username: string;
    ip_address: string;
}

interface LockedAccount {
    user_id: number;
    username: string;
    email: string;
    role: string;
    account_status: string;
    facility_id: number;
}

const SYSADMIN_API = `${import.meta.env.VITE_API_URL || ''}/api/sysadmin`;

const getAuthHeader = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
});

const formatUptime = (s: number) => `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;

export default function CommandCenter() {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
    const [lockedAccounts, setLockedAccounts] = useState<LockedAccount[]>([]);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [lockdownConfirm, setLockdownConfirm] = useState('');
    const [showLockdownDialog, setShowLockdownDialog] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchAll = async () => {
        setLoading(true);
        try {
            const [statsRes, eventsRes, lockedRes, configRes] = await Promise.all([
                fetch(`${SYSADMIN_API}/stats`, { headers: getAuthHeader() }),
                fetch(`${SYSADMIN_API}/security-events`, { headers: getAuthHeader() }),
                fetch(`${SYSADMIN_API}/locked-accounts`, { headers: getAuthHeader() }),
                fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/system-config`, { headers: getAuthHeader() })
            ]);

            const [statsData, eventsData, lockedData, configData] = await Promise.all([
                statsRes.json(), eventsRes.json(), lockedRes.json(), configRes.json()
            ]);

            if (statsData.success) setStats(statsData.data);
            if (eventsData.success) setSecurityEvents(eventsData.data);
            if (lockedData.success) setLockedAccounts(lockedData.data);
            if (configData.success) {
                const mode = configData.data?.maintenance_mode;
                setMaintenanceMode(mode?.enabled === true);
            }
        } catch {
            toast.error('Failed to load Command Center data.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAll();
        // [ISO 25010] Auto-refresh every 30 seconds for operational visibility
        const interval = setInterval(fetchAll, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleGlobalLockdown = async () => {
        if (lockdownConfirm !== 'CONFIRM LOCKDOWN') {
            toast.error('You must type "CONFIRM LOCKDOWN" exactly to proceed.');
            return;
        }
        try {
            const res = await fetch(`${SYSADMIN_API}/kill-switch/global-lockdown`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify({ enabled: !maintenanceMode })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message);
                setShowLockdownDialog(false);
                setLockdownConfirm('');
                fetchAll();
            } else {
                toast.error(data.message);
            }
        } catch {
            toast.error('Lockdown operation failed.');
        }
    };

    const handleUnlockUser = async (userId: number) => {
        try {
            await fetch(`${SYSADMIN_API}/users/${userId}/lock`, {
                method: 'POST',
                headers: getAuthHeader(),
                body: JSON.stringify({ lock: false })
            });
            toast.success('User unlocked.');
            fetchAll();
        } catch {
            toast.error('Failed to unlock user.');
        }
    };

    const statWidgets = [
        { label: 'Active Patients', value: stats?.total_patients, icon: Users, colorClass: 'border-l-blue-500', iconColor: 'text-blue-500' },
        { label: 'Online Devices', value: stats?.online_devices, icon: Cpu, colorClass: 'border-l-emerald-500', iconColor: 'text-emerald-500' },
        { label: 'Pending Approvals', value: stats?.pending_users, icon: Users, colorClass: 'border-l-amber-500', iconColor: 'text-amber-500' },
        { label: 'Critical Alerts', value: stats?.critical_alerts, icon: AlertTriangle, colorClass: 'border-l-red-500', iconColor: 'text-red-500' }
    ];

    const severityColor = (s: string) =>
        s === 'CRITICAL' ? 'destructive' : s === 'WARNING' ? 'outline' : 'secondary';

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-teal-900 tracking-tight">Command Center</h2>
                    <p className="text-[10px] font-medium text-slate-500">Global infrastructure overview and emergency controls.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchAll} className="border-slate-200 text-slate-600">
                        <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                    </Button>
                    <div className="flex items-center gap-2 text-xs bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200 text-slate-600">
                        <Server className="w-3 h-3" />
                        Uptime: {loading ? '...' : formatUptime(stats?.uptime || 0)}
                    </div>
                </div>
            </div>

            {/* Zone A: Stat Widgets */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {statWidgets.map((w) => (
                    <Card key={w.label} className={`bg-white border border-slate-200 border-l-4 ${w.colorClass} shadow-sm`}>
                        <CardHeader className="flex flex-row items-center justify-between py-2 px-4 space-y-0">
                            <CardTitle className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{w.label}</CardTitle>
                            <w.icon className={`w-4 h-4 ${w.iconColor}`} />
                        </CardHeader>
                        <CardContent className="px-4 pb-3 pt-0">
                            <div className="text-xl font-bold text-slate-800">{loading ? '...' : w.value ?? 0}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Zone B: Threat Intel + Locked Accounts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Security Events Feed */}
                <Card className="bg-white border border-slate-200 shadow-sm">
                    <CardHeader className="py-2 px-4">
                        <CardTitle className="text-sm font-semibold text-slate-700">Recent Security Events</CardTitle>
                        <CardDescription className="text-[10px] text-slate-400">Last 10 critical and warning-level events.</CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                        {securityEvents.length === 0 ? (
                            <div className="flex items-center gap-2 text-emerald-600 text-xs py-3">
                                <CheckCircle className="w-4 h-4" /> No recent security events.
                            </div>
                        ) : (
                            <ul className="space-y-1">
                                {securityEvents.map((e, i) => (
                                    <li key={i} className="flex items-start justify-between gap-2 py-1.5 border-b border-slate-100 last:border-0">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant={severityColor(e.severity)} className="text-xs shrink-0">{e.severity}</Badge>
                                                <span className="text-xs font-mono text-slate-700 truncate">{e.action}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-0.5 truncate">{e.resource_affected}</p>
                                            <p className="text-xs text-slate-400">{e.username || 'System'} &bull; {e.ip_address || 'N/A'}</p>
                                        </div>
                                        <span className="text-xs text-slate-400 shrink-0">{new Date(e.timestamp).toLocaleTimeString()}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                {/* Locked/Suspended Accounts */}
                <Card className="bg-white border border-slate-200 shadow-sm">
                    <CardHeader className="py-2 px-4">
                        <CardTitle className="text-sm font-semibold text-slate-700">Locked &amp; Suspended Accounts</CardTitle>
                        <CardDescription className="text-[10px] text-slate-400">Accounts requiring administrative review.</CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                        {lockedAccounts.length === 0 ? (
                            <div className="flex items-center gap-2 text-emerald-600 text-xs py-3">
                                <CheckCircle className="w-4 h-4" /> All accounts are in good standing.
                            </div>
                        ) : (
                            <ul className="space-y-1">
                                {lockedAccounts.map((acc) => (
                                    <li key={acc.user_id} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                                        <div>
                                            <p className="text-sm font-medium text-slate-700">{acc.username}</p>
                                            <p className="text-xs text-slate-500">{acc.email} &bull; <span className="capitalize">{acc.role.replace('_', ' ')}</span></p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="destructive" className="text-xs">{acc.account_status}</Badge>
                                            <Button variant="ghost" size="sm" onClick={() => handleUnlockUser(acc.user_id)}
                                                className="text-xs text-emerald-600 hover:text-emerald-700 h-7">
                                                Unlock
                                            </Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Zone C: Emergency Response */}
            <Card className="bg-white border border-red-200 shadow-sm">
                <CardHeader className="py-2 px-4">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <ShieldOff className="w-4 h-4 text-red-500" />
                        Emergency Response Controls
                    </CardTitle>
                    <CardDescription className="text-[10px] text-slate-400">
                        These actions take effect immediately across all facilities. All events are logged as CRITICAL severity.
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0 space-y-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-red-50 border border-red-100">
                        <div>
                            <p className="text-sm font-semibold text-slate-700">
                                {maintenanceMode ? 'Global Lockdown is ACTIVE' : 'Global Lockdown'}
                            </p>
                            <p className="text-xs text-slate-500">
                                {maintenanceMode
                                    ? 'All non-admin users are locked out. Disable to restore access.'
                                    : 'Immediately locks all caregiver and facility admin accounts and revokes all active sessions.'}
                            </p>
                        </div>
                        <Button
                            variant={maintenanceMode ? 'outline' : 'destructive'}
                            size="sm"
                            onClick={() => setShowLockdownDialog(true)}
                            className={maintenanceMode ? 'border-emerald-400 text-emerald-700 hover:bg-emerald-50' : ''}
                        >
                            <Lock className="w-4 h-4 mr-2" />
                            {maintenanceMode ? 'Disable Lockdown' : 'Enable Global Lockdown'}
                        </Button>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <div>
                            <p className="text-sm font-semibold text-slate-700">System Backup</p>
                            <p className="text-xs text-slate-500">Download a full JSON snapshot of all critical database tables.</p>
                        </div>
                        <Button variant="outline" size="sm" className="border-slate-300 text-slate-600 hover:bg-slate-100" asChild>
                            <a href={`http://localhost:3000/api/sysadmin/backup`}
                                onClick={() => toast.info('Backup download started.')}
                                target="_blank" rel="noreferrer">
                                <RefreshCw className="w-4 h-4 mr-2" /> Download Backup
                            </a>
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Lockdown Confirmation Dialog — kept dark for visual severity */}
            {showLockdownDialog && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 backdrop-blur-sm">
                    <div className="bg-slate-900 border border-red-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-900/50 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-white font-semibold">
                                    {maintenanceMode ? 'Disable Global Lockdown' : 'Enable Global Lockdown'}
                                </h3>
                                <p className="text-xs text-slate-400">This action is logged as a CRITICAL security event.</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-300 mb-4">
                            {maintenanceMode
                                ? 'This will restore access for all locked accounts and disable maintenance mode.'
                                : 'This will immediately lock out all caregivers and facility admins, revoke all active sessions, and enable maintenance mode.'}
                        </p>
                        <p className="text-xs text-slate-400 mb-2">
                            Type <span className="font-mono font-bold text-red-400">CONFIRM LOCKDOWN</span> to proceed:
                        </p>
                        <Input
                            value={lockdownConfirm}
                            onChange={(e) => setLockdownConfirm(e.target.value)}
                            placeholder="CONFIRM LOCKDOWN"
                            className="bg-slate-800 border-slate-600 text-white font-mono mb-4"
                        />
                        <div className="flex gap-3">
                            <Button variant="outline" onClick={() => { setShowLockdownDialog(false); setLockdownConfirm(''); }}
                                className="flex-1 border-slate-700 text-slate-300">
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleGlobalLockdown}
                                className="flex-1"
                                disabled={lockdownConfirm !== 'CONFIRM LOCKDOWN'}>
                                {maintenanceMode ? 'Disable Lockdown' : 'Activate Lockdown'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
