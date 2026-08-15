import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Avatar, AvatarFallback } from './ui/avatar';
import { toast } from 'sonner';
import {
    Shield,
    Activity,
    Bell,
    Users,
    Lock,
    Save,
    Trash2,
    Clock,
    UserCheck
} from 'lucide-react';
import { CaregiverProfile } from './CaregiverUserManagement';
import { CaregiverActivityLog } from './CaregiverActivityLog';

interface Props {
    caregiver: CaregiverProfile;
    onUpdate: () => void;
}

export const CaregiverManagement: React.FC<Props> = ({ caregiver, onUpdate }) => {
    // Local state for permissions (to allow editing before saving)
    const [permissions, setPermissions] = useState(caregiver.permissions);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Sync state when prop changes
    React.useEffect(() => {
        setPermissions(caregiver.permissions);
        setIsDirty(false);
    }, [caregiver]);

    const handleToggle = (key: keyof typeof permissions) => {
        setPermissions(prev => {
            const next = { ...prev, [key]: !prev[key] };
            setIsDirty(true);
            return next;
        });
    };

    const handleSave = async () => {
        setIsSaving(true);
        // Simulate API Update
        setTimeout(() => {
            setIsSaving(false);
            setIsDirty(false);
            onUpdate();
        }, 800);
    };

    const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    return (
        <div className="h-full flex flex-col gap-4">
            {/* PROFILE CARD */}
            <Card className="border-slate-200 shadow-sm shrink-0">
                <CardContent className="p-6">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-14 w-14 border-2 border-indigo-100">
                                <AvatarFallback className="bg-indigo-50 text-indigo-700 font-bold">
                                    {getInitials(caregiver.name)}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">{caregiver.name}</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="font-normal text-xs">{caregiver.role}</Badge>
                                    <span className="text-xs text-slate-400">•</span>
                                    <span className="text-xs text-slate-500">{caregiver.email}</span>
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            {caregiver.status === 'Active' ? (
                                <div className="flex items-center justify-end gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span className="text-xs font-semibold">Active Account</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-end gap-1.5 text-amber-600 bg-amber-50 px-2 py-1 rounded-md border border-amber-100">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span className="text-xs font-semibold">Invite Pending</span>
                                </div>
                            )}
                            {caregiver.last_active && (
                                <p className="text-[10px] text-slate-400 mt-1.5">Last active: {new Date(caregiver.last_active).toLocaleDateString()}</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* TABS: PERMISSIONS & LOGS */}
            <div className="flex-1 overflow-hidden">
                <Tabs defaultValue="permissions" className="h-full flex flex-col">
                    <TabsList className="w-full justify-start border-b rounded-none px-0 bg-transparent h-10">
                        <TabsTrigger
                            value="permissions"
                            className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:shadow-none rounded-none px-6"
                        >
                            Access Control
                        </TabsTrigger>
                        <TabsTrigger
                            value="activity"
                            className="data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 data-[state=active]:shadow-none rounded-none px-6"
                        >
                            Activity Log
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="permissions" className="flex-1 p-0 mt-0 overflow-hidden">
                        <Card className="h-full border-0 shadow-none rounded-none flex flex-col">
                            <CardHeader className="px-0 pt-6 pb-2">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-indigo-600" />
                                    Role-Based Access Control (RBAC)
                                </CardTitle>
                                <CardDescription>
                                    Define what <strong>{caregiver.name}</strong> can do within the system.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="px-0 py-4 flex-1">
                                <div className="grid gap-6">

                                    {/* Permission 1: Vitals */}
                                    <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-medium text-slate-900 flex items-center gap-2">
                                                <Activity className="w-4 h-4 text-rose-500" />
                                                View Patient Vitals
                                            </Label>
                                            <p className="text-xs text-slate-500">Allows access to real-time heart rate, temp, and moisture data.</p>
                                        </div>
                                        <Switch
                                            checked={permissions.can_view_vitals}
                                            onCheckedChange={() => handleToggle('can_view_vitals')}
                                        />
                                    </div>

                                    {/* Permission 2: Alerts */}
                                    <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-medium text-slate-900 flex items-center gap-2">
                                                <Bell className="w-4 h-4 text-amber-500" />
                                                Receive Alerts
                                            </Label>
                                            <p className="text-xs text-slate-500">User will receive SMS/App notifications for critical anomalies.</p>
                                        </div>
                                        <Switch
                                            checked={permissions.can_receive_alerts}
                                            onCheckedChange={() => handleToggle('can_receive_alerts')}
                                        />
                                    </div>

                                    {/* Permission 3: Management */}
                                    <div className="flex items-center justify-between p-4 border rounded-lg bg-slate-50/50">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-medium text-slate-900 flex items-center gap-2">
                                                <Users className="w-4 h-4 text-blue-500" />
                                                Manage Patient Profiles
                                            </Label>
                                            <p className="text-xs text-slate-500">Can enroll new patients, edit medical history, and assign devices.</p>
                                        </div>
                                        <Switch
                                            checked={permissions.can_manage_patients}
                                            onCheckedChange={() => handleToggle('can_manage_patients')}
                                        />
                                    </div>

                                    {/* Permission 4: Admin */}
                                    <div className="flex items-center justify-between p-4 border rounded-lg bg-purple-50/50 border-purple-100">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-medium text-purple-900 flex items-center gap-2">
                                                <Lock className="w-4 h-4 text-purple-600" />
                                                System Administrator
                                            </Label>
                                            <p className="text-xs text-purple-700/80">Full access to system settings, audit logs, and staff management.</p>
                                        </div>
                                        <Switch
                                            checked={permissions.is_admin}
                                            onCheckedChange={() => handleToggle('is_admin')}
                                            className="data-[state=checked]:bg-purple-600"
                                        />
                                    </div>

                                </div>
                            </CardContent>
                            <div className="pt-4 mt-auto border-t flex justify-between items-center">
                                <Button variant="ghost" className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 h-9">
                                    <Trash2 className="w-4 h-4 mr-2" /> Deactivate Account
                                </Button>
                                {isDirty && (
                                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-5">
                                        <span className="text-xs text-slate-500 italic">Unsaved changes</span>
                                        <Button onClick={handleSave} disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white h-9">
                                            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                                            Save Changes
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </Card>
                    </TabsContent>

                    <TabsContent value="activity" className="flex-1 p-0 mt-0 overflow-hidden">
                        <CaregiverActivityLog userId={caregiver.user_id} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};