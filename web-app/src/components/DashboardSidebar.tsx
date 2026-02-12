import React from 'react';
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
  LogOut
} from 'lucide-react';
import { Button } from './ui/button';
import { useAuth } from '../lib/auth-context';

interface DashboardSidebarProps {
  activeItem?: string;
  onItemClick?: (item: string) => void;
  userRole?: 'caregiver' | 'medical_staff';
}

const caregiverMenuItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'add-device', icon: Cpu, label: 'Add Device' },
  { id: 'add-patient', icon: UserPlus, label: 'Add Patient' },
  { id: 'patient-list', icon: List, label: 'Patient List' },
  { id: 'assignment-tracker', icon: ClipboardList, label: 'Assignments' },
  { id: 'user-management', icon: Users, label: 'Care Team' },
  { id: 'device-management', icon: Wifi, label: 'Devices' },
  { id: 'reports', icon: FileText, label: 'Reports' },
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'profile', icon: User, label: 'Profile' },
];

const medicalStaffMenuItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'patient-list', icon: Users, label: 'Directory' },
  { id: 'medical-calendar', icon: Activity, label: 'Calendar' },
  { id: 'reports', icon: FileText, label: 'Reports' },
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'profile', icon: User, label: 'Profile' },
];

// [FIX] Named Export to match your import { DashboardSidebar }
export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({
  activeItem = 'dashboard',
  onItemClick,
  userRole = 'caregiver',
}) => {
  const menuItems = userRole === 'medical_staff' ? medicalStaffMenuItems : caregiverMenuItems;
  const { signOut } = useAuth();

  return (
    // [LAYOUT] Flexbox Sidebar (No 'fixed', no 'z-50')
    <aside className="w-64 flex-shrink-0 h-screen bg-white border-r border-slate-200 flex flex-col transition-all duration-300">
      
      {/* Compact Header */}
      <div className="h-14 flex items-center px-5 border-b border-slate-100">
        <div className="flex items-center gap-2 text-teal-600">
          <Activity className="w-5 h-5" />
          <span className="font-bold text-lg tracking-tight">Alaga</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onItemClick?.(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200
                    ${isActive 
                      ? 'bg-teal-50 text-teal-700 shadow-sm ring-1 ring-teal-100' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }
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

      {/* Footer */}
      <div className="p-3 border-t border-slate-100">
         <Button 
            variant="ghost" 
            size="sm"
            className="w-full justify-start text-slate-500 hover:text-red-600 hover:bg-red-50 h-9"
            onClick={() => signOut()}
         >
            <LogOut className="w-4 h-4 mr-2" />
            <span className="text-xs font-medium">Sign Out</span>
         </Button>
      </div>
    </aside>
  );
};