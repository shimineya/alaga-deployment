import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
    Activity,
    Heart,
    Wind,
    Thermometer,
    Droplets,
    ShieldCheck,
    Search,
    RefreshCw,
    FileText,
    TrendingUp,
    BarChart3,
    Sparkles,
    Eye,
    Building2,
    Users,
    ChevronRight,
    Lock
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth-context';

export interface AnonymizedPatient {
    patient_id: number;
    anonymous_identifier: string;
    birthdate: string | null;
    gender: string | null;
    condition: string | null;
    ward_code: string | null;
    facility_name: string | null;
    created_at: string;
    total_readings_count: number;
    total_anomalies_count: number;
    latest_vitals: {
        heart_rate?: number;
        spo2?: number;
        temperature?: number;
        moisture?: number;
        recorded_at?: string;
    } | null;
}

export interface AnalyticsData {
    cohort_summary: {
        total_subjects: number;
        active_sensors: number;
        total_telemetry_packets: number;
        mean_heart_rate: number;
        mean_spo2: number;
        mean_temperature: number;
        mean_moisture: number;
        stddev_heart_rate: number;
        stddev_spo2: number;
    };
    heart_rate_distribution: { heart_rate_cohort: string; count: string }[];
    time_series: {
        time_bucket: string;
        avg_hr: number;
        avg_spo2: number;
        avg_temp: number;
        avg_moisture: number;
        sample_count: string;
    }[];
    anomaly_breakdown: { anomaly_type: string; event_count: string; avg_confidence: number }[];
    interpretation: {
        summary: string;
        clinical_observations: string[];
        governance_recommendation: string;
    };
}

