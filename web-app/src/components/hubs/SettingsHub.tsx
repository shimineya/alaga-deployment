import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Settings, Sliders, ShieldCheck } from 'lucide-react';

import { CaregiverSettings } from '../CaregiverSettings';
import SystemSettings from '../admin/SystemSettings';
import FacilityComplianceControls from '../sysadmin/FacilityComplianceControls';
import UserProfile from '../sysadmin/UserProfile';

export default function SettingsHub() {
    const { user, permissions } = useAuth();
    const role = user?.role?.toLowerCase() || '';

    // Authorizations
    const isSysAdmin = ['system_admin', 'admin', 'sysadmin'].includes(role);
    const isFacilityAdmin = role === 'facility_admin';
    const isClinical = ['caregiver', 'medical_staff'].includes(role);

    // Visibilities (Based on RBAC or role defaults)
    const canSeeAccount = isSysAdmin || (permissions && permissions['settings_profile'] !== false) || isClinical || isFacilityAdmin;
    const canSeePreferences = isSysAdmin || (permissions && permissions['settings_preferences'] !== false) || isClinical || isFacilityAdmin;
    const canSeeSystemSettings = isFacilityAdmin || isSysAdmin;
    const canSeeCompliance = isFacilityAdmin || isSysAdmin;

    const tabCount = [canSeeAccount, canSeePreferences, canSeeSystemSettings, canSeeCompliance].filter(Boolean).length;
    
    let defaultTab = 'account';

    return (
        <div className="w-full h-full animate-in fade-in duration-300 flex flex-col">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">System Settings</h1>
                <p className="text-sm text-slate-500 mt-1">Manage your account profile, personal preferences, and overarching system parameters.</p>
            </div>

            <Tabs defaultValue={defaultTab} className="w-full flex-1 flex flex-col min-h-0">
                {tabCount > 1 && (
                <div className="border-b border-slate-200 mb-6 shrink-0">
                    <TooltipProvider delayDuration={300}>
                        <TabsList className="bg-transparent h-12 p-0 flex gap-6 justify-start overflow-x-auto">
                            {canSeeAccount && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <TabsTrigger 
                                            value="account" 
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                        >
                                            <Settings className="w-4 h-4" /> Account Profile
                                        </TabsTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl max-w-[250px]">
                                        <p className="text-xs">Update your username, password, email, and contact number.</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}

                            {canSeePreferences && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <TabsTrigger 
                                            value="profile" 
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                        >
                                            <Sliders className="w-4 h-4" /> Preferences
                                        </TabsTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl max-w-[250px]">
                                        <p className="text-xs">Update your alert tones, visual settings, and calibration baselines.</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}

                            {canSeeSystemSettings && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <TabsTrigger 
                                            value="system" 
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                        >
                                            <Sliders className="w-4 h-4" /> System Overrides
                                        </TabsTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl max-w-[250px]">
                                        <p className="text-xs">Global configurations, maintenance mode, and application behavior.</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}

                            {canSeeCompliance && (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <TabsTrigger 
                                            value="compliance" 
                                            className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-none h-12 px-2 text-sm font-semibold text-slate-500 data-[state=active]:text-teal-700 flex items-center gap-2 transition-all hover:text-slate-700 whitespace-nowrap"
                                        >
                                            <ShieldCheck className="w-4 h-4" /> Privacy & Compliance
                                        </TabsTrigger>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" className="bg-slate-800 text-white border-none shadow-xl max-w-[250px]">
                                        <p className="text-xs">Data Privacy Act (DPA) limits, GDPR data retention, and security baselines.</p>
                                    </TooltipContent>
                                </Tooltip>
                            )}
                        </TabsList>
                    </TooltipProvider>
                </div>
                )}

                {canSeeAccount && (
                    <TabsContent value="account" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <UserProfile />
                    </TabsContent>
                )}

                {canSeePreferences && (
                    <TabsContent value="profile" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <CaregiverSettings />
                    </TabsContent>
                )}

                {canSeeSystemSettings && (
                    <TabsContent value="system" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <SystemSettings />
                    </TabsContent>
                )}

                {canSeeCompliance && (
                    <TabsContent value="compliance" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <FacilityComplianceControls />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
