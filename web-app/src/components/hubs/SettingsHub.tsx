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
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50/90 border border-teal-200/90 text-teal-800 text-[11px] font-black uppercase tracking-wider mb-2 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
                    Configuration & Governance
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">
                    {t('System', 'Sistema')} <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600">{t('Settings', 'Mga Setting')}</span>
                </h1>
                <p className="text-sm text-slate-500 mt-1">{t('Manage your account profile, personal preferences, and overarching system parameters.', 'Pamahalaan ang iyong profile sa account, mga personal na kagustuhan, at pangkalahatang mga parameter ng system.')}</p>
            </div>

            <Tabs defaultValue={defaultTab} className="w-full flex-1 flex flex-col min-h-0">
                {tabCount > 1 && (
                <div className="mb-6 shrink-0">
                    <TabsList className="bg-teal-50/60 p-1.5 rounded-2xl border border-teal-100/90 inline-flex gap-2 overflow-x-auto h-auto">
                        {canSeeAccount && (
                            <TabsTrigger 
                                value="account" 
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <Settings className="w-3.5 h-3.5 text-teal-600" /> {t('Account Profile', 'Profile ng Account')}
                            </TabsTrigger>
                        )}

                        {canSeePreferences && (
                            <TabsTrigger 
                                value="profile" 
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <Sliders className="w-3.5 h-3.5 text-teal-600" /> {t('Preferences', 'Mga Kagustuhan')}
                            </TabsTrigger>
                        )}

                        {canSeeSystemSettings && (
                            <TabsTrigger 
                                value="system" 
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <Sliders className="w-3.5 h-3.5 text-emerald-600" /> {t('System Overrides', 'Mga Pag-override sa System')}
                            </TabsTrigger>
                        )}

                        {canSeeCompliance && (
                            <TabsTrigger 
                                value="compliance" 
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <ShieldCheck className="w-3.5 h-3.5 text-rose-600" /> {t('Privacy & Compliance', 'Privacy at Pagsunod')}
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
