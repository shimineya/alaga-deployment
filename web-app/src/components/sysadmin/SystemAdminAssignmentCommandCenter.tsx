import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { useAuth } from '@/lib/auth-context';
import { toast } from 'sonner';
import { 
    Dialog, 
    DialogContent, 
    DialogDescription, 
    DialogHeader, 
    DialogTitle 
} from '../ui/dialog';
import { 
    Activity, 
    Search, 
    RefreshCw, 
    UserMinus, 
    Edit, 
    Check, 
    X, 
    Users, 
    Globe, 
    Building 
} from 'lucide-react';

const API = `${import.meta.env.VITE_API_URL || ''}/api/sysadmin`;
const getAuth = () => ({ 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });

interface SystemAssignment {
    access_id: number;
    user_id: number;
    patient_id: number;
    relationship: string;
    access_level: string;
    invite_status: string;
    assigned_at: string;
    caregiver_username: string;
    caregiver_first_name: string;
    caregiver_last_name: string;
    caregiver_email: string;
    patient_name: string;
    facility_name: string | null;
    invited_by_first_name: string | null;
    invited_by_last_name: string | null;
}

interface SystemStaff {
    user_id: number;
    username: string;
    email: string;
    role: string;
    account_status: string;
    is_locked: boolean;
    joined_at: string;
    last_activity_at: string | null;
    facility_name: string | null;
    is_online: boolean;
    creator_username: string | null;
}

