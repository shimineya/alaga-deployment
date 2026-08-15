import { useEffect, useState } from "react";
import RolePermissionModal from "./RolePermissionModal";
import { useAuth } from "@/lib/auth-context";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Lock, Unlock, RefreshCw, Pencil, Search, UserPlus, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface User {
    user_id: number;
    username: string;
    email: string;
    role: string;
    account_status: string;
    is_locked: boolean;
    joined_at: string;
}

export default function UserManagement() {
    const { user } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedFacility, setSelectedFacility] = useState<string>("all");

    // Edit State
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Create State (Mock CRUD)
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newUser, setNewUser] = useState({ username: '', email: '', role: 'caregiver' });

    // Permission Modal State
    const [isPermModalOpen, setIsPermModalOpen] = useState(false);

    // MOCK DATA for CRUD Demonstration
    const MOCK_USERS: User[] = [
        { user_id: 101, username: "jdelacruz_fa", email: "jdelacruz@facility.com", role: "facility_admin", account_status: "active", is_locked: false, joined_at: "2026-03-01T10:00:00Z" },
        { user_id: 102, username: "mreyes_md", email: "mreyes@hospital.com", role: "medical_staff", account_status: "active", is_locked: false, joined_at: "2026-03-02T11:30:00Z" },
        { user_id: 103, username: "asantos_cg", email: "asantos@care.com", role: "caregiver", account_status: "active", is_locked: false, joined_at: "2026-03-05T09:15:00Z" },
        { user_id: 104, username: "hacked_account", email: "suspicious@unknown.com", role: "caregiver", account_status: "locked", is_locked: true, joined_at: "2026-03-10T14:20:00Z" },
    ];

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            let url = `${import.meta.env.VITE_API_URL || ''}/api/admin/users`;

            // [Security/DPA] Append facility_id to prevent cross-tenant data leakage (OWASP A01)
            if (user?.role === 'facility_admin' && user?.facility_id) {
                url += `?facility_id=${user.facility_id}`;
            } else if ((user?.role === 'sysadmin' || user?.role === 'system_admin') && selectedFacility !== 'all') {
                url += `?facility_id=${selectedFacility}`;
            }

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && data.data && data.data.length > 0) {
                setUsers(data.data);
                setFilteredUsers(data.data);
            } else {
                // Fallback to MOCK_USERS if backend is empty for CRUD display purposes
                setUsers(MOCK_USERS);
                setFilteredUsers(MOCK_USERS);
            }
        } catch (err) {
            setUsers(MOCK_USERS);
            setFilteredUsers(MOCK_USERS);
            toast.error("Failed to load users from backend; loaded mock data.");
        }
    };

    useEffect(() => {
        if (user) {
            fetchUsers();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, selectedFacility]);

    // [Feature] Search Filtering
    useEffect(() => {
        if (!searchQuery) {
            setFilteredUsers(users);
        } else {
            const lower = searchQuery.toLowerCase();
            const filtered = users.filter(u =>
                u.username.toLowerCase().includes(lower) ||
                u.email.toLowerCase().includes(lower) ||
                u.role.toLowerCase().includes(lower)
            );
            setFilteredUsers(filtered);
        }
    }, [searchQuery, users]);

    // [CRUD] Create User Handler (Mock)
    const handleCreateUser = () => {
        if (!newUser.username || !newUser.email) {
            toast.error("Username and email are required.");
            return;
        }
        const createdUser: User = {
            user_id: Math.floor(Math.random() * 1000) + 200,
            username: newUser.username,
            email: newUser.email,
            role: newUser.role,
            account_status: "active",
            is_locked: false,
            joined_at: new Date().toISOString()
        };
        const updatedList = [createdUser, ...users];
        setUsers(updatedList);
        setIsCreateOpen(false);
        setNewUser({ username: '', email: '', role: 'caregiver' });
        toast.success("User successfully provisioned (Mock Backend).");
    };

    // [CRUD] Delete User Handler (Mock)
    const handleDeleteUser = (userId: number) => {
        if (!confirm("Are you sure you want to permanently delete this user? This action cannot be undone.")) return;
        const updatedList = users.filter(u => u.user_id !== userId);
        setUsers(updatedList);
        toast.success("User successfully deleted (Mock Backend).");
    };

    // [Feature] Edit User Handler
    const openEditModal = (user: User) => {
        setEditingUser(user);
        setIsEditOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingUser) return;

        // Mock Update logic
        const updatedList = users.map(u => u.user_id === editingUser.user_id ? editingUser : u);
        setUsers(updatedList);
        setIsEditOpen(false);
        toast.success("User profile updated (Mock Backend).");
    };

    const toggleLock = async (userId: number, currentLockStatus: boolean) => {
        const action = currentLockStatus ? "Unlock" : "Lock";
        if (!confirm(`Are you sure you want to ${action} this user?`)) return;

        // Mock Update logic
        const updatedList = users.map(u => u.user_id === userId ? { ...u, is_locked: !currentLockStatus } : u);
        setUsers(updatedList);
        toast.success(`User successfully ${action}ed (Mock Backend).`);
    };

    const handleResetMFA = async (userId: number) => {
        if (!confirm("Reset MFA secret for this user? They will need to re-scan the QR code.")) return;
        toast.success("MFA successfully reset (Mock Backend).");
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-end mb-2">
                <div>
                    <h2 className="text-lg font-bold text-teal-900 tracking-tight dark:text-teal-100">Role and Access Management</h2>
                    <p className="text-[10px] font-medium text-slate-500">Manage user identities, facility assignments, and enforce security policies.</p>
                </div>
                <div className="flex items-center gap-2">
                    {/* [Feature] Facility Filter for System Admin */}
                    {(user?.role === 'sysadmin' || user?.role === 'system_admin') && (
                        <Select value={selectedFacility} onValueChange={setSelectedFacility}>
                            <SelectTrigger className="w-40 h-8 text-xs bg-white border-slate-200" aria-label="Facility Filter">
                                <SelectValue placeholder="Facility Filter" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Global (All Facilities)</SelectItem>
                                <SelectItem value="1">St. Luke's Medical Center</SelectItem>
                                <SelectItem value="2">Makati Medical Center</SelectItem>
                            </SelectContent>
                        </Select>
                    )}

                    {/* [Security] Visual lock for Facility Admin */}
                    {user?.role === 'facility_admin' && (
                        <div className="flex items-center text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-md border border-amber-200" title="Locked to assigned facility territory.">
                            <Lock className="w-3.5 h-3.5 mr-1.5" />
                            <span className="font-medium">Confined Scope</span>
                        </div>
                    )}

                    <Button size="sm" variant="outline" className="h-8 text-xs font-medium" onClick={() => setIsPermModalOpen(true)}>
                        <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                        Permissions Matrix
                    </Button>

                    <Button size="sm" className="h-8 text-xs font-medium bg-teal-700 hover:bg-teal-600" onClick={() => setIsCreateOpen(true)}>
                        <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                        Create User
                    </Button>
                </div>
            </div>

            <div className="flex items-center w-full max-w-sm relative">
                <Search className="absolute left-2.5 top-2 h-4 w-4 text-slate-400" />
                <Input
                    placeholder="Search personnel by info..."
                    className="pl-8 h-8 text-xs border-slate-200 shadow-sm bg-white"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                />
            </div>

            <Card className="bg-white border border-slate-200 border-l-4 border-l-teal-600 shadow-sm">
                <CardHeader className="py-2 px-4 space-y-0 pb-2">
                    <CardTitle className="text-[11px] font-medium text-slate-500 uppercase tracking-wider flex items-center justify-between">
                        <span>Registered Personnel ({filteredUsers.length})</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 pt-0">
                    <div className="border border-slate-100 rounded-md">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow>
                                    <TableHead className="text-xs font-medium text-slate-500">Identity</TableHead>
                                    <TableHead className="text-xs font-medium text-slate-500">Role Authority</TableHead>
                                    <TableHead className="text-xs font-medium text-slate-500">Status</TableHead>
                                    <TableHead className="text-xs font-medium text-slate-500 text-right">Administrative Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-xs text-slate-500">
                                            No users matched the criteria.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map((u) => (
                                        <TableRow key={u.user_id} className="hover:bg-slate-50/80">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-slate-800 text-sm">{u.username}</span>
                                                    <span className="text-xs text-slate-500 font-mono">{u.email}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="text-[10px] capitalize bg-slate-100 text-slate-700 font-medium">
                                                    {u.role.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {u.is_locked ? (
                                                    <Badge variant="destructive" className="text-[10px] bg-red-100 text-red-800 border-red-200 hover:bg-red-200">Security Lockout</Badge>
                                                ) : (
                                                    <Badge className="text-[10px] bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200 border shadow-none">Active</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-blue-50 group" onClick={() => openEditModal(u)} title="Modify Profile">
                                                        <Pencil className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-orange-50 group" onClick={() => handleResetMFA(u.user_id)} title="Reset MFA Token Sequence">
                                                        <RefreshCw className="w-3.5 h-3.5 text-slate-400 group-hover:text-orange-600" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-slate-100 group" onClick={() => toggleLock(u.user_id, u.is_locked)} title={u.is_locked ? "Unlock Account" : "Lock Account"}>
                                                        {u.is_locked ? <Unlock className="w-3.5 h-3.5 text-emerald-600" /> : <Lock className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-500" />}
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-red-50 group" onClick={() => handleDeleteUser(u.user_id)} title="Purge Record">
                                                        <Trash2 className="w-3.5 h-3.5 text-slate-400 group-hover:text-red-600" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* CREATE MODAL */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-800">Provision New Identity</DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Establish a new user record. Facility boundaries will apply.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs font-semibold text-slate-700">Username</Label>
                            <Input
                                value={newUser.username}
                                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                                className="col-span-3 text-sm h-9"
                                placeholder="e.g. jdoe_admin"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs font-semibold text-slate-700">Email</Label>
                            <Input
                                value={newUser.email}
                                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                className="col-span-3 text-sm h-9"
                                placeholder="jdoe@hospital.com"
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label className="text-right text-xs font-semibold text-slate-700">Role</Label>
                            <Select
                                value={newUser.role}
                                onValueChange={(val) => setNewUser({ ...newUser, role: val })}
                            >
                                <SelectTrigger className="col-span-3 h-9 text-sm">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="facility_admin">Facility Admin</SelectItem>
                                    <SelectItem value="medical_staff">Medical Staff</SelectItem>
                                    <SelectItem value="caregiver">Caregiver</SelectItem>
                                    {(user?.role === 'sysadmin' || user?.role === 'system_admin') && (
                                        <SelectItem value="system_admin">System Admin</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button size="sm" className="bg-teal-700 hover:bg-teal-600" onClick={handleCreateUser}>Provision User</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* EDIT MODAL */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-slate-800">Modify Identity</DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Update user details or re-assign authority levels.
                        </DialogDescription>
                    </DialogHeader>
                    {editingUser && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right text-xs font-semibold text-slate-700">Username</Label>
                                <Input
                                    value={editingUser.username}
                                    onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                                    className="col-span-3 text-sm h-9"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right text-xs font-semibold text-slate-700">Email</Label>
                                <Input
                                    value={editingUser.email}
                                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                    className="col-span-3 text-sm h-9 font-mono"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right text-xs font-semibold text-slate-700">Role</Label>
                                <Select
                                    value={editingUser.role}
                                    onValueChange={(val) => setEditingUser({ ...editingUser, role: val })}
                                >
                                    <SelectTrigger className="col-span-3 h-9 text-sm">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="facility_admin">Facility Admin</SelectItem>
                                        <SelectItem value="medical_staff">Medical Staff</SelectItem>
                                        <SelectItem value="caregiver">Caregiver</SelectItem>
                                        {(user?.role === 'sysadmin' || user?.role === 'system_admin') && (
                                            <SelectItem value="system_admin">System Admin</SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                        <Button size="sm" className="bg-teal-700 hover:bg-teal-600" onClick={handleSaveEdit}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <RolePermissionModal
                isOpen={isPermModalOpen}
                onClose={() => setIsPermModalOpen(false)}
            />
        </div>
    );
}