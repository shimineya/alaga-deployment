import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Contact, Link2 } from 'lucide-react';

import WardStaffManagement from '../facility-admin/WardStaffManagement';
import PatientCaregiverAssignment from '../facility-admin/PatientCaregiverAssignment';
import { AssignmentTracker } from '../AssignmentTracker';
import { BreakGlassWrapper } from '../security/BreakGlassWrapper';

export default function StaffManagementHub() {
    const { user, permissions, isSysAdmin } = useAuth();
    const role = user?.role?.toLowerCase() || '';

    // Authorizations
    const isAdminTier  = isSysAdmin || ['system_admin', 'admin', 'sysadmin'].includes(role);
    const isFacilityAdmin = role === 'facility_admin';
    const isClinical   = ['caregiver', 'medical_staff'].includes(role);

    // [OWASP A01 / RBAC] Override-aware visibility helper
    const hasPermission = (moduleId: string, roleDefault: boolean): boolean => {
        if (isAdminTier) return true;
        if (Object.prototype.hasOwnProperty.call(permissions, moduleId)) {
            return permissions[moduleId];
        }
        return roleDefault;
    };

    // Visibilities
    const canSeeWardStaff        = hasPermission('ward-staff',          isFacilityAdmin || isAdminTier);
    const canSeeAssignmentsAdmin = hasPermission('patient-assignments',  isFacilityAdmin || isAdminTier);
    const canSeeMyAssignments    = hasPermission('patient-assignments',  isClinical);

    const tabCount = [canSeeWardStaff, canSeeAssignmentsAdmin, canSeeMyAssignments].filter(Boolean).length;
    
    let defaultTab = 'ward-staff';
    if (!canSeeWardStaff && canSeeMyAssignments) defaultTab = 'my-assignments';
    else if (!canSeeWardStaff && canSeeAssignmentsAdmin) defaultTab = 'admin-assignments';

    return (
        <div className="w-full h-full animate-in fade-in duration-300 flex flex-col">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">User Management</h1>
                <p className="text-sm text-slate-500 mt-1">Manage medical personnel and delegate care relationships.</p>
            </div>

            <Tabs defaultValue={defaultTab} className="w-full flex-1 flex flex-col min-h-0">
                {tabCount > 1 && (
                <div className="border-b border-slate-200 mb-6 shrink-0">
                    <TooltipProvider delayDuration={300}>
                        <TabsList className="bg-transparent h-12 p-0 flex gap-6 justify-start overflow-x-auto">
                            {canSeeWardStaff && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <TabsTrigger 
                                            value="ward-staff" 
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                        >
                                            <Contact className="w-4 h-4" /> Department Staff
                                        </TabsTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl max-w-[250px]">
                                        <p className="text-xs">Manage medical personnel, unlock accounts, and reset passwords.</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}

                            {(canSeeAssignmentsAdmin || canSeeMyAssignments) && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <TabsTrigger 
                                            value={canSeeMyAssignments ? "my-assignments" : "admin-assignments"}
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-amber-500 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-amber-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                        >
                                            <Link2 className="w-4 h-4" /> {canSeeMyAssignments ? 'My Care Assignments (PHI)' : 'Patient Assignments (PHI)'}
                                        </TabsTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl max-w-[250px]">
                                        <p className="text-xs">Delegate care relationships between staff and patients. <span className="font-bold text-amber-300">Contains PHI.</span></p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </TabsList>
                    </TooltipProvider>
                </div>
                )}

                {canSeeWardStaff && (
                    <TabsContent value="ward-staff" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <WardStaffManagement />
                    </TabsContent>
                )}

                {(canSeeAssignmentsAdmin || canSeeMyAssignments) && (
                    <TabsContent value={canSeeMyAssignments ? "my-assignments" : "admin-assignments"} className="mt-0 flex-1 min-h-[500px] outline-none">
                        <BreakGlassWrapper targetHub="Staff Management - Assignments">
                            {canSeeMyAssignments 
                                ? <AssignmentTracker /> 
                                : <PatientCaregiverAssignment />
                            }
                        </BreakGlassWrapper>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
