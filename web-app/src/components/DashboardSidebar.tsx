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
  UserPlus,
  ClipboardList,
  Cpu,
  LogOut,
  ChevronDown,
  Battery,
  Layers,
  RefreshCw,
  Terminal,
  TrendingUp,
  Bell
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
}

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ activeItem, onItemClick, userRole }) => {
  const { logout } = useAuth();
  const { t } = useCaregiverLanguage();
  const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false);
  const [isReportsMenuOpen, setIsReportsMenuOpen] = useState(false);

  const caregiverMenuItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: t('Dashboard', 'Dashboard') },
    { id: 'alerts-hub', icon: Bell, label: t('Alerts Hub', 'Alerts Hub') },
    { id: 'add-patient', icon: UserPlus, label: t('Add Patient', 'Magdagdag ng Pasyente') },
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
    { id: 'add-device', icon: Cpu, label: 'Add New Device' },
    { id: 'my-devices', icon: Wifi, label: 'My Devices' },
    // Status & Battery removed (Integrated into My Devices)
    // Groups removed (Integrated into My Devices)
    { id: 'firmware-update', icon: RefreshCw, label: 'Firmware (OTA)' },
    { id: 'diagnostics', icon: Terminal, label: 'Diagnostics' },
  ];

  return (
    <aside className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col shadow-sm sticky top-0">
      <div className="p-6 border-b border-slate-100 bg-teal-50/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center shadow-md">
            <Activity className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight italic">ALAGA</h1>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-3">
          {caregiverMenuItems.map((item) => {
            // [UX] Insert Device Management dropdown after Assignment Tracker
            if (item.id === 'user-management') {
              return (
                <li key="device-mgmt-dropdown" className="relative group">
                  <DropdownMenu onOpenChange={setIsDeviceMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`
                          w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
                          ${isDeviceMenuOpen ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <Wifi className={`w-4 h-4 ${isDeviceMenuOpen ? 'text-teal-600' : 'text-slate-400'}`} />
                          <span>Device Management</span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDeviceMenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="w-56 ml-2 bg-white border-slate-200 shadow-xl p-1">
                      {deviceSubItems.map((sub) => (
                        <DropdownMenuItem
                          key={sub.id}
                          onClick={() => onItemClick?.(sub.id)}
                          className="flex items-center gap-2 px-3 py-2 text-xs text-slate-600 cursor-pointer hover:bg-teal-50 hover:text-teal-700 rounded-md transition-colors"
                        >
                          <sub.icon className="w-3.5 h-3.5" />
                          {sub.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            }

            // Reports dropdown (caregiver)
            if (item.id === 'reports' && userRole === 'caregiver') {
              const isReportsActive = activeItem?.startsWith('reports-');
              return (
                <li key="reports-dropdown" className="relative group">
                  <DropdownMenu onOpenChange={setIsReportsMenuOpen}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={`
                          w-full flex items-center justify-between gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
                          ${isReportsMenuOpen || isReportsActive ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-50'}
                        `}
                      >
                        <div className="flex items-center gap-3">
                          <FileText className={`w-4 h-4 ${isReportsMenuOpen || isReportsActive ? 'text-teal-600' : 'text-slate-400'}`} />
                          <span>Reports</span>
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isReportsMenuOpen ? 'rotate-180' : ''}`} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="w-56 ml-2 bg-white border-slate-200 shadow-xl p-1 max-h-[280px] overflow-y-auto">
                      {reportsSubItems.map((sub) => (
                        <DropdownMenuItem
                          key={sub.id}
                          onClick={() => onItemClick?.(sub.id)}
                          className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer rounded-md transition-colors ${activeItem === sub.id ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-teal-50 hover:text-teal-700'}`}
                        >
                          <sub.icon className="w-3.5 h-3.5" />
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
                    w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
                    ${isActive ? 'bg-teal-50 text-teal-700 shadow-sm ring-1 ring-teal-100' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                  `}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-3 border-t border-slate-100">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50 h-9"
          onClick={() => logout()}
        >
          <LogOut className="w-4 h-4 mr-3" />
          <span>Sign Out</span>
        </Button>
      </div>
    </aside>
  );
};