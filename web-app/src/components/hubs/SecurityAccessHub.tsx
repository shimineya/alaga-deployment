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
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Security & Access Identity</h1>
                <p className="text-sm text-slate-500 mt-1">Review access controls, perform forensic audits, and monitor global threat matrices.</p>
            </div>

            <Tabs defaultValue={defaultTab} className="w-full flex-1 flex flex-col min-h-0">
                {tabCount > 1 && (
                <div className="border-b border-slate-200 mb-6 shrink-0">
                    <TooltipProvider delayDuration={300}>
                        <TabsList className="bg-transparent h-12 p-0 flex gap-6 justify-start overflow-x-auto">
                            {canSeeSystemSecurity && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <TabsTrigger 
                                            value="siem" 
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                        >
                                            <ShieldAlert className="w-4 h-4" /> Security Operations
                                        </TabsTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl max-w-[250px]">
                                        <p className="text-xs">Monitor global threat matrices and brute force attempts.</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}

                            {canSeeAuditTrails && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <TabsTrigger 
                                            value="audit" 
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                        >
                                            <FileJson className="w-4 h-4" /> Forensic Audit Trails
                                        </TabsTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl max-w-[250px]">
                                        <p className="text-xs">Trace actions, break-glass events, and API invocations for HIPAA compliance.</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}

                            {canSeeRBACManager && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <TabsTrigger 
                                            value="rbac" 
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                        >
                                            <SlidersHorizontal className="w-4 h-4" /> User Permissions Manager
                                        </TabsTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl max-w-[250px]">
                                        <p className="text-xs">Toggle which pages and features each individual user can access.</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </TabsList>
                    </TooltipProvider>
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
