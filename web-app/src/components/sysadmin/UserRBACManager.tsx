import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogCancel,
    AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { ShieldCheck, Search, RefreshCw, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, AlertTriangle, Users } from 'lucide-react';
// [RBAC] Single source of truth for module definitions and role defaults
import { MODULE_REGISTRY, computeRoleDefaults } from '@/lib/rbac-registry';

// [OWASP A01] API scoped strictly to sysadmin module
const SYSADMIN_API = `${import.meta.env.VITE_API_URL || ''}/api/sysadmin`;
const getAuth = () => ({
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
});

interface UserRecord {
    user_id: number;
    username: string;
    email: string;
    role: string;
    account_status: string;
    facility_name: string | null;
}

interface OverrideRecord {
    module_id: string;
    is_granted: boolean;
    override_reason: string;
    overridden_at: string;
}

// ================================================================
// MAIN COMPONENT
// ================================================================
export default function UserRBACManager() {
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
    const [overrides, setOverrides] = useState<Record<string, boolean | null>>({}); // null = follows role default
    // [RBAC] Actual role-level defaults fetched from role_permissions table.
    // Populated when a user is selected. Used by getRoleDefault so toggles
    // reflect the real state the target user currently sees in their UI.
    const [roleDefaults, setRoleDefaults] = useState<Record<string, boolean>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState<string | null>(null); // module_id currently being saved
    const [expandedGroups, setExpandedGroups] = useState<string[]>(MODULE_REGISTRY.map(g => g.group));
    const [reasonModal, setReasonModal] = useState<{ moduleId: string; label: string; newValue: boolean } | null>(null);
    const [reason, setReason] = useState('');

    // Fetch all non-admin users
    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${SYSADMIN_API}/users`, { headers: getAuth() });
            const data = await res.json();
            if (data.success) setUsers(data.data);
            else toast.error('Failed to load users.');
        } catch { toast.error('Network error fetching users.'); }
        setLoading(false);
    };

    useEffect(() => { fetchUsers(); }, []);

    // Fetch overrides for the selected user
    const fetchOverrides = useCallback(async (userId: number) => {
        try {
            const res = await fetch(`${SYSADMIN_API}/rbac/users/${userId}/overrides`, { headers: getAuth() });
            const data = await res.json();
            if (data.success) {
                // Convert array to a lookup map: module_id -> is_granted | null (null = default)
                const map: Record<string, boolean | null> = {};
                data.data.forEach((o: OverrideRecord) => {
                    map[o.module_id] = o.is_granted;
                });
                setOverrides(map);
            }
        } catch { toast.error('Could not load permission overrides.'); }
    }, []);

    // [RBAC] Fetch the role-level defaults for the selected user's role.
    // Strategy: start with computed defaults (mirrors hub visibility logic exactly),
    // then overlay any rows found in the role_permissions DB table.
    // This ensures toggles are always accurate even when role_permissions is empty.
    const fetchRoleDefaults = useCallback(async (role: string) => {
        // Step 1: compute from role-string logic — always correct regardless of DB state
        const computed = computeRoleDefaults(role);
        setRoleDefaults(computed);

        // Step 2: fetch any explicit DB overrides for this role and merge on top
        try {
            const res = await fetch(`${SYSADMIN_API}/rbac/roles/${role}`, { headers: getAuth() });
            const data = await res.json();
            if (data.success && Array.isArray(data.data) && data.data.length > 0) {
                setRoleDefaults(prev => {
                    const merged = { ...prev };
                    data.data.forEach((r: { module_id: string; is_enabled: boolean }) => {
                        merged[r.module_id] = r.is_enabled;
                    });
                    return merged;
                });
            }
        } catch { /* Network failure — computed defaults remain active */ }
    }, []);

    const handleSelectUser = (user: UserRecord) => {
        setSelectedUser(user);
        setOverrides({});
        setRoleDefaults({}); // Clear stale defaults while the new fetch is in-flight
        fetchOverrides(user.user_id);
        fetchRoleDefaults(user.role);
    };

    const initiateToggle = (moduleId: string, label: string, currentValue: boolean | null, roleDefault: boolean) => {
        // Determine what the effective current state is (override takes priority; else role default)
        const effective = currentValue !== null ? currentValue : roleDefault;
        // We want to flip it
        const newValue = !effective;
        setReason('');
        setReasonModal({ moduleId, label, newValue });
    };

    const confirmToggle = async () => {
        if (!selectedUser || !reasonModal) return;
        if (!reason.trim()) {
            toast.error('A justification reason is required. (OWASP A09)');
            return;
        }

        setSaving(reasonModal.moduleId);
        try {
            const res = await fetch(`${SYSADMIN_API}/rbac/users/${selectedUser.user_id}/overrides`, {
                method: 'POST',
                headers: getAuth(),
                body: JSON.stringify({
                    module_id: reasonModal.moduleId,
                    is_granted: reasonModal.newValue,
                    override_reason: reason.trim(),
                }),
            });
            const data = await res.json();
            if (data.success) {
                setOverrides(prev => ({ ...prev, [reasonModal.moduleId]: reasonModal.newValue }));
                toast.success(`Permission "${reasonModal.label}" ${reasonModal.newValue ? 'granted' : 'revoked'} for ${selectedUser.username}.`);
                setReasonModal(null);
            } else {
                toast.error(data.message || 'Failed to save override.');
            }
        } catch { toast.error('Network error saving override.'); }
        setSaving(null);
    };

    const handleResetToDefault = async (moduleId: string, label: string) => {
        if (!selectedUser) return;
        if (!confirm(`Reset "${label}" for ${selectedUser.username} to role default?`)) return;
        setSaving(moduleId);
        try {
            const res = await fetch(`${SYSADMIN_API}/rbac/users/${selectedUser.user_id}/overrides/${moduleId}`, {
                method: 'DELETE',
                headers: getAuth(),
            });
            const data = await res.json();
            if (data.success) {
                setOverrides(prev => {
                    const next = { ...prev };
                    delete next[moduleId];
                    return next;
                });
                toast.success(`"${label}" reset to role default for ${selectedUser.username}.`);
            } else {
                toast.error(data.message || 'Reset failed.');
            }
        } catch { toast.error('Network error during reset.'); }
        setSaving(null);
    };

    const toggleGroup = (group: string) => {
        setExpandedGroups(prev =>
            prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
        );
    };

    // [RBAC] Return the role-level default for a module.
    // roleDefaults is always populated (computed + optional DB overlay),
    // so this will almost never hit the true fallback.
    const getRoleDefault = (moduleId: string, _role: string): boolean => {
        if (Object.prototype.hasOwnProperty.call(roleDefaults, moduleId)) {
            return roleDefaults[moduleId];
        }
        // Unknown module not in MODULE_REGISTRY — assume OFF for safety
        return false;
    };

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase())
    );

    const roleColorClass = (role: string) => {
        if (role === 'facility_admin') return 'bg-purple-100 text-purple-700 border-purple-200';
        if (role === 'caregiver') return 'bg-teal-100 text-teal-700 border-teal-200';
        if (role === 'medical_staff') return 'bg-blue-100 text-blue-700 border-blue-200';
        return 'bg-slate-100 text-slate-600 border-slate-200';
    };

    return (
        <div className="flex gap-4 h-full min-h-[600px]">

            {/* ==========================================================
                LEFT PANEL: User List
            ========================================================== */}
            <div className="w-72 shrink-0 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-sm font-bold text-slate-800">User Accounts</h2>
                        <p className="text-[10px] text-slate-500">Select a user to configure their permissions.</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={fetchUsers} disabled={loading} className="h-7 w-7">
                        <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    <Input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search users..."
                        className="pl-8 h-8 text-xs border-slate-200"
                    />
                </div>
                <div className="flex-1 overflow-y-auto space-y-1 pr-1">
                    {filteredUsers.length === 0 && !loading && (
                        <div className="text-center text-xs text-slate-400 py-8 flex flex-col items-center gap-2">
                            <Users className="w-8 h-8 text-slate-200" />
                            No users found.
                        </div>
                    )}
                    {filteredUsers.map(u => (
                        <button
                            key={u.user_id}
                            onClick={() => handleSelectUser(u)}
                            className={`w-full text-left rounded-lg px-3 py-2.5 text-xs transition-all border ${
                                selectedUser?.user_id === u.user_id
                                    ? 'bg-teal-50 border-teal-200 shadow-sm'
                                    : 'bg-white border-transparent hover:border-slate-200 hover:bg-slate-50'
                            }`}
                        >
                            <p className="font-semibold text-slate-800 truncate">{u.username}</p>
                            <p className="text-slate-400 truncate">{u.email}</p>
                            <div className="mt-1 flex items-center gap-1">
                                <Badge className={`text-[10px] px-1.5 py-0 border font-medium ${roleColorClass(u.role)}`}>
                                    {u.role.replace('_', ' ')}
                                </Badge>
                                {u.facility_name && (
                                    <span className="text-[10px] text-slate-400 truncate">{u.facility_name}</span>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* ==========================================================
                RIGHT PANEL: Permission Toggles
            ========================================================== */}
            <div className="flex-1 overflow-y-auto">
                {!selectedUser ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 gap-3">
                        <ShieldCheck className="w-12 h-12 text-slate-200" />
                        <p className="text-sm font-medium text-slate-500">Select a user on the left</p>
                        <p className="text-xs max-w-xs">
                            You can grant or revoke access to specific pages and features for any individual user, overriding their default role permissions.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {/* User Header */}
                        <Card className="bg-slate-800 text-white border-none shadow-md">
                            <CardContent className="py-3 px-4 flex items-center justify-between">
                                <div>
                                    <p className="font-bold text-sm">{selectedUser.username}</p>
                                    <p className="text-xs text-slate-300">{selectedUser.email}</p>
                                </div>
                                <div className="text-right">
                                    <Badge className={`border text-[10px] ${roleColorClass(selectedUser.role)}`}>
                                        {selectedUser.role.replace('_', ' ')}
                                    </Badge>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        Toggles override the default role settings.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>

                        <div className="flex items-center gap-2 text-[10px] text-slate-500 px-1">
                            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                            All permission changes are logged in the Forensic Audit Trail (OWASP A09 / HIPAA).
                        </div>

                        {/* Module Groups */}
                        {MODULE_REGISTRY.map(group => {
                            const isExpanded = expandedGroups.includes(group.group);
                            return (
                                <Card key={group.group} className="border border-slate-200 shadow-sm overflow-hidden">
                                    <button
                                        onClick={() => toggleGroup(group.group)}
                                        className="w-full flex items-center justify-between px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                                    >
                                        <span className="text-xs font-bold text-slate-700">{group.group}</span>
                                        {isExpanded
                                            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                                            : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                        }
                                    </button>

                                    {isExpanded && (
                                        <CardContent className="p-0 divide-y divide-slate-100">
                                            {group.modules.map(mod => {
                                                const overrideValue = overrides.hasOwnProperty(mod.id) ? overrides[mod.id] : null;
                                                const roleDefault = getRoleDefault(mod.id, selectedUser.role);
                                                const effective = overrideValue !== null ? overrideValue : roleDefault;
                                                const isOverridden = overrideValue !== null;
                                                const isBusy = saving === mod.id;

                                                return (
                                                    <div key={mod.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 gap-4">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <p className="text-xs font-semibold text-slate-800">{mod.label}</p>
                                                                {isOverridden && (
                                                                    <Badge
                                                                        className={`text-[9px] px-1.5 py-0 border font-medium cursor-pointer hover:opacity-80 ${
                                                                            effective
                                                                                ? 'bg-teal-100 text-teal-700 border-teal-200'
                                                                                : 'bg-red-100 text-red-700 border-red-200'
                                                                        }`}
                                                                        onClick={() => handleResetToDefault(mod.id, mod.label)}
                                                                        title="Click to reset to role default"
                                                                    >
                                                                        {effective ? 'Granted Override' : 'Denied Override'} - Click to reset
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <p className="text-[10px] text-slate-400 mt-0.5 truncate">{mod.description}</p>
                                                        </div>

                                                        <button
                                                            onClick={() => initiateToggle(mod.id, mod.label, overrideValue, roleDefault)}
                                                            disabled={isBusy}
                                                            className={`shrink-0 transition-all ${isBusy ? 'opacity-50 cursor-wait' : 'hover:scale-110'}`}
                                                            title={effective ? 'Currently Enabled — click to deny' : 'Currently Denied — click to grant'}
                                                        >
                                                            {effective
                                                                ? <ToggleRight className="w-8 h-8 text-teal-500" />
                                                                : <ToggleLeft className="w-8 h-8 text-slate-300" />
                                                            }
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
                )}
            </div>

            {/* ==========================================================
                REASON DIALOG — Uses Radix AlertDialog so it renders in its
                own portal at the document root, completely outside the
                parent "Advanced Access Control" dialog's focus trap.
                [OWASP A09] Justification is stored in access_logs.
            ========================================================== */}
            <AlertDialog open={!!reasonModal} onOpenChange={open => { if (!open) setReasonModal(null); }}>
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 mb-1">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                                reasonModal?.newValue ? 'bg-teal-100' : 'bg-red-100'
                            }`}>
                                <ShieldCheck className={`w-5 h-5 ${
                                    reasonModal?.newValue ? 'text-teal-600' : 'text-red-600'
                                }`} />
                            </div>
                            <div>
                                <AlertDialogTitle className="text-sm font-bold text-slate-800 leading-tight">
                                    {reasonModal?.newValue ? 'Granting' : 'Revoking'} Access
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-xs text-slate-500 mt-0.5">
                                    To {reasonModal?.label}. A justification is required for the audit trail.
                                </AlertDialogDescription>
                            </div>
                        </div>

                        <p className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                            You are about to{' '}
                            <strong>{reasonModal?.newValue ? 'GRANT' : 'DENY'}</strong> access to the{' '}
                            <strong>"{reasonModal?.label}"</strong> feature for{' '}
                            <strong>{selectedUser?.username}</strong>.
                            This action will be permanently recorded in the Forensic Audit Trail.
                        </p>
                    </AlertDialogHeader>

                    <div className="mt-2">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Justification Reason <span className="text-red-500">*</span>
                        </label>
                        <Input
                            autoFocus
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            placeholder="e.g. Caregiver moved to read-only shift protocol..."
                            className="text-sm border-slate-300"
                            onKeyDown={e => {
                                if (e.key === 'Enter' && reason.trim()) confirmToggle();
                                if (e.key === 'Escape') setReasonModal(null);
                            }}
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                            Minimum requirement: describe the operational reason for this change.
                        </p>
                    </div>

                    <AlertDialogFooter className="mt-4">
                        <AlertDialogCancel
                            onClick={() => setReasonModal(null)}
                            className="text-xs border-slate-200"
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmToggle}
                            disabled={!reason.trim() || !!saving}
                            className={`text-xs text-white ${
                                reasonModal?.newValue
                                    ? 'bg-teal-600 hover:bg-teal-700'
                                    : 'bg-red-600 hover:bg-red-700'
                            }`}
                        >
                            Confirm {reasonModal?.newValue ? 'Grant' : 'Revoke'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
