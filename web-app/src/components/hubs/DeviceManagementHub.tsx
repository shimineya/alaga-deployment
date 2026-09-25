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
    const canSeeAddDevice      = hasPermission('add-device',     isClinical || isFacilityAdmin || isAdminTier);
    const canSeeDiagnostics    = hasPermission('diagnostics',    isFacilityAdmin || isAdminTier);
    const canSeeTopologyAndOTA = hasPermission('topology',       isAdminTier);
    const canSeeAssignDevice   = hasPermission('assign-device',  isFacilityAdmin || isClinical);
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
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50/90 border border-teal-200/90 text-teal-800 text-[11px] font-black uppercase tracking-wider mb-2 shadow-2xs">
                        <Cpu className="w-3.5 h-3.5 text-teal-600" />
                        <span>IoT Wearables & Hardware Infrastructure</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        Device & Fleet{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600">
                            Management
                        </span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">Manage connected hardware, sensors, firmware updates, and topology diagnostics.</p>
                </div>
            </div>

            <Tabs defaultValue={defaultTab} className="w-full flex-1 flex flex-col min-h-0">
                {tabCount > 1 && (
                <div className="mb-6 shrink-0">
                    <TabsList className="bg-teal-50/60 p-1.5 rounded-2xl border border-teal-100/90 inline-flex gap-2 overflow-x-auto h-auto">
                        {canSeeAssignDevice && !isSystemAdmin && (
                            <TabsTrigger 
                                value="assign-device" 
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <PenTool className="w-3.5 h-3.5 text-teal-600" /> Assign Device to Patient
                            </TabsTrigger>
                        )}

                        {canSeeMyDevices && (
                            <TabsTrigger 
                                value="my-devices" 
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <Cpu className="w-3.5 h-3.5 text-teal-600" /> {isSystemAdmin ? "Patients' Devices" : "My Devices"}
                            </TabsTrigger>
                        )}

                        {canSeeAddDevice && (
                            <TabsTrigger 
                                value="add-device" 
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <PlusCircle className="w-3.5 h-3.5 text-teal-600" /> {isSystemAdmin ? "Register Device" : "Add Device"}
                            </TabsTrigger>
                        )}

                        {canSeeDiagnostics && (
                            <TabsTrigger 
                                value="diagnostics" 
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <ActivitySquare className="w-3.5 h-3.5 text-teal-600" /> Ward Diagnostics
                            </TabsTrigger>
                        )}

                        {canSeeTopologyAndOTA && !isSystemAdmin && (
                            <TabsTrigger 
                                value="topology" 
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <Database className="w-3.5 h-3.5 text-teal-600" /> Network Topology
                            </TabsTrigger>
                        )}

                        {canSeeTopologyAndOTA && (
                            <TabsTrigger 
                                value="ota" 
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <PenTool className="w-3.5 h-3.5 text-teal-600" /> Firmware OTA
                            </TabsTrigger>
                        )}

                        {canSeeSysAssignment && (
                            <TabsTrigger 
                                value="sys-device-assignment"
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <Cpu className="w-3.5 h-3.5 text-teal-600" /> Device Assignment
                            </TabsTrigger>
                        )}

                        {canSeeSnapshots && (
                            <TabsTrigger 
                                value="device-snapshots"
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <Camera className="w-3.5 h-3.5 text-teal-600" /> Device Snapshots
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
