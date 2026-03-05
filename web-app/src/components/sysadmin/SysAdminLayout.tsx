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
                navigate('/dashboard');
            }
        }
    }, [user, isLoading, navigate]);

    // [OWASP A01] Only block rendering once we are certain the user is unauthorized.
    // Do NOT return null during isLoading — this causes a blank flash on sub-route navigation.
    if (!isLoading && (!user || (user.role !== 'system_admin' && user.role !== 'admin'))) return null;
    if (!user) return null; // No user at all (pre-auth), prevent rendering with undefined user.name

    return (
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F8FAFC' }}>
            <SysAdminSidebar />

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-slate-200 flex-shrink-0 px-6 py-2 shadow-sm z-20 h-14 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-teal-900 tracking-tight">System Administration</h2>
                        <p className="text-[10px] text-slate-500 font-medium">CISO / IT Operations Console — Authorized Personnel Only</p>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* User badge */}
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
                            <ShieldCheck className="w-4 h-4 text-teal-600" />
                            <span className="text-sm font-medium text-slate-700">
                                {user.name || user.username || 'System Admin'}
                            </span>
                            <span className="text-xs text-teal-600 font-mono">SYSADMIN</span>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 scroll-smooth">
                    <div className="w-full h-full pb-10">
                        <Outlet />
                    </div>
                </main>
            </div>

            <Toaster />
        </div>
    );
}
