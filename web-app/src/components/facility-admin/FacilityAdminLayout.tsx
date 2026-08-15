import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { FacilityAdminSidebar } from './FacilityAdminSidebar';
import { Toaster } from '@/components/ui/sonner';
import { Building2 } from 'lucide-react';

// [OWASP A01] This layout only renders for facility_admin role
export default function FacilityAdminLayout() {
    const { user, isLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                navigate('/login');
            } else if (user.role !== 'facility_admin') {
                navigate('/dashboard');
            }
        }
    }, [user, isLoading, navigate]);

    if (isLoading || !user || user.role !== 'facility_admin') return null;

    return (
        <div className="flex h-screen overflow-hidden" style={{ backgroundColor: '#F8FAFC' }}>
            <FacilityAdminSidebar />

            <div className="flex-1 flex flex-col h-full overflow-hidden">
                {/* Header */}
                <header
                    className="bg-white border-b border-slate-200 flex-shrink-0 px-6 py-2 shadow-sm z-20 h-14 flex items-center justify-between"
                >
                    <div>
                        <h2 className="text-lg font-bold text-teal-900 tracking-tight">Facility Administration</h2>
                        <p className="text-[10px] text-slate-500 font-medium">Ward Operations — Authorized Personnel Only</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
                            <Building2 className="w-4 h-4 text-teal-600" />
                            <span className="text-sm font-medium text-slate-700">
                                {user.name || user.username || 'Facility Admin'}
                            </span>
                            <span className="text-xs text-teal-600 font-mono">FACILITY ADMIN</span>
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
