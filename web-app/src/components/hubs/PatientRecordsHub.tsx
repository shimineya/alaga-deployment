import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, UserPlus, UserCheck, ShieldAlert } from 'lucide-react';

import PatientOnboarding from '../facility-admin/PatientOnboarding';
import { BreakGlassWrapper } from '../security/BreakGlassWrapper';
import SystemAdminPatientDirectory from '../sysadmin/SystemAdminPatientDirectory';

export default function PatientRecordsHub() {
    const { user, isSysAdmin } = useAuth();
    const role = user?.role?.toLowerCase() || '';

    const isFacilityAdmin = role === 'facility_admin';
    const isCaregiver = role === 'caregiver';
    const isMedicalStaff = role === 'medical_staff';
    const isParentOrGuardian = role === 'parent' || role === 'guardian';

    const isAllowed = isFacilityAdmin || isCaregiver || isMedicalStaff || isParentOrGuardian;

    // System Admins and unpermitted roles are restricted for data privacy
    if (!isAllowed || isSysAdmin) {
        return (
            <div className="w-full h-full flex items-center justify-center p-6">
                <div className="max-w-md w-full bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
                        <Users className="w-6 h-6" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-lg font-bold text-slate-800">Access Restricted</h2>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            To ensure strict data privacy and protect Patient Health Information (PHI), the Patient Records Hub is accessible exclusively by assigned caregivers, clinical staff, guardians, and facility administrators.
                        </p>
                    </div>
                    <div className="pt-2">
                        <a
                            href="/dashboard"
                            className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
                        >
                            Return to Dashboard
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // Role-specific tab visibility:
    // Facility Admins and Parents/Guardians can onboard/register new patients.
    const canSeeOnboarding = isFacilityAdmin || isParentOrGuardian;
    const canSeeAssigned = true;
    const canSeeUnassigned = isFacilityAdmin || isMedicalStaff || isParentOrGuardian;

    const tabCount = [canSeeOnboarding, canSeeAssigned, canSeeUnassigned].filter(Boolean).length;
    const defaultTab = canSeeOnboarding ? 'onboarding' : 'sys-assigned';

    // Dynamic tab labels based on role
    let onboardingTabLabel = 'Admission / Onboarding';
    let onboardingTabTooltip = 'Register new patients into the facility or care program.';
    if (isParentOrGuardian) {
        onboardingTabLabel = 'Register New Patient';
        onboardingTabTooltip = 'Add a new patient/family member and assign them to caregivers.';
    }

    let assignedTabLabel = 'Patients Registered and Assigned';
    let assignedTabTooltip = 'View and manage all registered patients.';
    if (isCaregiver) {
        assignedTabLabel = 'My Assigned Patients';
        assignedTabTooltip = 'View patients assigned to you that you have accepted.';
    } else if (isMedicalStaff) {
        assignedTabLabel = 'Facility Patients';
        assignedTabTooltip = 'View medical charts and patient status in your facility.';
    } else if (isParentOrGuardian) {
        assignedTabLabel = 'My Patients / Wards';
        assignedTabTooltip = 'View associated patient records and care summaries.';
    }

    return (
        <div className="w-full h-full animate-in fade-in duration-300 flex flex-col">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Patient Records (PHI)</h1>
                <p className="text-sm text-slate-500 mt-1">
                    {isCaregiver
                        ? 'View clinical records and telemetry for patients assigned to your care.'
                        : isParentOrGuardian
                        ? 'Register family members, manage patient records, and assign caregivers.'
                        : 'Manage patient admissions and view assigned medical charts.'}
                </p>
            </div>

            {/* Everything in Patient Records is PHI and requires DB Break-Glass if SysAdmin */}
            <BreakGlassWrapper targetHub="Patient Records Hub">
                <Tabs defaultValue={defaultTab} className="w-full flex-1 flex flex-col min-h-0">
                    {tabCount > 1 && (
                        <div className="border-b border-slate-200 mb-6 shrink-0">
                            <TabsList className="bg-transparent h-12 p-0 flex gap-6 justify-start overflow-x-auto">
                                {canSeeOnboarding && (
                                    <TabsTrigger 
                                        value="onboarding" 
                                        className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                                    >
                                        <UserPlus className="w-4 h-4" /> {onboardingTabLabel}
                                    </TabsTrigger>
                                )}

                                {canSeeAssigned && (
                                    <TabsTrigger 
                                        value="sys-assigned" 
                                        className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                                    >
                                        <Users className="w-4 h-4" /> {assignedTabLabel}
                                    </TabsTrigger>
                                )}

                                {canSeeUnassigned && (
                                    <TabsTrigger 
                                        value="sys-unassigned" 
                                        className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                                    >
                                        <UserCheck className="w-4 h-4" /> Unassigned Patients
                                    </TabsTrigger>
                                )}
                            </TabsList>
                        </div>
                    )}

                    {canSeeOnboarding && (
                        <TabsContent value="onboarding" className="mt-0 flex-1 min-h-[500px] outline-none">
                            <PatientOnboarding />
                        </TabsContent>
                    )}

                    {canSeeAssigned && (
                        <TabsContent value="sys-assigned" className="mt-0 flex-1 min-h-[500px] outline-none">
                            <SystemAdminPatientDirectory mode="assigned" />
                        </TabsContent>
                    )}

                    {canSeeUnassigned && (
                        <TabsContent value="sys-unassigned" className="mt-0 flex-1 min-h-[500px] outline-none">
                            <SystemAdminPatientDirectory mode="unassigned" />
                        </TabsContent>
                    )}
                </Tabs>
            </BreakGlassWrapper>
        </div>
    );
}
