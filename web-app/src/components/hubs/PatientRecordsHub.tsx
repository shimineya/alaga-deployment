import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, UserPlus } from 'lucide-react';

import PatientOnboarding from '../facility-admin/PatientOnboarding';
import { CaregiverDashboardNew } from '../CaregiverDashboardNew';
import { BreakGlassWrapper } from '../security/BreakGlassWrapper';

export default function PatientRecordsHub() {
    const { user, permissions, isSysAdmin } = useAuth();
    const role = user?.role?.toLowerCase() || '';

    // Authorization
    const isAdminTier  = isSysAdmin || ['system_admin', 'admin', 'sysadmin'].includes(role);
    const isFacilityAdmin = role === 'facility_admin';
    const isClinical   = ['caregiver', 'medical_staff'].includes(role);

    // [OWASP A01 / RBAC] Override-aware visibility helper — checks DB overrides first.
    const hasPermission = (moduleId: string, roleDefault: boolean): boolean => {
        if (isAdminTier) return true;
        if (Object.prototype.hasOwnProperty.call(permissions, moduleId)) {
            return permissions[moduleId];
        }
        return roleDefault;
    };

    // Visibility — module IDs match UserRBACManager MODULE_REGISTRY exactly
    const canSeeRoster      = hasPermission('my-patients',  isClinical || isAdminTier);
    // [OWASP A01] Onboarding calls /api/facility-admin/patients (verifyFacilityAdmin protected).
    // Clinical roles (caregiver, medical_staff) MUST NOT see this tab — they would receive
    // a 403 "Access Forbidden: Facility Admin Role Required" response on every form submit.
    const canSeeOnboarding  = hasPermission('add-patient',  isFacilityAdmin || isAdminTier);

    const tabCount = [canSeeRoster, canSeeOnboarding].filter(Boolean).length;
    
    let defaultTab = 'roster';
    if (!canSeeRoster && canSeeOnboarding) defaultTab = 'onboarding';

    return (
        <div className="w-full h-full animate-in fade-in duration-300 flex flex-col">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Patient Records (PHI)</h1>
                <p className="text-sm text-slate-500 mt-1">Manage patient admissions and view assigned medical charts.</p>
            </div>

            {/* Everything in Patient Records is PHI and requires DB Break-Glass if SysAdmin */}
            <BreakGlassWrapper targetHub="Patient Records Hub">
                <Tabs defaultValue={defaultTab} className="w-full flex-1 flex flex-col min-h-0">
                    {tabCount > 1 && (
                    <div className="border-b border-slate-200 mb-6 shrink-0">
                        <TooltipProvider delayDuration={300}>
                            <TabsList className="bg-transparent h-12 p-0 flex gap-6 justify-start overflow-x-auto">
                                {canSeeRoster && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <TabsTrigger 
                                                value="roster" 
                                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                            >
                                                <Users className="w-4 h-4" /> Patient Roster
                                            </TabsTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl">
                                            <p className="text-xs">View and select active assigned patients.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                                
                                {canSeeOnboarding && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <TabsTrigger 
                                                value="onboarding" 
                                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                            >
                                                <UserPlus className="w-4 h-4" /> Admission / Onboarding
                                            </TabsTrigger>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl">
                                            <p className="text-xs">Register new patients into the facility.</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </TabsList>
                        </TooltipProvider>
                    </div>
                    )}

                    {canSeeRoster && (
                        <TabsContent value="roster" className="mt-0 flex-1 min-h-[500px] outline-none">
                            <CaregiverDashboardNew initialTab="patient-list" hideNavigation={true} />
                        </TabsContent>
                    )}

                    {canSeeOnboarding && (
                        <TabsContent value="onboarding" className="mt-0 flex-1 min-h-[500px] outline-none">
                            <PatientOnboarding />
                        </TabsContent>
                    )}
                </Tabs>
            </BreakGlassWrapper>
        </div>
    );
}
