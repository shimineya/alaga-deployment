import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Globe, Building2, HeartPulse } from 'lucide-react';

import CommandCenterDashboard from '../sysadmin/CommandCenterDashboard';
import FacilityDashboard from '../facility-admin/FacilityDashboard';
import { CaregiverDashboardNew } from '../CaregiverDashboardNew';
import { BreakGlassWrapper } from '../security/BreakGlassWrapper';

export default function OverviewHub() {
    const { user } = useAuth();
    const role = user?.role?.toLowerCase() || '';

    // Authorization Flags
    const isSysAdmin = ['system_admin', 'admin', 'sysadmin'].includes(role);
    const isFacilityAdmin = role === 'facility_admin';
    // [OWASP A01] 'parent' is the consumer-facing home-monitoring role.
    // Parents land on the Caregiver Dashboard (live patient vitals for their child).
    const isClinical = ['caregiver', 'medical_staff', 'parent'].includes(role);

    // Visibility Logic
    const canSeeGlobal = isSysAdmin;
    const canSeeFacility = isFacilityAdmin || isSysAdmin;
    const canSeeCareView = isClinical || isSysAdmin;

    // Count tabs to gracefully degrade TabsList
    const tabCount = [canSeeGlobal, canSeeFacility, canSeeCareView].filter(Boolean).length;
    
    // Choose default tab
    let defaultTab = 'careview';
    if (canSeeGlobal) defaultTab = 'global';
    else if (canSeeFacility) defaultTab = 'facility';

    return (
        <div className="w-full h-full animate-in fade-in duration-300">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Dashboard</h1>
                <p className="text-sm text-slate-500 mt-1">High-level telemetry and status dashboards.</p>
            </div>

            <Tabs defaultValue={defaultTab} className="w-full flex flex-col h-[calc(100%-80px)]">
                {/* [UX] Graceful Degradation: Hide tabs if only 1 is available */}
                {tabCount > 1 && (
                <div className="border-b border-slate-200 mb-6 font-sans">
                    <TooltipProvider delayDuration={300}>
                        <TabsList className="bg-transparent h-12 p-0 flex gap-6 justify-start overflow-x-auto">
                            {canSeeGlobal && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <TabsTrigger 
                                            value="global" 
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                        >
                                            <Globe className="w-4 h-4" /> System Admin Dashboard
                                        </TabsTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl">
                                        <p className="text-xs">System-wide metrics across all federated facilities.</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}

                            {canSeeFacility && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <TabsTrigger 
                                            value="facility" 
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                        >
                                            <Building2 className="w-4 h-4" /> Facility Admin Dashboard
                                        </TabsTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl">
                                        <p className="text-xs">Device inventory and alert configuration for your ward.</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}

                            {canSeeCareView && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <TabsTrigger 
                                            value="careview" 
                                            // Make the color visually distinct indicating PHI sensitivity
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-amber-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                        >
                                            <HeartPulse className="w-4 h-4" /> Caregiver Dashboard
                                        </TabsTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl">
                                        <p className="text-xs">Live telemetry for assigned patients. <span className="font-bold text-amber-300">Contains PHI.</span></p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </TabsList>
                    </TooltipProvider>
                </div>
                )}

                {canSeeGlobal && (
                    <TabsContent value="global" className="mt-0 flex-1 h-full outline-none">
                        <CommandCenterDashboard />
                    </TabsContent>
                )}

                {canSeeFacility && (
                    <TabsContent value="facility" className="mt-0 flex-1 h-full outline-none">
                        <FacilityDashboard />
                    </TabsContent>
                )}

                {canSeeCareView && (
                    <TabsContent value="careview" className="mt-0 flex-1 min-h-[500px] outline-none">
                        {/* [OWASP A01] Break-Glass Enforcement strictly wraps the PHI component */}
                        <BreakGlassWrapper targetHub="OverviewHub - My Care View">
                            <CaregiverDashboardNew initialTab="dashboard" hideNavigation={true} />
                        </BreakGlassWrapper>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
