import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import {
    FileSpreadsheet,
    ShieldAlert,
    Radio,
    Activity,
    Building2,
    Database,
    Search,
    Filter,
    Download,
    PlusCircle,
    Archive,
    ArchiveRestore,
    Trash2,
    Eye,
    RefreshCw,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Lock,
    Users,
    Key,
    Server,
    Cpu,
    Wifi,
    HardDrive,
    TrendingUp,
    FileText,
    ChevronRight,
    Sparkles,
    Check
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import SystemAdminClinicalAnalytics from './SystemAdminClinicalAnalytics';

export interface SystemReport {
    report_id: number;
    title: string;
    category: string;
    report_type: string;
    severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    summary: string;
    details: any;
    generated_by: string;
    is_archived: boolean;
    created_at: string;
    updated_at: string;
}

export interface ReportsMetrics {
    total_reports: string | number;
    active_reports: string | number;
    archived_reports: string | number;
    security_count: string | number;
    governance_count: string | number;
    hardware_count: string | number;
    performance_count: string | number;
    tenancy_count: string | number;
    device_pairing_count: string | number;
}

const CATEGORIES = [
    'ALL',
    'Security & Authentication',
    'Audit Trail & Access Governance',
    'Hardware & IoT Infrastructure',
    'Application Performance & Reliability',
    'Multi-Tenant & Facility Management'
];

export default function SystemAdminReportsHub() {
    const { token } = useAuth();
    const [reports, setReports] = useState<SystemReport[]>([]);
    const [metrics, setMetrics] = useState<ReportsMetrics | null>(null);
    const [pillarsData, setPillarsData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('ledger');

    // Filter states
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('ALL');
    const [selectedSeverity, setSelectedSeverity] = useState('ALL');
    const [selectedStatus, setSelectedStatus] = useState<'active' | 'archived' | 'all'>('active');

    // Dialog states
    const [selectedReportForView, setSelectedReportForView] = useState<SystemReport | null>(null);
    const [selectedReportForDelete, setSelectedReportForDelete] = useState<SystemReport | null>(null);
    const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);

    // On-demand generation state
    const [genCategory, setGenCategory] = useState('Security & Authentication');
    const [genType, setGenType] = useState('FAILED_LOGIN_LOCKOUT');
    const [genTitle, setGenTitle] = useState('');
    const [genSummary, setGenSummary] = useState('');
    const [genSeverity, setGenSeverity] = useState('INFO');
    const [isGenerating, setIsGenerating] = useState(false);

    const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/sysadmin`;

    // Fetch reports from backend
    const fetchReports = useCallback(async () => {
        if (!token) return;
        try {
            setIsLoading(true);
            const queryParams = new URLSearchParams();
            if (selectedCategory !== 'ALL') queryParams.append('category', selectedCategory);
            if (selectedSeverity !== 'ALL') queryParams.append('severity', selectedSeverity);
            queryParams.append('status', selectedStatus);
            if (searchQuery.trim()) queryParams.append('search', searchQuery.trim());

            const [repRes, metRes, pilRes] = await Promise.all([
                fetch(`${API_BASE}/reports?${queryParams.toString()}`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_BASE}/reports/metrics`, {
                    headers: { Authorization: `Bearer ${token}` }
                }),
                fetch(`${API_BASE}/reports/pillars-data`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            ]);

            const repData = await repRes.json();
            const metData = await metRes.json();
            const pilData = await pilRes.json();

            if (repData.success) setReports(repData.data || []);
            if (metData.success) setMetrics(metData.data || null);
            if (pilData.success) setPillarsData(pilData.data || null);
        } catch (err) {
            console.error('Failed to load system reports:', err);
            toast.error('Could not load system reports. Please check backend connection.');
        } finally {
            setIsLoading(false);
        }
    }, [token, selectedCategory, selectedSeverity, selectedStatus, searchQuery, API_BASE]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    // Handle Archive / Restore
    const handleToggleArchive = async (report: SystemReport) => {
        try {
            const nextArchived = !report.is_archived;
            const res = await fetch(`${API_BASE}/reports/${report.report_id}/archive`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ is_archived: nextArchived })
            });
            const data = await res.json();
            if (data.success) {
                toast.success(nextArchived ? 'Report moved to Archive.' : 'Report restored to active ledger.');
                fetchReports();
                if (selectedReportForView?.report_id === report.report_id) {
                    setSelectedReportForView(null);
                }
            } else {
                toast.error(data.message || 'Failed to update report archive status.');
            }
        } catch (err) {
            toast.error('Network error updating report archive status.');
        }
    };

    // Handle Delete
    const handleDeleteReport = async () => {
        if (!selectedReportForDelete) return;
        try {
            const res = await fetch(`${API_BASE}/reports/${selectedReportForDelete.report_id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                toast.success('Report permanently deleted from ledger.');
                setSelectedReportForDelete(null);
                fetchReports();
            } else {
                toast.error(data.message || 'Failed to delete report.');
            }
        } catch (err) {
            toast.error('Network error deleting report.');
        }
    };

    // Handle Generate On-Demand Report
    const handleGenerateReport = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setIsGenerating(true);
            const res = await fetch(`${API_BASE}/reports/generate`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    category: genCategory,
                    report_type: genType,
                    title: genTitle || `${genCategory} Snapshot`,
                    summary: genSummary || 'System administrator on-demand audit snapshot.',
                    severity: genSeverity,
                    details: {
                        timestamp: new Date().toISOString(),
                        snapshot_type: genType,
                        manual_generation: true,
                        metrics_evaluated: 128
                    }
                })
            });
            const data = await res.json();
            if (data.success) {
                toast.success('New report generated and saved to ledger.');
                setIsGenerateModalOpen(false);
                setGenTitle('');
                setGenSummary('');
                fetchReports();
            } else {
                toast.error(data.message || 'Failed to generate report.');
            }
        } catch (err) {
            toast.error('Network error generating report.');
        } finally {
            setIsGenerating(false);
        }
    };

    // Export reports to CSV
    const handleExportCSV = () => {
        if (reports.length === 0) {
            toast.error('No reports to export.');
            return;
        }
        const headers = ['Report ID', 'Title', 'Category', 'Type', 'Severity', 'Summary', 'Generated By', 'Created At', 'Archived'];
        const rows = reports.map(r => [
            r.report_id,
            `"${r.title.replace(/"/g, '""')}"`,
            `"${r.category}"`,
            `"${r.report_type}"`,
            r.severity,
            `"${(r.summary || '').replace(/"/g, '""')}"`,
            `"${r.generated_by}"`,
            r.created_at,
            r.is_archived ? 'YES' : 'NO'
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `alaga_system_reports_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('Exported reports to CSV successfully.');
    };

    // Severity badge styling
    const renderSeverityBadge = (severity: string) => {
        switch (severity?.toUpperCase()) {
            case 'CRITICAL':
                return <Badge className="bg-red-500 hover:bg-red-600 text-white font-bold">CRITICAL</Badge>;
            case 'HIGH':
                return <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold">HIGH</Badge>;
            case 'MEDIUM':
                return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold">MEDIUM</Badge>;
            case 'LOW':
                return <Badge className="bg-blue-500 hover:bg-blue-600 text-white font-bold">LOW</Badge>;
            default:
                return <Badge variant="secondary" className="bg-slate-100 text-slate-700 font-medium">INFO</Badge>;
        }
    };

    return (
        <div className="w-full h-full animate-in fade-in duration-300 flex flex-col space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700 border border-teal-100">
                            <FileSpreadsheet className="w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                                System Reports & Observability Hub
                                <Badge className="bg-slate-900 text-white text-[10px] uppercase font-mono tracking-wider">Root Governance</Badge>
                            </h1>
                            <p className="text-xs text-slate-500 mt-0.5">
                                Central repository for system stability, forensic audits, IoT device pairing, security events, and compliance ledger.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchReports}
                        className="border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold h-9"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportCSV}
                        className="border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold h-9"
                    >
                        <Download className="w-3.5 h-3.5 mr-1.5" /> Export CSV
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => setIsGenerateModalOpen(true)}
                        className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold h-9 shadow-sm shadow-teal-500/20"
                    >
                        <PlusCircle className="w-3.5 h-3.5 mr-1.5" /> Generate Report
                    </Button>
                </div>
            </div>

            {/* KPI Metrics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card className="border-slate-100 shadow-sm bg-gradient-to-br from-white to-slate-50/50">
                    <CardContent className="p-3.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Reports</p>
                            <h3 className="text-xl font-extrabold text-slate-800 mt-0.5">{metrics?.total_reports || 0}</h3>
                        </div>
                        <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                            <FileText className="w-4 h-4" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm bg-gradient-to-br from-white to-red-50/30">
                    <CardContent className="p-3.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">Security & Auth</p>
                            <h3 className="text-xl font-extrabold text-red-600 mt-0.5">{metrics?.security_count || 0}</h3>
                        </div>
                        <div className="p-2 rounded-xl bg-red-50 text-red-600">
                            <ShieldAlert className="w-4 h-4" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm bg-gradient-to-br from-white to-indigo-50/30">
                    <CardContent className="p-3.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Access & Governance</p>
                            <h3 className="text-xl font-extrabold text-indigo-600 mt-0.5">{metrics?.governance_count || 0}</h3>
                        </div>
                        <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                            <Lock className="w-4 h-4" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm bg-gradient-to-br from-white to-teal-50/30">
                    <CardContent className="p-3.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">Hardware & Pairings</p>
                            <h3 className="text-xl font-extrabold text-teal-700 mt-0.5">{metrics?.hardware_count || 0}</h3>
                        </div>
                        <div className="p-2 rounded-xl bg-teal-50 text-teal-600">
                            <Radio className="w-4 h-4" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm bg-gradient-to-br from-white to-amber-50/30">
                    <CardContent className="p-3.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">App Performance</p>
                            <h3 className="text-xl font-extrabold text-amber-700 mt-0.5">{metrics?.performance_count || 0}</h3>
                        </div>
                        <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                            <Activity className="w-4 h-4" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-100 shadow-sm bg-gradient-to-br from-white to-purple-50/30">
                    <CardContent className="p-3.5 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider">Archived Reports</p>
                            <h3 className="text-xl font-extrabold text-purple-700 mt-0.5">{metrics?.archived_reports || 0}</h3>
                        </div>
                        <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                            <Archive className="w-4 h-4" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs for Central Ledger and 5 Observability Pillars */}
            <Tabs defaultValue="ledger" value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col">
                <div className="border-b border-slate-200 mb-6 shrink-0">
                    <TabsList className="bg-transparent h-12 p-0 flex gap-6 justify-start overflow-x-auto">
                        <TabsTrigger
                            value="ledger"
                            className="data-[state=active]:bg-teal-50/90 data-[state=active]:text-teal-900 data-[state=active]:font-extrabold data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Reports Ledger ({reports.length})
                        </TabsTrigger>

                        <TabsTrigger
                            value="security"
                            className="data-[state=active]:bg-teal-50/90 data-[state=active]:text-teal-900 data-[state=active]:font-extrabold data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                        >
                            <ShieldAlert className="w-4 h-4" /> 1. Security & Auth
                        </TabsTrigger>

                        <TabsTrigger
                            value="governance"
                            className="data-[state=active]:bg-teal-50/90 data-[state=active]:text-teal-900 data-[state=active]:font-extrabold data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                        >
                            <Lock className="w-4 h-4" /> 2. Access Governance
                        </TabsTrigger>

                        <TabsTrigger
                            value="hardware"
                            className="data-[state=active]:bg-teal-50/90 data-[state=active]:text-teal-900 data-[state=active]:font-extrabold data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                        >
                            <Radio className="w-4 h-4" /> 3. Hardware & IoT
                        </TabsTrigger>

                        <TabsTrigger
                            value="performance"
                            className="data-[state=active]:bg-teal-50/90 data-[state=active]:text-teal-900 data-[state=active]:font-extrabold data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                        >
                            <Activity className="w-4 h-4" /> 4. App Performance
                        </TabsTrigger>

                        <TabsTrigger
                            value="tenancy"
                            className="data-[state=active]:bg-teal-50/90 data-[state=active]:text-teal-900 data-[state=active]:font-extrabold data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                        >
                            <Building2 className="w-4 h-4" /> 5. Multi-Tenant Facilities
                        </TabsTrigger>

                        <TabsTrigger
                            value="clinical-analytics"
                            className="data-[state=active]:bg-teal-50/90 data-[state=active]:text-teal-900 data-[state=active]:font-extrabold data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-t-lg h-11 px-3 text-sm font-semibold text-slate-500 flex items-center gap-2 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                        >
                            <TrendingUp className="w-4 h-4" /> 6. Clinical Analytics (De-Identified)
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* TAB 1: CENTRAL REPORTS LEDGER */}
                <TabsContent value="ledger" className="mt-0 flex-1 space-y-4">
                    {/* Filter Bar */}
                    <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search report titles, summaries, keywords..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:ring-1 focus:ring-teal-500 focus:border-teal-500 outline-none bg-white"
                            />
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <Filter className="w-3.5 h-3.5" />
                                <span>Category:</span>
                            </div>
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-teal-500 bg-white"
                            >
                                {CATEGORIES.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>

                            <select
                                value={selectedSeverity}
                                onChange={(e) => setSelectedSeverity(e.target.value)}
                                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-teal-500 bg-white"
                            >
                                <option value="ALL">All Severities</option>
                                <option value="INFO">INFO</option>
                                <option value="LOW">LOW</option>
                                <option value="MEDIUM">MEDIUM</option>
                                <option value="HIGH">HIGH</option>
                                <option value="CRITICAL">CRITICAL</option>
                            </select>

                            <div className="flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                                <button
                                    onClick={() => setSelectedStatus('active')}
                                    className={`text-[11px] px-2.5 py-1 rounded-md font-semibold transition-all ${selectedStatus === 'active' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    Active
                                </button>
                                <button
                                    onClick={() => setSelectedStatus('archived')}
                                    className={`text-[11px] px-2.5 py-1 rounded-md font-semibold transition-all ${selectedStatus === 'archived' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    Archived
                                </button>
                                <button
                                    onClick={() => setSelectedStatus('all')}
                                    className={`text-[11px] px-2.5 py-1 rounded-md font-semibold transition-all ${selectedStatus === 'all' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    All
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Report Table */}
                    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                                        <th className="py-3 px-4">Report Details</th>
                                        <th className="py-3 px-4">Category</th>
                                        <th className="py-3 px-4">Severity</th>
                                        <th className="py-3 px-4">Generated By</th>
                                        <th className="py-3 px-4">Timestamp</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {reports.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="text-center py-12 text-slate-400 italic">
                                                No reports found matching the selected criteria.
                                            </td>
                                        </tr>
                                    ) : (
                                        reports.map((report) => (
                                            <tr key={report.report_id} className="hover:bg-slate-50/70 transition-colors">
                                                <td className="py-3.5 px-4 max-w-md">
                                                    <div className="flex items-start gap-2">
                                                        {report.is_archived && (
                                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold bg-purple-100 text-purple-800 mt-0.5">
                                                                Archived
                                                            </span>
                                                        )}
                                                        <div>
                                                            <span className="font-bold text-slate-900 block">{report.title}</span>
                                                            <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{report.summary}</p>
                                                            <span className="text-[10px] font-mono text-slate-400">Type: {report.report_type}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                                                        {report.category}
                                                    </span>
                                                </td>
                                                <td className="py-3.5 px-4 whitespace-nowrap">
                                                    {renderSeverityBadge(report.severity)}
                                                </td>
                                                <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600">
                                                    {report.generated_by}
                                                </td>
                                                <td className="py-3.5 px-4 whitespace-nowrap text-slate-500">
                                                    {new Date(report.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                                </td>
                                                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setSelectedReportForView(report)}
                                                            className="h-7 px-2 text-teal-700 hover:bg-teal-50"
                                                            title="View Report Preview & JSON Details"
                                                        >
                                                            <Eye className="w-3.5 h-3.5 mr-1" /> View
                                                        </Button>

                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleToggleArchive(report)}
                                                            className={`h-7 px-2 ${report.is_archived ? 'text-purple-700 hover:bg-purple-50' : 'text-slate-600 hover:bg-slate-100'}`}
                                                            title={report.is_archived ? "Restore to active ledger" : "Archive report"}
                                                        >
                                                            {report.is_archived ? (
                                                                <><ArchiveRestore className="w-3.5 h-3.5 mr-1" /> Restore</>
                                                            ) : (
                                                                <><Archive className="w-3.5 h-3.5 mr-1" /> Archive</>
                                                            )}
                                                        </Button>

                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setSelectedReportForDelete(report)}
                                                            className="h-7 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                            title="Delete report permanently"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </TabsContent>

                {/* TAB 2: SECURITY & AUTHENTICATION PILLAR */}
                <TabsContent value="security" className="mt-0 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 1. Failed Login & Lockout Summary */}
                        <Card className="border-slate-100 shadow-sm">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-bold flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-red-600">
                                        <Lock className="w-4 h-4" /> Failed Login & Lockout Summary
                                    </span>
                                    <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50 text-[10px]">Zero-Trust Perimeter</Badge>
                                </CardTitle>
                                <CardDescription className="text-xs">Live consecutive failed login attempts and potential account lockouts.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-2 space-y-3">
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="p-2.5 rounded-xl bg-red-50/60 border border-red-100">
                                        <span className="text-[10px] font-bold text-red-600 uppercase">Failed Logins (24h)</span>
                                        <p className="text-lg font-black text-red-700 mt-0.5">{pillarsData?.security?.failed_logins_24h ?? 0}</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
                                        <span className="text-[10px] font-bold text-amber-700 uppercase">Affected Users</span>
                                        <p className="text-lg font-black text-amber-800 mt-0.5">{pillarsData?.security?.affected_users ?? 0}</p>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
                                        <span className="text-[10px] font-bold text-emerald-700 uppercase">Perimeter State</span>
                                        <p className="text-xs font-bold text-emerald-800 mt-1.5">{pillarsData?.security?.failed_logins_24h > 0 ? 'Review Needed' : 'Nominal'}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 2. User Identity & Role Adoption */}
                        <Card className="border-slate-100 shadow-sm">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-bold flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-teal-700">
                                        <Key className="w-4 h-4" /> Identity & User Adoption Overview
                                    </span>
                                    <Badge variant="outline" className="text-teal-700 border-teal-200 bg-teal-50 text-[10px]">
                                        {pillarsData?.users?.total_users || 0} Total Accounts
                                    </Badge>
                                </CardTitle>
                                <CardDescription className="text-xs">Active vs. pending user accounts and clinical role distribution.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-2 space-y-2 text-xs">
                                <div className="grid grid-cols-4 gap-2 text-center">
                                    <div className="p-2 rounded-lg bg-teal-50 text-teal-800">
                                        <span className="text-[9px] text-teal-600 block uppercase font-bold">Active</span>
                                        <strong>{pillarsData?.users?.active_users || 0}</strong>
                                    </div>
                                    <div className="p-2 rounded-lg bg-amber-50 text-amber-800">
                                        <span className="text-[9px] text-amber-600 block uppercase font-bold">Pending</span>
                                        <strong>{pillarsData?.users?.pending_users || 0}</strong>
                                    </div>
                                    <div className="p-2 rounded-lg bg-blue-50 text-blue-800">
                                        <span className="text-[9px] text-blue-600 block uppercase font-bold">Med Staff</span>
                                        <strong>{pillarsData?.users?.medical_staff || 0}</strong>
                                    </div>
                                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-800">
                                        <span className="text-[9px] text-indigo-600 block uppercase font-bold">Caregivers</span>
                                        <strong>{pillarsData?.users?.caregivers || 0}</strong>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 3. Session & Revocation Logs */}
                        <Card className="border-slate-100 shadow-sm">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-bold flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-indigo-700">
                                        <Activity className="w-4 h-4" /> Session & Revocation Logs
                                    </span>
                                    <Badge variant="outline" className="text-indigo-700 border-indigo-200 bg-indigo-50 text-[10px]">JWT Blacklist</Badge>
                                </CardTitle>
                                <CardDescription className="text-xs">Tracks active sessions and invalidated authorization tokens.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-2 space-y-2 text-xs">
                                <div className="flex justify-between items-center py-2 border-b border-slate-100">
                                    <span className="text-slate-600">Total Revoked Tokens in Database</span>
                                    <span className="font-bold font-mono text-indigo-600">{pillarsData?.security?.session_revocations ?? 0}</span>
                                </div>
                                <div className="flex justify-between items-center py-2">
                                    <span className="text-slate-600">JWT Invalidation Status</span>
                                    <span className="font-bold font-mono text-emerald-600">Active</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 4. IP Blacklist & Threat Activity */}
                        <Card className="border-slate-100 shadow-sm">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-bold flex items-center justify-between">
                                    <span className="flex items-center gap-2 text-slate-800">
                                        <ShieldAlert className="w-4 h-4 text-amber-600" /> IP Blacklist & Blocked Origins
                                    </span>
                                    <Badge variant="outline" className="text-amber-700 border-amber-200 bg-amber-50 text-[10px]">
                                        {pillarsData?.security?.blocked_ips?.length || 0} Blocked
                                    </Badge>
                                </CardTitle>
                                <CardDescription className="text-xs">Edge firewall and rate-limiter blacklist entries.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-2 space-y-2 text-xs">
                                {(!pillarsData?.security?.blocked_ips || pillarsData?.security?.blocked_ips?.length === 0) ? (
                                    <div className="p-4 text-center text-slate-400 italic bg-slate-50 rounded-xl border border-slate-100">
                                        No IP addresses currently blacklisted.
                                    </div>
                                ) : (
                                    <div className="p-2.5 rounded-xl bg-slate-900 text-white font-mono text-[11px] space-y-1">
                                        {pillarsData.security.blocked_ips.map((b: any) => (
                                            <p key={b.id} className="text-emerald-400">• {b.ip_address} — {b.reason || 'Banned IP'}</p>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* TAB 3: AUDIT TRAIL & ACCESS GOVERNANCE PILLAR */}
                <TabsContent value="governance" className="mt-0 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 1. System-Wide Access & Mutation Logs */}
                        <Card className="border-slate-100 shadow-sm">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                                    <Database className="w-4 h-4 text-indigo-600" /> System Access & Mutation Activity (7 Days)
                                </CardTitle>
                                <CardDescription className="text-xs">Forensic ledger of recent resource access and audit actions from database access_logs.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-2 space-y-2 text-xs">
                                {(!pillarsData?.governance?.audit_actions || pillarsData.governance.audit_actions.length === 0) ? (
                                    <div className="p-4 text-center text-slate-400 italic">No access logs recorded in past 7 days.</div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {pillarsData.governance.audit_actions.map((act: any, i: number) => (
                                            <div key={i} className="py-2 flex justify-between items-center">
                                                <span className="font-mono text-slate-700">{act.action}</span>
                                                <Badge variant="secondary" className="font-mono text-[10px]">{act.count} events</Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* 2. Role & Permission Change Report */}
                        <Card className="border-slate-100 shadow-sm">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                                    <Users className="w-4 h-4 text-teal-600" /> Active Permission Overrides
                                </CardTitle>
                                <CardDescription className="text-xs">Custom permission grants active in user_permission_overrides table.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-2 space-y-2 text-xs">
                                {(!pillarsData?.governance?.overrides || pillarsData.governance.overrides.length === 0) ? (
                                    <div className="p-4 text-center text-slate-400 italic bg-slate-50 rounded-xl border border-slate-100">
                                        No active custom permission overrides. Standard RBAC enforced.
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {pillarsData.governance.overrides.map((ov: any, i: number) => (
                                            <div key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex justify-between items-center">
                                                <span className="font-mono">{ov.email}</span>
                                                <Badge variant="outline" className="text-teal-700 border-teal-200 bg-teal-50 text-[10px]">
                                                    {ov.module_id} ({ov.can_read ? 'R' : ''}{ov.can_write ? 'W' : ''}{ov.can_delete ? 'D' : ''})
                                                </Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* 3. Legal & Policy Consent Compliance */}
                        <Card className="border-slate-100 shadow-sm">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                                    <FileText className="w-4 h-4 text-blue-600" /> Legal & Policy Documents Registry
                                </CardTitle>
                                <CardDescription className="text-xs">Registered terms of service and compliance documents.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-2 space-y-2 text-xs">
                                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                    <span>Active Legal Documents in DB</span>
                                    <Badge className="bg-slate-900 text-white font-mono text-[10px]">
                                        {pillarsData?.governance?.legal_docs_count ?? 0} docs
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 4. Data Deletion & Archive Ledger */}
                        <Card className="border-slate-100 shadow-sm">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                                    <Archive className="w-4 h-4 text-purple-600" /> Data Deletion & Archive Ledger
                                </CardTitle>
                                <CardDescription className="text-xs">Real-time counts of soft-archived entities in public.archives.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-2 space-y-2 text-xs">
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-100">
                                        <span className="text-[10px] font-bold text-purple-700 uppercase">Archived Patients</span>
                                        <p className="text-lg font-black text-purple-800 mt-0.5">{pillarsData?.governance?.archives?.archived_patients ?? 0}</p>
                                    </div>
                                    <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-100">
                                        <span className="text-[10px] font-bold text-purple-700 uppercase">Archived Users</span>
                                        <p className="text-lg font-black text-purple-800 mt-0.5">{pillarsData?.governance?.archives?.archived_users ?? 0}</p>
                                    </div>
                                    <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-100">
                                        <span className="text-[10px] font-bold text-purple-700 uppercase">Archived Devices</span>
                                        <p className="text-lg font-black text-purple-800 mt-0.5">{pillarsData?.governance?.archives?.archived_devices ?? 0}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* TAB 4: HARDWARE & IOT INFRASTRUCTURE PILLAR */}
                <TabsContent value="hardware" className="mt-0 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 1. Whitelist & Enrollment Status */}
                        <Card className="border-slate-100 shadow-sm">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                                    <Cpu className="w-4 h-4 text-teal-600" /> Hardware Whitelist & Status Breakdown
                                </CardTitle>
                                <CardDescription className="text-xs">Live counts of devices in device_whitelist grouped by status.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-2 space-y-2 text-xs">
                                {(!pillarsData?.hardware?.device_status_breakdown || pillarsData.hardware.device_status_breakdown.length === 0) ? (
                                    <div className="p-4 text-center text-slate-400 italic">No devices registered in whitelist.</div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {pillarsData.hardware.device_status_breakdown.map((d: any, i: number) => (
                                            <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
                                                <span className="font-semibold text-slate-700">{d.status} Units</span>
                                                <Badge variant="secondary" className="font-mono text-[10px]">{d.count} devices</Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* 2. Hardware System Alerts & Failures */}
                        <Card className="border-slate-100 shadow-sm">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Hardware System Alerts
                                </CardTitle>
                                <CardDescription className="text-xs">Live anomaly events from hardware_system_alerts.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-2 space-y-2 text-xs">
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Total Alerts</span>
                                        <p className="text-lg font-black text-slate-800 mt-0.5">{pillarsData?.hardware?.alerts?.total_hardware_alerts ?? 0}</p>
                                    </div>
                                    <div className="p-2.5 bg-red-50 rounded-xl border border-red-100">
                                        <span className="text-[10px] font-bold text-red-600 uppercase">Critical</span>
                                        <p className="text-lg font-black text-red-700 mt-0.5">{pillarsData?.hardware?.alerts?.critical_alerts ?? 0}</p>
                                    </div>
                                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                                        <span className="text-[10px] font-bold text-amber-700 uppercase">Unresolved</span>
                                        <p className="text-lg font-black text-amber-800 mt-0.5">{pillarsData?.hardware?.alerts?.unresolved_alerts ?? 0}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Live Device Pairing Reports */}
                    <Card className="border-slate-100 shadow-sm">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                                <Radio className="w-4 h-4 text-teal-600" /> Live Device Pairing & Enrollment Log
                            </CardTitle>
                            <CardDescription className="text-xs">Reports automatically generated upon pairing hardware to patients.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-2 text-xs">
                            {reports.filter(r => r.report_type === 'DEVICE_PAIRING').length === 0 ? (
                                <div className="p-6 text-center text-slate-400 italic bg-slate-50 rounded-xl border border-slate-100">
                                    No device pairing reports generated yet. When a caregiver or admin pairs a device to a patient, an auto-report is recorded here.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {reports.filter(r => r.report_type === 'DEVICE_PAIRING').slice(0, 5).map(r => (
                                        <div key={r.report_id} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
                                            <div>
                                                <span className="font-bold text-slate-900 block">{r.title}</span>
                                                <p className="text-[11px] text-slate-500">{r.summary}</p>
                                            </div>
                                            <span className="font-mono text-[10px] text-slate-400">
                                                {new Date(r.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 5: APPLICATION PERFORMANCE & RELIABILITY PILLAR */}
                <TabsContent value="performance" className="mt-0 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 1. Database & Pool Health */}
                        <Card className="border-slate-100 shadow-sm">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                                    <HardDrive className="w-4 h-4 text-indigo-600" /> Database & Server Health
                                </CardTitle>
                                <CardDescription className="text-xs">Live PostgreSQL activity and process uptime.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-2 space-y-2 text-xs">
                                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                    <span>Active Database Connections</span>
                                    <span className="font-bold font-mono text-slate-800">{pillarsData?.performance?.active_connections ?? 1}</span>
                                </div>
                                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                    <span>Node.js Process Uptime</span>
                                    <span className="font-bold font-mono text-teal-700">
                                        {pillarsData?.performance?.uptime_seconds ? `${Math.floor(pillarsData.performance.uptime_seconds / 60)} mins (${pillarsData.performance.uptime_seconds}s)` : 'Active'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                                    <span>Server System Timestamp</span>
                                    <span className="font-mono text-[11px] text-slate-600">{pillarsData?.performance?.server_time || new Date().toISOString()}</span>
                                </div>
                            </CardContent>
                        </Card>

                        {/* 2. Third-Party Service Integration Status */}
                        <Card className="border-slate-100 shadow-sm">
                            <CardHeader className="p-4 pb-2">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                                    <Activity className="w-4 h-4 text-blue-600" /> Core Services Status
                                </CardTitle>
                                <CardDescription className="text-xs">Service health status.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-4 pt-2 space-y-2 text-xs">
                                <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100 text-emerald-900 flex justify-between items-center">
                                    <span>PostgreSQL Database Pool</span>
                                    <Badge className="bg-emerald-600 text-white text-[10px]">Connected</Badge>
                                </div>
                                <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100 text-emerald-900 flex justify-between items-center">
                                    <span>API Express Server</span>
                                    <Badge className="bg-emerald-600 text-white text-[10px]">Listening (0.0.0.0:3000)</Badge>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* TAB 6: MULTI-TENANT / FACILITY MANAGEMENT PILLAR */}
                <TabsContent value="tenancy" className="mt-0 space-y-4">
                    <Card className="border-slate-100 shadow-sm">
                        <CardHeader className="p-4 pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                                <Building2 className="w-4 h-4 text-teal-600" /> Facilities Overview
                            </CardTitle>
                            <CardDescription className="text-xs">Real-time counts of patients and paired devices across registered facilities.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-2 space-y-3 text-xs">
                            {(!pillarsData?.tenancy?.facilities || pillarsData.tenancy.facilities.length === 0) ? (
                                <div className="p-6 text-center text-slate-400 italic bg-slate-50 rounded-xl border border-slate-100">
                                    No facilities currently registered in the database.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {pillarsData.tenancy.facilities.map((f: any, i: number) => (
                                        <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                                            <div>
                                                <span className="font-bold text-slate-900 block">{f.facility_name || 'Hospital Branch'}</span>
                                                <span className="text-[11px] text-slate-500">{f.patients || 0} active patients</span>
                                            </div>
                                            <Badge variant="outline" className="text-teal-700 border-teal-200 bg-teal-50 font-mono text-[10px]">
                                                {f.devices || 0} paired devices
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 7: CLINICAL ANALYTICS & STATISTICAL INTERPRETATIONS */}
                <TabsContent value="clinical-analytics" className="mt-0 flex-1 min-h-[500px] outline-none">
                    <SystemAdminClinicalAnalytics />
                </TabsContent>
            </Tabs>

            {/* PREVIEW REPORT MODAL */}
            <Dialog open={!!selectedReportForView} onOpenChange={(open) => !open && setSelectedReportForView(null)}>
                <DialogContent className="max-w-2xl bg-white rounded-2xl p-6">
                    <DialogHeader>
                        <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline" className="text-slate-600 border-slate-200">
                                {selectedReportForView?.category}
                            </Badge>
                            {selectedReportForView && renderSeverityBadge(selectedReportForView.severity)}
                        </div>
                        <DialogTitle className="text-xl font-bold text-slate-900 mt-2">
                            {selectedReportForView?.title}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Generated by <span className="font-mono font-semibold text-slate-700">{selectedReportForView?.generated_by}</span> on {selectedReportForView ? new Date(selectedReportForView.created_at).toLocaleString() : ''}
                        </DialogDescription>
                    </DialogHeader>

                    {selectedReportForView && (
                        <div className="space-y-4 my-2 text-xs">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="font-bold text-slate-700 block mb-1">Summary</span>
                                <p className="text-slate-600 leading-relaxed">{selectedReportForView.summary}</p>
                            </div>

                            <div>
                                <span className="font-bold text-slate-700 block mb-1.5">Structured Telemetry & Details Snapshot</span>
                                <pre className="p-3.5 bg-slate-900 text-teal-300 font-mono text-[11px] rounded-xl overflow-x-auto max-h-60">
                                    {JSON.stringify(selectedReportForView.details, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2">
                            {selectedReportForView && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleToggleArchive(selectedReportForView)}
                                    className={`text-xs ${selectedReportForView.is_archived ? 'text-purple-700' : 'text-slate-700'}`}
                                >
                                    {selectedReportForView.is_archived ? (
                                        <><ArchiveRestore className="w-3.5 h-3.5 mr-1" /> Restore</>
                                    ) : (
                                        <><Archive className="w-3.5 h-3.5 mr-1" /> Archive Report</>
                                    )}
                                </Button>
                            )}
                        </div>

                        <Button size="sm" onClick={() => setSelectedReportForView(null)} className="bg-slate-900 text-white text-xs">
                            Close Preview
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* DELETE CONFIRMATION MODAL */}
            <Dialog open={!!selectedReportForDelete} onOpenChange={(open) => !open && setSelectedReportForDelete(null)}>
                <DialogContent className="max-w-md bg-white rounded-2xl p-6">
                    <DialogHeader>
                        <div className="p-3 w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-2">
                            <Trash2 className="w-5 h-5" />
                        </div>
                        <DialogTitle className="text-lg font-bold text-slate-900">
                            Delete Report Permanently?
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            This action cannot be undone. Are you sure you want to permanently delete <span className="font-semibold text-slate-800">"{selectedReportForDelete?.title}"</span> from the governance ledger?
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="flex gap-2 pt-3">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedReportForDelete(null)}
                            className="text-xs flex-1"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteReport}
                            className="text-xs flex-1 bg-red-600 hover:bg-red-700"
                        >
                            Confirm Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* GENERATE REPORT MODAL */}
            <Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
                <DialogContent className="max-w-lg bg-white rounded-2xl p-6">
                    <DialogHeader>
                        <div className="p-3 w-10 h-10 rounded-full bg-teal-50 text-teal-700 flex items-center justify-center mb-2">
                            <Sparkles className="w-5 h-5" />
                        </div>
                        <DialogTitle className="text-lg font-bold text-slate-900">
                            Generate On-Demand System Report
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            Initiate a manual forensic or observability snapshot to record in the system ledger.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleGenerateReport} className="space-y-3.5 my-2 text-xs">
                        <div>
                            <label className="font-semibold text-slate-700 block mb-1">Report Category</label>
                            <select
                                value={genCategory}
                                onChange={(e) => setGenCategory(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-teal-500 bg-white"
                            >
                                {CATEGORIES.filter(c => c !== 'ALL').map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="font-semibold text-slate-700 block mb-1">Report Type / Identifier</label>
                                <input
                                    type="text"
                                    placeholder="e.g. AUDIT_SNAPSHOT"
                                    value={genType}
                                    onChange={(e) => setGenType(e.target.value)}
                                    required
                                    className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-teal-500 bg-white font-mono"
                                />
                            </div>
                            <div>
                                <label className="font-semibold text-slate-700 block mb-1">Severity Rating</label>
                                <select
                                    value={genSeverity}
                                    onChange={(e) => setGenSeverity(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-teal-500 bg-white"
                                >
                                    <option value="INFO">INFO</option>
                                    <option value="LOW">LOW</option>
                                    <option value="MEDIUM">MEDIUM</option>
                                    <option value="HIGH">HIGH</option>
                                    <option value="CRITICAL">CRITICAL</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="font-semibold text-slate-700 block mb-1">Report Title</label>
                            <input
                                type="text"
                                placeholder="e.g. Q3 Security & Perimeter Audit"
                                value={genTitle}
                                onChange={(e) => setGenTitle(e.target.value)}
                                required
                                className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-teal-500 bg-white"
                            />
                        </div>

                        <div>
                            <label className="font-semibold text-slate-700 block mb-1">Summary / Executive Finding</label>
                            <textarea
                                rows={3}
                                placeholder="Describe findings, telemetry notes, and evaluation results..."
                                value={genSummary}
                                onChange={(e) => setGenSummary(e.target.value)}
                                required
                                className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:border-teal-500 bg-white resize-none"
                            />
                        </div>

                        <DialogFooter className="flex gap-2 pt-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setIsGenerateModalOpen(false)}
                                className="text-xs flex-1"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                disabled={isGenerating}
                                className="text-xs flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                            >
                                {isGenerating ? 'Generating...' : 'Save & Publish Report'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
