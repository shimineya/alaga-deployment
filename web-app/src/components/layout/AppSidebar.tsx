import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { useCaregiverLanguage } from '@/lib/caregiver-language-context';
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
  Lock,
  Link,
  Archive,
  Menu,
  FileSpreadsheet
} from 'lucide-react';

interface AppSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function AppSidebar({ collapsed = false, onToggle }: AppSidebarProps) {
  const { user, logout, permissions, isSysAdmin } = useAuth();
  const { t } = useCaregiverLanguage();
  const role = user?.role?.toLowerCase() || '';

  // Real-time Notification States
  const [hasUnreadAlerts, setHasUnreadAlerts] = useState(false);
  const [hasPendingInvites, setHasPendingInvites] = useState(false);
  const [hasCareTeamUpdates, setHasCareTeamUpdates] = useState(false);

  // Role Logic Checkers
  const isAdminTier     = isSysAdmin || ['system_admin', 'admin', 'sysadmin'].includes(role);
  const isFacilityAdmin = role === 'facility_admin';
  // [OWASP A01] 'parent' is the consumer-facing home-monitoring role.
  // isClinical includes 'parent' so all caregiver-equivalent hub visibility
  // checks resolve correctly without duplicating the parent check everywhere.
  const isParent        = role === 'parent';
  const isClinical      = ['caregiver', 'medical_staff', 'parent'].includes(role);

  // [RBAC] Pre-compute the role's baseline defaults from the shared registry.
  // This is the SAME function UserRBACManager uses for toggle states, so the
  // sidebar and the permission manager always agree on what is ON vs OFF by default.
  const roleDefaults = computeRoleDefaults(role);

  // [OWASP A01 / RBAC] Override-aware visibility helper.
  const hasPermission = (moduleId: string): boolean => {
    if (isAdminTier) return true;
    if (Object.prototype.hasOwnProperty.call(permissions, moduleId)) {
      return permissions[moduleId];
    }
    return roleDefaults[moduleId] ?? false;
  };

  // Real-time Polling for Hub Updates
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    const API_BASE = import.meta.env.VITE_API_URL || '';

    const checkUpdates = async () => {
      try {
        // 1. Check Alerts (only if user has alerts module access)
        if (hasPermission('alerts')) {
          const res = await fetch(`${API_BASE}/api/alerts/clinical`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            setHasUnreadAlerts(data.data.some((a: any) => a.status !== 'Acknowledged'));
          }
        }

        // 2. Check Pending Invites (Caregivers / Med Staff)
        const isCaregiverOrMedStaff = role === 'caregiver' || role === 'medical_staff';
        if (isCaregiverOrMedStaff) {
          const res = await fetch(`${API_BASE}/api/assignments/pending-invites`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            setHasPendingInvites(data.data.length > 0);
          }
        }

        // 3. Check Care Team Updates (Pending / Rejected invites) for Parents & Admins
        const isParentOrAdmin = role === 'parent' || role === 'facility_admin';
        if (isParentOrAdmin) {
          let hasUpdate = false;
          if (role === 'parent') {
            const patRes = await fetch(`${API_BASE}/api/caregiver/patients`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const patData = await patRes.json();
            if (patData.success && Array.isArray(patData.data)) {
              for (const pat of patData.data) {
                const teamRes = await fetch(`${API_BASE}/api/caregiver/patients/${pat.patient_id}/care-team`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                const teamData = await teamRes.json();
                if (teamData.success && Array.isArray(teamData.data)) {
                  if (teamData.data.some((m: any) => m.invite_status === 'Pending' || m.invite_status === 'Declined')) {
                    hasUpdate = true;
                    break;
                  }
                }
              }
            }
          } else {
            // Facility admin check
            const patRes = await fetch(`${API_BASE}/api/facility-admin/patients`, {
              headers: { 'Authorization': `Bearer ${token}` }
            });
            const patData = await patRes.json();
            if (patData.success && Array.isArray(patData.data)) {
              for (const pat of patData.data) {
                if (Array.isArray(pat.caregivers)) {
                  if (pat.caregivers.some((c: any) => c.invite_status === 'Pending' || c.invite_status === 'Declined')) {
                    hasUpdate = true;
                    break;
                  }
                }
              }
            }
          }
          setHasCareTeamUpdates(hasUpdate);
        }
      } catch (err) {
        console.error("Sidebar poll error:", err);
      }
    };

    checkUpdates();
    const intervalId = setInterval(checkUpdates, 10000);
    return () => clearInterval(intervalId);
  }, [user, role, permissions]);

  // [RBAC] Hub visibility: a hub link stays visible as long as the user has
  // access to AT LEAST ONE tab inside it. The hub itself renders only allowed tabs.
  const isCaregiverOrMedStaff = role === 'caregiver' || role === 'medical_staff';
  const isParentOrGuardian    = role === 'parent' || role === 'guardian';

