import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserPlus, Key, Search, Lock, Unlock, ShieldAlert, RefreshCw, Trash2, ShieldCheck, ChevronRight, ChevronDown, ToggleRight, ToggleLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MODULE_REGISTRY, computeRoleDefaults } from '@/lib/rbac-registry';

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
    const [loading, setLoading] = useState(false);

    // Create User State
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', email: '', role: 'caregiver', password: '' });
    const [creating, setCreating] = useState(false);

    // RBAC Modal State
    const [rbacModalOpen, setRbacModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<StaffMember | null>(null);
    const [overrides, setOverrides] = useState<Record<string, boolean | null>>({});
    const [roleDefaults, setRoleDefaults] = useState<Record<string, boolean>>({});
    const [expandedGroups, setExpandedGroups] = useState<string[]>(MODULE_REGISTRY.map(g => g.group));
    const [savingOverride, setSavingOverride] = useState<string | null>(null);
    
    // Reason Modal State (for RBAC)
    const [reasonModal, setReasonModal] = useState<{ moduleId: string; label: string; newValue: boolean } | null>(null);
    const [reason, setReason] = useState('');

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
    useEffect(() => {
        const interval = setInterval(fetchStaff, 30000);
        return () => clearInterval(interval);
    }, []);

    // -----------------------------------------------------
    // CRUD: CREATE & DELETE
    // -----------------------------------------------------
    const handleCreateStaff = async () => {
        if (!newUser.username || !newUser.email || !newUser.password) {
            return toast.error("All fields (Username, Email, Password) are required.");
        }
        setCreating(true);
        try {
            const res = await fetch(`${API}/staff`, {
                method: 'POST',
                headers: getAuth(),
                body: JSON.stringify(newUser)
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Staff member provisioned successfully.');
                setIsCreateOpen(false);
                setNewUser({ username: '', email: '', role: 'caregiver', password: '' });
                fetchStaff();
            } else {
                toast.error(data.message || 'Failed to create staff.');
            }
        } catch (err) {
            toast.error('Network error during provisioning.');
        }
        setCreating(false);
    };

    const handleDeleteStaff = async (userId: number, username: string) => {
        if (!confirm(`Are you absolutely sure you want to permanently delete the account for ${username}? This action is logged and cannot be undone.`)) return;
        try {
            const res = await fetch(`${API}/staff/${userId}`, { method: 'DELETE', headers: getAuth() });
            const data = await res.json();
            if (data.success) {
                toast.success(`Staff member ${username} removed.`);
                fetchStaff();
            } else {
                toast.error(data.message || 'Failed to delete staff member.');
            }
        } catch (err) {
            toast.error('Network error removing staff member.');
        }
    };

    // -----------------------------------------------------
    // QUICK ACTIONS
    // -----------------------------------------------------
    const handleRevokeSession = async (userId: number, username: string) => {
        if (!confirm(`Revoke all active sessions for ${username}? They will be logged out immediately.`)) return;
        try {
            const res = await fetch(`${API}/staff/${userId}/revoke-session`, { method: 'POST', headers: getAuth() });
            const data = await res.json();
            if (data.success) { toast.success(`Session revoked for ${username}.`); fetchStaff(); }
            else { toast.error(data.message || 'Revocation failed.'); }
        } catch (err) { toast.error('Network error during revocation.'); }
    };

    const handleLockAccount = async (userId: number, username: string) => {
        if (!confirm(`Lock ${username}'s account? This will immediately log them out and prevent future login.`)) return;
        try {
            const res = await fetch(`${API}/staff/${userId}/lock-account`, { method: 'POST', headers: getAuth() });
            const data = await res.json();
            if (data.success) { toast.success(data.message); fetchStaff(); }
            else toast.error(data.message);
        } catch { toast.error('Failed to lock account.'); }
    };

    const handleUnlockAccount = async (userId: number, username: string) => {
        if (!confirm(`Unlock ${username}'s account?`)) return;
        try {
            const res = await fetch(`${API}/staff/${userId}/unlock-account`, { method: 'POST', headers: getAuth() });
            const data = await res.json();
            if (data.success) { toast.success(data.message); fetchStaff(); }
            else toast.error(data.message);
        } catch { toast.error('Failed to unlock account.'); }
    };

    // -----------------------------------------------------
    // RBAC PERMISSIONS LOGIC
    // -----------------------------------------------------
    const openRbacModal = async (user: StaffMember) => {
        setSelectedUser(user);
        setOverrides({});
        setRoleDefaults(computeRoleDefaults(user.role));
        setRbacModalOpen(true);
        
        try {
            const overridesRes = await fetch(`${API}/staff/${user.user_id}/overrides`, { headers: getAuth() });
            const overridesData = await overridesRes.json();
            if (overridesData.success) {
                const map: Record<string, boolean | null> = {};
                overridesData.data.forEach((o: any) => { map[o.module_id] = o.is_granted; });
                setOverrides(map);
            }
        } catch { toast.error('Failed to load actual DB overrides.'); }
    };

    const initiateToggle = (moduleId: string, label: string, currentValue: boolean | null, def: boolean) => {
        const effective = currentValue !== null ? currentValue : def;
        setReason('');
        setReasonModal({ moduleId, label, newValue: !effective });
    };

    const confirmToggle = async () => {
        if (!selectedUser || !reasonModal) return;
        if (!reason.trim()) return toast.error('Justification reasoning is required for audit logs. [OWASP A09]');

        setSavingOverride(reasonModal.moduleId);
        try {
            const res = await fetch(`${API}/staff/${selectedUser.user_id}/overrides`, {
                method: 'POST', headers: getAuth(),
                body: JSON.stringify({
                    module_id: reasonModal.moduleId,
                    is_granted: reasonModal.newValue,
                    override_reason: reason.trim()
                })
            });
            const data = await res.json();
            if (data.success) {
                setOverrides(prev => ({ ...prev, [reasonModal.moduleId]: reasonModal.newValue }));
                toast.success(`Access ${reasonModal.newValue ? 'granted' : 'revoked'} for ${selectedUser.username}.`);
                setReasonModal(null);
            } else { toast.error(data.message); }
        } catch { toast.error('Network error saving override.'); }
        setSavingOverride(null);
    };

    const handleResetOverride = async (moduleId: string, label: string) => {
        if (!selectedUser) return;
        if (!confirm(`Reset "${label}" to standard default for ${selectedUser.username}?`)) return;
        setSavingOverride(moduleId);
        try {
            const res = await fetch(`${API}/staff/${selectedUser.user_id}/overrides/${moduleId}`, { method: 'DELETE', headers: getAuth() });
            const data = await res.json();
            if (data.success) {
                setOverrides(prev => { const n = { ...prev }; delete n[moduleId]; return n; });
                toast.success(`Reset to default successful.`);
            } else { toast.error(data.message); }
        } catch { toast.error('Reset failed.'); }
        setSavingOverride(null);
    };

    const toggleGroup = (g: string) => setExpandedGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

    const filtered = staff.filter(s => s.username.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-teal-900 tracking-tight">User Management</h2>
                    <p className="text-[10px] font-medium text-slate-500">View and manage caregivers and medical staff assigned to your facility.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchStaff} disabled={loading} className="h-9 gap-1.5 text-slate-600 border-slate-200">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                    <Button onClick={() => setIsCreateOpen(true)} className="bg-teal-600 hover:bg-teal-700 text-white">
                        <UserPlus className="w-4 h-4 mr-2" /> Add User
                    </Button>
                </div>
            </div>

            <Card className="bg-white border border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center gap-2">
                        <Search className="w-4 h-4 text-slate-400" />
                        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..." className="h-8 text-sm border-0 border-b border-slate-200 rounded-none focus-visible:ring-0 px-0" />
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
                            {filtered.length === 0 ? <tr><td colSpan={5} className="text-center text-xs text-slate-400 py-8">No staff found.</td></tr> : filtered.map(s => (
                                <tr key={s.user_id} className={`border-b border-slate-50 hover:bg-slate-50 ${s.is_locked ? 'bg-red-50/50' : ''}`}>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-2">
                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.is_locked ? 'bg-red-500' : s.is_online ? 'bg-emerald-500' : 'bg-slate-300'}`} title={s.is_locked ? 'Account Locked' : s.is_online ? 'Online' : 'Offline'} />
                                            <div>
                                                <p className="font-medium text-slate-800">{s.username}</p>
                                                <p className="text-xs text-slate-400">{s.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-2.5"><span className="text-xs capitalize text-slate-600">{s.role.replace('_', ' ')}</span></td>
                                    <td className="px-4 py-2.5">
                                        {s.is_locked ? <Badge variant="destructive" className="text-xs gap-1"><Lock className="w-3 h-3" /> Locked</Badge> : s.is_online ? <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">Online</Badge> : <Badge variant="outline" className="text-xs text-slate-500">Offline</Badge>}
                                    </td>
                                    <td className="px-4 py-2.5 text-xs text-slate-400">{s.joined_at}</td>
                                    <td className="px-4 py-2.5">
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {!s.is_locked && (
                                                <>
                                                    <Button variant="ghost" size="sm" onClick={() => handleRevokeSession(s.user_id, s.username)} className="h-7 px-2 text-amber-600 hover:text-amber-800 hover:bg-amber-50" title="End all active sessions"><Key className="w-3.5 h-3.5" /></Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleLockAccount(s.user_id, s.username)} className="h-7 px-2 text-red-600 hover:text-red-800 hover:bg-red-50" title="Lock account immediately"><ShieldAlert className="w-3.5 h-3.5" /></Button>
                                                </>
                                            )}
                                            {s.is_locked && (
                                                <Button variant="ghost" size="sm" onClick={() => handleUnlockAccount(s.user_id, s.username)} className="h-7 px-2 text-teal-600 hover:text-teal-800 hover:bg-teal-50" title="Unlock account"><Unlock className="w-3.5 h-3.5" /></Button>
                                            )}
                                            
                                            {/* New CRUD & RBAC Actions */}
                                            <Button variant="ghost" size="sm" onClick={() => openRbacModal(s)} className="h-7 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50" title="Manage RBAC Permissions">
                                                <ShieldCheck className="w-3.5 h-3.5" />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDeleteStaff(s.user_id, s.username)} className="h-7 px-2 text-slate-400 hover:text-red-600 hover:bg-red-50" title="Permanently Delete Staff">
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </CardContent>
            </Card>

            {/* CREATE MODAL */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-800">Provision New Staff</DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">Register a new medical staff or caregiver for your facility.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs font-semibold text-slate-700">Username</Label>
                            <Input value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} className="col-span-3 text-sm h-9" placeholder="e.g. jdoe_nurse" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs font-semibold text-slate-700">Email</Label>
                            <Input type="email" value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} className="col-span-3 text-sm h-9" placeholder="jdoe@hospital.com" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs font-semibold text-slate-700">Password</Label>
                            <Input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} className="col-span-3 text-sm h-9" placeholder="Temporary password" />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs font-semibold text-slate-700">Role</Label>
                            <Select value={newUser.role} onValueChange={val => setNewUser({ ...newUser, role: val })}>
                                <SelectTrigger className="col-span-3 h-9 text-sm"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="caregiver">Caregiver</SelectItem>
                                    <SelectItem value="medical_staff">Medical Staff</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button size="sm" disabled={creating} className="bg-teal-700 hover:bg-teal-600 text-white" onClick={handleCreateStaff}>
                            {creating ? 'Adding User...' : 'Add User'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* RBAC OVERRIDE MODAL
                modal={false} — prevents Radix from setting pointer-events:none on the body.
                Without this, the justification popup rendered outside DialogContent
                is unreachable because clicks are blocked by Radix's focus lock. */}
            <Dialog open={rbacModalOpen} onOpenChange={setRbacModalOpen} modal={false}>
                <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-slate-50">
                    <div className="p-4 border-b border-slate-200 bg-white">
                        <DialogTitle className="text-lg font-bold text-slate-800">Advanced Access Control</DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">Toggle specialized feature permissions for {selectedUser?.username}. Overrides apply locally.</DialogDescription>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {MODULE_REGISTRY.map(group => {
                            const expanded = expandedGroups.includes(group.group);
                            return (
                                <Card key={group.group} className="border border-slate-200 shadow-sm overflow-hidden">
                                    <button onClick={() => toggleGroup(group.group)} className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-100 hover:bg-slate-200 transition-colors text-left">
                                        <span className="text-xs font-bold text-slate-700">{group.group}</span>
                                        {expanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                    </button>
                                    {expanded && (
                                        <CardContent className="p-0 divide-y divide-slate-100 bg-white">
                                            {group.modules.map(mod => {
                                                const ov = overrides.hasOwnProperty(mod.id) ? overrides[mod.id] : null;
                                                const def = roleDefaults[mod.id] || false;
                                                const effective = ov !== null ? ov : def;
                                                const isBusy = savingOverride === mod.id;

                                                return (
                                                    <div key={mod.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-xs font-semibold text-slate-800">{mod.label}</p>
                                                                {ov !== null && (
                                                                    <Badge className={`text-[9px] px-1.5 py-0 border font-medium cursor-pointer ${effective ? 'bg-teal-100 text-teal-700 border-teal-200' : 'bg-red-100 text-red-700 border-red-200'}`} onClick={() => handleResetOverride(mod.id, mod.label)}>
                                                                        {effective ? 'Override Set' : 'Denied By Override'} (Reset)
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{mod.description}</p>
                                                        </div>
                                                        <button onClick={() => initiateToggle(mod.id, mod.label, ov, def)} disabled={isBusy} className={`shrink-0 transition-opacity ${isBusy ? 'opacity-50' : 'hover:opacity-80'}`}>
                                                            {effective ? <ToggleRight className="w-8 h-8 text-teal-500" /> : <ToggleLeft className="w-8 h-8 text-slate-300" />}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </CardContent>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                </DialogContent>
            </Dialog>

            {/* RBAC REASON MODAL */}
            {reasonModal && (
                <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 animate-in zoom-in-95">
                        <div className="mb-4">
                            <p className="font-bold text-slate-800 text-sm">{reasonModal.newValue ? 'Granting' : 'Revoking'} Access</p>
                            <p className="text-xs text-slate-500 mb-2">To {reasonModal.label}. A justification is required for the audit trail.</p>
                        </div>
                        <Label className="text-xs text-slate-700 font-semibold mb-1 block">Justification Reason</Label>
                        <Input autoFocus value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Authorized to oversee metrics temporarily..." className="text-sm border-slate-300" onKeyDown={e => { if (e.key === 'Enter') confirmToggle(); if (e.key === 'Escape') setReasonModal(null); }} />
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" size="sm" onClick={() => setReasonModal(null)} className="h-8 text-xs">Cancel</Button>
                            <Button size="sm" disabled={!reason.trim() || !!savingOverride} onClick={confirmToggle} className={`h-8 text-xs text-white ${reasonModal.newValue ? 'bg-teal-600 hover:bg-teal-700' : 'bg-red-600 hover:bg-red-700'}`}>
                                Confirm {reasonModal.newValue ? 'Grant' : 'Revoke'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
