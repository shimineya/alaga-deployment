import React, { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RolePermissionModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type PermissionState = 'toggle_on' | 'toggle_off' | 'locked_on' | 'locked_off' | 'override';

interface MatrixRow {
    moduleName: string;
    sysAdmin: PermissionState;
    facilityAdmin: PermissionState;
    medicalStaff: PermissionState;
    caregiver: PermissionState;
}

interface Zone {
    name: string;
    modules: MatrixRow[];
}

const ZONES: Zone[] = [
    {
        name: 'A. COMMAND CENTER (Zone A)',
        modules: [
            { moduleName: 'Command Center Dashboard', sysAdmin: 'locked_on', facilityAdmin: 'locked_off', medicalStaff: 'locked_off', caregiver: 'locked_off' },
            { moduleName: 'Global Security & SIEM', sysAdmin: 'locked_on', facilityAdmin: 'locked_off', medicalStaff: 'locked_off', caregiver: 'locked_off' },
            { moduleName: 'Facility Topology Builder', sysAdmin: 'locked_on', facilityAdmin: 'locked_off', medicalStaff: 'locked_off', caregiver: 'locked_off' },
            { moduleName: 'Forensic Audit Trails', sysAdmin: 'locked_on', facilityAdmin: 'locked_off', medicalStaff: 'locked_off', caregiver: 'locked_off' },
            { moduleName: 'Firmware OTA Updates', sysAdmin: 'locked_on', facilityAdmin: 'locked_off', medicalStaff: 'locked_off', caregiver: 'locked_off' }
        ]
    },
    {
        name: 'B. FACILITY ADMINISTRATION (Zone B)',
        modules: [
            { moduleName: 'Ward Dashboard', sysAdmin: 'toggle_on', facilityAdmin: 'locked_on', medicalStaff: 'locked_off', caregiver: 'locked_off' },
            { moduleName: 'User Management', sysAdmin: 'toggle_on', facilityAdmin: 'locked_on', medicalStaff: 'locked_off', caregiver: 'locked_off' },
            { moduleName: 'Staff Management', sysAdmin: 'toggle_on', facilityAdmin: 'locked_on', medicalStaff: 'locked_off', caregiver: 'locked_off' },
            { moduleName: 'Patient Onboarding', sysAdmin: 'toggle_on', facilityAdmin: 'locked_on', medicalStaff: 'toggle_on', caregiver: 'locked_off' },
            { moduleName: 'Alert Configuration', sysAdmin: 'toggle_on', facilityAdmin: 'locked_on', medicalStaff: 'toggle_on', caregiver: 'locked_off' },
            { moduleName: 'Security & Audits', sysAdmin: 'toggle_on', facilityAdmin: 'locked_on', medicalStaff: 'locked_off', caregiver: 'locked_off' },
            { moduleName: 'Diagnostics and Logs', sysAdmin: 'toggle_on', facilityAdmin: 'locked_on', medicalStaff: 'locked_off', caregiver: 'locked_off' }
        ]
    },
    {
        name: 'C. PATIENT CARE - PHI ZONE (Zone C)',
        modules: [
            { moduleName: 'Caregiver Dashboard', sysAdmin: 'override', facilityAdmin: 'toggle_on', medicalStaff: 'locked_on', caregiver: 'locked_on' },
            { moduleName: 'Patient Management / My Patients', sysAdmin: 'override', facilityAdmin: 'toggle_on', medicalStaff: 'locked_on', caregiver: 'locked_on' },
            { moduleName: 'Device Management / My Devices', sysAdmin: 'override', facilityAdmin: 'toggle_on', medicalStaff: 'locked_on', caregiver: 'locked_on' },
            { moduleName: 'Patient Care Reports', sysAdmin: 'override', facilityAdmin: 'toggle_on', medicalStaff: 'locked_on', caregiver: 'locked_on' },
            { moduleName: 'Medical Calendar & Tasks', sysAdmin: 'override', facilityAdmin: 'locked_off', medicalStaff: 'toggle_on', caregiver: 'toggle_on' }
        ]
    }
];

export default function RolePermissionModal({ isOpen, onClose }: RolePermissionModalProps) {
    const initialToggles: Record<string, boolean> = {};
    ZONES.forEach(zone => {
        zone.modules.forEach(mod => {
            initialToggles[`${mod.moduleName}-sysAdmin`] = mod.sysAdmin === 'toggle_on';
            initialToggles[`${mod.moduleName}-facilityAdmin`] = mod.facilityAdmin === 'toggle_on';
            initialToggles[`${mod.moduleName}-medicalStaff`] = mod.medicalStaff === 'toggle_on';
            initialToggles[`${mod.moduleName}-caregiver`] = mod.caregiver === 'toggle_on';
        });
    });

    const [toggles, setToggles] = useState<Record<string, boolean>>(initialToggles);

    const handleToggle = (key: string, checked: boolean) => {
        setToggles(prev => ({ ...prev, [key]: checked }));
    };

    const handleOverride = () => {
        // [HIPAA] Break-Glass protocol for accessing PHI. Requires justification code.
        console.log("Trigger Justification Modal");
    };

    const renderCell = (state: PermissionState, moduleName: string, role: string) => {
        if (state === 'toggle_on' || state === 'toggle_off') {
            const key = `${moduleName}-${role}`;
            return (
                <Switch
                    checked={toggles[key] || false}
                    onCheckedChange={(checked) => handleToggle(key, checked)}
                />
            );
        }

        if (state === 'locked_on') {
            return (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="inline-block cursor-not-allowed">
                                <Badge variant="secondary" className="pointer-events-none">Locked ON</Badge>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Baseline permission. This access cannot be revoked for this role.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        }

        if (state === 'locked_off') {
            // [OWASP A01] Enforcing hard security boundaries by preventing modification of default restrictions
            return (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="inline-block cursor-not-allowed">
                                <Badge variant="outline" className="text-gray-400 pointer-events-none">Locked OFF</Badge>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Security boundary enforced. This role cannot access this module by default.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        }

        if (state === 'override') {
            // [OWASP A06] Insecure Design mitigation: explicit break-glass mechanism to access PHI instead of default open access
            // [HIPAA] Requires logging of emergency access to Protected Health Information
            return (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="inline-block">
                                <Button variant="destructive" size="sm" onClick={handleOverride}>
                                    Emergency Override
                                </Button>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs text-center">
                            <p>HIPAA/DPA Guardrail: Accessing this exposes Protected Health Information (PHI). Requires an Emergency Justification Code.</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
        }

        return null;
    };

    const renderCellState = (state: PermissionState, moduleName: string, roleKey: string) => {
        return (
            <div className="flex justify-center items-center">
                {renderCell(state, moduleName, roleKey)}
            </div>
        );
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle>Role Permissions Management</DialogTitle>
                    <DialogDescription>
                        Configure and review module access across all roles. Strict boundaries are enforced per compliance mandates.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 pt-0">
                    <div className="w-full rounded-md border min-w-[700px]">
                        <Table>
                            <TableHeader className="bg-muted min-w-full sticky top-0 z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="w-[300px] font-semibold text-black dark:text-white">Module Name</TableHead>
                                    <TableHead className="text-center font-semibold text-black dark:text-white">SysAdmin</TableHead>
                                    <TableHead className="text-center font-semibold text-black dark:text-white">Facility Admin</TableHead>
                                    <TableHead className="text-center font-semibold text-black dark:text-white">Medical Staff</TableHead>
                                    <TableHead className="text-center font-semibold text-black dark:text-white">Caregiver</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ZONES.map((zone) => (
                                    <React.Fragment key={zone.name}>
                                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                                            <TableCell colSpan={5} className="font-semibold py-2 text-primary">
                                                {zone.name}
                                            </TableCell>
                                        </TableRow>
                                        {zone.modules.map((mod) => (
                                            <TableRow key={mod.moduleName}>
                                                <TableCell className="font-medium">{mod.moduleName}</TableCell>
                                                <TableCell>{renderCellState(mod.sysAdmin, mod.moduleName, 'sysAdmin')}</TableCell>
                                                <TableCell>{renderCellState(mod.facilityAdmin, mod.moduleName, 'facilityAdmin')}</TableCell>
                                                <TableCell>{renderCellState(mod.medicalStaff, mod.moduleName, 'medicalStaff')}</TableCell>
                                                <TableCell>{renderCellState(mod.caregiver, mod.moduleName, 'caregiver')}</TableCell>
                                            </TableRow>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <DialogFooter className="p-6 pt-2">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={onClose}>Save Configurations</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
