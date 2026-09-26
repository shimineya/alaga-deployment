import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import { GlobalNotificationBell } from '../GlobalNotificationBell';
import { UserManualButton } from '../UserManualButton';
import { InteractiveOnboardingTutorial } from '../InteractiveOnboardingTutorial';
import { useAuth } from '@/lib/auth-context';
import { useAlertSync } from '@/hooks/useAlertSync';
import { Building2, Home, Volume2, VolumeX, Menu } from 'lucide-react';

export default function MainLayout() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const { user } = useAuth();
  const { isMuted, toggleMute, isConnected } = useAlertSync();

  const role = (user?.role || '').toLowerCase();
  const isFacilityRelevantRole = ['caregiver', 'medical_staff', 'facility_admin', 'parent'].includes(role);
  const facilityName = user?.facility_name;

  return (
    <div className="flex h-screen alaga-ambient-bg font-sans selection:bg-teal-100 selection:text-teal-900 overflow-hidden">
      {/* Role-tailored interactive onboarding tutorial */}
      <InteractiveOnboardingTutorial />

      {/* Desktop Sidebar - collapsible (hidden on screens < lg) */}
      <div className={`hidden lg:block ${isCollapsed ? 'w-16' : 'w-64'} h-full shrink-0 shadow-xl shadow-teal-950/10 z-20 transition-all duration-300`}>
        <AppSidebar collapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
      </div>

      {/* Mobile Off-Canvas Drawer (visible on screens < lg when opened) */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-all duration-300 ${
          isMobileDrawerOpen ? 'visible pointer-events-auto' : 'invisible pointer-events-none'
        }`}
      >
        {/* Dark Backdrop */}
        <div
          className={`fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-300 ${
            isMobileDrawerOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={() => setIsMobileDrawerOpen(false)}
          aria-hidden="true"
        />

        {/* Sliding Sidebar Container */}
        <div
          className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] h-full bg-[#061126] shadow-2xl transition-transform duration-300 ease-in-out transform ${
            isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <AppSidebar
            isMobile={true}
            onClose={() => setIsMobileDrawerOpen(false)}
          />
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
        <header className="h-14 sm:h-15 border-b border-teal-100/90 bg-white/80 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between shrink-0 z-10 shadow-xs">
          {/* Left: Mobile Toggle & Branding */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile Menu Hamburger (Visible < lg) */}
            <button
              onClick={() => setIsMobileDrawerOpen(true)}
              className="lg:hidden p-1.5 -ml-1 text-slate-700 hover:text-teal-900 hover:bg-teal-50 rounded-xl transition-colors shrink-0"
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5 text-slate-700" />
            </button>

            <div className="inline-flex items-center gap-1.5 sm:gap-2 text-slate-800 text-xs font-bold truncate">
              <img src="/alaga-robot-logo.png" alt="Alaga" className="w-5 h-5 object-contain shrink-0" />
              <span className="w-2 h-2 rounded-full bg-emerald-500 alaga-streaming-radar shrink-0" />
              <span className="tracking-tight truncate hidden sm:inline">ALAGA Smart Healthcare Portal</span>
              <span className="tracking-tight truncate sm:hidden font-black text-teal-950">ALAGA</span>
            </div>
            <span className="hidden xl:inline-block text-[11px] font-semibold text-slate-500 truncate">
              Continuous IoT Diaper & Vitals Telemetry
            </span>
          </div>

          {/* Right: Facility Affiliation Badge + Quick Actions & Notifications */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {isFacilityRelevantRole && (
              facilityName ? (
                <div 
                  className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50/90 border border-blue-200/90 text-blue-900 text-xs font-bold shadow-2xs"
                  title={`Registered under healthcare facility: ${facilityName}`}
                >
                  <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate max-w-[140px] lg:max-w-[220px]">{facilityName}</span>
                </div>
              ) : (role === 'caregiver' || role === 'parent') ? (
                <div 
                  className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100/90 border border-slate-200/90 text-slate-700 text-xs font-medium"
                  title="Operating in independent home care mode (no hospital facility linked)"
                >
                  <Home className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Independent Care</span>
                </div>
              ) : null
            )}
            {/* Real-time Synchronized Sound Toggle (Web & Mobile) */}
            <button
              onClick={() => toggleMute()}
              title={isMuted ? "Alert audio is muted across all devices. Click to unmute." : "Alert audio is active and synchronized in real time with mobile phone. Click to mute."}
              className={`p-1.5 sm:p-2 rounded-xl border transition-all duration-200 flex items-center gap-1.5 text-xs font-semibold ${
                isMuted
                  ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-amber-600 shrink-0" /> : <Volume2 className="w-4 h-4 text-emerald-600 shrink-0" />}
              <span className="hidden lg:inline text-[11px] font-bold">
                {isMuted ? 'Audio Muted' : 'Audio Synced'}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isConnected ? 'bg-emerald-500 alaga-streaming-radar' : 'bg-amber-400'}`} title={isConnected ? 'Real-time sync active' : 'Connecting real-time sync...'} />
            </button>
            <UserManualButton />
            <GlobalNotificationBell />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-8 scroll-smooth touch-scroll min-w-0 max-w-full">
          <div className="w-full min-h-full pb-20 max-w-7xl mx-auto min-w-0 overflow-x-hidden">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
