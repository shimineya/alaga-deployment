import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { MODULE_REGISTRY } from '@/lib/rbac-registry';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogHeader, 
    DialogTitle 
} from '../ui/dialog';
import { 
    Search, 
    RefreshCw, 
    ShieldAlert, 
    Lock, 
    Unlock, 
    LogOut, 
    Edit, 
    Trash2, 
    Sliders,
    Building, 
    User, 
    Clock,
    X,
    UserCheck,
    Mail,
    UserPlus
} from 'lucide-react';

const API = `${import.meta.env.VITE_API_URL || ''}/api/sysadmin`;
const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

interface RegisteredUser {
    user_id: number;
    username: string;
    email: string;
    role: string;
    account_status: string;
    is_locked: boolean;
    facility_id: number | null;
    facility_name: string | null;
    joined_at: string;
    last_activity_at: string | null;
    is_online: boolean;
}

interface FacilityOption {
    facility_id: number;
    facility_name: string;
}

export default function SystemAdminUserList() {
    const { user: currentUser, token } = useAuth();
    
    const [users, setUsers] = useState<RegisteredUser[]>([]);
    const [facilities, setFacilities] = useState<FacilityOption[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state for Edit Details
    const [editUser, setEditUser] = useState<RegisteredUser | null>(null);
    const [editUsername, setEditUsername] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const [editRole, setEditRole] = useState('');
    const [editFacilityId, setEditFacilityId] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    // Modal state for Advanced Access Control
    const [rbacUser, setRbacUser] = useState<RegisteredUser | null>(null);
    const [overrides, setOverrides] = useState<Record<string, boolean>>({});
    const [overrideReason, setOverrideReason] = useState('');
    const [isSavingRbac, setIsSavingRbac] = useState(false);

    // Modal state for Add User
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [addUsername, setAddUsername] = useState('');
    const [addEmail, setAddEmail] = useState('');
    const [addPassword, setAddPassword] = useState('');
    const [addRole, setAddRole] = useState('facility_admin');
    const [addFacilityId, setAddFacilityId] = useState('');
    const [addFacilityName, setAddFacilityName] = useState('');
    const [isAdding, setIsAdding] = useState(false);

    const handleCreateUser = async () => {
        if (!addUsername.trim() || !addEmail.trim() || !addPassword.trim() || !addRole.trim()) {
            toast.error('All fields (username, email, password, and role) are required.');
            return;
        }

        if (addRole === 'facility_admin' && !addFacilityName.trim()) {
            toast.error('Facility Name is required for Facility Admin role.');
            return;
        }

        setIsAdding(true);
        try {
            const res = await fetch(`${API}/users`, {
                method: 'POST',
                headers: getAuth(),
                body: JSON.stringify({
                    username: addUsername.trim(),
                    email: addEmail.trim(),
                    password: addPassword,
                    role: addRole,
                    facility_id: (addRole !== 'facility_admin' && addFacilityId !== '') ? parseInt(addFacilityId) : null,
                    facility_name: addRole === 'facility_admin' ? addFacilityName.trim() : null
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('User account created and immediately activated.');
                setIsAddModalOpen(false);
                setAddUsername('');
                setAddEmail('');
                setAddPassword('');
                setAddRole('facility_admin');
                setAddFacilityId('');
                setAddFacilityName('');
                fetchData();
            } else {
                toast.error(data.message || 'Failed to create user.');
            }
        } catch {
            toast.error('Server error creating user.');
        } finally {
            setIsAdding(false);
        }
    };

    const fetchData = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            // 1. Fetch Users
            const usersRes = await fetch(`${API}/users`, { headers: getAuth() });
            const usersData = await usersRes.json();
            if (usersData.success) {
                setUsers(usersData.data || []);
            }

            // 2. Fetch Facilities
            const facRes = await fetch(`${API}/facilities`, { headers: getAuth() });
            const facData = await facRes.json();
            if (facData.success) {
                setFacilities(facData.data || []);
            }
        } catch {
            toast.error('Failed to load system users list.');
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleLockToggle = async (targetUser: RegisteredUser) => {
        const nextLockState = !targetUser.is_locked;
        if (!window.confirm(`Are you sure you want to ${nextLockState ? 'LOCK' : 'UNLOCK'} user account "${targetUser.username}"?`)) return;
        try {
            const res = await fetch(`${API}/users/${targetUser.user_id}/lock`, {
                method: 'POST',
                headers: getAuth(),
                body: JSON.stringify({ lock: nextLockState })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(data.message || `User account lock status updated.`);
                fetchData();
            } else {
                toast.error(data.message || 'Failed to toggle lock status.');
            }
        } catch {
            toast.error('Server error updating lock status.');
        }
    };

    const handleEndSession = async (targetUserId: number) => {
        if (!window.confirm('Are you sure you want to terminate all active sessions for this user? they will be forced to log out immediately.')) return;
        try {
            const res = await fetch(`${API}/kill-switch/revoke-user`, {
                method: 'POST',
                headers: getAuth(),
                body: JSON.stringify({ user_id: targetUserId, reason: 'Manual session termination by System Admin.' })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Active sessions terminated successfully.');
                fetchData();
            } else {
                toast.error(data.message || 'Failed to revoke sessions.');
            }
        } catch {
            toast.error('Server error revoking sessions.');
        }
    };

    const handleArchiveUser = async (targetUserId: number) => {
        if (targetUserId === currentUser?.user_id) {
            toast.error('You cannot archive your own active admin account.');
            return;
        }
        if (!window.confirm('Are you sure you want to archive/delete this user? All user records, assignments, and permissions overrides will be permanently purged.')) return;
        try {
            const res = await fetch(`${API}/users/${targetUserId}`, {
                method: 'DELETE',
                headers: getAuth()
            });
            const data = await res.json();
            if (data.success) {
                toast.success('User archived and deleted successfully.');
                fetchData();
            } else {
                toast.error(data.message || 'Failed to delete user.');
            }
        } catch {
            toast.error('Server error deleting user.');
        }
    };

    const handleOpenEditModal = (targetUser: RegisteredUser) => {
        setEditUser(targetUser);
        setEditUsername(targetUser.username);
        setEditEmail(targetUser.email);
        setEditRole(targetUser.role);
        setEditFacilityId(targetUser.facility_id ? targetUser.facility_id.toString() : '');
    };

    const handleSaveEditDetails = async () => {
        if (!editUser) return;
        if (!editUsername.trim() || !editEmail.trim()) {
            toast.error('Username and Email are required.');
            return;
        }
        setIsSaving(true);
        try {
            const res = await fetch(`${API}/users/${editUser.user_id}`, {
                method: 'PUT',
                headers: getAuth(),
                body: JSON.stringify({
                    username: editUsername.trim(),
                    email: editEmail.trim(),
                    role: editRole,
                    facility_id: editFacilityId !== '' ? parseInt(editFacilityId) : null
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('User details updated successfully.');
                setEditUser(null);
                fetchData();
            } else {
                toast.error(data.message || 'Failed to update user.');
            }
        } catch {
            toast.error('Server error updating user.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleOpenRbacModal = async (targetUser: RegisteredUser) => {
        setRbacUser(targetUser);
        setOverrideReason('');
        
        // Fetch explicit overrides
        try {
            const res = await fetch(`${API}/rbac/users/${targetUser.user_id}/overrides`, { headers: getAuth() });
            const data = await res.json();
            if (data.success) {
                const map: Record<string, boolean> = {};
                (data.data || []).forEach((o: any) => {
                    map[o.module_id] = o.is_granted;
                });
                setOverrides(map);
            }
        } catch {
            toast.error('Failed to load permission overrides.');
        }
    };

    const handleToggleOverride = async (moduleId: string, currentGranted: boolean | undefined) => {
        if (!rbacUser) return;

        // Toggle state: If currently defined, delete the override (so it follows default). If undefined/default, set override.
        if (currentGranted !== undefined) {
            // Delete override
            try {
                const res = await fetch(`${API}/rbac/users/${rbacUser.user_id}/overrides/${moduleId}`, {
                    method: 'DELETE',
                    headers: getAuth()
                });
                const data = await res.json();
                if (data.success) {
                    toast.success('Override removed. User follows role defaults.');
                    setOverrides(prev => {
                        const next = { ...prev };
                        delete next[moduleId];
                        return next;
                    });
                }
            } catch {
                toast.error('Failed to remove override.');
            }
        } else {
            // Ask for reason and toggle (Default is grant = true)
            const reason = window.prompt(`Enter justification reason to override module "${moduleId}":`);
            if (!reason || reason.trim() === '') {
                toast.error('A reason is required to apply module overrides.');
                return;
            }
            try {
                const res = await fetch(`${API}/rbac/users/${rbacUser.user_id}/overrides`, {
                    method: 'POST',
                    headers: getAuth(),
                    body: JSON.stringify({
                        module_id: moduleId,
                        is_granted: true,
                        override_reason: reason
                    })
                });
                const data = await res.json();
                if (data.success) {
                    toast.success('Permission override saved.');
                    setOverrides(prev => ({ ...prev, [moduleId]: true }));
                }
            } catch {
                toast.error('Failed to save override.');
            }
        }
    };

    const handleToggleDenyOverride = async (moduleId: string) => {
        if (!rbacUser) return;
        const reason = window.prompt(`Enter justification reason to DENY module "${moduleId}":`);
        if (!reason || reason.trim() === '') {
            toast.error('A reason is required to deny module access.');
            return;
        }
        try {
            const res = await fetch(`${API}/rbac/users/${rbacUser.user_id}/overrides`, {
                method: 'POST',
                headers: getAuth(),
                body: JSON.stringify({
                    module_id: moduleId,
                    is_granted: false,
                    override_reason: reason
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Permission override (DENY) saved.');
                setOverrides(prev => ({ ...prev, [moduleId]: false }));
            }
        } catch {
            toast.error('Failed to deny permission.');
        }
    };

    // Filter list
    const filteredUsers = users.filter(u => {
        const query = searchQuery.toLowerCase();
        return u.username.toLowerCase().includes(query) ||
               u.email.toLowerCase().includes(query) ||
               u.role.toLowerCase().includes(query) ||
               (u.facility_name || '').toLowerCase().includes(query);
    });

    return (
        <div className="space-y-6 flex flex-col min-h-0">
            {/* Header section with Filter controls */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div>
                    <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-teal-600 animate-pulse" />
                        Registered Users Directory
                    </h2>
                    <p className="text-[10px] text-slate-500 font-medium">
                        System-wide listing of all active registered user profiles, permissions, lock statuses, and active sessions.
                    </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-60">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                            placeholder="Search by username, email, role, or facility..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 h-8 text-xs bg-white border-slate-200 rounded-lg"
                        />
                    </div>
                    <Button size="sm" variant="outline" onClick={fetchData} disabled={isLoading} className="h-8 gap-1 bg-white cursor-pointer shrink-0">
                        <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="h-8 gap-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold cursor-pointer shrink-0">
                        <UserPlus className="w-3.5 h-3.5" />
                        Add User
                    </Button>
                </div>
            </div>

            {/* Users List Table Card */}
            <Card className="border-slate-200 shadow-sm flex-1 flex flex-col min-h-[400px]">
                <CardHeader className="py-4 px-4 border-b border-slate-100 shrink-0">
                    <CardTitle className="text-xs font-bold text-slate-800">All Registered Users</CardTitle>
                    <CardDescription className="text-[9px] text-slate-400">Total users registered in system database: {users.length}</CardDescription>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-auto">
                    {filteredUsers.length === 0 ? (
                        <div className="text-center py-12 italic text-slate-400 text-xs">No registered users found.</div>
                    ) : (
                        <table className="w-full text-left border-collapse text-xs">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0 z-10">
                                <tr>
                                    <th className="p-3">User Role</th>
                                    <th className="p-3">Username</th>
                                    <th className="p-3">Facility Name</th>
                                    <th className="p-3">Email Address</th>
                                    <th className="p-3">Account Status</th>
                                    <th className="p-3">Joined Date</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map((u) => {
                                    const isSelf = u.user_id === currentUser?.user_id;
                                    return (
                                        <tr key={u.user_id} className={`border-b border-slate-100 hover:bg-slate-50/50 transition-colors ${u.is_locked ? 'bg-red-50/20' : ''}`}>
                                            <td className="p-3">
                                                <Badge className={`border-none font-bold text-[8px] px-1.5 py-0.5 ${
                                                    u.role.includes('admin') 
                                                        ? 'bg-rose-50 text-rose-700' 
                                                        : u.role === 'medical_staff' 
                                                            ? 'bg-blue-50 text-blue-700' 
                                                            : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {u.role.toUpperCase()}
                                                </Badge>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-3.5 h-3.5 text-slate-400" />
                                                    <div>
                                                        <span className="font-bold text-slate-800">{u.username}</span>
                                                        {isSelf && <span className="text-[8px] text-teal-600 font-bold ml-1.5">(You)</span>}
                                                    </div>
                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${u.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} title={u.is_online ? 'Online' : 'Offline'} />
                                                </div>
                                            </td>
                                            <td className="p-3 font-semibold text-teal-800">
                                                <span className="flex items-center gap-1">
                                                    <Building className="w-3.5 h-3.5 text-slate-400" />
                                                    {u.facility_name || <span className="text-slate-400 font-normal italic">Global / Direct</span>}
                                                </span>
                                            </td>
                                            <td className="p-3 text-slate-600 font-medium">{u.email}</td>
                                            <td className="p-3">
                                                <Badge className={`border-none font-bold text-[8px] px-1.5 py-0.5 ${
                                                    u.is_locked 
                                                        ? 'bg-red-100 text-red-700' 
                                                        : u.account_status === 'Active' 
                                                            ? 'bg-emerald-50 text-emerald-700' 
                                                            : 'bg-amber-50 text-amber-700'
                                                }`}>
                                                    {u.is_locked ? 'Locked' : u.account_status}
                                                </Badge>
                                            </td>
                                            <td className="p-3 text-slate-400 font-mono text-[10px]">{u.joined_at}</td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {/* Edit */}
                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenEditModal(u)} className="h-7 w-7 text-slate-500 hover:text-slate-700 cursor-pointer" title="Edit Profile Details">
                                                        <Edit className="w-3.5 h-3.5" />
                                                    </Button>
                                                    
                                                    {/* Lock Account */}
                                                    <Button variant="ghost" size="icon" onClick={() => handleLockToggle(u)} className={`h-7 w-7 cursor-pointer ${u.is_locked ? 'text-red-600 hover:text-red-800' : 'text-slate-500 hover:text-slate-700'}`} title={u.is_locked ? 'Unlock Account' : 'Lock Account'}>
                                                        {u.is_locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                                    </Button>

                                                    {/* End Session */}
                                                    <Button variant="ghost" size="icon" onClick={() => handleEndSession(u.user_id)} className="h-7 w-7 text-amber-600 hover:text-amber-800 hover:bg-amber-50 cursor-pointer" title="End Active Sessions">
                                                        <LogOut className="w-3.5 h-3.5" />
                                                    </Button>

                                                    {/* Advanced Access Control */}
                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenRbacModal(u)} className="h-7 w-7 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 cursor-pointer" title="Advanced Access Control Override">
                                                        <Sliders className="w-3.5 h-3.5" />
                                                    </Button>

                                                    {/* Archive */}
                                                    <Button variant="ghost" size="icon" onClick={() => handleArchiveUser(u.user_id)} disabled={isSelf} className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer" title="Archive / Delete User">
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>

            {/* EDIT USER DETAILS DIALOG */}
            {editUser && (
                <Dialog open={true} onOpenChange={() => setEditUser(null)}>
                    <DialogContent className="bg-white">
                        <DialogHeader>
                            <DialogTitle className="text-slate-800">Edit User Profile Details</DialogTitle>
                            <DialogDescription className="text-xs">
                                Adjust demographic profile, operational role, or facility department for user ID #{editUser.user_id}.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2 text-xs">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">Username</label>
                                <Input 
                                    value={editUsername} 
                                    onChange={(e) => setEditUsername(e.target.value)}
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">Email Address</label>
                                <Input 
                                    type="email"
                                    value={editEmail} 
                                    onChange={(e) => setEditEmail(e.target.value)}
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">System Role Category</label>
                                <select 
                                    value={editRole} 
                                    onChange={(e) => setEditRole(e.target.value)}
                                    className="w-full h-9 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700"
                                >
                                    <option value="system_admin">System Administrator</option>
                                    <option value="facility_admin">Facility Administrator</option>
                                    <option value="medical_staff">Medical Staff / Clinical Nurse</option>
                                    <option value="caregiver">Caregiver / Attendant</option>
                                    <option value="parent">Parent / Guardian</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">Facility Assigned</label>
                                <select 
                                    value={editFacilityId} 
                                    onChange={(e) => setEditFacilityId(e.target.value)}
                                    className="w-full h-9 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700"
                                >
                                    <option value="">No Facility Assigned (Global)</option>
                                    {facilities.map(f => (
                                        <option key={f.facility_id} value={f.facility_id}>{f.facility_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-2 border-t flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setEditUser(null)} className="h-8 text-xs">Cancel</Button>
                                <Button onClick={handleSaveEditDetails} disabled={isSaving} className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold">
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* ADVANCED ACCESS CONTROL OVERRIDE DIALOG */}
            {rbacUser && (
                <Dialog open={true} onOpenChange={() => setRbacUser(null)}>
                    <DialogContent className="max-w-2xl bg-white max-h-[85vh] flex flex-col">
                        <DialogHeader className="shrink-0">
                            <DialogTitle className="text-slate-800 flex items-center gap-2">
                                <Sliders className="w-5 h-5 text-indigo-600" />
                                Advanced Access Control Overrides
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Configure specialized system permission overrides for <strong className="font-bold text-slate-700">{rbacUser.username}</strong> ({rbacUser.role.toUpperCase()}).
                            </DialogDescription>
                        </DialogHeader>
                        
                        <div className="flex-1 overflow-y-auto py-2 pr-1 space-y-4 my-2 text-xs">
                            {MODULE_REGISTRY.map((group) => (
                                <div key={group.group} className="space-y-2">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50 py-1 px-2 rounded">{group.group}</h4>
                                    <div className="divide-y divide-slate-100">
                                        {group.modules.map((mod) => {
                                            const overrideState = overrides[mod.id]; // true = granted, false = denied, undefined = follows defaults
                                            return (
                                                <div key={mod.id} className="flex items-center justify-between py-2 px-2 hover:bg-slate-50/50 rounded transition-colors">
                                                    <div>
                                                        <span className="font-semibold text-slate-700 block">{mod.label}</span>
                                                        <span className="text-[9px] text-slate-400 block leading-tight">{mod.description}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {/* Status Label */}
                                                        <span className="text-[9px] font-mono mr-2">
                                                            {overrideState === true ? (
                                                                <span className="text-emerald-600 font-bold">OVERRIDDEN: GRANT</span>
                                                            ) : overrideState === false ? (
                                                                <span className="text-rose-600 font-bold">OVERRIDDEN: DENY</span>
                                                            ) : (
                                                                <span className="text-slate-400 italic">Follows Defaults</span>
                                                            )}
                                                        </span>

                                                        {/* Grant/Reset Override */}
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={() => handleToggleOverride(mod.id, overrideState)}
                                                            className={`h-7 text-[9px] cursor-pointer ${overrideState === true ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200' : ''}`}
                                                        >
                                                            {overrideState === true ? 'Reset to Default' : 'Grant Override'}
                                                        </Button>

                                                        {/* Deny Override */}
                                                        {overrideState !== false && (
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                onClick={() => handleToggleDenyOverride(mod.id)}
                                                                className="h-7 text-[9px] text-rose-700 hover:bg-rose-50 cursor-pointer"
                                                            >
                                                                Deny Module
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-2 border-t flex justify-end gap-2 shrink-0">
                            <Button variant="outline" size="sm" onClick={() => setRbacUser(null)} className="h-8 text-xs">Close Override Panel</Button>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* ADD USER DIALOG */}
            {isAddModalOpen && (
                <Dialog open={true} onOpenChange={() => setIsAddModalOpen(false)}>
                    <DialogContent className="bg-white">
                        <DialogHeader>
                            <DialogTitle className="text-slate-800 flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-teal-600" />
                                Provision New User Account
                            </DialogTitle>
                            <DialogDescription className="text-xs">
                                Create an immediately working and usable account. System roles automatically receive their respective dashboard view and feature access.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2 text-xs">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">Username</label>
                                <Input 
                                    placeholder="Enter username"
                                    value={addUsername} 
                                    onChange={(e) => setAddUsername(e.target.value)}
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">Email Address</label>
                                <Input 
                                    type="email"
                                    placeholder="Enter email address"
                                    value={addEmail} 
                                    onChange={(e) => setAddEmail(e.target.value)}
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">Password</label>
                                <Input 
                                    type="password"
                                    placeholder="Enter secure password"
                                    value={addPassword} 
                                    onChange={(e) => setAddPassword(e.target.value)}
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">System Role</label>
                                <select 
                                    value={addRole} 
                                    onChange={(e) => setAddRole(e.target.value)}
                                    className="w-full h-9 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700"
                                >
                                    <option value="facility_admin">Facility Administrator</option>
                                    <option value="medical_staff">Medical Staff / Clinical Nurse</option>
                                    <option value="caregiver">Caregiver / Attendant</option>
                                    <option value="parent">Parent / Guardian</option>
                                </select>
                            </div>

                            {addRole === 'facility_admin' && (
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Facility Name</label>
                                    <Input 
                                        placeholder="Enter the name of the facility to create or link"
                                        value={addFacilityName} 
                                        onChange={(e) => setAddFacilityName(e.target.value)}
                                        className="h-9 text-xs"
                                    />
                                    <p className="text-[9px] text-slate-400 mt-1 italic">
                                        If the facility name doesn't exist, a new facility record will be dynamically generated.
                                    </p>
                                </div>
                            )}

                            {(addRole === 'medical_staff' || addRole === 'caregiver') && (
                                <div>
                                    <label className="block text-[10px] font-bold text-slate-700 mb-1">Select Facility Association</label>
                                    <select 
                                        value={addFacilityId} 
                                        onChange={(e) => setAddFacilityId(e.target.value)}
                                        className="w-full h-9 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700"
                                    >
                                        <option value="">No Facility Assigned (Global)</option>
                                        {facilities.map(f => (
                                            <option key={f.facility_id} value={f.facility_id}>{f.facility_name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="pt-2 border-t flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)} className="h-8 text-xs">Cancel</Button>
                                <Button onClick={handleCreateUser} disabled={isAdding} className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold">
                                    {isAdding ? 'Adding User...' : 'Add User Account'}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
