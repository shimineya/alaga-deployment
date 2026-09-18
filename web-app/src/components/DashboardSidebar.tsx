import React, { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  List,
  FileText,
  Wifi,
  Settings,
  User,
  Activity,
  ClipboardList,
  LogOut,
  ChevronDown,
  Battery,
  Layers,
  RefreshCw,
  Terminal,
  TrendingUp,
  Bell,
  Menu,
  X,
  Calendar as CalendarIcon
} from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../lib/auth-context';
import { useCaregiverLanguage } from '../lib/caregiver-language-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface DashboardSidebarProps {
  activeItem?: string;
  onItemClick?: (item: string) => void;
  userRole?: 'caregiver' | 'medical_staff';
  onOpenCalendar?: () => void;
  alertsCount?: number;
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ activeItem, onItemClick, userRole }) => {
  const { logout } = useAuth();
  const { t } = useCaregiverLanguage();
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false);
  const [isReportsMenuOpen, setIsReportsMenuOpen] = useState(false);

  const caregiverMenuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('Dashboard', 'Dashboard') },
    { id: 'alerts-hub', icon: Bell, label: t('Alerts Hub', 'Alerts Hub') },
    { id: 'patient-list', icon: List, label: t('Patient List', 'Listahan ng Pasyente') },
    { id: 'assignment-tracker', icon: ClipboardList, label: t('Assignments', 'Mga Assignment') },
    { id: 'user-management', icon: Users, label: t('Caregiver Management', 'Pamamahala ng Caregiver') },
    { id: 'reports', icon: FileText, label: t('Reports', 'Mga Report') },
    { id: 'settings', icon: Settings, label: t('Settings', 'Mga Setting') },
    { id: 'profile', icon: User, label: t('Profile', 'Profile') },
  ];

  const reportsSubItems = [
    { id: 'reports-daily-summary', icon: Activity, label: 'Daily Health Summary' },
    { id: 'reports-anomaly-log', icon: Battery, label: 'Anomaly Log (Silence Check)' },
    { id: 'reports-moisture-hygiene', icon: Layers, label: 'Moisture & Hygiene Tracker' },
    { id: 'reports-weekly-trends', icon: TrendingUp, label: 'Weekly Trend Analysis' },
    { id: 'reports-export', icon: FileText, label: 'Exportable Health Report' },
  ];

  const deviceSubItems = [
    { id: 'my-devices', icon: Wifi, label: "Patients' Devices" },
    { id: 'firmware-update', icon: RefreshCw, label: 'Firmware (OTA)' },
    { id: 'diagnostics', icon: Terminal, label: 'Diagnostics' },
  ];

  return (
    <aside className="hidden md:flex w-64 h-screen bg-white border-r border-slate-200/90 flex-col shadow-sm sticky top-0 shrink-0 z-30">
      <div className="p-5 border-b border-slate-200/80 bg-teal-50/40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center shadow-md">
            <Activity className="text-white w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight italic leading-none">ALAGA</h1>
            <span className="text-[10px] font-semibold text-teal-700 tracking-wide uppercase">Healthcare Platform</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-1 px-3">
          {caregiverMenuItems.map((item) => {
            if (item.id === 'user-management') {
              return (
                <li key="device-mgmt-dropdown" className="relative group">
                  <DropdownMenu onOpenChange={setIsDeviceMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`
                          w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                          ${isDeviceMenuOpen ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200' : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <Wifi className={`w-4 h-4 ${isDeviceMenuOpen ? 'text-teal-600' : 'text-slate-500'}`} />
                          <span>Device Management</span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDeviceMenuOpen ? 'rotate-180 text-teal-600' : 'text-slate-400'}`} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="w-56 ml-2 bg-white border-slate-200 shadow-xl p-1 z-50">
                      {deviceSubItems.map((sub) => (
                        <DropdownMenuItem
                          key={sub.id}
                          onClick={() => onItemClick?.(sub.id)}
                          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 cursor-pointer hover:bg-teal-50 hover:text-teal-800 rounded-md transition-colors"
                        >
                          <sub.icon className="w-3.5 h-3.5 text-teal-600" />
                          {sub.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            }

            if (item.id === 'reports' && userRole === 'caregiver') {
              const isReportsActive = activeItem?.startsWith('reports-');
              return (
                <li key="reports-dropdown" className="relative group">
                  <DropdownMenu onOpenChange={setIsReportsMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`
                          w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-semibold transition-all duration-200
                          ${isReportsMenuOpen || isReportsActive ? 'bg-teal-50 text-teal-800 ring-1 ring-teal-200' : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className={`w-4 h-4 ${isReportsMenuOpen || isReportsActive ? 'text-teal-600' : 'text-slate-500'}`} />
                          <span>Reports</span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isReportsMenuOpen ? 'rotate-180 text-teal-600' : 'text-slate-400'}`} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="w-56 ml-2 bg-white border-slate-200 shadow-xl p-1 max-h-[280px] overflow-y-auto z-50">
                      {reportsSubItems.map((sub) => (
                        <DropdownMenuItem
                          key={sub.id}
                          onClick={() => onItemClick?.(sub.id)}
                          className={`flex items-center gap-2 px-3 py-2 text-xs font-medium cursor-pointer rounded-md transition-colors ${activeItem === sub.id ? 'bg-teal-50 text-teal-800 font-semibold' : 'text-slate-700 hover:bg-teal-50 hover:text-teal-800'}`}
                        >
                          <sub.icon className="w-3.5 h-3.5 text-teal-600" />
                          {sub.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            }

            const Icon = item.icon;
            const isActive = activeItem === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onItemClick?.(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200
                    ${isActive ? 'bg-teal-50 text-teal-800 border-l-4 border-teal-600 shadow-sm ring-1 ring-teal-100/80 font-bold' : 'text-slate-700 hover:bg-slate-100/80 hover:text-slate-900'}
                  `}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-700' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-3 border-t border-slate-200/80 bg-slate-50/50">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-slate-700 hover:text-rose-700 hover:bg-rose-50 h-9 font-semibold"
          onClick={() => logout()}
        >
          <LogOut className="w-4 h-4 mr-3 text-slate-500" />
          <span>Sign Out</span>
        </Button>
      </div>
    </aside>
  );
};

// =========================================================================
// MOBILE BOTTOM NAVIGATION BAR (Thumb-Accessible for Phones < 768px)
// =========================================================================
export const MobileBottomNav: React.FC<{
  activeItem?: string;
  onItemClick?: (item: string) => void;
  onOpenDrawer?: () => void;
  onOpenCalendar?: () => void;
  alertsCount?: number;
}> = ({ activeItem, onItemClick, onOpenDrawer, onOpenCalendar, alertsCount = 0 }) => {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-2px_10px_rgba(0,0,0,0.06)] px-2 py-1.5 flex items-center justify-around">
      <button
        onClick={() => onItemClick?.('dashboard')}
        className={`flex flex-col items-center justify-center py-1 px-2.5 min-w-[56px] rounded-lg transition-colors ${
          activeItem === 'dashboard' ? 'text-teal-700 font-bold' : 'text-slate-600 hover:text-slate-900 font-medium'
        }`}
      >
        <LayoutDashboard className={`w-5 h-5 ${activeItem === 'dashboard' ? 'text-teal-600' : 'text-slate-500'}`} />
        <span className="text-[10px] mt-0.5">Home</span>
      </button>

      <button
        onClick={() => onItemClick?.('patient-list')}
        className={`flex flex-col items-center justify-center py-1 px-2.5 min-w-[56px] rounded-lg transition-colors ${
          activeItem === 'patient-list' ? 'text-teal-700 font-bold' : 'text-slate-600 hover:text-slate-900 font-medium'
        }`}
      >
        <List className={`w-5 h-5 ${activeItem === 'patient-list' ? 'text-teal-600' : 'text-slate-500'}`} />
        <span className="text-[10px] mt-0.5">Patients</span>
      </button>

      {onOpenCalendar && (
        <button
          onClick={onOpenCalendar}
          className="flex flex-col items-center justify-center py-1 px-2.5 min-w-[56px] rounded-lg text-slate-600 hover:text-slate-900 font-medium transition-colors"
        >
          <CalendarIcon className="w-5 h-5 text-slate-500" />
          <span className="text-[10px] mt-0.5">Calendar</span>
        </button>
      )}

      <button
        onClick={() => onItemClick?.('alerts-hub')}
        className={`flex flex-col items-center justify-center py-1 px-2.5 min-w-[56px] rounded-lg transition-colors relative ${
          activeItem === 'alerts-hub' ? 'text-teal-700 font-bold' : 'text-slate-600 hover:text-slate-900 font-medium'
        }`}
      >
        <div className="relative">
          <Bell className={`w-5 h-5 ${activeItem === 'alerts-hub' ? 'text-teal-600' : 'text-slate-500'}`} />
          {alertsCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-rose-600 text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
              {alertsCount > 9 ? '9+' : alertsCount}
            </span>
          )}
        </div>
        <span className="text-[10px] mt-0.5">Alerts</span>
      </button>

      <button
        onClick={onOpenDrawer}
        className="flex flex-col items-center justify-center py-1 px-2.5 min-w-[56px] rounded-lg text-slate-600 hover:text-slate-900 font-medium transition-colors"
      >
        <Menu className="w-5 h-5 text-slate-500" />
        <span className="text-[10px] mt-0.5">More</span>
      </button>
    </nav>
  );
};

// =========================================================================
// MOBILE SLIDE-OVER DRAWER (For Secondary Navigation on Phones < 768px)
// =========================================================================
export const MobileNavDrawer: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  activeItem?: string;
  onItemClick?: (item: string) => void;
  userRole?: 'caregiver' | 'medical_staff';
}> = ({ isOpen, onClose, activeItem, onItemClick, userRole = 'caregiver' }) => {
  const { logout, user } = useAuth();

  if (!isOpen) return null;

  const handleSelect = (item: string) => {
    onItemClick?.(item);
    onClose();
  };

  return (
    <div className="md:hidden fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose} 
      />

      {/* Slide-over Content */}
      <div className="relative ml-auto w-4/5 max-w-xs h-full bg-white shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-200">
        <div className="p-4 border-b border-slate-200 bg-teal-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-teal-600 rounded-lg flex items-center justify-center shadow">
              <Activity className="text-white w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 leading-none">ALAGA</h2>
              <span className="text-[10px] text-teal-700 font-semibold">{user?.username || (user as any)?.name || 'Caregiver'}</span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Primary Views</span>
            <ul className="mt-1 space-y-0.5">
              <li>
                <button
                  onClick={() => handleSelect('dashboard')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold ${
                    activeItem === 'dashboard' ? 'bg-teal-50 text-teal-800 font-bold' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 text-teal-600" />
                  <span>Dashboard</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelect('alerts-hub')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold ${
                    activeItem === 'alerts-hub' ? 'bg-teal-50 text-teal-800 font-bold' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Bell className="w-4 h-4 text-rose-600" />
                  <span>Alerts Hub</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelect('patient-list')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold ${
                    activeItem === 'patient-list' ? 'bg-teal-50 text-teal-800 font-bold' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <List className="w-4 h-4 text-teal-600" />
                  <span>Patient List</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelect('assignment-tracker')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold ${
                    activeItem === 'assignment-tracker' ? 'bg-teal-50 text-teal-800 font-bold' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <ClipboardList className="w-4 h-4 text-indigo-600" />
                  <span>Assignments</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelect('user-management')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold ${
                    activeItem === 'user-management' ? 'bg-teal-50 text-teal-800 font-bold' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Users className="w-4 h-4 text-teal-600" />
                  <span>Caregiver Management</span>
                </button>
              </li>
            </ul>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Device Management</span>
            <ul className="mt-1 space-y-0.5">
              <li>
                <button
                  onClick={() => handleSelect('my-devices')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium ${
                    activeItem === 'my-devices' ? 'bg-teal-50 text-teal-800 font-bold' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Wifi className="w-4 h-4 text-slate-500" />
                  <span>Patients' Devices</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelect('firmware-update')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium ${
                    activeItem === 'firmware-update' ? 'bg-teal-50 text-teal-800 font-bold' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <RefreshCw className="w-4 h-4 text-slate-500" />
                  <span>Firmware (OTA)</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelect('diagnostics')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium ${
                    activeItem === 'diagnostics' ? 'bg-teal-50 text-teal-800 font-bold' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Terminal className="w-4 h-4 text-slate-500" />
                  <span>Diagnostics</span>
                </button>
              </li>
            </ul>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Health Reports</span>
            <ul className="mt-1 space-y-0.5">
              <li>
                <button
                  onClick={() => handleSelect('reports-daily-summary')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Activity className="w-4 h-4 text-slate-500" />
                  <span>Daily Health Summary</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelect('reports-anomaly-log')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Battery className="w-4 h-4 text-slate-500" />
                  <span>Anomaly Log</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelect('reports-moisture-hygiene')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <Layers className="w-4 h-4 text-slate-500" />
                  <span>Moisture & Hygiene</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelect('reports-weekly-trends')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <TrendingUp className="w-4 h-4 text-slate-500" />
                  <span>Weekly Trend Analysis</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelect('reports-export')}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span>Exportable Report</span>
                </button>
              </li>
            </ul>
          </div>

          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Account</span>
            <ul className="mt-1 space-y-0.5">
              <li>
                <button
                  onClick={() => handleSelect('settings')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold ${
                    activeItem === 'settings' ? 'bg-teal-50 text-teal-800 font-bold' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>Settings & Preferences</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => handleSelect('profile')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold ${
                    activeItem === 'profile' ? 'bg-teal-50 text-teal-800 font-bold' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <User className="w-4 h-4 text-slate-500" />
                  <span>Profile</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="p-3 border-t border-slate-200 bg-slate-50">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-rose-700 hover:bg-rose-50 h-9 font-semibold"
            onClick={() => { onClose(); logout(); }}
          >
            <LogOut className="w-4 h-4 mr-3 text-rose-600" />
            <span>Sign Out</span>
          </Button>
        </div>
      </div>
    </div>
  );
};