export default function SystemAdminClinicalAnalytics() {
    const { token } = useAuth();
    const [activeTab, setActiveTab] = useState<'analytics' | 'directory'>('analytics');
    const [patients, setPatients] = useState<AnonymizedPatient[]>([]);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
    const [patientDetail, setPatientDetail] = useState<any>(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);

    const API_BASE = `${import.meta.env.VITE_API_URL || ''}/api/sysadmin`;
    const getAuth = () => ({
        'Authorization': `Bearer ${token || localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
    });

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [analyticsRes, patientsRes] = await Promise.all([
                fetch(`${API_BASE}/clinical-analytics`, { headers: getAuth() }),
                fetch(`${API_BASE}/anonymized-patients${searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : ''}`, { headers: getAuth() })
            ]);

            const analyticsData = await analyticsRes.json();
            const patientsData = await patientsRes.json();

            if (analyticsData.success) {
                setAnalytics(analyticsData.data);
            }
            if (patientsData.success) {
                setPatients(patientsData.data || []);
            }
        } catch {
            toast.error('Failed to load clinical analytics');
        } finally {
            setIsLoading(false);
        }
    }, [API_BASE, searchQuery, token]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleViewSubjectDetail = async (patientId: number) => {
        setSelectedPatientId(patientId);
        setIsLoadingDetail(true);
        try {
            const res = await fetch(`${API_BASE}/anonymized-patients/${patientId}`, { headers: getAuth() });
            const data = await res.json();
            if (data.success) {
                setPatientDetail(data.data);
            } else {
                toast.error(data.message || 'Failed to query patient details');
            }
        } catch {
            toast.error('Network error loading subject telemetry');
        } finally {
            setIsLoadingDetail(false);
        }
    };

    return (
        <div className="w-full flex-1 flex flex-col space-y-5 min-h-0">
            {/* Header Privacy Notice */}
            <div className="bg-slate-900 text-white p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        <Lock className="w-5 h-5" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-sm font-bold tracking-tight text-white">
                                De-Identified Clinical Intelligence & Statistical Analytics
                            </h2>
                            <Badge className="bg-teal-500/30 text-teal-200 border-teal-400/30 text-[9px] uppercase font-mono">
                                HIPAA / DPA Protected
                            </Badge>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                            Patient identities are masked as anonymous tokens. System administrators view clinical telemetry and statistical cohort interpretations.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchData}
                        className="h-8 border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} /> Refresh Data
                    </Button>
                </div>
            </div>

            {/* Hub Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full flex-1 flex flex-col min-h-0">
                <div className="border-b border-slate-200 shrink-0 mb-4">
                    <TabsList className="bg-transparent h-11 p-0 flex gap-6 justify-start">
                        <TabsTrigger
                            value="analytics"
                            className="data-[state=active]:bg-teal-50/90 data-[state=active]:text-teal-900 data-[state=active]:font-extrabold data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-t-lg h-10 px-3 text-xs font-bold text-slate-500 flex items-center gap-1.5 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                        >
                            <BarChart3 className="w-4 h-4" /> Data Analytics & Interpretations
                        </TabsTrigger>
                        <TabsTrigger
                            value="directory"
                            className="data-[state=active]:bg-teal-50/90 data-[state=active]:text-teal-900 data-[state=active]:font-extrabold data-[state=active]:border-b-2 data-[state=active]:border-teal-600 rounded-t-lg h-10 px-3 text-xs font-bold text-slate-500 flex items-center gap-1.5 transition-all hover:text-slate-800 hover:bg-slate-50/80 whitespace-nowrap"
                        >
                            <Users className="w-4 h-4" /> De-Identified Subject Directory ({patients.length})
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* TAB 1: DATA ANALYTICS & INTERPRETATIONS */}
                <TabsContent value="analytics" className="mt-0 flex-1 flex flex-col space-y-4 min-h-0 overflow-auto pr-1">
                    {/* KPI Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-rose-50/20">
                            <CardContent className="p-3.5 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mean Heart Rate</p>
                                    <h3 className="text-xl font-black text-rose-600 mt-0.5">
                                        {analytics?.cohort_summary?.mean_heart_rate || '--'} <span className="text-xs font-medium text-slate-400">bpm</span>
                                    </h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5">σ = {analytics?.cohort_summary?.stddev_heart_rate || '--'}</p>
                                </div>
                                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600">
                                    <Heart className="w-5 h-5" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-sky-50/20">
                            <CardContent className="p-3.5 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mean SpO2 Saturation</p>
                                    <h3 className="text-xl font-black text-sky-600 mt-0.5">
                                        {analytics?.cohort_summary?.mean_spo2 || '--'} <span className="text-xs font-medium text-slate-400">%</span>
                                    </h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Target: ≥ 95.0%</p>
                                </div>
                                <div className="p-2.5 rounded-xl bg-sky-50 text-sky-600">
                                    <Wind className="w-5 h-5" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-amber-50/20">
                            <CardContent className="p-3.5 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mean Temperature</p>
                                    <h3 className="text-xl font-black text-amber-600 mt-0.5">
                                        {analytics?.cohort_summary?.mean_temperature || '--'} <span className="text-xs font-medium text-slate-400">°C</span>
                                    </h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5">Core Baseline: 36.5 - 37.5°C</p>
                                </div>
                                <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                                    <Thermometer className="w-5 h-5" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-white to-teal-50/20">
                            <CardContent className="p-3.5 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Telemetry Ingested</p>
                                    <h3 className="text-xl font-black text-teal-700 mt-0.5">
                                        {(analytics?.cohort_summary?.total_telemetry_packets || 0).toLocaleString()}
                                    </h3>
                                    <p className="text-[10px] text-slate-400 mt-0.5">{analytics?.cohort_summary?.total_subjects || 0} active subjects</p>
                                </div>
                                <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600">
                                    <Activity className="w-5 h-5" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* AI & Statistical Interpretation Card */}
                    <Card className="border-teal-200/80 bg-gradient-to-r from-teal-50/70 via-white to-emerald-50/50 shadow-sm">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-teal-900 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-teal-600" />
                                Statistical Data Interpretation & Clinical Observations
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-600">
                                {analytics?.interpretation?.summary || 'Computing cohort insights...'}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2.5 pt-1">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {(analytics?.interpretation?.clinical_observations || []).map((obs, i) => (
                                    <div key={i} className="p-2.5 bg-white/80 rounded-lg border border-teal-100/80 text-xs text-slate-700 flex items-start gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1.5 shrink-0" />
                                        <span>{obs}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="p-2.5 bg-teal-900 text-teal-100 rounded-lg text-xs flex items-center justify-between gap-2">
                                <span className="font-semibold">Governance Status:</span>
                                <span className="text-[11px] text-teal-200">{analytics?.interpretation?.governance_recommendation}</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Graphs & Distributions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Heart Rate Distribution */}
                        <Card className="border-slate-200 shadow-sm bg-white">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                    <Heart className="w-4 h-4 text-rose-500" />
                                    Heart Rate Cohort Distribution
                                </CardTitle>
                                <CardDescription className="text-[11px] text-slate-400">
                                    Breakdown of subjects categorized by resting cardiac frequency
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {(analytics?.heart_rate_distribution || []).map((item, idx) => {
                                    const total = analytics?.heart_rate_distribution.reduce((acc, curr) => acc + parseInt(curr.count, 10), 0) || 1;
                                    const count = parseInt(item.count, 10);
                                    const pct = Math.round((count / total) * 100);
                                    return (
                                        <div key={idx} className="space-y-1">
                                            <div className="flex justify-between text-xs font-medium text-slate-700">
                                                <span>{item.heart_rate_cohort}</span>
                                                <span className="font-mono">{count} samples ({pct}%)</span>
                                            </div>
                                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${
                                                        item.heart_rate_cohort.includes('Normal')
                                                            ? 'bg-emerald-500'
                                                            : item.heart_rate_cohort.includes('Bradycardia')
                                                            ? 'bg-blue-500'
                                                            : 'bg-amber-500'
                                                    }`}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>

                        {/* Recent Telemetry Time-Series */}
                        <Card className="border-slate-200 shadow-sm bg-white">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-bold text-slate-800 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4 text-teal-600" />
                                    Recent Telemetry Moving Averages
                                </CardTitle>
                                <CardDescription className="text-[11px] text-slate-400">
                                    Chronological time buckets with mean SpO2 and Heart Rate
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {(!analytics?.time_series || analytics.time_series.length === 0) ? (
                                    <div className="h-36 flex items-center justify-center text-xs text-slate-400">
                                        No recent telemetry recorded in the last 48 hours.
                                    </div>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-auto pr-1">
                                        {analytics.time_series.slice(-5).map((ts, i) => (
                                            <div key={i} className="p-2 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                                                <span className="font-mono text-[10px] text-slate-500">{ts.time_bucket}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-rose-600 font-semibold font-mono text-[11px]">HR: {ts.avg_hr} bpm</span>
                                                    <span className="text-sky-600 font-semibold font-mono text-[11px]">SpO2: {ts.avg_spo2}%</span>
                                                    <span className="text-amber-600 font-semibold font-mono text-[11px]">Temp: {ts.avg_temp}°C</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* TAB 2: DE-IDENTIFIED PATIENT DIRECTORY */}
                <TabsContent value="directory" className="mt-0 flex-1 flex flex-col min-h-0 space-y-3">
                    <div className="flex items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200">
                        <div className="relative w-64">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                            <Input
                                placeholder="Search by Subject #, condition..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-8 pl-8 text-xs bg-slate-50 border-slate-200"
                            />
                        </div>
                        <p className="text-xs text-slate-500">
                            Showing {patients.length} de-identified subjects
                        </p>
                    </div>

                    <Card className="border-slate-200 shadow-sm flex-1 flex flex-col min-h-0 bg-white overflow-hidden">
                        <CardContent className="p-0 flex-1 overflow-auto">
                            <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                                <thead className="bg-slate-50/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3">Subject Token</th>
                                        <th className="px-4 py-3">Gender</th>
                                        <th className="px-4 py-3">Condition Profile</th>
                                        <th className="px-4 py-3">Facility</th>
                                        <th className="px-4 py-3">Latest Vitals</th>
                                        <th className="px-4 py-3 text-center">Telemetry Data</th>
                                        <th className="px-4 py-3 text-right">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
                                    {patients.map((p) => (
                                        <tr key={p.patient_id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-4 py-3 font-mono font-bold text-slate-800">
                                                {p.anonymous_identifier}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200 text-[10px]">
                                                    {p.gender || 'Unknown'}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-800">
                                                {p.condition || 'General Monitoring'}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600">
                                                {p.facility_name || 'Home / Standalone'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {p.latest_vitals ? (
                                                    <div className="flex items-center gap-2 text-[11px] font-mono">
                                                        <span className="text-rose-600 font-semibold">{p.latest_vitals.heart_rate || '--'} bpm</span>
                                                        <span className="text-slate-300">|</span>
                                                        <span className="text-sky-600 font-semibold">{p.latest_vitals.spo2 || '--'}%</span>
                                                        <span className="text-slate-300">|</span>
                                                        <span className="text-amber-600 font-semibold">{p.latest_vitals.temperature || '--'}°C</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic text-[10px]">No telemetry stream</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-center font-mono font-semibold">
                                                {p.total_readings_count.toLocaleString()} samples
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleViewSubjectDetail(p.patient_id)}
                                                    className="h-7 px-2 text-[10px] font-semibold gap-1 text-teal-700 border-teal-200 hover:bg-teal-50"
                                                >
                                                    <Eye className="w-3 h-3" /> View Data
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Subject Telemetry Details Modal */}
            <Dialog open={!!selectedPatientId} onOpenChange={() => setSelectedPatientId(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col bg-white">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-teal-600" />
                            {patientDetail?.patient?.anonymous_identifier || `Subject #${selectedPatientId}`}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500">
                            De-identified telemetry history and anomaly events ledger.
                        </DialogDescription>
                    </DialogHeader>

                    {isLoadingDetail ? (
                        <div className="h-48 flex items-center justify-center">
                            <RefreshCw className="w-6 h-6 animate-spin text-teal-600" />
                        </div>
                    ) : (
                        <div className="space-y-4 flex-1 overflow-auto pr-1">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Condition</p>
                                    <p className="text-xs font-bold text-slate-800 mt-0.5">{patientDetail?.patient?.condition || 'N/A'}</p>
                                </div>
                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Facility</p>
                                    <p className="text-xs font-bold text-slate-800 mt-0.5">{patientDetail?.patient?.facility_name || 'Home'}</p>
                                </div>
                                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                                    <p className="text-[10px] font-semibold text-slate-400 uppercase">Gender</p>
                                    <p className="text-xs font-bold text-slate-800 mt-0.5">{patientDetail?.patient?.gender || 'N/A'}</p>
                                </div>
                            </div>

                            <div>
                                <h4 className="text-xs font-bold text-slate-800 mb-2">Recent Telemetry Readings (Last 100)</h4>
                                <div className="max-h-48 overflow-auto border border-slate-200 rounded-lg">
                                    <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                                        <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase sticky top-0">
                                            <tr>
                                                <th className="px-3 py-2">Reading ID</th>
                                                <th className="px-3 py-2">Heart Rate</th>
                                                <th className="px-3 py-2">SpO2</th>
                                                <th className="px-3 py-2">Temperature</th>
                                                <th className="px-3 py-2">Moisture</th>
                                                <th className="px-3 py-2">Recorded At</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {(patientDetail?.readings || []).map((r: any) => (
                                                <tr key={r.reading_id}>
                                                    <td className="px-3 py-1.5 font-mono text-[10px] text-slate-500">#{r.reading_id}</td>
                                                    <td className="px-3 py-1.5 font-mono font-semibold text-rose-600">{r.heart_rate} bpm</td>
                                                    <td className="px-3 py-1.5 font-mono font-semibold text-sky-600">{r.spo2}%</td>
                                                    <td className="px-3 py-1.5 font-mono font-semibold text-amber-600">{r.temperature}°C</td>
                                                    <td className="px-3 py-1.5 font-mono text-teal-700">{r.moisture_value}%</td>
                                                    <td className="px-3 py-1.5 font-mono text-[10px] text-slate-400">{new Date(r.recorded_at).toLocaleTimeString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
