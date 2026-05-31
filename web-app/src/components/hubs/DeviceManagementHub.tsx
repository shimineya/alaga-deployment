import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Cpu, PlusCircle, PenTool, Database, ActivitySquare } from 'lucide-react';

import { MyDevices } from '../MyDevices';
import { CaregiverDashboardNew } from '../CaregiverDashboardNew';
import ReadOnlyDiagnostics from '../facility-admin/ReadOnlyDiagnostics';
import FirmwareOTAUpdates from '../sysadmin/FirmwareOTAUpdates';
import FacilityTopologyBuilder from '../sysadmin/FacilityTopologyBuilder';

export default function DeviceManagementHub() {
    const { user, permissions, isSysAdmin } = useAuth();
    const role = user?.role?.toLowerCase() || '';

    // Authorizations
    const isAdminTier  = isSysAdmin || ['system_admin', 'admin', 'sysadmin'].includes(role);
    const isFacilityAdmin = role === 'facility_admin';
    // [OWASP A01] 'parent' is the consumer-facing home-monitoring role.
    // Backend caregiverRoutes.js POST /devices/register allows admin | medical_staff | parent.
    // Parent sees My Devices (their child's sensor) and Add Device (pair new ESP32).
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
    const canSeeMyDevices      = hasPermission('device-status',  isClinical || isAdminTier);
    const canSeeAddDevice      = hasPermission('add-device',     isClinical || isFacilityAdmin || isAdminTier);
    const canSeeDiagnostics    = hasPermission('diagnostics',    isFacilityAdmin || isAdminTier);
    const canSeeTopologyAndOTA = hasPermission('topology',       isAdminTier);

    const tabCount = [canSeeMyDevices, canSeeAddDevice, canSeeDiagnostics, canSeeTopologyAndOTA].filter(Boolean).length;
    
    let defaultTab = 'my-devices';
    if (!canSeeMyDevices) {
        if (canSeeDiagnostics) defaultTab = 'diagnostics';
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
                    <TooltipProvider delayDuration={300}>
                        <TabsList className="bg-transparent h-12 p-0 flex gap-6 justify-start overflow-x-auto">
                            {canSeeMyDevices && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <TabsTrigger 
                                            value="my-devices" 
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                        >
                                            <Cpu className="w-4 h-4" /> My Devices
                                        </TabsTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl max-w-[250px]">
                                        <p className="text-xs">View ESP32 sensors assigned to your patients.</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}

                            {canSeeAddDevice && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <TabsTrigger 
                                            value="add-device" 
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                        >
                                            <PlusCircle className="w-4 h-4" /> Add Device
                                        </TabsTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl max-w-[250px]">
                                        <p className="text-xs">Pair a new piece of hardware to the system whitelist.</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}

                            {canSeeDiagnostics && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <TabsTrigger 
                                            value="diagnostics" 
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                        >
                                            <ActivitySquare className="w-4 h-4" /> Ward Diagnostics
                                        </TabsTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl max-w-[250px]">
                                        <p className="text-xs">Examine network stability and battery levels across the facility.</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}

                            {canSeeTopologyAndOTA && (
                                <>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <TabsTrigger 
                                                value="topology" 
                                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                            >
                                                <Database className="w-4 h-4" /> Network Topology
                                            </TabsTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl max-w-[250px]">
                                            <p className="text-xs">Build and align the facility's logical hardware structure.</p>
                                        </TooltipContent>
                                    </Tooltip>

                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <TabsTrigger 
                                                value="ota" 
                                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                            >
                                                <PenTool className="w-4 h-4" /> Firmware OTA
                                            </TabsTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl max-w-[250px]">
                                            <p className="text-xs">Push Over-The-Air security patches to ESP32 endpoints.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </>
                            )}
                        </TabsList>
                    </TooltipProvider>
                </div>
                )}

                {canSeeMyDevices && (
                    <TabsContent value="my-devices" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <MyDevices />
                    </TabsContent>
                )}

                {canSeeAddDevice && (
                    <TabsContent value="add-device" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <CaregiverDashboardNew initialTab="add-device" hideNavigation={true} />
                    </TabsContent>
                )}

                {canSeeDiagnostics && (
                    <TabsContent value="diagnostics" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <ReadOnlyDiagnostics />
                    </TabsContent>
                )}

                {canSeeTopologyAndOTA && (
                    <>
                        <TabsContent value="topology" className="mt-0 flex-1 min-h-[500px] outline-none">
                            <FacilityTopologyBuilder />
                        </TabsContent>
                        <TabsContent value="ota" className="mt-0 flex-1 min-h-[500px] outline-none">
                            <FirmwareOTAUpdates />
                        </TabsContent>
                    </>
                )}
            </Tabs>
        </div>
    );
}
