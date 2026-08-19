import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { FileSearch, Download, Filter, RefreshCw } from 'lucide-react';

const API = `${import.meta.env.VITE_API_URL || ''}/api/sysadmin`;
const getAuth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

interface AuditLog {
    log_id: number;
    timestamp: string;
    action: string;
    severity: string;
    ip_address: string;
    username: string;
    email: string;
    resource_affected: string;
}

const severityVariant = (s: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    if (s === 'CRITICAL') return 'destructive';
    if (s === 'WARNING') return 'outline';
    return 'secondary';
};

export default function ForensicAuditTrails() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [severity, setSeverity] = useState('all'); // 'all' is the sentinel for "no filter"
    const [action, setAction] = useState('');
    const [limit, setLimit] = useState('100');
    const [activeTab, setActiveTab] = useState<'all' | 'role-changes' | 'auth-failures'>('all');
    const [loading, setLoading] = useState(false);

    const fetchLogs = async (tab: typeof activeTab = activeTab) => {
        setLoading(true);
        try {
            let url = `${API}/audit-logs`;
            if (tab === 'role-changes') url += '/role-changes';
            else if (tab === 'auth-failures') url += '/auth-failures';
            else {
                const params = new URLSearchParams();
                // [UI] 'all' is the SelectItem sentinel — translate to empty string (no filter)
                if (severity && severity !== 'all') params.set('severity', severity);
                if (action) params.set('action', action);
                if (limit) params.set('limit', limit);
                if (params.toString()) url += `?${params.toString()}`;
            }
            const res = await fetch(url, { headers: getAuth() });
            const data = await res.json();
            if (data.success) setLogs(data.data);
        } catch {
            toast.error('Failed to load audit logs.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const switchTab = (tab: typeof activeTab) => {
        setActiveTab(tab);
        fetchLogs(tab);
    };

   const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const handleExportPdf = () => {
    window.open(`${API_URL}/api/sysadmin/audit-logs/export`, '_blank');
    toast.info('PDF export started. Event logged.');
};

    const tabs = [
        { key: 'all', label: 'All Events' },
        { key: 'role-changes', label: 'Role Changes' },
        { key: 'auth-failures', label: 'Auth Failures' },
    ];

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-teal-900 tracking-tight">Forensic Audit Trails</h2>
                    <p className="text-[10px] font-medium text-slate-500">
                        HIPAA 164.312(b) — Complete audit record for all system events. Required for incident
                        investigations and DPO reporting.
                    </p>
                </div>
                <Button
                    onClick={handleExportPdf}
                    variant="outline"
                    size="sm"
                    className="border-slate-200 text-slate-600"
                >
                    <Download className="w-4 h-4 mr-2" /> Export PDF for DPO
                </Button>
            </div>

            {/* Tab Switcher */}
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit border border-slate-200">
                {tabs.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => switchTab(t.key as typeof activeTab)}
                        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${
                            activeTab === t.key
                                ? 'bg-white text-slate-800 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Filters (only for "all" tab) */}
            {activeTab === 'all' && (
                <Card className="bg-white border border-slate-200 shadow-sm">
                    <CardHeader className="py-2 px-4 pb-1">
                        <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                            <Filter className="w-4 h-4" /> Filter Events
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-3 pt-0">
                        <div className="flex gap-2 flex-wrap">
                            <Select value={severity} onValueChange={setSeverity}>
                                <SelectTrigger className="w-36 h-8 bg-white border-slate-300 text-slate-700 text-xs">
                                    <SelectValue placeholder="Severity" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Severities</SelectItem>
                                    <SelectItem value="CRITICAL">Critical</SelectItem>
                                    <SelectItem value="WARNING">Warning</SelectItem>
                                    <SelectItem value="INFO">Info</SelectItem>
                                </SelectContent>
                            </Select>
                            <Input
                                value={action}
                                onChange={(e) => setAction(e.target.value)}
                                placeholder="Action keyword"
                                className="h-8 w-40 bg-white border-slate-300 text-slate-800 text-xs"
                            />
                            <Select value={limit} onValueChange={setLimit}>
                                <SelectTrigger className="w-28 h-8 bg-white border-slate-300 text-slate-700 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="50">Last 50</SelectItem>
                                    <SelectItem value="100">Last 100</SelectItem>
                                    <SelectItem value="500">Last 500</SelectItem>
                                    <SelectItem value="1000">Last 1000</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button
                                onClick={() => fetchLogs('all')}
                                size="sm"
                                className="h-8 bg-teal-700 hover:bg-teal-600 text-white text-xs"
                            >
                                <RefreshCw className="w-3 h-3 mr-1.5" /> Apply
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Log Table */}
            <Card className="bg-white border border-slate-200 shadow-sm">
                <CardHeader className="py-2 px-4 pb-1">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        <FileSearch className="w-4 h-4 text-teal-600" />
                        {logs.length} events returned
                    </CardTitle>
                    <CardDescription className="text-[10px] text-slate-400">
                        All data includes IP address and user agent — accessible only to System Admin (HIPAA full technical
                        detail).
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[520px] overflow-y-auto">
                        {loading ? (
                            <p className="text-xs text-slate-400 p-4">Loading...</p>
                        ) : logs.length === 0 ? (
                            <p className="text-xs text-slate-400 p-4">No events match the current filters.</p>
                        ) : (
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="text-left px-4 py-2 text-slate-500 font-medium">Timestamp</th>
                                        <th className="text-left px-4 py-2 text-slate-500 font-medium">Action</th>
                                        <th className="text-left px-4 py-2 text-slate-500 font-medium">Severity</th>
                                        <th className="text-left px-4 py-2 text-slate-500 font-medium">User</th>
                                        <th className="text-left px-4 py-2 text-slate-500 font-medium">IP Address</th>
                                        <th className="text-left px-4 py-2 text-slate-500 font-medium">Resource</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr
                                            key={log.log_id}
                                            className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                                        >
                                            <td className="px-4 py-2 text-slate-400 font-mono whitespace-nowrap">
                                                {new Date(log.timestamp).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-2 text-slate-800 font-mono">{log.action}</td>
                                            <td className="px-4 py-2">
                                                <Badge variant={severityVariant(log.severity)} className="text-xs">
                                                    {log.severity}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-2 text-slate-700">{log.username || '—'}</td>
                                            <td className="px-4 py-2 text-slate-500 font-mono">
                                                {log.ip_address || '—'}
                                            </td>
                                            <td className="px-4 py-2 text-slate-600 max-w-xs truncate">
                                                {log.resource_affected}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