  const canSeeDashboard  = true;
  // Patient Records Hub is accessible by Facility Admins, Medical Staff, Caregivers, and Parents/Guardians (restricted for SysAdmin)
  const canSeePatients   = !isAdminTier && (isFacilityAdmin || isCaregiverOrMedStaff || isParentOrGuardian);
  const canSeeDevices    = hasPermission('device-status') || hasPermission('add-device')
                        || hasPermission('diagnostics')   || hasPermission('topology');
  // Caregivers and Medical Staff should not see User Management
  const canSeeStaff      = !isCaregiverOrMedStaff && (hasPermission('ward-staff') || hasPermission('patient-assignments'));
  const canSeeAssignmentCommandCenter = isCaregiverOrMedStaff;
  const canSeeSecurity   = isAdminTier
                        || hasPermission('security-operations')
                        || hasPermission('audit-logs')
                        || hasPermission('rbac_management');
  const canSeeAlerts     = hasPermission('alerts')        || hasPermission('alert-config');
  const canSeeReports    = (isAdminTier || isFacilityAdmin || role === 'medical_staff') && (isAdminTier || hasPermission('reports'));
  const canSeeSettings   = true;
  const canSeeArchives   = isAdminTier || isFacilityAdmin;
 
  const navItems = [
    { label: t('Dashboard', 'Dashboard'),        path: '/dashboard', icon: LayoutDashboard, visible: canSeeDashboard },
    { label: t('Assignment Command Center', 'Assignment Command Center'), path: '/assignments', icon: Link, visible: canSeeAssignmentCommandCenter, hasDot: hasPendingInvites },
    { label: t('Patient Records', 'Mga Rekord ng Pasyente'),  path: '/patients',  icon: Users,           visible: canSeePatients },
    { label: t('Device Management', 'Pamamahala ng Device'),path: '/devices',   icon: RadioReceiver,   visible: canSeeDevices },
    { label: t('User Management', 'Pamamahala ng User'),  path: '/staff',     icon: Users,           visible: canSeeStaff, hasDot: hasCareTeamUpdates },
    { label: t('Security & Access', 'Seguridad at Akses'),path: '/security',  icon: Lock,            visible: canSeeSecurity },
    { label: t('Alerts', 'Mga Alert'),           path: '/alerts',    icon: BellRing,        visible: canSeeAlerts, hasDot: hasUnreadAlerts },
    { 
      label: isAdminTier ? t('Reports Hub', 'Hub ng Ulat') : t('Clinical Reports', 'Mga Klinikal na Ulat'), 
      path: '/reports',   
      icon: isAdminTier ? FileSpreadsheet : ActivitySquare,  
      visible: canSeeReports 
    },
    { label: t('Archive Hub', 'Hub ng Archive'),        path: '/archives',  icon: Archive,         visible: canSeeArchives },
    { label: t('System Settings', 'Mga Setting ng System'),  path: '/settings',  icon: Settings,        visible: canSeeSettings },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 select-none">
      {/* Brand & Toggle header */}
      <div className={`p-4 border-b border-slate-800/80 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2 overflow-hidden">
            <ActivitySquare className="w-6 h-6 text-teal-400 shrink-0" />
            <div className="overflow-hidden">
              <h1 className="text-xl font-black text-white tracking-tight flex items-center leading-none">
                ALAGA <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-teal-500/20 text-teal-300 ml-1.5 tracking-widest align-top">SYS</span>
              </h1>
              <p className="text-[9px] text-slate-500 font-medium uppercase tracking-widest mt-0.5 truncate">Monitoring System</p>
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 px-2.5 py-3 space-y-1 overflow-y-auto">
        {!collapsed && (
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 ml-2 mt-1">
            {t('Command Modules', 'Mga Module ng Utos')}
          </div>
        )}
        
        {navItems.filter(item => item.visible).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center ${collapsed ? 'justify-center relative' : 'gap-3'} px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                isActive 
                  ? 'bg-teal-500/10 text-teal-400 font-semibold' 
                  : 'hover:bg-slate-800 hover:text-white text-slate-400'
              }`
            }
            title={collapsed ? item.label : undefined}
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                {!collapsed && <span className="flex-1 truncate text-xs">{item.label}</span>}
                {!collapsed && item.hasDot && (
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse ml-2 shrink-0 shadow-sm border border-slate-900" />
                )}
                {collapsed && item.hasDot && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* User Area bottom */}
      <div className="p-3 border-t border-slate-800 bg-slate-900/50">
        {!collapsed ? (
          <>
            <div className="flex items-center gap-2.5 mb-3 px-1">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700 shrink-0">
                {user?.profile_picture_url ? (
                  <img
                    src={`${import.meta.env.VITE_API_URL || ''}${user.profile_picture_url}`}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserCircle className="w-5 h-5" />
                )}
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-white truncate">{user?.name || user?.username || 'User'}</p>
                <p className="text-[9px] text-teal-400 uppercase tracking-wider font-semibold truncate">
                  {role === 'parent' ? t('Parent / Guardian', 'Magulang / Tagapangalaga')
                    : role === 'medical_staff' ? t('Medical Staff', 'Klinikal na Staff')
                    : role === 'facility_admin' ? t('Facility Admin', 'Admin ng Pasilidad')
                    : role === 'system_admin' ? t('System Admin', 'Admin ng System')
                    : role.replace('_', ' ')}
                </p>
              </div>
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-red-500/10 hover:text-red-400 text-xs font-medium transition-colors border border-slate-700 hover:border-red-500/30"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t('Sign Out', 'Mag-sign Out')}
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2.5 py-1">
            <div 
              className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700" 
              title={`${user?.name || user?.username} (${role.replace('_', ' ')})`}
            >
              {user?.profile_picture_url ? (
                <img
                  src={`${import.meta.env.VITE_API_URL || ''}${user.profile_picture_url}`}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserCircle className="w-5 h-5" />
              )}
            </div>
            <button
              onClick={logout}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition-colors border border-slate-700 hover:border-red-500/30"
              title={t('Sign Out', 'Mag-sign Out')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
