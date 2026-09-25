import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import { GlobalNotificationBell } from '../GlobalNotificationBell';
import { UserManualButton } from '../UserManualButton';
import { InteractiveOnboardingTutorial } from '../InteractiveOnboardingTutorial';
import { useAuth } from '@/lib/auth-context';
import { useAlertSync } from '@/hooks/useAlertSync';
import { Building2, Home, Volume2, VolumeX } from 'lucide-react';

export default function MainLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();
  const { isMuted, toggleMute, isConnected } = useAlertSync();

  const role = (user?.role || '').toLowerCase();
  const isFacilityRelevantRole = ['caregiver', 'medical_staff', 'facility_admin', 'parent'].includes(role);
  const facilityName = user?.facility_name;

  return (
    <div className="flex h-screen alaga-ambient-bg font-sans selection:bg-teal-100 selection:text-teal-900 overflow-hidden">
      {/* Role-tailored interactive onboarding tutorial */}
      <InteractiveOnboardingTutorial />

      {/* Sidebar - collapsible with landing page deep teal-navy border */}
      <div className={`${isCollapsed ? 'w-16' : 'w-64'} h-full shrink-0 shadow-xl shadow-teal-950/10 z-20 transition-all duration-300`}>
        <AppSidebar collapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-15 border-b border-teal-100/90 bg-white/80 backdrop-blur-md px-6 flex items-center justify-between shrink-0 z-10 shadow-xs">
          {/* Left: Branding & Real-time Sensor Status */}
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 text-slate-800 text-xs font-bold">
              <img src="/alaga-robot-logo.png" alt="Alaga" className="w-5 h-5 object-contain" />
              <span className="w-2 h-2 rounded-full bg-emerald-500 alaga-streaming-radar" />
              <span className="tracking-tight">ALAGA Smart Healthcare Portal</span>
            </div>
            <span className="hidden md:inline-block text-[11px] font-semibold text-slate-500">
              Continuous IoT Diaper & Vitals Telemetry
            </span>
          </div>

          {/* Right: Facility Affiliation Badge + Quick Actions & Notifications */}
          <div className="flex items-center gap-3">
            {isFacilityRelevantRole && (
              facilityName ? (
                <div 
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50/90 border border-blue-200/90 text-blue-900 text-xs font-bold shadow-2xs"
                  title={`Registered under healthcare facility: ${facilityName}`}
                >
                  <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate max-w-[200px] md:max-w-[280px]">{facilityName}</span>
                </div>
              ) : (role === 'caregiver' || role === 'parent') ? (
                <div 
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/90 border border-slate-200/90 text-slate-700 text-xs font-medium"
                  title="Operating in independent home care mode (no hospital facility linked)"
                >
                  <Home className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Independent / Home Care</span>
                </div>
              ) : null
            )}
            {/* Real-time Synchronized Sound Toggle (Web & Mobile) */}
            <button
              onClick={() => toggleMute()}
              title={isMuted ? "Alert audio is muted across all devices. Click to unmute." : "Alert audio is active and synchronized in real time with mobile phone. Click to mute."}
              className={`p-2 rounded-xl border transition-all duration-200 flex items-center gap-1.5 text-xs font-semibold ${
                isMuted
                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-amber-600" /> : <Volume2 className="w-4 h-4 text-emerald-600" />}
              <span className="hidden lg:inline text-[11px] font-bold">
                {isMuted ? 'Audio Muted' : 'Audio Synced'}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500 alaga-streaming-radar' : 'bg-amber-400'}`} title={isConnected ? 'Real-time sync active' : 'Connecting real-time sync...'} />
            </button>
            <UserManualButton />
            <GlobalNotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scroll-smooth">
          <div className="w-full min-h-full pb-20 max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
