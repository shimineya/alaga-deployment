import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
// [RBAC] Shared registry — same source of truth used by UserRBACManager
import { computeRoleDefaults } from '@/lib/rbac-registry';
import { 
  LayoutDashboard, 
  Users, 
  RadioReceiver, 
  ShieldCheck, 
  BellRing, 
  ActivitySquare,
  Settings,
  LogOut,
  UserCircle,
  Lock
} from 'lucide-react';

export default function AppSidebar() {
  const { user, logout, permissions, isSysAdmin } = useAuth();
  const role = user?.role?.toLowerCase() || '';

  // Role Logic Checkers
  const isAdminTier     = isSysAdmin || ['system_admin', 'admin', 'sysadmin'].includes(role);
  const isFacilityAdmin = role === 'facility_admin';
  const isClinical      = ['caregiver', 'medical_staff'].includes(role);

  // [RBAC] Pre-compute the role's baseline defaults from the shared registry.
  // This is the SAME function UserRBACManager uses for toggle states, so the
  // sidebar and the permission manager always agree on what is ON vs OFF by default.
  const roleDefaults = computeRoleDefaults(role);

  // [OWASP A01 / RBAC] Override-aware visibility helper.
  // Resolution order:
  //   1. SysAdmins bypass everything — always true.
  //   2. If a per-user override exists in the permissions map (from /api/auth/my-permissions),
  //      use that value.
  //   3. Fall back to the computed role default from rbac-registry (ground truth).
  const hasPermission = (moduleId: string): boolean => {
    if (isAdminTier) return true;
    if (Object.prototype.hasOwnProperty.call(permissions, moduleId)) {
      return permissions[moduleId];
    }
    // Use computeRoleDefaults as the fallback — same logic UserRBACManager shows in toggles
    return roleDefaults[moduleId] ?? false;
  };

  // [RBAC] Hub visibility: a hub link stays visible as long as the user has
  // access to AT LEAST ONE tab inside it. The hub itself renders only allowed tabs.
  const canSeeDashboard  = true;
  const canSeePatients   = hasPermission('my-patients')   || hasPermission('add-patient');
  const canSeeDevices    = hasPermission('device-status') || hasPermission('add-device')
                        || hasPermission('diagnostics')   || hasPermission('topology');
  const canSeeStaff      = hasPermission('ward-staff')    || hasPermission('patient-assignments');
  const canSeeSecurity   = isAdminTier
                        || hasPermission('security-operations')
                        || hasPermission('audit-logs')
                        || hasPermission('rbac_management');
  const canSeeAlerts     = hasPermission('alerts')        || hasPermission('alert-config');
  const canSeeReports    = hasPermission('reports');
  const canSeeSettings   = true;

  const navItems = [
    { label: 'Dashboard',        path: '/dashboard', icon: LayoutDashboard, visible: canSeeDashboard },
    { label: 'Patient Records',  path: '/patients',  icon: Users,           visible: canSeePatients },
    { label: 'Device Management',path: '/devices',   icon: RadioReceiver,   visible: canSeeDevices },
    { label: 'User Management',  path: '/staff',     icon: Users,           visible: canSeeStaff },
    { label: 'Security & Access',path: '/security',  icon: Lock,            visible: canSeeSecurity },
    { label: 'Alerts',           path: '/alerts',    icon: BellRing,        visible: canSeeAlerts },
    { label: 'Clinical Reports', path: '/reports',   icon: ActivitySquare,  visible: canSeeReports },
    { label: 'System Settings',  path: '/settings',  icon: Settings,        visible: canSeeSettings },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300">
      {/* Brand area */}
      <div className="p-6 pb-4">
        <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
          <ActivitySquare className="w-6 h-6 text-teal-400" />
          ALAGA <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 ml-1 tracking-widest align-top">SYS</span>
        </h1>
        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-widest mt-1 ml-8">Monitoring System</p>
      </div>

      <div className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 ml-2 mt-4">Command Modules</div>
        
        {navItems.filter(item => item.visible).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive 
                  ? 'bg-teal-500/10 text-teal-400 font-semibold' 
                  : 'hover:bg-slate-800 hover:text-white text-slate-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-5 h-5 ${isActive ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* User Area bottom */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700">
            <UserCircle className="w-5 h-5" />
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-white truncate">{user?.name || user?.username || 'User'}</p>
            <p className="text-[10px] text-teal-400 uppercase tracking-wider font-semibold truncate">
              {role.replace('_', ' ')}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-red-500/10 hover:text-red-400 text-sm font-medium transition-colors border border-slate-700 hover:border-red-500/30"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
