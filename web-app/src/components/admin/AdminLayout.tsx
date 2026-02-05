import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { AdminSidebar } from './AdminSidebar';
import { Toaster } from '@/components/ui/sonner';
import { User } from 'lucide-react';

export default function AdminLayout() {
  const { user, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  // [Security] Redirect unauthorized users
  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        navigate('/login');
      } else if (user.role !== 'admin') {
        navigate('/dashboard');
      }
    }
  }, [user, isLoading, navigate]);

  if (isLoading || !user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* 1. Fixed Sidebar (Width: 240px / w-60) */}
      <AdminSidebar />

      {/* 2. Main Content Area (Pushed 240px to the right) */}
      <div className="ml-60 transition-all duration-300">

        {/* Admin Header */}
        <header className="bg-white dark:bg-slate-950 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold" style={{ color: '#2C3E50' }}>System Administration</h2>
              <p className="text-sm text-gray-500">Authorized Personnel Only</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 dark:bg-slate-800">
                <User className="w-4 h-4 text-teal-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {user.name || 'Administrator'}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>

      <Toaster />
    </div>
  );
}