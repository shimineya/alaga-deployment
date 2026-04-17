import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
    ShieldCheck,
    Globe,
    Cpu,
    FileSearch,
    LogOut,
    Terminal,
    HeartPulse,
    CalendarClock,
    FileText,
    BellRing,
    Building2,
    Users,
    UserPlus,
    Bell,
    Activity,
    Settings,
    ClipboardList,
    PlusCircle,
    Smartphone,
    TrendingUp,
    Droplets,
    FileSpreadsheet
} from 'lucide-react';

const zoneANav = [
    { title: 'Command Center Dashboard', url: '/sysadmin/command-center', icon: Globe },
    { title: 'Global Security Monitoring', url: '/sysadmin/command-center/security', icon: ShieldCheck },
    { title: 'Role and Access Management', url: '/sysadmin/facility/users', icon: Users },
    {
        title: 'Facility Topology Builder',
        url: '/sysadmin/command-center/topology',
        icon: Building2,
    },
    { title: 'Forensic Audit Trails', url: '/sysadmin/command-center/audit', icon: FileSearch },
    { title: 'Firmware OTA Updates', url: '/sysadmin/command-center/firmware-ota', icon: Cpu },
    { title: 'Diagnostics and Logs', url: '/sysadmin/facility/diagnostics', icon: Activity },
];

const zoneBNav = [
    {
        title: 'Ward Dashboard',
        url: '/sysadmin/facility/dashboard',
        icon: Building2,
    },
    {
        title: 'Patient Onboarding',
        url: '/sysadmin/facility/patient-onboarding',
        icon: UserPlus,
    },
    {
        title: 'Alert Configuration',
        url: '/sysadmin/facility/alerts',
        icon: Bell,
    },
    {
        title: 'Security & Audits',
        url: '/sysadmin/facility/security',
        icon: ShieldCheck,
    },
];