export default function SystemAdminAssignmentCommandCenter() {
    const { token } = useAuth();
    const [assignments, setAssignments] = useState<SystemAssignment[]>([]);
    const [staffList, setStaffList] = useState<SystemStaff[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    // Dialog states
    const [editAssignment, setEditAssignment] = useState<SystemAssignment | null>(null);
    const [editStaff, setEditStaff] = useState<SystemStaff | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Form states
    const [relationship, setRelationship] = useState('');
    const [accessLevel, setAccessLevel] = useState('');
    const [inviteStatus, setInviteStatus] = useState('');
    const [accountStatus, setAccountStatus] = useState('');
    const [isLocked, setIsLocked] = useState(false);

    const fetchData = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            // 1. Fetch assignments
            const assignRes = await fetch(`${API}/assignments`, { headers: getAuth() });
            const assignData = await assignRes.json();
            if (assignData.success) {
                setAssignments(assignData.data || []);
            }

            // 2. Fetch staff given accounts
            const staffRes = await fetch(`${API}/staff-given-accounts`, { headers: getAuth() });
            const staffData = await staffRes.json();
            if (staffData.success) {
                setStaffList(staffData.data || []);
            }
        } catch {
            toast.error('Failed to load system-wide command center data.');
        } finally {
            setIsLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleOpenEditAssignment = (assign: SystemAssignment) => {
        setEditAssignment(assign);
        setRelationship(assign.relationship);
        setAccessLevel(assign.access_level);
        setInviteStatus(assign.invite_status);
    };

    const handleSaveAssignment = async () => {
        if (!editAssignment) return;
        setIsSaving(true);
        try {
            const res = await fetch(`${API}/assignments/${editAssignment.access_id}`, {
                method: 'PUT',
                headers: getAuth(),
                body: JSON.stringify({
                    relationship,
                    access_level: accessLevel,
                    invite_status: inviteStatus
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Assignment updated successfully.');
                setEditAssignment(null);
                fetchData();
            } else {
                toast.error(data.message || 'Failed to update assignment.');
            }
        } catch {
            toast.error('Server error updating assignment.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleArchiveAssignment = async (id: number) => {
        if (!window.confirm('Are you sure you want to archive/remove this care team assignment?')) return;
        try {
            const res = await fetch(`${API}/assignments/${id}`, {
                method: 'DELETE',
                headers: getAuth()
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Assignment archived successfully.');
                fetchData();
            } else {
                toast.error(data.message || 'Failed to archive assignment.');
            }
        } catch {
            toast.error('Server error archiving assignment.');
        }
    };

    const handleOpenEditStaff = (staff: SystemStaff) => {
        setEditStaff(staff);
        setAccountStatus(staff.account_status);
        setIsLocked(staff.is_locked);
    };

    const handleSaveStaff = async () => {
        if (!editStaff) return;
        setIsSaving(true);
        try {
            const res = await fetch(`${API}/staff-given-accounts/${editStaff.user_id}`, {
                method: 'PUT',
                headers: getAuth(),
                body: JSON.stringify({
                    account_status: accountStatus,
                    is_locked: isLocked
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Staff account updated successfully.');
                setEditStaff(null);
                fetchData();
            } else {
                toast.error(data.message || 'Failed to update staff.');
            }
        } catch {
            toast.error('Server error updating staff.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteStaff = async (id: number) => {
        if (!window.confirm('Are you sure you want to permanently delete this provisioned staff account? This will revoke all active sessions.')) return;
        try {
            const res = await fetch(`${API}/staff-given-accounts/${id}`, {
                method: 'DELETE',
                headers: getAuth()
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Staff account deleted successfully.');
                fetchData();
            } else {
                toast.error(data.message || 'Failed to delete staff.');
            }
        } catch {
            toast.error('Server error deleting staff.');
        }
    };

    // Filtered lists
    const filteredAssignments = assignments.filter(a => {
        const query = searchQuery.toLowerCase();
        return a.caregiver_username.toLowerCase().includes(query) ||
               a.patient_name.toLowerCase().includes(query) ||
               (a.facility_name || '').toLowerCase().includes(query) ||
               a.relationship.toLowerCase().includes(query);
    });

    const filteredStaff = staffList.filter(s => {
        const query = searchQuery.toLowerCase();
        return s.username.toLowerCase().includes(query) ||
               s.email.toLowerCase().includes(query) ||
               (s.facility_name || '').toLowerCase().includes(query) ||
               s.role.toLowerCase().includes(query);
    });

    return (
        <div className="space-y-6 flex flex-col min-h-0">
            {/* Context Notice Banner */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0 bg-teal-50 border border-teal-200 rounded-xl p-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-teal-600/10 flex items-center justify-center shrink-0">
                        <Globe className="w-5 h-5 text-teal-700" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-teal-900">System Assignment Command Center</h2>
                        <p className="text-[10px] text-teal-700 font-medium">
                            Scope: <strong>System-Wide</strong> (Viewing and managing assignments and staff accounts across ALL facilities and departments).
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative w-48 sm:w-60">
                        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                            placeholder="Filter records..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-8 h-8 text-xs bg-white border-slate-200 rounded-lg"
                        />
                    </div>
                    <Button size="sm" variant="outline" onClick={fetchData} disabled={isLoading} className="h-8 gap-1 bg-white cursor-pointer">
                        <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 gap-6 flex-1 min-h-0 overflow-auto">
                {/* Section A: Care Assignments */}
                <Card className="border-slate-200 shadow-sm flex flex-col min-h-[300px]">
                    <CardHeader className="py-4 px-4 border-b border-slate-100 flex flex-row items-center justify-between shrink-0">
                        <div>
                            <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-teal-600" />
                                Care Assignments &amp; Delegations (PHI)
                            </CardTitle>
                            <CardDescription className="text-[9px] text-slate-400">All care assignments and invitations registered globally in Alaga.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-auto">
                        {filteredAssignments.length === 0 ? (
                            <div className="text-center py-12 italic text-slate-400 text-xs">No assignments found.</div>
                        ) : (
                            <table className="w-full text-left border-collapse text-xs">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3">Facility</th>
                                        <th className="p-3">Caregiver</th>
                                        <th className="p-3">Patient</th>
                                        <th className="p-3">Relationship</th>
                                        <th className="p-3">Access Level</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3">Assigned Date</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAssignments.map((a) => (
                                        <tr key={a.access_id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                            <td className="p-3 font-semibold text-teal-800 flex items-center gap-1">
                                                <Building className="w-3.5 h-3.5 text-slate-400" />
                                                {a.facility_name || 'Global / Direct'}
                                            </td>
                                            <td className="p-3">
                                                <span className="font-bold text-slate-800">{a.caregiver_first_name} {a.caregiver_last_name}</span>
                                                <span className="text-[10px] text-slate-400 block font-mono">({a.caregiver_username})</span>
                                            </td>
                                            <td className="p-3 font-medium text-slate-700">{a.patient_name}</td>
                                            <td className="p-3 text-slate-600">{a.relationship}</td>
                                            <td className="p-3">
                                                <Badge className={a.access_level === 'Edit' ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border-none text-[9px]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-none text-[9px]'}>
                                                    {a.access_level}
                                                </Badge>
                                            </td>
                                            <td className="p-3">
                                                <Badge className={a.invite_status === 'Active' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-none text-[9px]' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-none text-[9px] animate-pulse'}>
                                                    {a.invite_status}
                                                </Badge>
                                            </td>
                                            <td className="p-3 text-slate-400 font-mono text-[10px]">{a.assigned_at}</td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenEditAssignment(a)} className="h-7 w-7 text-slate-500 hover:text-slate-700 cursor-pointer">
                                                        <Edit className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleArchiveAssignment(a.access_id)} className="h-7 w-7 text-rose-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer">
                                                        <UserMinus className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </CardContent>
                </Card>

                {/* Section B: Staff Accounts */}
                <Card className="border-slate-200 shadow-sm flex flex-col min-h-[300px]">
                    <CardHeader className="py-4 px-4 border-b border-slate-100 flex flex-row items-center justify-between shrink-0">
                        <div>
                            <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                <Users className="w-4 h-4 text-teal-600" />
                                System Staff &amp; Caregiver Personnel
                            </CardTitle>
                            <CardDescription className="text-[9px] text-slate-400">All registered Caregivers and Medical Staff accounts in Alaga.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-auto">
                        {filteredStaff.length === 0 ? (
                            <div className="text-center py-12 italic text-slate-400 text-xs">No staff accounts found.</div>
                        ) : (
                            <table className="w-full text-left border-collapse text-xs">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3">Facility</th>
                                        <th className="p-3">Username</th>
                                        <th className="p-3">Email</th>
                                        <th className="p-3">Role</th>
                                        <th className="p-3">Status</th>
                                        <th className="p-3">Security Lock</th>
                                        <th className="p-3">Creator / Origin</th>
                                        <th className="p-3">Creation Date</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredStaff.map((s) => (
                                        <tr key={s.user_id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                                            <td className="p-3 font-semibold text-teal-800 flex items-center gap-1">
                                                <Building className="w-3.5 h-3.5 text-slate-400" />
                                                {s.facility_name || 'N/A'}
                                            </td>
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-slate-800">{s.username}</span>
                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} title={s.is_online ? 'Online' : 'Offline'} />
                                                </div>
                                            </td>
                                            <td className="p-3 text-slate-600 font-medium">{s.email}</td>
                                            <td className="p-3">
                                                <Badge className="bg-slate-100 text-slate-700 border-none font-semibold text-[8px] px-1 py-0 h-4">
                                                    {s.role}
                                                </Badge>
                                            </td>
                                            <td className="p-3">
                                                <Badge className={s.account_status === 'Active' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-none text-[9px]' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-none text-[9px]'}>
                                                    {s.account_status}
                                                </Badge>
                                            </td>
                                            <td className="p-3 font-medium">
                                                {s.is_locked ? (
                                                    <span className="text-red-600 font-bold text-[9px]">LOCKED</span>
                                                ) : (
                                                    <span className="text-emerald-600 text-[9px]">Unlocked</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-slate-500 font-medium">
                                                {s.creator_username ? `Admin: ${s.creator_username}` : 'Self Registered / System'}
                                            </td>
                                            <td className="p-3 text-slate-400 font-mono text-[10px]">{s.joined_at}</td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Button variant="ghost" size="icon" onClick={() => handleOpenEditStaff(s)} className="h-7 w-7 text-slate-500 hover:text-slate-700 cursor-pointer">
                                                        <Edit className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteStaff(s.user_id)} className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer">
                                                        <X className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* EDIT ASSIGNMENT DIALOG */}
            {editAssignment && (
                <Dialog open={true} onOpenChange={() => setEditAssignment(null)}>
                    <DialogContent className="bg-white">
                        <DialogHeader>
                            <DialogTitle className="text-slate-800">Edit System Care Assignment</DialogTitle>
                            <DialogDescription className="text-xs">
                                Adjust credentials, visibility, and access limits for assignment ID #{editAssignment.access_id}.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2 text-xs">
                            <div className="grid grid-cols-2 gap-2 text-slate-600">
                                <div><strong>Caregiver:</strong> {editAssignment.caregiver_username}</div>
                                <div><strong>Patient:</strong> {editAssignment.patient_name}</div>
                            </div>
                            
                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">Relationship Context</label>
                                <Input 
                                    value={relationship} 
                                    onChange={(e) => setRelationship(e.target.value)}
                                    className="h-8 text-xs bg-slate-50/50"
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">Access Level</label>
                                <select 
                                    value={accessLevel} 
                                    onChange={(e) => setAccessLevel(e.target.value)}
                                    className="w-full h-8 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700"
                                >
                                    <option value="View">View (Read Only)</option>
                                    <option value="Edit">Edit (Read &amp; Write)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">Invitation Status</label>
                                <select 
                                    value={inviteStatus} 
                                    onChange={(e) => setInviteStatus(e.target.value)}
                                    className="w-full h-8 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700"
                                >
                                    <option value="Pending">Pending Approval</option>
                                    <option value="Active">Active / Approved</option>
                                    <option value="Archived">Archived / Revoked</option>
                                </select>
                            </div>

                            <div className="pt-2 border-t flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setEditAssignment(null)} className="h-8 text-xs">Cancel</Button>
                                <Button onClick={handleSaveAssignment} disabled={isSaving} className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold">
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* EDIT STAFF DIALOG */}
            {editStaff && (
                <Dialog open={true} onOpenChange={() => setEditStaff(null)}>
                    <DialogContent className="bg-white">
                        <DialogHeader>
                            <DialogTitle className="text-slate-800">Edit Staff Account Status</DialogTitle>
                            <DialogDescription className="text-xs">
                                Adjust account status or enforce immediate lockouts for {editStaff.username}.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2 text-xs">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-700 mb-1">Account Status</label>
                                <select 
                                    value={accountStatus} 
                                    onChange={(e) => setAccountStatus(e.target.value)}
                                    className="w-full h-8 text-xs border border-slate-200 rounded px-2 bg-white text-slate-700"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Pending_Review">Pending Review</option>
                                    <option value="Suspended">Suspended</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                                <input 
                                    type="checkbox" 
                                    id="isLocked" 
                                    checked={isLocked}
                                    onChange={(e) => setIsLocked(e.target.checked)}
                                    className="accent-red-600 w-4 h-4 cursor-pointer"
                                />
                                <label htmlFor="isLocked" className="text-xs text-red-900 cursor-pointer select-none font-semibold">
                                    Enforce Administrative Lock (revokes session keys immediately)
                                </label>
                            </div>

                            <div className="pt-2 border-t flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => setEditStaff(null)} className="h-8 text-xs">Cancel</Button>
                                <Button onClick={handleSaveStaff} disabled={isSaving} className="h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white font-semibold">
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
