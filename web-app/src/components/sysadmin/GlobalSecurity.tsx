import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Shield, Ban, Trash2, Plus, RefreshCw, Key } from 'lucide-react';

const API = `${import.meta.env.VITE_API_URL || ''}/api/sysadmin`;
const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

interface IpEntry { id: number; ip_address: string; reason: string; banned_at: string; }
interface Policy { password_rotation_days: number; mfa_required_roles: string[]; session_timeout_minutes: number; }

export default function GlobalSecurity() {
    const [ipList, setIpList] = useState<IpEntry[]>([]);
    const [newIp, setNewIp] = useState('');
    const [newIpReason, setNewIpReason] = useState('');
    const [policies, setPolicies] = useState<Policy>({ password_rotation_days: 90, mfa_required_roles: [], session_timeout_minutes: 480 });
    const [revokeUserId, setRevokeUserId] = useState('');
    const [revokeReason, setRevokeReason] = useState('');

    const fetchData = async () => {
        const [ipRes, policyRes] = await Promise.all([
            fetch(`${API}/security/ip-whitelist`, { headers: getAuth() }),
            fetch(`${API}/security/policies`, { headers: getAuth() })
        ]);
        const ipData = await ipRes.json();
        const policyData = await policyRes.json();
        if (ipData.success) setIpList(ipData.data);
        if (policyData.success && policyData.data) {
            try { setPolicies(typeof policyData.data === 'string' ? JSON.parse(policyData.data) : policyData.data); } catch { /* use defaults */ }
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleBanIp = async () => {
        if (!newIp) return toast.error('Enter an IP address.');
        const res = await fetch(`${API}/security/ip-ban`, { method: 'POST', headers: getAuth(), body: JSON.stringify({ ip: newIp, reason: newIpReason }) });
        const data = await res.json();
        if (data.success) { toast.success(data.message); setNewIp(''); setNewIpReason(''); fetchData(); }
        else toast.error(data.message);
    };

    const handleUnbanIp = async (id: number) => {
        const res = await fetch(`${API}/security/ip-ban/${id}`, { method: 'DELETE', headers: getAuth() });
        const data = await res.json();
        if (data.success) { toast.success('IP removed from ban list.'); fetchData(); }
        else toast.error(data.message);
    };

    const handleSavePolicies = async () => {
        const res = await fetch(`${API}/security/policies`, { method: 'POST', headers: getAuth(), body: JSON.stringify(policies) });
        const data = await res.json();
        if (data.success) toast.success('Security policies saved.'); else toast.error(data.message);
    };

    const handleRevokeSession = async () => {
        if (!revokeUserId) return toast.error('Enter a User ID.');
        const res = await fetch(`${API}/kill-switch/revoke-user`, { method: 'POST', headers: getAuth(), body: JSON.stringify({ user_id: parseInt(revokeUserId), reason: revokeReason }) });
        const data = await res.json();
        if (data.success) { toast.success(data.message); setRevokeUserId(''); setRevokeReason(''); }
        else toast.error(data.message);
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold text-white">Global Security</h2>
                <p className="text-slate-400 text-sm mt-1">IP blacklisting, session revocation, and global authentication policies.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* IP Blacklist */}
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-white text-base flex items-center gap-2"><Ban className="w-4 h-4 text-red-500" /> IP Blacklist</CardTitle>
                        <CardDescription className="text-slate-500 text-xs">Tooltip: Blocks all incoming requests from the listed IP addresses. Use this for repeated attackers or compromised network ranges.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <div className="flex gap-2">
                            <Input value={newIp} onChange={e => setNewIp(e.target.value)} placeholder="e.g. 192.168.1.1" className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
                            <Input value={newIpReason} onChange={e => setNewIpReason(e.target.value)} placeholder="Reason" className="bg-slate-800 border-slate-700 text-white text-sm h-8 flex-1" />
                            <Button size="sm" onClick={handleBanIp} className="h-8 bg-red-700 hover:bg-red-600 text-white shrink-0"><Plus className="w-4 h-4" /> Ban</Button>
                        </div>
                        <div className="max-h-52 overflow-y-auto space-y-1">
                            {ipList.length === 0
                                ? <p className="text-xs text-slate-600 py-2">No IPs on the blacklist.</p>
                                : ipList.map(ip => (
                                    <div key={ip.id} className="flex items-center justify-between bg-slate-800 rounded px-3 py-2">
                                        <div>
                                            <p className="text-xs font-mono text-red-400">{ip.ip_address}</p>
                                            <p className="text-xs text-slate-500">{ip.reason}</p>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => handleUnbanIp(ip.id)} className="h-6 text-slate-500 hover:text-red-400 p-1">
                                            <Trash2 className="w-3 h-3" />
                                        </Button>
                                    </div>
                                ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Session Revocation */}
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-white text-base flex items-center gap-2"><Key className="w-4 h-4 text-amber-500" /> Targeted Session Revocation</CardTitle>
                        <CardDescription className="text-slate-500 text-xs">Tooltip: Immediately logs out a specific user, even if their login token has not expired yet. Use when a device or account may be compromised.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <Input value={revokeUserId} onChange={e => setRevokeUserId(e.target.value)} placeholder="Target User ID (number)" className="bg-slate-800 border-slate-700 text-white text-sm h-8" type="number" />
                        <Input value={revokeReason} onChange={e => setRevokeReason(e.target.value)} placeholder="Reason for revocation (required)" className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
                        <Button onClick={handleRevokeSession} className="w-full h-8 bg-amber-700 hover:bg-amber-600 text-white text-sm">
                            <Key className="w-4 h-4 mr-2" /> Revoke User Session
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Authentication Policies */}
            <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                    <CardTitle className="text-white text-base flex items-center gap-2"><Shield className="w-4 h-4 text-teal-400" /> Global Authentication Policies</CardTitle>
                    <CardDescription className="text-slate-500 text-xs">
                        Tooltip: These settings apply to all users across all facilities. Changes take effect during each user's next login or session renewal.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Password Rotation (days)</label>
                            <p className="text-xs text-slate-600 mb-1">Tooltip: Users will be required to change their password after this many days.</p>
                            <Input
                                type="number"
                                value={policies.password_rotation_days}
                                onChange={e => setPolicies(p => ({ ...p, password_rotation_days: parseInt(e.target.value) }))}
                                className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">Session Timeout (minutes)</label>
                            <p className="text-xs text-slate-600 mb-1">Tooltip: Users will be logged out after being idle for this many minutes.</p>
                            <Input
                                type="number"
                                value={policies.session_timeout_minutes}
                                onChange={e => setPolicies(p => ({ ...p, session_timeout_minutes: parseInt(e.target.value) }))}
                                className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1">MFA Required Roles</label>
                            <p className="text-xs text-slate-600 mb-1">Current: {policies.mfa_required_roles.length === 0 ? 'None enforced' : policies.mfa_required_roles.join(', ')}</p>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {['caregiver', 'medical_staff', 'facility_admin'].map(role => (
                                    <Badge
                                        key={role}
                                        variant={policies.mfa_required_roles.includes(role) ? 'default' : 'outline'}
                                        className="cursor-pointer text-xs"
                                        onClick={() => setPolicies(p => ({
                                            ...p,
                                            mfa_required_roles: p.mfa_required_roles.includes(role)
                                                ? p.mfa_required_roles.filter(r => r !== role)
                                                : [...p.mfa_required_roles, role]
                                        }))}
                                    >
                                        {role.replace('_', ' ')}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    </div>
                    <Button onClick={handleSavePolicies} className="bg-teal-700 hover:bg-teal-600 text-white text-sm h-8">
                        <RefreshCw className="w-4 h-4 mr-2" /> Save Policies
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
