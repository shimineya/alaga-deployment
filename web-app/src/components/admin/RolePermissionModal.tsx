import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    LayoutDashboard,
    Users,
    UserPlus,
    Megaphone,
    Bell,
    FileText,
    BarChart3,
    Heart,
    Wifi,
    Archive,
    Trash2,
    Settings,
    User,
    List,
    AlertCircle,
    TrendingUp,
    ClipboardList,
    Cpu
} from 'lucide-react';
import { toast } from "sonner";

interface RolePermissionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// Define all possible modules merging both arrays from Sidebar
const ALL_MODULES = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'my-patients', label: 'My Patients (Caregiver)', icon: Users },
    { id: 'master-list', label: 'Master Patient List (Medical)', icon: List },
    { id: 'add-patient', label: 'Add Patient', icon: UserPlus },
    { id: 'bulletin', label: 'Bulletin Board', icon: Megaphone },
    { id: 'alerts', label: 'Alerts', icon: Bell }, // Caregiver version (Bell)
    { id: 'alerts-medical', label: 'Alerts (Medical)', icon: AlertCircle }, // Medical version (AlertCircle)
    { id: 'reports', label: 'Reports', icon: FileText },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'health-trends', label: 'Health Trends', icon: TrendingUp },
    { id: 'vital-signs', label: 'Vital Signs', icon: Heart },
    { id: 'activity-logs', label: 'Activity & Logs', icon: ClipboardList },
    { id: 'device-status', label: 'Device Status (Caregiver)', icon: Wifi },
    { id: 'sensor-health', label: 'Sensor Health (Medical)', icon: Cpu },
    { id: 'archived', label: 'Archived', icon: Archive },
    { id: 'trash', label: 'Trash', icon: Trash2 },
    { id: 'settings', label: 'Settings', icon: Settings }, // Caregiver
    { id: 'system-settings', label: 'System Settings (Medical)', icon: Settings }, // Medical
    { id: 'profile', label: 'Profile', icon: User },
];

export default function RolePermissionModal({ isOpen, onClose }: RolePermissionModalProps) {
    const [selectedRole, setSelectedRole] = useState<string>("medical_staff");
    // Map role -> list of enabled module IDs
    const [permissions, setPermissions] = useState<Record<string, string[]>>({
        "medical_staff": [
            'dashboard', 'add-patient', 'master-list', 'bulletin', 'alerts-medical',
            'reports', 'health-trends', 'activity-logs', 'sensor-health',
            'archived', 'trash', 'system-settings', 'profile'
        ],
        "caregiver": [
            'dashboard', 'my-patients', 'add-patient', 'bulletin', 'alerts',
            'reports', 'analytics', 'vital-signs', 'device-status',
            'archived', 'trash', 'settings', 'profile'
        ]
    });

    // Load from localStorage on mount
    useEffect(() => {
        const stored = localStorage.getItem("role_permissions");
        if (stored) {
            try {
                setPermissions(JSON.parse(stored));
            } catch (e) {
                console.error("Failed to parse permissions", e);
            }
        }
    }, []);

    const handleToggle = (moduleId: string) => {
        setPermissions(prev => {
            const rolePerms = prev[selectedRole] || [];
            const newRolePerms = rolePerms.includes(moduleId)
                ? rolePerms.filter(id => id !== moduleId)
                : [...rolePerms, moduleId];

            return { ...prev, [selectedRole]: newRolePerms };
        });
    };

    const handleSave = () => {
        localStorage.setItem("role_permissions", JSON.stringify(permissions));
        toast.success("Permissions updated successfully");
        // Dispatch event so Sidebar can react immediately if we want to do that later
        window.dispatchEvent(new Event("permissionsUpdated"));
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Role Permissions Management</DialogTitle>
                    <DialogDescription>
                        Configure which modules are visible for each role.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <div className="flex items-center gap-4 mb-6">
                        <Label className="text-base font-medium">Select Role:</Label>
                        <Select value={selectedRole} onValueChange={setSelectedRole}>
                            <SelectTrigger className="w-48">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="medical_staff">Medical Staff</SelectItem>
                                <SelectItem value="caregiver">Caregiver</SelectItem>
                                {/* Admin usually sees everything, but we could add it if needed */}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-md p-4">
                        {ALL_MODULES.map((module) => {
                            const isEnabled = (permissions[selectedRole] || []).includes(module.id);
                            return (
                                <div key={module.id} className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded">
                                    <div className="flex items-center gap-3">
                                        <module.icon className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-sm">{module.label}</span>
                                    </div>
                                    <Switch
                                        checked={isEnabled}
                                        onCheckedChange={() => handleToggle(module.id)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
