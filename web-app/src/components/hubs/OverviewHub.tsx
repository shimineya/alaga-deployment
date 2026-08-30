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
    const { user, permissions, isSysAdmin } = useAuth();
    const role = user?.role?.toLowerCase() || '';

    // Authorization Flags
    const isAdminTier = isSysAdmin || ['system_admin', 'admin', 'sysadmin'].includes(role);
    const isFacilityAdmin = role === 'facility_admin';
    // [OWASP A01] 'parent' is the consumer-facing home-monitoring role.
    // Parents land on the Caregiver Dashboard (live patient vitals for their child).
    const isClinical = ['caregiver', 'medical_staff', 'parent'].includes(role);

    const hasPermission = (moduleId: string, roleDefault: boolean): boolean => {
        if (isAdminTier) return true;
        if (Object.prototype.hasOwnProperty.call(permissions, moduleId)) {
            return permissions[moduleId];
        }
        return roleDefault;
    };

    // Visibility Logic
    const canSeeGlobal = hasPermission('dashboard', isAdminTier);
    const canSeeFacility = hasPermission('facility-dashboard', isFacilityAdmin || isAdminTier);
    const canSeeCareView = hasPermission('caregiver-dashboard', isClinical || isAdminTier);

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
                <p className="text-sm text-slate-500 mt-1">Health metrics and status dashboards.</p>
            </div>

            <Tabs defaultValue={defaultTab} className="w-full flex flex-col h-[calc(100%-80px)]">
                {/* [UX] Graceful Degradation: Hide tabs if only 1 is available */}
                {tabCount > 1 && (
                    <div className="border-b border-slate-200 mb-6 font-sans">
                        <TabsList className="bg-transparent h-12 p-0 flex gap-6 justify-start overflow-x-auto">
                            {canSeeGlobal && (
                                <TabsTrigger
                                    value="global"
                                    className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                                >
                                    <Globe className="w-4 h-4" /> System Admin Dashboard
                                </TabsTrigger>
                            )}

                            {canSeeFacility && (
                                <TabsTrigger
                                    value="facility"
                                    className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                                >
                                    <Building2 className="w-4 h-4" /> Facility Admin Dashboard
                                </TabsTrigger>
                            )}

                            {canSeeCareView && (
                                <TabsTrigger
                                    value="careview"
                                    className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                                >
                                    <HeartPulse className="w-4 h-4" /> Caregiver Dashboard
                                </TabsTrigger>
                            )}
                        </TabsList>
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
