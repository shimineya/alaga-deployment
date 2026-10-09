import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth-context';
import { useCaregiverLanguage } from '@/lib/caregiver-language-context';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Settings, Sliders, ShieldCheck } from 'lucide-react';

import { CaregiverSettings } from '../CaregiverSettings';
import SystemSettings from '../admin/SystemSettings';
import FacilityComplianceControls from '../sysadmin/FacilityComplianceControls';
import UserProfile from '../sysadmin/UserProfile';
import { ConsentAgreementModal } from '../compliance/ConsentAgreementModal';

export default function SettingsHub() {
    const { user, permissions } = useAuth();
    const { t } = useCaregiverLanguage();
    const [searchParams, setSearchParams] = useSearchParams();
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
    const canSeeLegal = true; // Accessible to all users: parents, caregivers, medical staff, admins

    const [showLegalModal, setShowLegalModal] = React.useState(false);

    const tabCount = [canSeeAccount, canSeePreferences, canSeeLegal, canSeeSystemSettings, canSeeCompliance].filter(Boolean).length;
    
    const tabParam = searchParams.get('tab');
    const validTabs = [
        canSeeAccount ? 'account' : null,
        canSeePreferences ? 'profile' : null,
        canSeeLegal ? 'legal' : null,
        canSeeSystemSettings ? 'system' : null,
        canSeeCompliance ? 'compliance' : null,
    ].filter(Boolean) as string[];

    const activeTab = tabParam && validTabs.includes(tabParam)
        ? tabParam
        : (validTabs[0] || 'account');

    const handleTabChange = (val: string) => {
        setSearchParams({ tab: val });
    };

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
                <p className="text-sm text-slate-500 mt-1">{t('Manage your account profile, personal preferences, legal consents, and overarching system parameters.', 'Pamahalaan ang iyong profile sa account, mga personal na kagustuhan, mga legal na pahintulot, at pangkalahatang mga parameter ng system.')}</p>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full flex-1 flex flex-col min-h-0">
                {tabCount > 1 && (
                <div className="mb-4 sm:mb-6 shrink-0 overflow-x-auto no-scrollbar touch-scroll -mx-1 px-1 sm:mx-0 sm:px-0">
                    <TabsList className="bg-teal-50/60 p-1.5 rounded-2xl border border-teal-100/90 inline-flex gap-2 flex-nowrap w-max max-w-none">
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

                        {canSeeLegal && (
                            <TabsTrigger 
                                value="legal" 
                                className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 data-[state=active]:bg-white data-[state=active]:text-teal-900 data-[state=active]:shadow-xs data-[state=active]:border data-[state=active]:border-teal-200/80 flex items-center gap-2 transition-all alaga-btn-tactile whitespace-nowrap"
                            >
                                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" /> {t('Legal & Consents', 'Legal at Mga Pahintulot')}
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

                {canSeeLegal && (
                    <TabsContent value="legal" className="mt-0 flex-1 min-h-[500px] outline-none">
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs max-w-4xl space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                                <div>
                                    <h2 className="text-base font-bold text-slate-800">Legal Agreements &amp; Clinical Consents</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Review the binding terms, Philippine Republic Act 10173 data privacy disclosures, AI non-diagnostic disclaimers, and continuous telemetry authorizations governing your ALAGA account.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowLegalModal(true)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 transition-colors shrink-0 shadow-xs flex items-center gap-1.5"
                                >
                                    <ShieldCheck className="w-3.5 h-3.5" />
                                    Read Full Legal Forms
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                                        Platform Terms and Conditions
                                    </div>
                                    <p className="text-[11px] text-slate-600 leading-relaxed">
                                        Governs platform usage, auxiliary monitoring hardware limitations, account security obligations, and service availability.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                                        Platform Privacy Policy (RA 10173)
                                    </div>
                                    <p className="text-[11px] text-slate-600 leading-relaxed">
                                        Outlines lawful handling of Sensitive Personal Information (SPI) under Philippine Data Privacy Act and HIPAA standards with AES-256 / TLS 1.3 encryption.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                                        Informed Health Data &amp; Telemetry Consent
                                    </div>
                                    <p className="text-[11px] text-slate-600 leading-relaxed">
                                        Explicit authorization for continuous optical biometric tracking (heart rate, SpO2), body temperature, and smart diaper moisture detection.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
                                    <div className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                                        AI Assistive Decision-Support Disclaimer
                                    </div>
                                    <p className="text-[11px] text-slate-600 leading-relaxed">
                                        Clinical safeguard establishing that Machine Learning algorithms (One-Class SVM) and rule triggers are assistive tools, not independent diagnostic devices.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Read-Only Consent Viewer Modal */}
                        {showLegalModal && (
                            <ConsentAgreementModal
                                isOpen={showLegalModal}
                                isReadOnly={true}
                                userRole={role}
                                authToken={localStorage.getItem('token')}
                                onAccepted={() => setShowLegalModal(false)}
                                onClose={() => setShowLegalModal(false)}
                            />
                        )}
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
