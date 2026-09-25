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
  Activity,
  ActivitySquare,
  Settings,
  LogOut,
  UserCircle,
  Lock,
  Link,
  Archive,
  Menu,
  FileSpreadsheet,
  Building2,
  Home,
  Sparkles,
  X
} from 'lucide-react';

interface AppSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  onClose?: () => void;
  isMobile?: boolean;
}

export default function AppSidebar({ collapsed = false, onToggle, onClose, isMobile = false }: AppSidebarProps) {
  const effectiveCollapsed = isMobile ? false : collapsed;
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
  const isClinical      = ['caregiver', 'medical_staff', 'parent', 'guardian'].includes(role);

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
  const canSeeAlerts          = !isAdminTier && (hasPermission('alerts') || hasPermission('alert-config'));
  const canSeeAiInsights      = isFacilityAdmin || isCaregiverOrMedStaff || isParentOrGuardian || isAdminTier;
  const canSeeClinicalReports = isFacilityAdmin || isCaregiverOrMedStaff || isParentOrGuardian || isAdminTier || hasPermission('clinical-reports');
  const canSeeSystemReports   = isAdminTier;
  const canSeeSettings        = true;
  const canSeeArchives        = isAdminTier || isFacilityAdmin;
 
  const navItems = [
    { label: t('Dashboard', 'Dashboard'),        path: '/dashboard', icon: LayoutDashboard, visible: canSeeDashboard },
    { label: t('Assignment Command Center', 'Assignment Command Center'), path: '/assignments', icon: Link, visible: canSeeAssignmentCommandCenter, hasDot: hasPendingInvites },
    { label: t('Patient Records', 'Mga Rekord ng Pasyente'),  path: '/patients',  icon: Users,           visible: canSeePatients },
    { label: t('Device Management', 'Pamamahala ng Device'),path: '/devices',   icon: RadioReceiver,   visible: canSeeDevices },
    { label: t('User Management', 'Pamamahala ng User'),  path: '/staff',     icon: Users,           visible: canSeeStaff, hasDot: hasCareTeamUpdates },
    { label: t('Security & Access', 'Seguridad at Akses'),path: '/security',  icon: Lock,            visible: canSeeSecurity },
    { label: t('Alerts', 'Mga Alert'),           path: '/alerts',    icon: BellRing,        visible: canSeeAlerts, hasDot: hasUnreadAlerts },
    { 
      label: t('AI Insights', 'Mga Insight ng AI'), 
      path: '/ai-insights', 
      icon: Sparkles, 
      visible: canSeeAiInsights 
    },
    { 
      label: t('Clinical Reports', 'Mga Klinikal na Ulat'), 
      path: '/clinical-reports',   
      icon: ActivitySquare,  
      visible: canSeeClinicalReports 
    },
    { 
      label: t('System Reports', 'Hub ng Ulat ng System'), 
      path: '/reports',   
      icon: FileSpreadsheet,  
      visible: canSeeSystemReports 
    },
    { label: t('Archive Hub', 'Hub ng Archive'),        path: '/archives',  icon: Archive,         visible: canSeeArchives },
    { label: t('System Settings', 'Mga Setting ng System'),  path: '/settings',  icon: Settings,        visible: canSeeSettings },
  ];

  const handleLogout = () => {
    if (isMobile && onClose) {
      onClose();
    }
    logout();
  };

  return (
    <div className="flex flex-col h-full bg-[#061126] border-r border-teal-500/20 text-slate-300 select-none shadow-2xl">
      {/* Brand & Toggle header - Styled with Alaga Robot Head Logo */}
      <div className={`p-4 border-b border-teal-500/20 flex items-center ${effectiveCollapsed ? 'flex-col gap-3 justify-center' : 'justify-between'}`}>
        {effectiveCollapsed ? (
          <img 
            src="/alaga-robot-logo.png" 
            alt="Alaga Logo" 
            className="w-8 h-8 object-contain cursor-pointer hover:scale-110 transition-transform"
            onClick={onToggle}
            title="Expand sidebar"
          />
        ) : (
          <div className="flex items-center gap-2.5 overflow-hidden">
            <img 
              src="/alaga-robot-logo.png" 
              alt="Alaga Logo" 
              className="w-9 h-9 object-contain shrink-0 hover:scale-105 transition-transform" 
            />
            <div className="overflow-hidden flex flex-col">
              <span className="text-lg font-black tracking-tight text-white italic leading-tight">
                ALAGA
              </span>
              <span className="text-[8.5px] font-black tracking-widest uppercase text-amber-400 -mt-0.5">
                Smart Healthcare
              </span>
            </div>
          </div>
        )}
        {isMobile ? (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title="Close navigation menu"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={effectiveCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
      </div>

      <div className="flex-1 px-2.5 py-3 space-y-1.5 overflow-y-auto touch-scroll">
        {!effectiveCollapsed && (
          <div className="text-[10px] font-bold text-teal-400/80 uppercase tracking-widest mb-2.5 ml-2 mt-1">
            {t('Command Modules', 'Mga Module ng Utos')}
          </div>
        )}
        
        {navItems.filter(item => item.visible).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={() => {
              if (isMobile && onClose) {
                onClose();
              }
            }}
            className={({ isActive }) =>
              `flex items-center ${effectiveCollapsed ? 'justify-center relative' : 'gap-3'} px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group ${
                isActive 
                  ? 'bg-gradient-to-r from-teal-500/20 via-teal-500/10 to-transparent text-teal-300 border-l-2 border-teal-400 shadow-2xs font-bold' 
                  : 'hover:bg-white/5 hover:text-white text-slate-400'
              }`
            }
            title={effectiveCollapsed ? item.label : undefined}
          >
            {({ isActive }) => (
              <>
                <item.icon className={`w-4.5 h-4.5 shrink-0 transition-colors ${isActive ? 'text-teal-400' : 'text-slate-400 group-hover:text-teal-300'}`} />
                {!effectiveCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                {!effectiveCollapsed && item.hasDot && (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse ml-2 shrink-0 shadow-sm border border-slate-900" />
                )}
                {effectiveCollapsed && item.hasDot && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* User Area bottom - Frosted high-contrast card */}
      <div className="p-3 border-t border-teal-500/20 bg-[#040c1c]">
        {!effectiveCollapsed ? (
          <>
            <div className="flex items-center gap-2.5 mb-3 px-2 py-1.5 rounded-xl bg-white/5 border border-white/10">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-teal-950 flex items-center justify-center text-teal-300 border border-teal-500/40 shrink-0">
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
                <p className="text-[9px] text-teal-300 uppercase tracking-wider font-semibold truncate">
                  {role === 'parent' ? t('Parent / Guardian', 'Magulang / Tagapangalaga')
                    : role === 'medical_staff' ? t('Medical Staff', 'Klinikal na Staff')
                    : role === 'facility_admin' ? t('Facility Admin', 'Admin ng Pasilidad')
                    : role === 'system_admin' ? t('System Admin', 'Admin ng System')
                    : role.replace('_', ' ')}
                </p>
                {user?.facility_name ? (
                  <p className="text-[9.5px] text-sky-300 font-semibold flex items-center gap-1 truncate mt-0.5" title={`Facility: ${user.facility_name}`}>
                    <Building2 className="w-2.5 h-2.5 shrink-0 text-sky-400" />
                    <span className="truncate">{user.facility_name}</span>
                  </p>
                ) : (role === 'caregiver' || role === 'parent') ? (
                  <p className="text-[9px] text-slate-400 font-medium flex items-center gap-1 truncate mt-0.5">
                    <Home className="w-2.5 h-2.5 shrink-0 text-slate-500" />
                    <span className="truncate">Independent Care</span>
                  </p>
                ) : null}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/10 text-slate-300 hover:text-rose-300 text-xs font-semibold transition-all border border-white/10 hover:border-rose-500/30 alaga-btn-tactile"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t('Sign Out', 'Mag-sign Out')}
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2.5 py-1">
            <div 
              className="w-8 h-8 rounded-full overflow-hidden bg-teal-950 flex items-center justify-center text-teal-300 border border-teal-500/40" 
              title={`${user?.name || user?.username} (${role.replace('_', ' ')})${user?.facility_name ? ` • ${user.facility_name}` : ''}`}
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
              onClick={handleLogout}
              className="p-1.5 rounded-xl bg-white/5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors border border-white/10 hover:border-rose-500/30 alaga-btn-tactile"
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
