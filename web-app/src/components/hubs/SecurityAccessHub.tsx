import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ShieldAlert, FileJson, SlidersHorizontal } from 'lucide-react';

import GlobalSecuritySIEM from '../sysadmin/GlobalSecuritySIEM';
import ForensicAuditTrails from '../sysadmin/ForensicAuditTrails';
import UserRBACManager from '../sysadmin/UserRBACManager';

export default function SecurityAccessHub() {
    const { user, permissions, isSysAdmin } = useAuth();
    const role = user?.role?.toLowerCase() || '';

    // Authorizations
    const isAdminTier  = isSysAdmin || ['system_admin', 'admin', 'sysadmin'].includes(role);

    // [OWASP A01 / RBAC] Override-aware visibility helper
    const hasPermission = (moduleId: string, roleDefault: boolean): boolean => {
        if (isAdminTier) return true;
        if (Object.prototype.hasOwnProperty.call(permissions, moduleId)) {
            return permissions[moduleId];
        }
        return roleDefault;
    };

    // Visibilities — module IDs match UserRBACManager MODULE_REGISTRY exactly
    // Note: security-operations and rbac_management are sysadmin-only
    const canSeeSystemSecurity   = isAdminTier;
    const canSeeAuditTrails      = hasPermission('audit-logs', isAdminTier);
    const canSeeRBACManager      = isAdminTier;

    const tabCount = [canSeeSystemSecurity, canSeeAuditTrails, canSeeRBACManager].filter(Boolean).length;
    
    let defaultTab = 'siem';
    if (!canSeeSystemSecurity && canSeeAuditTrails) defaultTab = 'audit';
    else if (!canSeeSystemSecurity && !canSeeAuditTrails && canSeeRBACManager) defaultTab = 'rbac';

    return (
        <div className="w-full h-full animate-in fade-in duration-300 flex flex-col">
            <div className="mb-6">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50/90 border border-teal-200/90 text-teal-800 text-[11px] font-black uppercase tracking-wider mb-2 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                    Zero Trust Architecture
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                    Security & Access <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600">Identity</span>
                </h1>
                <p className="text-sm text-slate-500 mt-1">Review access controls, perform forensic audits, and monitor global threat matrices.</p>
            </div>

            <Tabs defaultValue={defaultTab} className="w-full flex-1 flex flex-col min-h-0">
                {tabCount > 1 && (
                <div className="mb-6 shrink-0">
                    <TabsList className="bg-teal-50/60 p-1.5 rounded-2xl border border-teal-100/90 inline-flex gap-2 overflow-x-auto h-auto">
                        {canSeeSystemSecurity && (
                            <TabsTrigger 
                                value="siem" 
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <ShieldAlert className="w-3.5 h-3.5 text-rose-600" /> Security Operations
                            </TabsTrigger>
                        )}

                        {canSeeAuditTrails && (
                            <TabsTrigger 
                                value="audit" 
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <FileJson className="w-3.5 h-3.5 text-teal-600" /> Forensic Audit Trails
                            </TabsTrigger>
                        )}

                        {canSeeRBACManager && (
                            <TabsTrigger 
                                value="rbac" 
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-600" /> User Permissions Manager
                            </TabsTrigger>
                        )}
                    </TabsList>
                </div>
                )}

                {canSeeSystemSecurity && (
                    <TabsContent value="siem" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <GlobalSecuritySIEM />
                    </TabsContent>
                )}

                {canSeeAuditTrails && (
                    <TabsContent value="audit" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <ForensicAuditTrails />
                    </TabsContent>
                )}

                {canSeeRBACManager && (
                    <TabsContent value="rbac" className="mt-0 flex-1 min-h-[600px] outline-none">
                        <UserRBACManager />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
