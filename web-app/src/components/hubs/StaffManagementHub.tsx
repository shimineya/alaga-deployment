import React from 'react';
import { Navigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Contact, Link2, Activity, Cpu, Database } from 'lucide-react';

import WardStaffManagement from '../facility-admin/WardStaffManagement';
import PatientCaregiverAssignment from '../facility-admin/PatientCaregiverAssignment';
import { AssignmentTracker } from '../AssignmentTracker';
import ParentCareTeamManagement from '../ParentCareTeamManagement';
import { BreakGlassWrapper } from '../security/BreakGlassWrapper';
import FacilityAdminAssignmentCommandCenter from '../facility-admin/FacilityAdminAssignmentCommandCenter';
import SystemAdminAssignmentCommandCenter from '../sysadmin/SystemAdminAssignmentCommandCenter';
import FacilityTopologyBuilder from '../sysadmin/FacilityTopologyBuilder';
import SystemAdminUserList from '../sysadmin/SystemAdminUserList';

export default function StaffManagementHub() {
    const { user, permissions, isSysAdmin } = useAuth();
    const role = user?.role?.toLowerCase() || '';

    // [OWASP A01] Caregiver and Medical Staff are not allowed in this admin/parent area.
    if (role === 'caregiver' || role === 'medical_staff') {
        return <Navigate to="/dashboard" replace />;
    }

    // Authorizations
    const isAdminTier  = isSysAdmin || ['system_admin', 'admin', 'sysadmin'].includes(role);
    const isFacilityAdmin = role === 'facility_admin';
    // [OWASP A01] 'parent' is the consumer-facing home-monitoring role.
    // Parent sees 'My Care Assignments' tab (read-only: who is caring for their child).
    // Parent does NOT see Ward Staff Management — that is a facility-level admin function.
    const isClinical   = ['caregiver', 'medical_staff', 'parent'].includes(role);

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
    const canSeeCommandCenter    = isFacilityAdmin;
    const canSeeSysCommandCenter = isAdminTier;

    const tabCount = [canSeeWardStaff, canSeeAssignmentsAdmin, canSeeMyAssignments, canSeeCommandCenter, canSeeSysCommandCenter].filter(Boolean).length;
    
    let defaultTab = 'ward-staff';
    if (!canSeeWardStaff && canSeeMyAssignments) defaultTab = 'my-assignments';
    else if (!canSeeWardStaff && canSeeAssignmentsAdmin) defaultTab = 'admin-assignments';
    else if (!canSeeWardStaff && !canSeeAssignmentsAdmin && canSeeCommandCenter) defaultTab = 'assignment-command-center';

    return (
        <div className="w-full h-full animate-in fade-in duration-300 flex flex-col">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">User Management</h1>
                <p className="text-sm text-slate-500 mt-1">Manage medical personnel and delegate care relationships.</p>
            </div>

            <Tabs defaultValue={defaultTab} className="w-full flex-1 flex flex-col min-h-0">
                {tabCount > 1 && (
                <div className="border-b border-slate-200 mb-6 shrink-0">
                    <TabsList className="bg-transparent h-12 p-0 flex gap-6 justify-start overflow-x-auto">
                        {canSeeWardStaff && (
                            <TabsTrigger 
                                value="ward-staff" 
                                className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                            >
                                <Contact className="w-4 h-4" /> {canSeeSysCommandCenter ? 'User List' : 'Department Staff'}
                            </TabsTrigger>
                        )}

                        {canSeeCommandCenter && (
                            <TabsTrigger 
                                value="assignment-command-center" 
                                className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                            >
                                <Activity className="w-4 h-4" /> Assignment Command Center
                            </TabsTrigger>
                        )}

                        {canSeeSysCommandCenter && (
                            <TabsTrigger 
                                value="sys-assignment-command-center" 
                                className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                            >
                                <Activity className="w-4 h-4" /> System Assignment Command Center
                            </TabsTrigger>
                        )}

                        {canSeeSysCommandCenter && (
                            <TabsTrigger 
                                value="sys-network-topology" 
                                className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                            >
                                <Database className="w-4 h-4" /> Network Topology
                            </TabsTrigger>
                        )}

                        {((canSeeAssignmentsAdmin || canSeeMyAssignments) && !canSeeSysCommandCenter) && (
                            <TabsTrigger 
                                value={canSeeMyAssignments ? "my-assignments" : "admin-assignments"}
                                className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                            >
                                <Link2 className="w-4 h-4" /> {canSeeMyAssignments ? 'My Care Assignments (PHI)' : 'Patient Assignments (PHI)'}
                            </TabsTrigger>
                        )}
                    </TabsList>
                </div>
                )}

                {canSeeWardStaff && (
                    <TabsContent value="ward-staff" className="mt-0 flex-1 min-h-[500px] outline-none">
                        {canSeeSysCommandCenter ? <SystemAdminUserList /> : <WardStaffManagement />}
                    </TabsContent>
                )}

                {canSeeCommandCenter && (
                    <TabsContent value="assignment-command-center" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <FacilityAdminAssignmentCommandCenter />
                    </TabsContent>
                )}

                {canSeeSysCommandCenter && (
                    <TabsContent value="sys-assignment-command-center" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <SystemAdminAssignmentCommandCenter />
                    </TabsContent>
                )}

                {canSeeSysCommandCenter && (
                    <TabsContent value="sys-network-topology" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <FacilityTopologyBuilder />
                    </TabsContent>
                )}

                {((canSeeAssignmentsAdmin || canSeeMyAssignments) && !canSeeSysCommandCenter) && (
                    <TabsContent value={canSeeMyAssignments ? "my-assignments" : "admin-assignments"} className="mt-0 flex-1 min-h-[500px] outline-none">
                        <BreakGlassWrapper targetHub="Staff Management - Assignments">
                            {canSeeMyAssignments 
                                ? (role === 'parent' ? <ParentCareTeamManagement /> : <AssignmentTracker />) 
                                : <PatientCaregiverAssignment />
                            }
                        </BreakGlassWrapper>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
