import { useEffect, useState } from "react";
import RolePermissionModal from "./RolePermissionModal";
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
import { Input } from "@/components/ui/input"; // Search Input
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
import { Lock, Unlock, UserX, RefreshCw, Pencil, Search } from "lucide-react";
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
    const [users, setUsers] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState("");

    // Edit State
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);

    // Permission Modal State
    const [isPermModalOpen, setIsPermModalOpen] = useState(false);

    const fetchUsers = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                setUsers(data.data);
                setFilteredUsers(data.data);
            }
        } catch (err) {
            toast.error("Failed to load users");
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

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

    // [Feature] Edit User Handler
    const openEditModal = (user: User) => {
        console.log("Opening edit modal for:", user);
        setEditingUser(user);
        setIsEditOpen(true);
    };

    const handleSaveEdit = async () => {
        if (!editingUser) return;
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`http://localhost:3000/api/admin/users/${editingUser.user_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    username: editingUser.username,
                    email: editingUser.email,
                    role: editingUser.role
                })
            });

            if (res.ok) {
                toast.success("User Updated");
                setIsEditOpen(false);
                fetchUsers(); // Refresh list
            } else {
                toast.error("Update Failed");
            }
        } catch (err) {
            toast.error("Connection Error");
        }
    };

    const toggleLock = async (userId: number, currentLockStatus: boolean) => {
        // ... (Existing lock logic, same as before)
        const action = currentLockStatus ? "Unlock" : "Lock";
        if (!confirm(`Are you sure you want to ${action} this user?`)) return;

        try {
            const token = localStorage.getItem('token');
            await fetch(`http://localhost:3000/api/admin/users/${userId}/lock`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ lock: !currentLockStatus })
            });
            toast.success(`User ${action}ed`);
            fetchUsers();
        } catch (e) { toast.error("Failed"); }
    };

    const handleResetMFA = async (userId: number) => {
        // ... (Existing MFA logic)
        if (!confirm("Reset MFA secret?")) return;
        try {
            const token = localStorage.getItem('token');
            await fetch(`http://localhost:3000/api/admin/users/${userId}/reset-mfa`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            toast.success("MFA Reset");
        } catch (e) { toast.error("Failed"); }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Identity & Access Management</h2>
                    <p className="text-muted-foreground">Manage roles and enforce security policies.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => {
                        console.log("Clicked Manage Roles");
                        setIsPermModalOpen(true);
                    }}>
                        <Lock className="w-4 h-4 mr-2" />
                        Manage Roles
                    </Button>
                    <div className="relative w-72">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search users..."
                            className="pl-8"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Registered Personnel ({filteredUsers.length})</CardTitle>
                    <CardDescription>Medical Staff and Caregivers.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.map((user) => (
                                <TableRow key={user.user_id}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-medium">{user.username}</span>
                                            <span className="text-xs text-muted-foreground">{user.email}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell><Badge variant="outline" className="capitalize">{user.role}</Badge></TableCell>
                                    <TableCell>
                                        {user.is_locked ? <Badge variant="destructive">Locked</Badge> : <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200">Active</Badge>}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            {/* Edit Button */}
                                            <Button variant="ghost" size="sm" onClick={() => openEditModal(user)}>
                                                <Pencil className="w-4 h-4 text-blue-500" />
                                            </Button>

                                            {/* MFA Reset */}
                                            <Button variant="ghost" size="sm" onClick={() => handleResetMFA(user.user_id)}>
                                                <RefreshCw className="w-4 h-4 text-orange-500" />
                                            </Button>

                                            {/* Lock Button */}
                                            <Button variant="ghost" size="sm" onClick={() => toggleLock(user.user_id, user.is_locked)}>
                                                {user.is_locked ? <Unlock className="w-4 h-4 text-green-600" /> : <Lock className="w-4 h-4 text-red-600" />}
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* EDIT MODAL */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit User Profile</DialogTitle>
                        <DialogDescription>
                            Make changes to the user profile here.
                        </DialogDescription>
                    </DialogHeader>
                    {editingUser && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Username</Label>
                                <Input
                                    value={editingUser.username}
                                    onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Email</Label>
                                <Input
                                    value={editingUser.email}
                                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                    className="col-span-3"
                                />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label className="text-right">Role</Label>
                                <Select
                                    value={editingUser.role}
                                    onValueChange={(val) => setEditingUser({ ...editingUser, role: val })}
                                >
                                    <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="admin">Admin</SelectItem>
                                        <SelectItem value="medical_staff">Medical Staff</SelectItem>
                                        <SelectItem value="caregiver">Caregiver</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveEdit}>Save Changes</Button>
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