export function SysAdminSidebar() {
    const location = useLocation();
    const navigate = useNavigate();
    const { logout } = useAuth();

    const [isZoneAOpen, setIsZoneAOpen] = useState(true);
    const [isZoneBOpen, setIsZoneBOpen] = useState(true);
    const [isStaffOpen, setIsStaffOpen] = useState(false);
    const [isPatientOpen, setIsPatientOpen] = useState(false);
    const [isPatientMenuOpen, setIsPatientMenuOpen] = useState(false);
    const [isDeviceMenuOpen, setIsDeviceMenuOpen] = useState(false);
    const [isReportsMenuOpen, setIsReportsMenuOpen] = useState(false);
    const [showBreakGlass, setShowBreakGlass] = useState(false);
    const [breakGlassTarget, setBreakGlassTarget] = useState<string | null>(null);
    const [justificationCode, setJustificationCode] = useState('');
    const [hasJustified, setHasJustified] = useState(false);

    const phiNavLinkClasses =
        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 relative ' +
        'border border-red-500/60 bg-gradient-to-r from-red-900/40 via-amber-900/30 to-slate-900/40 ' +
        'text-red-100 hover:border-amber-400 hover:from-red-900/70 hover:via-amber-900/60 hover:to-slate-900/70';

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const openBreakGlass = (target: string) => {
        setBreakGlassTarget(target);
        setShowBreakGlass(true);
    };

    const handlePhiClick = (e: React.MouseEvent, url: string) => {
        if (!hasJustified) {
            e.preventDefault();
            openBreakGlass(url);
        }
    };

    const handleAcknowledge = () => {
        if (!breakGlassTarget) return;
        if (!justificationCode.trim()) {
            return;
        }
        const target = breakGlassTarget;
        setHasJustified(true);
        setShowBreakGlass(false);
        setJustificationCode('');
        setBreakGlassTarget(null);
        navigate(target);
    };

    return (
        <aside
            className="w-60 h-screen flex flex-col flex-shrink-0 sticky top-0"
            style={{ backgroundColor: '#1E293B', zIndex: 50 }}
        >
            {/* Logo */}
            <div className="p-6 border-b border-slate-700">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: '#0D9488' }}
                    >
                        <Terminal className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-white text-base font-bold tracking-tight">ALAGA</h1>
                        <p className="text-xs font-medium" style={{ color: '#94A3B8' }}>System Admin</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 overflow-y-auto">
                {/* Zone A */}
                <div className="px-3 mb-4">
                    <button
                        type="button"
                        onClick={() => setIsZoneAOpen((prev) => !prev)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-600 text-xs font-semibold uppercase tracking-widest text-slate-200 hover:bg-slate-700 transition-colors"
                    >
                        <span>Zone A — Command Center</span>
                        <span className="text-[10px] text-teal-300 font-mono">SYSADMIN</span>
                    </button>
                    {isZoneAOpen && (
                        <ul className="mt-1 space-y-0.5">
                            {zoneANav.map((item) => {
                                const isActive = location.pathname === item.url;
                                return (
                                    <li key={item.title}>
                                        <Link
                                            to={item.url}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-all duration-200 relative ${isActive
                                                ? 'text-white bg-slate-800/80'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                                }`}
                                        >
                                            {isActive && (
                                                <div
                                                    className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r"
                                                    style={{ backgroundColor: '#0D9488' }}
                                                />
                                            )}
                                            <item.icon
                                                className="w-4 h-4 flex-shrink-0"
                                                style={isActive ? { color: '#0D9488' } : {}}
                                            />
                                            <span>{item.title}</span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Zone B */}
                <div className="px-3 mb-4">
                    <button
                        type="button"
                        onClick={() => setIsZoneBOpen((prev) => !prev)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-600 text-xs font-semibold uppercase tracking-widest text-slate-200 hover:bg-slate-700 transition-colors"
                    >
                        <span>Zone B — Facility Administration</span>
                        <span className="text-[10px] text-sky-300 font-mono">SYSADMIN + FACILITY</span>
                    </button>
                    {isZoneBOpen && (
                        <ul className="mt-1 space-y-0.5">
                            {/* Ward Dashboard */}
                            {zoneBNav.slice(0, 1).map((item) => {
                                const isActive = location.pathname === item.url;
                                return (
                                    <li key={item.title}>
                                        <Link
                                            to={item.url}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-all duration-200 relative ${isActive
                                                ? 'text-white bg-slate-800/80'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                                }`}
                                        >
                                            {isActive && (
                                                <div
                                                    className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r"
                                                    style={{ backgroundColor: '#0D9488' }}
                                                />
                                            )}
                                            <item.icon
                                                className="w-4 h-4 flex-shrink-0"
                                                style={isActive ? { color: '#0D9488' } : {}}
                                            />
                                            <span>{item.title}</span>
                                        </Link>
                                    </li>
                                );
                            })}

                            {/* User Management (single link) */}
                            {zoneBNav.slice(1, 2).map((item) => {
                                const isActive = location.pathname === item.url;
                                return (
                                    <li key={item.title}>
                                        <Link
                                            to={item.url}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-all duration-200 relative ${isActive
                                                ? 'text-white bg-slate-800/80'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                                }`}
                                        >
                                            {isActive && (
                                                <div
                                                    className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r"
                                                    style={{ backgroundColor: '#0D9488' }}
                                                />
                                            )}
                                            <item.icon
                                                className="w-4 h-4 flex-shrink-0"
                                                style={isActive ? { color: '#0D9488' } : {}}
                                            />
                                            <span>{item.title}</span>
                                        </Link>
                                    </li>
                                );
                            })}

                            {/* User Management dropdown */}
                            <li>
                                <button
                                    type="button"
                                    onClick={() => setIsStaffOpen((prev) => !prev)}
                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs text-slate-300 hover:text-white hover:bg-slate-700 bg-slate-800/60 border border-slate-700 transition-colors"
                                >
                                    <span className="flex items-center gap-2">
                                        <Users className="w-4 h-4 flex-shrink-0" />
                                        <span>User Management</span>
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                        {isStaffOpen ? 'HIDE' : 'SHOW'}
                                    </span>
                                </button>
                                {isStaffOpen && (
                                    <ul className="mt-1 space-y-0.5 pl-4">
                                        <li>
                                            <Link
                                                to="/sysadmin/facility/staff"
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all duration-200 relative ${location.pathname === '/sysadmin/facility/staff'
                                                    ? 'text-white bg-slate-800/80'
                                                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                                    }`}
                                            >
                                                <Users className="w-3.5 h-3.5 flex-shrink-0" />
                                                <span>User List &amp; Invitations</span>
                                            </Link>
                                        </li>
                                        <li>
                                            <Link
                                                to="/sysadmin/facility/staff/assignments"
                                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-all duration-200 relative ${location.pathname === '/sysadmin/facility/staff/assignments'
                                                    ? 'text-white bg-slate-800/80'
                                                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                                    }`}
                                            >
                                                <ClipboardList className="w-3.5 h-3.5 flex-shrink-0" />
                                                <span>Patient Caregiver Assignment</span>
                                            </Link>
                                        </li>
                                    </ul>
                                )}
                            </li>

                            {/* Remaining Facility links */}
                            {zoneBNav.slice(2).map((item) => {
                                const isActive = location.pathname === item.url;
                                return (
                                    <li key={item.title}>
                                        <Link
                                            to={item.url}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs transition-all duration-200 relative ${isActive
                                                ? 'text-white bg-slate-800/80'
                                                : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                                }`}
                                        >
                                            {isActive && (
                                                <div
                                                    className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r"
                                                    style={{ backgroundColor: '#0D9488' }}
                                                />
                                            )}
                                            <item.icon
                                                className="w-4 h-4 flex-shrink-0"
                                                style={isActive ? { color: '#0D9488' } : {}}
                                            />
                                            <span>{item.title}</span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Zone C — Patient Care (RESTRICTED PHI ZONE) */}
                <div className="mt-2 px-3">
                    <div className="mb-2 rounded-lg border border-red-600/70 bg-red-900/40 px-3 py-2">
                        <p className="text-[10px] font-semibold text-red-100 tracking-wide">
                            PHI WARNING: Zone C contains Restricted Health Information. Access only with valid operational
                            justification. All overrides are logged.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsPatientOpen((prev) => !prev)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-600 text-xs font-semibold uppercase tracking-widest text-amber-300 hover:bg-slate-700 transition-colors"
                    >
                        <span>Zone C — Patient Care</span>
                        <span className="text-[10px] text-red-300 font-mono">RESTRICTED PHI</span>
                    </button>
                    {isPatientOpen && (
                        <ul className="mt-1 space-y-0.5">
                            <li>
                                <NavLink
                                    to="/sysadmin/caregiver/dashboard"
                                    onClick={(e) => handlePhiClick(e, '/sysadmin/caregiver/dashboard')}
                                    className={({ isActive }) =>
                                        `${phiNavLinkClasses} ${isActive ? 'ring-2 ring-amber-400/80' : ''}`
                                    }
                                >
                                    <HeartPulse className="w-4 h-4 flex-shrink-0 text-amber-300" />
                                    <span>Caregiver Dashboard</span>
                                </NavLink>
                            </li>
                            <li>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        if (!hasJustified) {
                                            e.preventDefault();
                                            openBreakGlass('/sysadmin/caregiver/patients');
                                            return;
                                        }
                                        setIsPatientMenuOpen((prev) => !prev);
                                    }}
                                    className={`${phiNavLinkClasses} justify-between ${isPatientMenuOpen ? 'ring-2 ring-amber-400/80' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <HeartPulse className="w-4 h-4 flex-shrink-0 text-amber-300" />
                                        <span>Patient Management</span>
                                    </div>
                                    <span className="text-[10px] text-red-300 font-mono">
                                        {isPatientMenuOpen ? 'HIDE' : 'SHOW'}
                                    </span>
                                </button>
                                {isPatientMenuOpen && hasJustified && (
                                    <ul className="mt-1 space-y-0.5 pl-4">
                                        <li>
                                            <NavLink
                                                to="/sysadmin/caregiver/patients"
                                                end
                                                className={({ isActive }) =>
                                                    `${phiNavLinkClasses} ${isActive ? 'ring-2 ring-amber-400/80' : ''}`
                                                }
                                            >
                                                <Users className="w-3.5 h-3.5 flex-shrink-0 text-amber-300" />
                                                <span>Patient List</span>
                                            </NavLink>
                                        </li>
                                        <li>
                                            <NavLink
                                                to="/sysadmin/caregiver/patients/add"
                                                className={({ isActive }) =>
                                                    `${phiNavLinkClasses} ${isActive ? 'ring-2 ring-amber-400/80' : ''}`
                                                }
                                            >
                                                <UserPlus className="w-3.5 h-3.5 flex-shrink-0 text-amber-300" />
                                                <span>Add Patient</span>
                                            </NavLink>
                                        </li>
                                    </ul>
                                )}
                            </li>
                            <li>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        if (!hasJustified) {
                                            e.preventDefault();
                                            openBreakGlass('/sysadmin/caregiver/devices');
                                            return;
                                        }
                                        setIsDeviceMenuOpen((prev) => !prev);
                                    }}
                                    className={`${phiNavLinkClasses} justify-between ${isDeviceMenuOpen ? 'ring-2 ring-amber-400/80' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <Activity className="w-4 h-4 flex-shrink-0 text-amber-300" />
                                        <span>Device Management</span>
                                    </div>
                                    <span className="text-[10px] text-red-300 font-mono">
                                        {isDeviceMenuOpen ? 'HIDE' : 'SHOW'}
                                    </span>
                                </button>
                                {isDeviceMenuOpen && hasJustified && (
                                    <ul className="mt-1 space-y-0.5 pl-4">
                                        <li>
                                            <NavLink
                                                to="/sysadmin/caregiver/devices/add"
                                                className={({ isActive }) =>
                                                    `${phiNavLinkClasses} ${isActive ? 'ring-2 ring-amber-400/80' : ''}`
                                                }
                                            >
                                                <PlusCircle className="w-3.5 h-3.5 flex-shrink-0 text-amber-300" />
                                                <span>Add New Device</span>
                                            </NavLink>
                                        </li>
                                        <li>
                                            <NavLink
                                                to="/sysadmin/caregiver/devices"
                                                end
                                                className={({ isActive }) =>
                                                    `${phiNavLinkClasses} ${isActive ? 'ring-2 ring-amber-400/80' : ''}`
                                                }
                                            >
                                                <Smartphone className="w-3.5 h-3.5 flex-shrink-0 text-amber-300" />
                                                <span>My Devices</span>
                                            </NavLink>
                                        </li>
                                        <li>
                                            <NavLink
                                                to="/sysadmin/command-center/firmware-ota"
                                                className={({ isActive }) =>
                                                    `${phiNavLinkClasses} ${isActive ? 'ring-2 ring-amber-400/80' : ''}`
                                                }
                                            >
                                                <Cpu className="w-3.5 h-3.5 flex-shrink-0 text-amber-300" />
                                                <span>Firmware OTA Updates</span>
                                            </NavLink>
                                        </li>
                                    </ul>
                                )}
                            </li>
                            <li>
                                <NavLink
                                    to="/sysadmin/caregiver/alerts"
                                    onClick={(e) => handlePhiClick(e, '/sysadmin/caregiver/alerts')}
                                    className={({ isActive }) =>
                                        `${phiNavLinkClasses} ${isActive ? 'ring-2 ring-amber-400/80' : ''}`
                                    }
                                >
                                    <Bell className="w-4 h-4 flex-shrink-0 text-amber-300" />
                                    <span>Alerts &amp; Notifications</span>
                                </NavLink>
                            </li>
                            <li>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        if (!hasJustified) {
                                            e.preventDefault();
                                            openBreakGlass('/sysadmin/caregiver/reports/daily');
                                            return;
                                        }
                                        setIsReportsMenuOpen((prev) => !prev);
                                    }}
                                    className={`${phiNavLinkClasses} justify-between ${isReportsMenuOpen ? 'ring-2 ring-amber-400/80' : ''}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <FileText className="w-4 h-4 flex-shrink-0 text-amber-300" />
                                        <span>Patient Care Reports</span>
                                    </div>
                                    <span className="text-[10px] text-red-300 font-mono">
                                        {isReportsMenuOpen ? 'HIDE' : 'SHOW'}
                                    </span>
                                </button>
                                {isReportsMenuOpen && hasJustified && (
                                    <ul className="mt-1 space-y-0.5 pl-4">
                                        <li>
                                            <NavLink
                                                to="/sysadmin/caregiver/reports/daily"
                                                className={({ isActive }) =>
                                                    `${phiNavLinkClasses} ${isActive ? 'ring-2 ring-amber-400/80' : ''}`
                                                }
                                            >
                                                <FileText className="w-3.5 h-3.5 flex-shrink-0 text-amber-300" />
                                                <span>Daily Health Summary</span>
                                            </NavLink>
                                        </li>
                                        <li>
                                            <NavLink
                                                to="/sysadmin/caregiver/reports/anomaly"
                                                className={({ isActive }) =>
                                                    `${phiNavLinkClasses} ${isActive ? 'ring-2 ring-amber-400/80' : ''}`
                                                }
                                            >
                                                <Activity className="w-3.5 h-3.5 flex-shrink-0 text-amber-300" />
                                                <span>Anomaly Log</span>
                                            </NavLink>
                                        </li>
                                        <li>
                                            <NavLink
                                                to="/sysadmin/caregiver/reports/moisture"
                                                className={({ isActive }) =>
                                                    `${phiNavLinkClasses} ${isActive ? 'ring-2 ring-amber-400/80' : ''}`
                                                }
                                            >
                                                <Droplets className="w-3.5 h-3.5 flex-shrink-0 text-amber-300" />
                                                <span>Moisture &amp; Hygiene Tracker</span>
                                            </NavLink>
                                        </li>
                                        <li>
                                            <NavLink
                                                to="/sysadmin/caregiver/reports/trend"
                                                className={({ isActive }) =>
                                                    `${phiNavLinkClasses} ${isActive ? 'ring-2 ring-amber-400/80' : ''}`
                                                }
                                            >
                                                <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 text-amber-300" />
                                                <span>Weekly Trend Analysis</span>
                                            </NavLink>
                                        </li>
                                        <li>
                                            <NavLink
                                                to="/sysadmin/caregiver/reports/exportable"
                                                className={({ isActive }) =>
                                                    `${phiNavLinkClasses} ${isActive ? 'ring-2 ring-amber-400/80' : ''}`
                                                }
                                            >
                                                <FileSpreadsheet className="w-3.5 h-3.5 flex-shrink-0 text-amber-300" />
                                                <span>Exportable Health Report</span>
                                            </NavLink>
                                        </li>
                                    </ul>
                                )}
                            </li>
                            <li>
                                <NavLink
                                    to="/sysadmin/caregiver/calendar"
                                    onClick={(e) => handlePhiClick(e, '/sysadmin/caregiver/calendar')}
                                    className={({ isActive }) =>
                                        `${phiNavLinkClasses} ${isActive ? 'ring-2 ring-amber-400/80' : ''}`
                                    }
                                >
                                    <CalendarClock className="w-4 h-4 flex-shrink-0 text-amber-300" />
                                    <span>Medical Calendar</span>
                                </NavLink>
                            </li>
                            <li>
                                <NavLink
                                    to="/sysadmin/caregiver/assignments"
                                    onClick={(e) => handlePhiClick(e, '/sysadmin/caregiver/assignments')}
                                    className={({ isActive }) =>
                                        `${phiNavLinkClasses} ${isActive ? 'ring-2 ring-amber-400/80' : ''}`
                                    }
                                >
                                    <ClipboardList className="w-4 h-4 flex-shrink-0 text-amber-300" />
                                    <span>Assignments &amp; Tasks</span>
                                </NavLink>
                            </li>
                            <li>
                                <NavLink
                                    to="/sysadmin/caregiver/settings"
                                    onClick={(e) => handlePhiClick(e, '/sysadmin/caregiver/settings')}
                                    className={({ isActive }) =>
                                        `${phiNavLinkClasses} ${isActive ? 'ring-2 ring-amber-400/80' : ''}`
                                    }
                                >
                                    <Settings className="w-4 h-4 flex-shrink-0 text-amber-300" />
                                    <span>Settings</span>
                                </NavLink>
                            </li>
                        </ul>
                    )}
                </div>
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-slate-700">
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                </button>
                <p className="text-xs text-slate-500 text-center mt-3">System Admin Console</p>
            </div>

            {/* Break-Glass Modal for PHI Zone */}
            {showBreakGlass && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-xl bg-slate-900 border border-red-500/70 shadow-2xl p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-red-900/80 border border-red-400/80">
                                <ShieldCheck className="w-5 h-5 text-red-200" />
                            </div>
                            <div>
                                <h2 className="text-sm font-bold text-red-100 tracking-tight">
                                    RESTRICTED HEALTH INFORMATION.
                                </h2>
                                <p className="text-[11px] text-red-200/80 font-medium">
                                    You are operating outside standard administrative bounds. Please enter a Justification Code
                                    (e.g., IT Support Ticket ID) to proceed.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-amber-200 tracking-wide">
                                Justification Code
                            </label>
                            <input
                                type="text"
                                value={justificationCode}
                                onChange={(e) => setJustificationCode(e.target.value)}
                                className="w-full rounded-md border border-amber-400/60 bg-slate-950/60 px-3 py-2 text-sm text-amber-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400/80"
                                placeholder="e.g. IT-INC-2026-00123"
                            />
                            <p className="text-[10px] text-amber-200/80 mt-1">
                                Access is logged and may be audited. Use only for legitimate support, forensic, or incident-response
                                purposes.
                            </p>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowBreakGlass(false);
                                    setBreakGlassTarget(null);
                                    setJustificationCode('');
                                }}
                                className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 border border-slate-600 hover:bg-slate-800"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleAcknowledge}
                                disabled={!justificationCode.trim()}
                                className="px-4 py-1.5 rounded-md text-xs font-semibold bg-red-600 disabled:bg-red-900/60 disabled:text-red-200/60 text-red-50 hover:bg-red-500 shadow-sm border border-red-400/80"
                            >
                                Acknowledge
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}
