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
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50/90 border border-teal-200/90 text-teal-800 text-[11px] font-black uppercase tracking-wider mb-2 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                    Personnel & Access Control
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                    Staff & Care <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600">Assignments</span>
                </h1>
                <p className="text-sm text-slate-500 mt-1">Manage medical personnel, facility topology, and care team delegations.</p>
            </div>

            <Tabs defaultValue={defaultTab} className="w-full flex-1 flex flex-col min-h-0">
                {tabCount > 1 && (
                <div className="mb-6 shrink-0">
                    <TabsList className="bg-teal-50/60 p-1.5 rounded-2xl border border-teal-100/90 inline-flex gap-2 overflow-x-auto h-auto">
                        {canSeeWardStaff && (
                            <TabsTrigger 
                                value="ward-staff" 
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <Contact className="w-3.5 h-3.5 text-teal-600" /> {canSeeSysCommandCenter ? 'User Directory' : 'Department Staff'}
                            </TabsTrigger>
                        )}

                        {canSeeCommandCenter && (
                            <TabsTrigger 
                                value="assignment-command-center" 
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <Activity className="w-3.5 h-3.5 text-emerald-600" /> Assignment Command Center
                            </TabsTrigger>
                        )}

                        {canSeeSysCommandCenter && (
                            <TabsTrigger 
                                value="sys-assignment-command-center" 
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <Activity className="w-3.5 h-3.5 text-emerald-600" /> System Command Center
                            </TabsTrigger>
                        )}

                        {canSeeSysCommandCenter && (
                            <TabsTrigger 
                                value="sys-network-topology" 
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <Database className="w-3.5 h-3.5 text-teal-600" /> Network Topology
                            </TabsTrigger>
                        )}

                        {((canSeeAssignmentsAdmin || canSeeMyAssignments) && !canSeeSysCommandCenter) && (
                            <TabsTrigger 
                                value={canSeeMyAssignments ? "my-assignments" : "admin-assignments"}
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <Link2 className="w-3.5 h-3.5 text-teal-600" /> {canSeeMyAssignments ? 'My Care Assignments (PHI)' : 'Patient Assignments (PHI)'}
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
