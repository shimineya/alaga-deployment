import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import {
    LayoutDashboard,
    Users,
    UserPlus,
    Bell,
    Activity,
    LogOut,
    Building2
} from 'lucide-react';

const navItems = [
    { title: 'Ward Dashboard', url: '/facility-admin', icon: LayoutDashboard },
    { title: 'Staff Management', url: '/facility-admin/staff', icon: Users },
    { title: 'Patient Onboarding', url: '/facility-admin/patients', icon: UserPlus },
    { title: 'Alert Configuration', url: '/facility-admin/alerts', icon: Bell },
    { title: 'Diagnostics & Logs', url: '/facility-admin/diagnostics', icon: Activity },
];

export function FacilityAdminSidebar() {
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
            style={{ backgroundColor: '#1E293B', zIndex: 50 }}
        >
            {/* Logo */}
            <div className="p-6 border-b border-slate-700">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: '#0D9488' }}
                    >
                        <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-white text-base font-bold tracking-tight">ALAGA</h1>
                        <p className="text-xs font-medium" style={{ color: '#94A3B8' }}>Facility Admin</p>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 overflow-y-auto">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 px-6 mb-2">Ward Operations</p>
                <ul className="space-y-0.5 px-3">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.url;
                        return (
                            <li key={item.title}>
                                <Link
                                    to={item.url}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 relative ${isActive ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-slate-700'
                                        }`}
                                    style={isActive ? { backgroundColor: 'rgba(13, 148, 136, 0.15)' } : {}}
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
                <p className="text-xs text-slate-600 text-center mt-3">Facility Admin Console</p>
            </div>
        </aside>
    );
}
