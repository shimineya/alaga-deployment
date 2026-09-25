import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, UserPlus, UserCheck, ShieldAlert } from 'lucide-react';
import { Patient } from '@/types';
import { PatientProfile } from '../PatientProfile';

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
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

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

    if (selectedPatient) {
        return (
            <div className="w-full h-full animate-in fade-in duration-300 flex flex-col">
                <BreakGlassWrapper targetHub="Patient Records Hub">
                    <PatientProfile
                        patient={selectedPatient}
                        onBack={() => setSelectedPatient(null)}
                        caregiverName={selectedPatient.assignedCaregiverName}
                    />
                </BreakGlassWrapper>
            </div>
        );
    }

    return (
        <div className="w-full h-full animate-in fade-in duration-300 flex flex-col">
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50/90 border border-teal-200/90 text-teal-800 text-[11px] font-black uppercase tracking-wider mb-2 shadow-2xs">
                        <Users className="w-3.5 h-3.5 text-teal-600" />
                        <span>HIPAA & DPA Protected Health Information</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        Clinical{' '}
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600">
                            Patient Records
                        </span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                        {isCaregiver
                            ? 'View clinical records and vital signs monitoring for patients assigned to your care.'
                            : isParentOrGuardian
                            ? 'Register family members, manage patient records, and assign caregivers.'
                            : 'Manage patient admissions and view assigned medical charts.'}
                    </p>
                </div>
            </div>

            {/* Everything in Patient Records is PHI and requires DB Break-Glass if SysAdmin */}
            <BreakGlassWrapper targetHub="Patient Records Hub">
                <Tabs defaultValue={defaultTab} className="w-full flex-1 flex flex-col min-h-0">
                    {tabCount > 1 && (
                        <div className="mb-6 shrink-0">
                            <TabsList className="bg-teal-50/60 p-1.5 rounded-2xl border border-teal-100/90 inline-flex gap-2 overflow-x-auto h-auto">
                                {canSeeOnboarding && (
                                    <TabsTrigger 
                                        value="onboarding" 
                                        className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                                    >
                                        <UserPlus className="w-3.5 h-3.5 text-teal-600" /> {onboardingTabLabel}
                                    </TabsTrigger>
                                )}

                                {canSeeAssigned && (
                                    <TabsTrigger 
                                        value="sys-assigned" 
                                        className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                                    >
                                        <Users className="w-3.5 h-3.5 text-teal-600" /> {assignedTabLabel}
                                    </TabsTrigger>
                                )}

                                {canSeeUnassigned && (
                                    <TabsTrigger 
                                        value="sys-unassigned" 
                                        className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-sm data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                                    >
                                        <UserCheck className="w-3.5 h-3.5 text-teal-600" /> Unassigned Patients
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
                            <SystemAdminPatientDirectory mode="assigned" onSelectPatient={setSelectedPatient} />
                        </TabsContent>
                    )}

                    {canSeeUnassigned && (
                        <TabsContent value="sys-unassigned" className="mt-0 flex-1 min-h-[500px] outline-none">
                            <SystemAdminPatientDirectory mode="unassigned" onSelectPatient={setSelectedPatient} />
                        </TabsContent>
                    )}
                </Tabs>
            </BreakGlassWrapper>
        </div>
    );
}
