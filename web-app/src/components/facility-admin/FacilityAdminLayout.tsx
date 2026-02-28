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
        <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
            <FacilityAdminSidebar />

            <div className="ml-60 transition-all duration-300">
                {/* Header */}
                <header
                    className="sticky top-0 z-40 px-6 py-4 border-b border-slate-200 bg-white"
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Facility Administration</h2>
                            <p className="text-xs text-slate-500">Ward Operations — Authorized Personnel Only</p>
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
