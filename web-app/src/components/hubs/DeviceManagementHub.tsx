import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Cpu, PlusCircle, PenTool, Database, ActivitySquare, Camera } from 'lucide-react';

import { MyDevices } from '../MyDevices';
import { AddNewDevice } from '../AddNewDevice';
import { CaregiverDashboardNew } from '../CaregiverDashboardNew';
import ReadOnlyDiagnostics from '../facility-admin/ReadOnlyDiagnostics';
import FirmwareOTAUpdates from '../sysadmin/FirmwareOTAUpdates';
import FacilityTopologyBuilder from '../sysadmin/FacilityTopologyBuilder';
import AssignDeviceToPatient from '../facility-admin/AssignDeviceToPatient';
import SystemAdminDeviceAssignment from '../sysadmin/SystemAdminDeviceAssignment';
import DeviceSnapshotsTab from '../sysadmin/DeviceSnapshotsTab';

export default function DeviceManagementHub() {
    const { user, permissions, isSysAdmin } = useAuth();
    const role = user?.role?.toLowerCase() || '';

    // Authorizations
    const isAdminTier  = isSysAdmin || ['system_admin', 'admin', 'sysadmin'].includes(role);
    const isFacilityAdmin = role === 'facility_admin';
    const isSystemAdmin = isAdminTier && !isFacilityAdmin;
    const isClinical   = ['caregiver', 'medical_staff', 'parent'].includes(role);

    // [OWASP A01 / RBAC] Override-aware visibility helper
    const hasPermission = (moduleId: string, roleDefault: boolean): boolean => {
        if (isAdminTier) return true;
        if (Object.prototype.hasOwnProperty.call(permissions, moduleId)) {
            return permissions[moduleId];
        }
        return roleDefault;
    };

    // Visibilities — module IDs match UserRBACManager MODULE_REGISTRY exactly
    const canSeeMyDevices      = hasPermission('device-status',  isClinical || isFacilityAdmin || isAdminTier);
    const canSeeAddDevice      = hasPermission('add-device',     isClinical || isFacilityAdmin || isAdminTier) && !['caregiver', 'medical_staff', 'parent'].includes(role);
    const canSeeDiagnostics    = hasPermission('diagnostics',    isFacilityAdmin || isAdminTier);
    const canSeeTopologyAndOTA = hasPermission('topology',       isAdminTier);
    const canSeeAssignDevice   = hasPermission('assign-device',  isFacilityAdmin || isAdminTier);
    const canSeeSysAssignment  = hasPermission('sys-device-assignment', isAdminTier);
    const canSeeSnapshots      = isAdminTier;
 
    const tabCount = [canSeeMyDevices, canSeeAddDevice, canSeeDiagnostics, canSeeTopologyAndOTA, canSeeAssignDevice, canSeeSysAssignment, canSeeSnapshots].filter(Boolean).length;
    
    let defaultTab = 'my-devices';
    if (!canSeeMyDevices) {
        if (canSeeAssignDevice) defaultTab = 'assign-device';
        else if (canSeeSysAssignment) defaultTab = 'sys-device-assignment';
        else if (canSeeDiagnostics) defaultTab = 'diagnostics';
        else if (canSeeTopologyAndOTA) defaultTab = 'topology';
    }

    return (
        <div className="w-full h-full animate-in fade-in duration-300 flex flex-col">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Device Management</h1>
                <p className="text-sm text-slate-500 mt-1">Manage connected hardware, sensors, and firmware infrastructure.</p>
            </div>

            <Tabs defaultValue={defaultTab} className="w-full flex-1 flex flex-col min-h-0">
                {tabCount > 1 && (
                <div className="border-b border-slate-200 mb-6 shrink-0">
                    <TabsList className="bg-transparent h-12 p-0 flex gap-6 justify-start overflow-x-auto">
                        {canSeeAssignDevice && !isSystemAdmin && (
                            <TabsTrigger 
                                value="assign-device" 
                                className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                            >
                                <PenTool className="w-4 h-4" /> Assign Device to Patient
                            </TabsTrigger>
                        )}

                        {canSeeMyDevices && (
                            <TabsTrigger 
                                value="my-devices" 
                                className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                            >
                                <Cpu className="w-4 h-4" /> {isSystemAdmin ? "Patients' Devices" : "My Devices"}
                            </TabsTrigger>
                        )}

                        {canSeeAddDevice && (
                            <TabsTrigger 
                                value="add-device" 
                                className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                            >
                                <PlusCircle className="w-4 h-4" /> {isSystemAdmin ? "Register Device" : "Add Device"}
                            </TabsTrigger>
                        )}

                        {canSeeDiagnostics && (
                            <TabsTrigger 
                                value="diagnostics" 
                                className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                            >
                                <ActivitySquare className="w-4 h-4" /> Ward Diagnostics
                            </TabsTrigger>
                        )}

                        {canSeeTopologyAndOTA && !isSystemAdmin && (
                            <TabsTrigger 
                                value="topology" 
                                className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                            >
                                <Database className="w-4 h-4" /> Network Topology
                            </TabsTrigger>
                        )}

                        {canSeeTopologyAndOTA && (
                            <TabsTrigger 
                                value="ota" 
                                className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                            >
                                <PenTool className="w-4 h-4" /> Firmware OTA
                            </TabsTrigger>
                        )}

                        {canSeeSysAssignment && (
                            <TabsTrigger 
                                value="sys-device-assignment"
                                className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                            >
                                <Cpu className="w-4 h-4" /> Device Assignment
                            </TabsTrigger>
                        )}

                        {canSeeSnapshots && (
                            <TabsTrigger 
                                value="device-snapshots"
                                className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                            >
                                <Camera className="w-4 h-4" /> Device Snapshots
                            </TabsTrigger>
                        )}
                    </TabsList>
                </div>
                )}

                {canSeeMyDevices && (
                    <TabsContent value="my-devices" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <MyDevices />
                    </TabsContent>
                )}

                {canSeeAddDevice && (
                    <TabsContent value="add-device" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <AddNewDevice onDeviceAdded={() => {}} onCancel={() => {}} />
                    </TabsContent>
                )}

                {canSeeAssignDevice && !isSystemAdmin && (
                    <TabsContent value="assign-device" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <AssignDeviceToPatient />
                    </TabsContent>
                )}

                {canSeeDiagnostics && (
                    <TabsContent value="diagnostics" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <ReadOnlyDiagnostics />
                    </TabsContent>
                )}

                {canSeeTopologyAndOTA && !isSystemAdmin && (
                    <TabsContent value="topology" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <FacilityTopologyBuilder />
                    </TabsContent>
                )}

                {canSeeTopologyAndOTA && (
                    <TabsContent value="ota" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <FirmwareOTAUpdates />
                    </TabsContent>
                )}

                {canSeeSysAssignment && (
                    <TabsContent value="sys-device-assignment" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <SystemAdminDeviceAssignment />
                    </TabsContent>
                )}

                {canSeeSnapshots && (
                    <TabsContent value="device-snapshots" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <DeviceSnapshotsTab />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
