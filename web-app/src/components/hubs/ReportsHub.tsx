import React from 'react';
import { useAuth } from '@/lib/auth-context';
import SystemAdminReportsHub from '../sysadmin/SystemAdminReportsHub';
import { Lock, FileSpreadsheet } from 'lucide-react';

export default function ReportsHub() {
    const { user, isSysAdmin } = useAuth();
    const role = user?.role?.toLowerCase() || '';
    const isSysAdminUser = isSysAdmin || ['system_admin', 'sysadmin', 'admin'].includes(role);

    if (!isSysAdminUser) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 bg-white rounded-xl border border-slate-200">
                <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
                    <Lock className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 tracking-tight">Access Restricted</h2>
                <p className="text-sm text-slate-500 max-w-md mt-2">
                    System Reports & Observability are restricted to <strong>System Administrators</strong>. For patient clinical records, please visit the <strong>Clinical Reports Hub</strong>.
                </p>
            </div>
        );
    }

    return <SystemAdminReportsHub />;
}
