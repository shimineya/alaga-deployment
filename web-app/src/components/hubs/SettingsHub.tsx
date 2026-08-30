import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { useCaregiverLanguage } from '@/lib/caregiver-language-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Settings, Sliders, ShieldCheck } from 'lucide-react';

import { CaregiverSettings } from '../CaregiverSettings';
import SystemSettings from '../admin/SystemSettings';
import FacilityComplianceControls from '../sysadmin/FacilityComplianceControls';
import UserProfile from '../sysadmin/UserProfile';

export default function SettingsHub() {
    const { user, permissions } = useAuth();
    const { t } = useCaregiverLanguage();
    const role = user?.role?.toLowerCase() || '';

    // Authorizations
    const isSysAdmin = ['system_admin', 'admin', 'sysadmin'].includes(role);
    const isFacilityAdmin = role === 'facility_admin';
    // [OWASP A01] 'parent' is the consumer-facing home-monitoring role.
    // Parent gets Account Profile and Preferences tabs only.
    // System Overrides and Compliance are facility/admin-tier only — not surfaced to parents.
    const isClinical = ['caregiver', 'medical_staff', 'parent'].includes(role);

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
                <h1 className="text-2xl font-bold text-slate-800 tracking-tight">{t('System Settings', 'Mga Setting ng System')}</h1>
                <p className="text-sm text-slate-500 mt-1">{t('Manage your account profile, personal preferences, and overarching system parameters.', 'Pamahalaan ang iyong profile sa account, mga personal na kagustuhan, at pangkalahatang mga parameter ng system.')}</p>
            </div>

            <Tabs defaultValue={defaultTab} className="w-full flex-1 flex flex-col min-h-0">
                {tabCount > 1 && (
                <div className="border-b border-slate-200 mb-6 shrink-0">
                    <TabsList className="bg-transparent h-12 p-0 flex gap-6 justify-start overflow-x-auto">
                        {canSeeAccount && (
                            <TabsTrigger 
                                value="account" 
                                className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                            >
                                <Settings className="w-4 h-4" /> {t('Account Profile', 'Profile ng Account')}
                            </TabsTrigger>
                        )}

                        {canSeePreferences && (
                            <TabsTrigger 
                                value="profile" 
                                className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                            >
                                <Sliders className="w-4 h-4" /> {t('Preferences', 'Mga Kagustuhan')}
                            </TabsTrigger>
                        )}

                        {canSeeSystemSettings && (
                            <TabsTrigger 
                                value="system" 
                                className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                            >
                                <Sliders className="w-4 h-4" /> {t('System Overrides', 'Mga Pag-override sa System')}
                            </TabsTrigger>
                        )}

                        {canSeeCompliance && (
                            <TabsTrigger 
                                value="compliance" 
                                className="rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                            >
                                <ShieldCheck className="w-4 h-4" /> {t('Privacy & Compliance', 'Privacy at Pagsunod')}
                            </TabsTrigger>
                        )}
                    </TabsList>
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
