import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  BarChart3, 
  List, 
  Heart, 
  Bell, 
  FileText, 
  Wifi, 
  Settings, 
  User,
  Activity,
  UserPlus,
  TrendingUp,
  ClipboardList,
  Cpu
} from 'lucide-react';

interface DashboardSidebarProps {
  activeItem?: string;
  onItemClick?: (item: string) => void;
  userRole?: 'caregiver' | 'medical_staff';
}

const caregiverMenuItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { id: 'my-patients', icon: Users, label: 'My Patients' },
  { id: 'add-patient', icon: UserPlus, label: 'Add A New Patient' },
  { id: 'alerts-reports', icon: Bell, label: 'Alerts & Reports' },
  { id: 'analytics', icon: BarChart3, label: 'Analytics' },
  { id: 'vital-signs', icon: Heart, label: 'Vital Signs' },
  { id: 'device-status', icon: Wifi, label: 'Device Status' },
  { id: 'settings', icon: Settings, label: 'Settings' },
  { id: 'profile', icon: User, label: 'Profile' },
];

const medicalStaffMenuItems = [
  { id: 'dashboard', icon: LayoutDashboard, label: 'Main Dashboard' },
  { id: 'add-patient', icon: UserPlus, label: 'Add New Patient' },
  { id: 'master-list', icon: List, label: 'Master Patient List' },
  { id: 'analytics-reports', icon: FileText, label: 'Analytics & Reports' },
  { id: 'health-trends', icon: TrendingUp, label: 'Health Trends' },
  { id: 'activity-logs', icon: ClipboardList, label: 'Activity & Logs' },
  { id: 'sensor-health', icon: Cpu, label: 'Sensor Health' },
  { id: 'system-settings', icon: Settings, label: 'System Settings' },
  { id: 'profile', icon: User, label: 'Profile' },
];

export const DashboardSidebar: React.FC<DashboardSidebarProps> = ({ 
  activeItem = 'dashboard',
  onItemClick,
  userRole = 'caregiver'
}) => {
  const menuItems = userRole === 'medical_staff' ? medicalStaffMenuItems : caregiverMenuItems;

  return (
    <aside 
      className="fixed left-0 top-0 h-screen w-60 flex flex-col"
      style={{ backgroundColor: '#2C3E50', zIndex: 50 }}
    >
      {/* Logo Section */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105"
            style={{ 
              backgroundColor: '#7DD3C0',
              boxShadow: '0 0 20px rgba(125, 211, 192, 0.3)'
            }}
          >
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white text-lg tracking-tight">ALAGA</h1>
            <p className="text-xs" style={{ color: '#BDC3C7' }}>Patient Monitoring</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-3">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onItemClick?.(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                    transition-all duration-300 relative
                    ${isActive 
                      ? 'text-white' 
                      : 'hover:text-white'
                    }
                  `}
                  style={isActive ? {
                    backgroundColor: 'rgba(125, 211, 192, 0.15)',
                    color: '#FFFFFF',
                    boxShadow: '0 0 15px rgba(125, 211, 192, 0.2)'
                  } : {
                    color: '#BDC3C7'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'rgba(232, 246, 243, 0.1)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <div 
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
                      style={{ 
                        backgroundColor: '#7DD3C0',
                        boxShadow: '0 0 10px rgba(125, 211, 192, 0.5)'
                      }}
                    />
                  )}
                  
                  <Icon className="w-5 h-5 flex-shrink-0" style={isActive ? { color: '#7DD3C0' } : {}} />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-center" style={{ color: '#7F8C8D' }}>
          <p>© 2025 Alaga System</p>
          <p className="mt-1">Version 1.0.0</p>
        </div>
      </div>
    </aside>
  );
};