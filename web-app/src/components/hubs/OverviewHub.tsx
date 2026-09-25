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
    const isClinical = ['caregiver', 'medical_staff', 'parent', 'guardian'].includes(role);

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
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50/90 border border-teal-200/90 text-teal-800 text-[11px] font-black uppercase tracking-wider mb-2 shadow-2xs">
                        <HeartPulse className="w-3.5 h-3.5 text-teal-600" />
                        <span>Live Clinical Overview</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        Healthcare{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600">
                            Command Dashboard
                        </span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">Real-time patient telemetry, vital thresholds, and proactive anomaly monitoring.</p>
                </div>
            </div>

            <Tabs defaultValue={defaultTab} className="w-full flex flex-col h-[calc(100%-80px)]">
                {/* [UX] Graceful Degradation: Hide tabs if only 1 is available */}
                {tabCount > 1 && (
                    <div className="mb-6">
                        <TabsList className="bg-teal-50/60 p-1.5 rounded-2xl border border-teal-100/90 inline-flex gap-2 overflow-x-auto h-auto">
                            {canSeeGlobal && (
                                <TabsTrigger
                                    value="global"
                                    className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                                >
                                    <Globe className="w-3.5 h-3.5 text-teal-600" /> System Admin Dashboard
                                </TabsTrigger>
                            )}

                            {canSeeFacility && (
                                <TabsTrigger
                                    value="facility"
                                    className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                                >
                                    <Building2 className="w-3.5 h-3.5 text-teal-600" /> Facility Admin Dashboard
                                </TabsTrigger>
                            )}

                            {canSeeCareView && (
                                <TabsTrigger
                                    value="careview"
                                    className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                                >
                                    <HeartPulse className="w-3.5 h-3.5 text-teal-600" /> Caregiver Dashboard
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
