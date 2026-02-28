import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { SysAdminSidebar } from './SysAdminSidebar';
import { Toaster } from '@/components/ui/sonner';
import { ShieldCheck } from 'lucide-react';

// [OWASP A01] This layout only renders for system_admin or legacy admin roles
export default function SysAdminLayout() {
    const { user, isLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                navigate('/login');
            } else if (user.role !== 'system_admin' && user.role !== 'admin') {
                // Non-system-admins are redirected to their own dashboard
                navigate('/dashboard');
            }
        }
    }, [user, isLoading, navigate]);

    if (isLoading || !user || (user.role !== 'system_admin' && user.role !== 'admin')) return null;

    return (
        <div className="min-h-screen bg-slate-950">
            <SysAdminSidebar />

            <div className="ml-60 transition-all duration-300">
                {/* Header */}
                <header
                    className="sticky top-0 z-40 px-6 py-4 border-b border-slate-800"
                    style={{ backgroundColor: '#0F172A' }}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-white">System Administration</h2>
                            <p className="text-xs text-slate-400">CISO / IT Operations Console — Authorized Personnel Only</p>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* System status pill */}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium bg-emerald-900/50 text-emerald-400 border border-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                System Operational
                            </div>
                            {/* User badge */}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700">
                                <ShieldCheck className="w-4 h-4 text-teal-400" />
                                <span className="text-sm font-medium text-slate-200">
                                    {user.name || user.username || 'System Admin'}
                                </span>
                                <span className="text-xs text-teal-400 font-mono">SYSADMIN</span>
                            </div>
                        </div>
                    </div>
                </header>

                <main className="p-6">
                    <Outlet />
                </main>
            </div>

            <Toaster />
        </div>
    );
}
