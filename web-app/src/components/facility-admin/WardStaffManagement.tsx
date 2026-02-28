import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Users, UserPlus, Key, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

const API = 'http://localhost:3000/api/facility-admin';
const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

interface StaffMember {
    user_id: number; username: string; email: string; role: string;
    account_status: string; is_locked: boolean; joined_at: string;
}

const statusColor = (s: string, locked: boolean) => {
    if (locked || s === 'Locked') return 'destructive';
    if (s === 'Pending_Review') return 'outline';
    return 'secondary';
};

export default function WardStaffManagement() {
    const [staff, setStaff] = useState<StaffMember[]>([]);
    const [search, setSearch] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'caregiver' | 'medical_staff'>('caregiver');
    const [showInvite, setShowInvite] = useState(false);

    const fetchStaff = async () => {
        try {
            const res = await fetch(`${API}/staff`, { headers: getAuth() });
            const data = await res.json();
            if (data.success) setStaff(data.data);
        } catch { toast.error('Failed to load staff.'); }
    };

    useEffect(() => { fetchStaff(); }, []);

    const handleRevokeSession = async (userId: number, username: string) => {
        try {
            const res = await fetch(`${API}/staff/${userId}/revoke-session`, { method: 'POST', headers: getAuth() });
            const data = await res.json();
            if (data.success) { toast.success(`Session revoked for ${username}.`); fetchStaff(); }
            else toast.error(data.message);
        } catch { toast.error('Revocation failed.'); }
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
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold text-slate-800">Staff Management</h2>
                    <p className="text-slate-500 text-sm mt-1">View and manage caregivers and medical staff assigned to your facility.</p>
                </div>
                <Button onClick={() => setShowInvite(v => !v)} className="bg-teal-600 hover:bg-teal-700 text-white">
                    <UserPlus className="w-4 h-4 mr-2" /> Invite Staff
                </Button>
            </div>

            {showInvite && (
                <Card className="bg-teal-50 border-teal-200">
                    <CardHeader className="pb-2"><CardTitle className="text-teal-800 text-sm">Send Staff Invitation</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex gap-2 flex-wrap">
                            <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="staff@facility.com" className="flex-1 h-8 text-sm" />
                            <select
                                value={inviteRole}
                                onChange={e => setInviteRole(e.target.value as 'caregiver' | 'medical_staff')}
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
                        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..." className="h-8 text-sm border-0 border-b border-slate-200 rounded-none focus-visible:ring-0 px-0" />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 text-xs text-slate-500">
                                <th className="text-left px-4 py-2 font-medium">Staff Member</th>
                                <th className="text-left px-4 py-2 font-medium">Role</th>
                                <th className="text-left px-4 py-2 font-medium">Status</th>
                                <th className="text-left px-4 py-2 font-medium">Joined</th>
                                <th className="text-left px-4 py-2 font-medium">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0
                                ? <tr><td colSpan={5} className="text-center text-xs text-slate-400 py-8">No staff found.</td></tr>
                                : filtered.map(s => (
                                    <tr key={s.user_id} className="border-b border-slate-50 hover:bg-slate-50">
                                        <td className="px-4 py-2.5">
                                            <p className="font-medium text-slate-800">{s.username}</p>
                                            <p className="text-xs text-slate-400">{s.email}</p>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="text-xs capitalize text-slate-600">{s.role.replace('_', ' ')}</span>
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <Badge variant={statusColor(s.account_status, s.is_locked)} className="text-xs">
                                                {s.is_locked ? 'Locked' : s.account_status}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-2.5 text-xs text-slate-400">{s.joined_at}</td>
                                        <td className="px-4 py-2.5">
                                            <Button variant="ghost" size="sm" onClick={() => handleRevokeSession(s.user_id, s.username)}
                                                className="h-7 text-xs text-amber-600 hover:text-amber-800 hover:bg-amber-50 gap-1.5">
                                                <Key className="w-3 h-3" /> Revoke Session
                                            </Button>
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
