import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, UserPlus, Key, Search, Lock, Unlock, ShieldAlert, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';

const API = `${import.meta.env.VITE_API_URL || ''}/api/facility-admin`;
const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

interface StaffMember {
    user_id: number; username: string; email: string; role: string;
    account_status: string; is_locked: boolean; joined_at: string;
    is_online: boolean;
}

export default function WardStaffManagement() {
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [search, setSearch] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'caregiver' | 'medical_staff'>('caregiver');
    const [showInvite, setShowInvite] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchStaff = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API}/staff`, { headers: getAuth() });
            const data = await res.json();
            if (data.success) setStaff(data.data);
        } catch { toast.error('Failed to load staff.'); }
        setLoading(false);
    };

    useEffect(() => { fetchStaff(); }, []);

    // Refresh every 30 seconds to update online/offline status
    useEffect(() => {
        const interval = setInterval(fetchStaff, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleRevokeSession = async (userId: number, username: string) => {
        if (!confirm(`Revoke all active sessions for ${username}? They will be logged out immediately.`)) return;
        try {
            const res = await fetch(`${API}/staff/${userId}/revoke-session`, { method: 'POST', headers: getAuth() });
            const data = await res.json();
            if (data.success) { toast.success(`Session revoked for ${username}.`); fetchStaff(); }
            else { console.error('Revoke failed:', data); toast.error(data.message || 'Revocation failed.'); }
        } catch (err) { console.error('Revoke error:', err); toast.error('Network error during revocation.'); }
    };

    const handleLockAccount = async (userId: number, username: string) => {
        if (!confirm(`Lock ${username}'s account? This will immediately log them out and prevent future login until unlocked.`)) return;
        try {
            const res = await fetch(`${API}/staff/${userId}/lock-account`, { method: 'POST', headers: getAuth() });
            const data = await res.json();
            if (data.success) { toast.success(data.message); fetchStaff(); }
            else toast.error(data.message);
        } catch { toast.error('Failed to lock account.'); }
    };

    const handleUnlockAccount = async (userId: number, username: string) => {
        if (!confirm(`Unlock ${username}'s account? They will be able to log in again.`)) return;
        try {
            const res = await fetch(`${API}/staff/${userId}/unlock-account`, { method: 'POST', headers: getAuth() });
            const data = await res.json();
            if (data.success) { toast.success(data.message); fetchStaff(); }
            else toast.error(data.message);
        } catch { toast.error('Failed to unlock account.'); }
    };

    const handleInvite = async () => {
        if (!inviteEmail) return toast.error('Enter a valid email.');
        const res = await fetch(`${API}/staff/invite`, {
            method: 'POST', headers: getAuth(),
            body: JSON.stringify({ email: inviteEmail, role: inviteRole })
        });
        const data = await res.json();
        if (data.success) { toast.success(data.message); setInviteEmail(''); setShowInvite(false); }
        else toast.error(data.message);
    };

    const filtered = staff.filter(s =>
        s.username.toLowerCase().includes(search.toLowerCase()) ||
        s.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-teal-900 tracking-tight">Staff Management</h2>
                    <p className="text-[10px] font-medium text-slate-500">View and manage caregivers and medical staff assigned to your facility.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchStaff} disabled={loading}
                        className="h-9 gap-1.5 text-slate-600 border-slate-200">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                    <Button onClick={() => setShowInvite(v => !v)} className="bg-teal-600 hover:bg-teal-700 text-white">
                        <UserPlus className="w-4 h-4 mr-2" /> Invite Staff
                    </Button>
                </div>
            </div>

            {showInvite && (
                <Card className="bg-teal-50 border-teal-200">
                    <CardHeader className="pb-2"><CardTitle className="text-teal-800 text-sm">Send Staff Invitation</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex gap-2 flex-wrap">
                            <Input value={inviteEmail} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInviteEmail(e.target.value)} placeholder="staff@facility.com" className="flex-1 h-8 text-sm" />
                            <select
                                value={inviteRole}
                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setInviteRole(e.target.value as 'caregiver' | 'medical_staff')}
                                className="h-8 text-sm border border-slate-200 rounded px-2 bg-white text-slate-700"
                            >
                                <option value="caregiver">Caregiver</option>
                                <option value="medical_staff">Medical Staff</option>
                            </select>
                            <Button onClick={handleInvite} className="h-8 bg-teal-600 hover:bg-teal-700 text-white text-sm">Send Invite</Button>
                        </div>
                        <p className="text-xs text-teal-700 mt-2">Note: Email delivery requires SMTP configuration by System Admin.</p>
                    </CardContent>
                </Card>
            )}

            <Card className="bg-white border border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-slate-400" />
                        <Input value={search} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)} placeholder="Search by name or email..." className="h-8 text-sm border-0 border-b border-slate-200 rounded-none focus-visible:ring-0 px-0" />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="border-b border-slate-100 text-xs text-slate-500">
                                <th className="text-left px-4 py-2 font-medium">Staff Member</th>
                                <th className="text-left px-4 py-2 font-medium">Role</th>
                                <th className="text-left px-4 py-2 font-medium">Status</th>
                                <th className="text-left px-4 py-2 font-medium">Joined</th>
                                <th className="text-left px-4 py-2 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0
                                ? <tr><td colSpan={5} className="text-center text-xs text-slate-400 py-8">No staff found.</td></tr>
                                : filtered.map(s => (
                                    <tr key={s.user_id} className={`border-b border-slate-50 hover:bg-slate-50 ${s.is_locked ? 'bg-red-50/50' : ''}`}>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-2">
                                                {/* Online/Offline indicator dot */}
                                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.is_locked ? 'bg-red-500' : s.is_online ? 'bg-emerald-500' : 'bg-slate-300'
                                                    }`}
                                                    title={s.is_locked ? 'Account Locked' : s.is_online ? 'Online' : 'Offline'}
                                                />
                                                <div>
                                                    <p className="font-medium text-slate-800">{s.username}</p>
                                                    <p className="text-xs text-slate-400">{s.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="text-xs capitalize text-slate-600">{s.role.replace('_', ' ')}</span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {s.is_locked ? (
                                                <Badge variant="destructive" className="text-xs gap-1">
                                                    <Lock className="w-3 h-3" /> Locked
                                                </Badge>
                                            ) : s.is_online ? (
                                                <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">Online</Badge>
                                            ) : (
                                                <Badge variant="outline" className="text-xs text-slate-500">Offline</Badge>
                                            )}
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-slate-400">{s.joined_at}</td>
                                        <td className="px-4 py-2.5">
                                            <div className="flex items-center gap-1 flex-wrap">
                                                {!s.is_locked && (
                                                    <>
                                                        <Button variant="ghost" size="sm" onClick={() => handleRevokeSession(s.user_id, s.username)}
                                                            className="h-7 text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-50 gap-1"
                                                            title="End all active sessions for this user">
                                                            <Key className="w-3 h-3" /> Revoke
                                                        </Button>
                                                        <Button variant="ghost" size="sm" onClick={() => handleLockAccount(s.user_id, s.username)}
                                                            className="h-7 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 gap-1"
                                                            title="Lock account immediately -- prevents login and revokes sessions">
                                                            <ShieldAlert className="w-3 h-3" /> Lock
                                                        </Button>
                                                    </>
                                                )}
                                                {s.is_locked && (
                                                    <Button variant="ghost" size="sm" onClick={() => handleUnlockAccount(s.user_id, s.username)}
                                                        className="h-7 text-xs text-teal-600 hover:text-teal-800 hover:bg-teal-50 gap-1"
                                                        title="Unlock account -- allows the user to log in again">
                                                        <Unlock className="w-3 h-3" /> Unlock
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>
        </div>
    );
}
