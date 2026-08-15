import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import {
  ShieldAlert,
  Activity,
  Lock,
  Users,
  LogOut,
  Settings,
  FileText
} from 'lucide-react';
import { Box } from 'lucide-react';

// [Admin Menu Items]
const adminItems = [
  { title: "System Overview", url: "/admin", icon: Activity },
  { title: "Compliance Hub", url: "/admin/compliance", icon: ShieldAlert },
  { title: "Device Governance", url: "/admin/devices", icon: Lock },
  { title: "Inventory & Assign", url: "/admin/inventory", icon: Box },
  { title: "User Management", url: "/admin/users", icon: Users },
  { title: "System Config", url: "/admin/settings", icon: Settings },
  { title: "Security Controls", url: "/admin/security", icon: Lock },
];

export function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-60 flex flex-col"
      style={{ backgroundColor: '#2C3E50', zIndex: 50 }}
    >
      {/* 1. Header / Logo Section */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-105"
            style={{
              backgroundColor: '#7DD3C0',
              boxShadow: '0 0 20px rgba(125, 211, 192, 0.3)'
            }}
          >
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-white text-lg tracking-tight font-bold">ALAGA</h1>
            <p className="text-xs font-medium" style={{ color: '#BDC3C7' }}>Security Admin</p>
          </div>
        </div>
      </div>

      {/* 2. Navigation Menu */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-3">
          {adminItems.map((item) => {
            const isActive = location.pathname === item.url;

            return (
              <li key={item.title}>
                <Link
                  to={item.url}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm
                    transition-all duration-300 relative
                    ${isActive ? 'text-white' : 'hover:text-white'}
                  `}
                  style={isActive ? {
                    backgroundColor: 'rgba(125, 211, 192, 0.15)',
                    color: '#FFFFFF',
                    boxShadow: '0 0 15px rgba(125, 211, 192, 0.2)'
                  } : {
                    color: '#BDC3C7'
                  }}
                >
                  {/* Active Indicator Bar */}
                  {isActive && (
                    <div
                      className="absolute left-0 top-0 bottom-0 w-1 rounded-r"
                      style={{
                        backgroundColor: '#7DD3C0',
                        boxShadow: '0 0 10px rgba(125, 211, 192, 0.5)'
                      }}
                    />
                  )}

                  <item.icon className="w-5 h-5 flex-shrink-0" style={isActive ? { color: '#7DD3C0' } : {}} />
                  <span>{item.title}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* 3. Footer / Logout */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-red-400 hover:bg-red-900/20 hover:text-red-300"
        >
          <LogOut className="w-5 h-5" />
          <span>Sign Out</span>
        </button>
        <div className="mt-4 text-xs text-center" style={{ color: '#7F8C8D' }}>
          <p>© 2025 Alaga Security</p>
          <p className="mt-1">Admin Access Only</p>
        </div>
      </div>
    </aside>
  );
}