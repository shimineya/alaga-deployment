import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { toast } from 'sonner';
import { useAuth } from '../../lib/auth-context';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter, 
    DialogDescription 
} from '../ui/dialog';
import { Label } from '../ui/label';
import { 
    Link as LinkIcon, 
    UserCheck, 
    UserX, 
    Clock, 
    Search, 
    RefreshCw, 
    Trash2, 
    Edit2,
    ActivitySquare, 
    Inbox,
    Users
} from 'lucide-react';

interface ScopedAssignment {
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
    invited_by_first_name?: string;
    invited_by_last_name?: string;
}

interface ScopedUser {
    user_id: number;
    username: string;
    email: string;
    role: string;
    account_status: string;
    is_locked: boolean;
    joined_at: string;
    is_online: boolean;
}

export default function FacilityAdminAssignmentCommandCenter() {
    const { token } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    
    // Data States
    const [pendingAssignments, setPendingAssignments] = useState<ScopedAssignment[]>([]);
    const [activeAssignments, setActiveAssignments] = useState<ScopedAssignment[]>([]);
    const [scopedUsers, setScopedUsers] = useState<ScopedUser[]>([]);
    
    // Search Queries
    const [searchAssignment, setSearchAssignment] = useState('');
    const [searchUser, setSearchUser] = useState('');

    // Edit Assignment Dialog
    const [isEditAssignmentOpen, setIsEditAssignmentOpen] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState<ScopedAssignment | null>(null);
    const [editAssignmentFields, setEditAssignmentFields] = useState({ relationship: '', access_level: '' });

    // Edit User Dialog
    const [isEditUserOpen, setIsEditUserOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<ScopedUser | null>(null);
    const [editUserFields, setEditUserFields] = useState({ username: '', email: '', role: '' });

    const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/facility-admin`;

    const fetchData = useCallback(async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            // 1. Fetch assignments
            const assignRes = await fetch(`${API_BASE}/assignments`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const assignData = await assignRes.json();
            if (assignData.success) {
                setPendingAssignments(assignData.data.pending || []);
                setActiveAssignments(assignData.data.active || []);
            }

            // 2. Fetch scoped users
            const userRes = await fetch(`${API_BASE}/staff-given-accounts`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const userData = await userRes.json();
            if (userData.success) {
                setScopedUsers(userData.data || []);
            }
        } catch (err) {
            console.error(err);
            toast.error('Failed to load command center data.');
        } finally {
            setIsLoading(false);
        }
    }, [token, API_BASE]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // -----------------------------------------------------
    // ASSIGNMENT OPERATIONS (EDIT, DELETE)
    // -----------------------------------------------------
    const openEditAssignment = (assign: ScopedAssignment) => {
        setEditingAssignment(assign);
        setEditAssignmentFields({
            relationship: assign.relationship,
            access_level: assign.access_level
        });
        setIsEditAssignmentOpen(true);
    };

    const handleUpdateAssignment = async () => {
        if (!editingAssignment) return;
        try {
            const res = await fetch(`${API_BASE}/assignments/${editingAssignment.access_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editAssignmentFields)
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Assignment updated successfully.');
                setIsEditAssignmentOpen(false);
                fetchData();
            } else {
                toast.error(data.message || 'Failed to update assignment.');
            }
        } catch {
            toast.error('Network error during assignment update.');
        }
    };

    const handleDeleteAssignment = async (assign: ScopedAssignment) => {
        if (!confirm(`Are you sure you want to archive/cancel the care assignment between caregiver ${assign.caregiver_first_name} ${assign.caregiver_last_name} and patient ${assign.patient_name}?`)) {
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/assignments/${assign.access_id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Assignment removed successfully.');
                fetchData();
            } else {
                toast.error(data.message || 'Failed to delete assignment.');
            }
        } catch {
            toast.error('Network error removing assignment.');
        }
    };

    // -----------------------------------------------------
    // SCOPED USER OPERATIONS (EDIT, DELETE)
    // -----------------------------------------------------
    const openEditUser = (user: ScopedUser) => {
        setEditingUser(user);
        setEditUserFields({
            username: user.username,
            email: user.email,
            role: user.role
        });
        setIsEditUserOpen(true);
    };

    const handleUpdateUser = async () => {
        if (!editingUser) return;
        try {
            const res = await fetch(`${API_BASE}/staff-given-accounts/${editingUser.user_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(editUserFields)
            });
            const data = await res.json();
            if (data.success) {
                toast.success('User account updated successfully.');
                setIsEditUserOpen(false);
                fetchData();
            } else {
                toast.error(data.message || 'Failed to update user account.');
            }
        } catch {
            toast.error('Network error during user update.');
        }
    };

    const handleDeleteUser = async (user: ScopedUser) => {
        if (!confirm(`Are you absolutely sure you want to delete the user account for ${user.username}? This will also remove all their care assignments and cannot be undone.`)) {
            return;
        }
        try {
            const res = await fetch(`${API_BASE}/staff-given-accounts/${user.user_id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                toast.success('User account deleted.');
                fetchData();
            } else {
                toast.error(data.message || 'Failed to delete user account.');
            }
        } catch {
            toast.error('Network error deleting user.');
        }
    };

    // Filtering active assignments & provisioned users
    const filteredActive = activeAssignments.filter(a => 
        a.patient_name.toLowerCase().includes(searchAssignment.toLowerCase()) ||
        a.caregiver_username.toLowerCase().includes(searchAssignment.toLowerCase())
    );

    const filteredUsers = scopedUsers.filter(u =>
        u.username.toLowerCase().includes(searchUser.toLowerCase()) ||
        u.email.toLowerCase().includes(searchUser.toLowerCase())
    );

    return (
        <div className="w-full h-full space-y-6 flex flex-col min-h-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
                        <ActivitySquare className="w-5 h-5 text-teal-600 animate-pulse" />
                        Assignment Command Center
                    </h1>
                    <p className="text-xs text-slate-500 mt-1">
                        View, edit, and archive staff accounts you created and caregiver patient assignments you delegated.
                    </p>
                </div>
                <Button size="sm" variant="outline" onClick={fetchData} disabled={isLoading} className="h-9 gap-1.5 cursor-pointer">
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh Feed
                </Button>
            </div>

            {/* Pending Care Team Invitations Section */}
            <Card className="border-amber-100 bg-amber-50/20 shadow-sm shrink-0">
                <CardHeader className="py-3 px-4 border-b border-amber-50">
                    <CardTitle className="text-xs font-semibold flex items-center gap-2 text-amber-800">
                        <Inbox className="w-4 h-4" />
                        Pending Caregiver Invitations ({pendingAssignments.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                    {pendingAssignments.length === 0 ? (
                        <p className="text-xs text-slate-400 italic text-center py-4">
                            No pending invitations at this time.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {pendingAssignments.map((invite) => (
                                <div key={invite.access_id} className="p-3 border border-amber-100 bg-white rounded-xl shadow-xs flex justify-between items-center gap-4">
                                    <div className="space-y-1 flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-xs text-slate-800 truncate max-w-[150px]" title={invite.patient_name}>{invite.patient_name}</h3>
                                            <Badge className="bg-amber-100 text-amber-800 text-[8px] hover:bg-amber-100 border-none font-normal h-4 py-0">
                                                Pending Acceptance
                                            </Badge>
                                        </div>
                                        <p className="text-[11px] text-slate-500">
                                            Caregiver: <span className="font-semibold text-slate-600">{invite.caregiver_first_name} {invite.caregiver_last_name} ({invite.caregiver_role || 'Caregiver'})</span>
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                            Relationship: <span className="font-mono">{invite.relationship}</span> | Access: <span className="font-semibold text-teal-600">{invite.access_level}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Button 
                                            size="sm" 
                                            variant="ghost"
                                            onClick={() => openEditAssignment(invite)}
                                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                                            title="Edit Assignment"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="ghost"
                                            onClick={() => handleDeleteAssignment(invite)}
                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                            title="Archive Invitation"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
                {/* Active Care Assignments Section */}
                <Card className="border-slate-200 shadow-sm flex flex-col min-h-0">
                    <CardHeader className="py-4 px-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                        <div>
                            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <LinkIcon className="w-4 h-4 text-teal-600" />
                                Active Assignments ({filteredActive.length})
                            </CardTitle>
                            <CardDescription className="text-[10px] text-slate-400">
                                Delegated patient care relationships currently active.
                            </CardDescription>
                        </div>
                        <div className="relative w-full sm:w-48">
                            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input
                                placeholder="Search active assignments..."
                                value={searchAssignment}
                                onChange={(e) => setSearchAssignment(e.target.value)}
                                className="pl-8 h-8 text-[11px] bg-slate-50 border-slate-200 rounded-lg"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 flex-1 overflow-y-auto min-h-0 space-y-3">
                        {filteredActive.length === 0 ? (
                            <p className="text-xs text-slate-400 italic text-center py-8">
                                No active assignments found.
                            </p>
                        ) : (
                            filteredActive.map((assign) => (
                                <div key={assign.access_id} className="p-3 border border-slate-100 rounded-xl hover:shadow-xs transition-shadow flex justify-between items-center gap-4 bg-slate-50/30">
                                    <div className="space-y-1 flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-xs text-slate-800">{assign.patient_name}</h3>
                                            <Badge className="bg-emerald-50 text-emerald-700 text-[8px] hover:bg-emerald-50 border-none font-normal h-4 py-0">
                                                Active
                                            </Badge>
                                        </div>
                                        <p className="text-[11px] text-slate-500">
                                            Caregiver: <span className="font-medium text-slate-700">{assign.caregiver_first_name} {assign.caregiver_last_name}</span>
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                            Relationship: <span className="font-mono text-slate-600">{assign.relationship}</span> | Access: <span className="font-semibold text-teal-600">{assign.access_level}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Button 
                                            size="sm" 
                                            variant="ghost"
                                            onClick={() => openEditAssignment(assign)}
                                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                                            title="Edit Assignment"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="ghost"
                                            onClick={() => handleDeleteAssignment(assign)}
                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                            title="Archive Assignment"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>

                {/* Provisioned Staff Accounts Section */}
                <Card className="border-slate-200 shadow-sm flex flex-col min-h-0">
                    <CardHeader className="py-4 px-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
                        <div>
                            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <Users className="w-4 h-4 text-indigo-600" />
                                Provisioned Staff Accounts ({filteredUsers.length})
                            </CardTitle>
                            <CardDescription className="text-[10px] text-slate-400">
                                Staff accounts created and provisioned by you.
                            </CardDescription>
                        </div>
                        <div className="relative w-full sm:w-48">
                            <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                            <Input
                                placeholder="Search staff accounts..."
                                value={searchUser}
                                onChange={(e) => setSearchUser(e.target.value)}
                                className="pl-8 h-8 text-[11px] bg-slate-50 border-slate-200 rounded-lg"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 flex-1 overflow-y-auto min-h-0 space-y-3">
                        {filteredUsers.length === 0 ? (
                            <p className="text-xs text-slate-400 italic text-center py-8">
                                No staff accounts found.
                            </p>
                        ) : (
                            filteredUsers.map((user) => (
                                <div key={user.user_id} className="p-3 border border-slate-100 rounded-xl hover:shadow-xs transition-shadow flex justify-between items-center gap-4 bg-slate-50/30">
                                    <div className="space-y-1 flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-xs text-slate-800">{user.username}</h3>
                                            <Badge variant="outline" className={`text-[8px] border-none font-normal h-4 py-0 ${
                                                user.role === 'caregiver' ? 'bg-teal-50 text-teal-700' : 'bg-indigo-50 text-indigo-700'
                                            }`}>
                                                {user.role}
                                            </Badge>
                                            <span className={`w-1.5 h-1.5 rounded-full ${user.is_online ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'}`} title={user.is_online ? 'Online' : 'Offline'} />
                                        </div>
                                        <p className="text-[11px] text-slate-500">{user.email}</p>
                                        <p className="text-[10px] text-slate-400">Joined: {user.joined_at}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Button 
                                            size="sm" 
                                            variant="ghost"
                                            onClick={() => openEditUser(user)}
                                            className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                                            title="Edit Staff Account"
                                        >
                                            <Edit2 className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button 
                                            size="sm" 
                                            variant="ghost"
                                            onClick={() => handleDeleteUser(user)}
                                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 cursor-pointer"
                                            title="Delete Account"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* EDIT ASSIGNMENT DIALOG */}
            <Dialog open={isEditAssignmentOpen} onOpenChange={setIsEditAssignmentOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-slate-800 font-bold text-sm">Edit Care Assignment</DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Update the access privileges and care relationship between patient and staff.
                        </DialogDescription>
                    </DialogHeader>
                    {editingAssignment && (
                        <div className="space-y-4 py-3">
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-slate-600">Patient</Label>
                                <Input disabled value={editingAssignment.patient_name} className="h-9 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-semibold text-slate-600">Caregiver</Label>
                                <Input disabled value={`${editingAssignment.caregiver_first_name} ${editingAssignment.caregiver_last_name}`} className="h-9 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="edit-relationship" className="text-xs font-semibold text-slate-600">Relationship</Label>
                                <Input 
                                    id="edit-relationship"
                                    value={editAssignmentFields.relationship}
                                    onChange={(e) => setEditAssignmentFields({ ...editAssignmentFields, relationship: e.target.value })}
                                    className="h-9 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="edit-access-level" className="text-xs font-semibold text-slate-600">Access Level</Label>
                                <select
                                    id="edit-access-level"
                                    value={editAssignmentFields.access_level}
                                    onChange={(e) => setEditAssignmentFields({ ...editAssignmentFields, access_level: e.target.value })}
                                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-600 focus-visible:border-teal-600 cursor-pointer"
                                >
                                    <option value="View">View Only</option>
                                    <option value="Edit">Edit Details</option>
                                    <option value="Full">Full Management Access</option>
                                </select>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" size="sm" onClick={() => setIsEditAssignmentOpen(false)} className="h-9 text-xs">
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateAssignment} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold h-9 text-xs">
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* EDIT SCOPED USER DIALOG */}
            <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-slate-800 font-bold text-sm">Edit Staff Account</DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Modify credentials and roles for staff accounts you provisioned.
                        </DialogDescription>
                    </DialogHeader>
                    {editingUser && (
                        <div className="space-y-4 py-3">
                            <div className="space-y-1">
                                <Label htmlFor="edit-username" className="text-xs font-semibold text-slate-600">Username</Label>
                                <Input 
                                    id="edit-username"
                                    value={editUserFields.username}
                                    onChange={(e) => setEditUserFields({ ...editUserFields, username: e.target.value })}
                                    className="h-9 text-xs"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="edit-email" className="text-xs font-semibold text-slate-600">Email Address</Label>
                                <Input 
                                    id="edit-email"
                                    type="email"
                                    value={editUserFields.email}
                                    onChange={(e) => setEditUserFields({ ...editUserFields, email: e.target.value })}
                                    className="h-9 text-xs"
                                    required
                                />
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="edit-role" className="text-xs font-semibold text-slate-600">Staff Role</Label>
                                <select
                                    id="edit-role"
                                    value={editUserFields.role}
                                    onChange={(e) => setEditUserFields({ ...editUserFields, role: e.target.value })}
                                    className="flex h-9 w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-600 focus-visible:border-teal-600 cursor-pointer"
                                >
                                    <option value="caregiver">Caregiver</option>
                                    <option value="medical_staff">Medical Staff</option>
                                </select>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" size="sm" onClick={() => setIsEditUserOpen(false)} className="h-9 text-xs">
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateUser} className="bg-teal-600 hover:bg-teal-700 text-white font-semibold h-9 text-xs">
                            Save Changes
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
