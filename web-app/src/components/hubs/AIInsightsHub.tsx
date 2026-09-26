import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCaregiverLanguage } from '@/lib/caregiver-language-context';
import {
  Sparkles,
  Search,
  Calendar,
  Activity,
  Heart,
  Thermometer,
  Droplets,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Building2,
  User,
  ChevronRight,
  TrendingUp,
  Info,
  CheckCircle2,
  Stethoscope,
  Clock,
  ShieldAlert
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { toast } from 'sonner';

type TimeframeOption = 'day' | 'week' | 'month' | '6months' | 'year';

interface AccessiblePatient {
  id: string;
  patient_id?: number | string;
  name: string;
  age?: number;
  gender?: string;
  condition?: string;
  room?: string;
  facility_name?: string;
  assignedCaregiverName?: string;
}

interface PossibleIllness {
  id: string;
  condition: string;
  category: string;
  confidence: string;
  severity: 'Low' | 'Moderate' | 'High' | 'Critical';
  indicators: string[];
  description: string;
  recommendations: string[];
}

interface InsightsData {
  patient: {
    id: number | string;
    name: string;
    anonymous_identifier?: string;
    is_anonymized?: boolean;
    age: number;
    gender: string;
    condition: string;
    room: string;
    facility: string;
  };
  timeframe: string;
  timeframeLabel: string;
  stabilityScore: number;
  riskLevel: string;
  metrics: {
    sampleCount: number;
    avgHr: number;
    minHr: number;
    maxHr: number;
    avgSpo2: number;
    minSpo2: number;
    maxSpo2: number;
    avgTemp: number;
    minTemp: number;
    maxTemp: number;
    wetCycles: number;
    totalWetMinutes: number;
  };
  possibleIllnesses: PossibleIllness[];
  keyInsights: string[];
  chartData: Array<{
    timestamp: string;
    timeLabel: string;
    heartRate: number | null;
    spo2: number | null;
    temperature: number | null;
    moistureValue: number;
    isWet: boolean;
  }>;
}

export default function AIInsightsHub() {
  const { token, user } = useAuth();
  const { t } = useCaregiverLanguage();

  const [patients, setPatients] = useState<AccessiblePatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeframe, setTimeframe] = useState<TimeframeOption>('week');
  const [activeChartMetric, setActiveChartMetric] = useState<'all' | 'hr' | 'spo2' | 'temp' | 'moisture'>('all');

  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);

  const isSysAdmin = user?.role === 'sysadmin' || user?.role === 'system_admin';

  // 1. Fetch accessible patients for the user
  const fetchAccessiblePatients = useCallback(async () => {
    if (!token) return;
    setIsLoadingPatients(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/caregiver/patients`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const mapped: AccessiblePatient[] = data.data.map((p: any) => {
          const displayName = isSysAdmin
            ? (p.anonymous_identifier || `Subject #${p.patient_id} [De-identified]`)
            : (p.name || p.patient_name || `Patient #${p.patient_id}`);
          const roomDisplay = isSysAdmin
            ? 'Restricted Inpatient Ward'
            : (p.room ? `Room ${p.room}` : (p.baseline_data?.room || 'Home Care'));

          return {
            id: p.patient_id?.toString() || '',
            patient_id: p.patient_id,
            name: displayName,
            age: p.age || (p.baseline_data?.age ? parseInt(p.baseline_data.age, 10) : 0),
            gender: p.gender || p.baseline_data?.gender || 'Unknown',
            condition: p.condition || p.baseline_data?.condition || 'Stable',
            room: roomDisplay,
            facility_name: p.facility_name || user?.facility_name || undefined
          };
        });
        setPatients(mapped);
        if (mapped.length > 0 && !selectedPatientId) {
          setSelectedPatientId(mapped[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load accessible patients:', e);
      toast.error('Failed to load your accessible patients.');
    } finally {
      setIsLoadingPatients(false);
    }
  }, [token, user, selectedPatientId, isSysAdmin]);

  useEffect(() => {
    fetchAccessiblePatients();
  }, [fetchAccessiblePatients]);

  // 2. Fetch AI Insights for selected patient & timeframe
  const fetchInsights = useCallback(async () => {
    if (!token || !selectedPatientId) return;
    setIsLoadingInsights(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${apiBase}/api/sensor/ai-insights/${selectedPatientId}?timeframe=${timeframe}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setInsights(data);
      } else {
        toast.error(data.message || 'Could not load AI insights for this patient.');
      }
    } catch (e) {
      console.error('AI Insights fetch error:', e);
      toast.error('Network error loading AI insights.');
    } finally {
      setIsLoadingInsights(false);
    }
  }, [token, selectedPatientId, timeframe]);

  useEffect(() => {
    if (selectedPatientId) {
      fetchInsights();
    }
  }, [fetchInsights, selectedPatientId, timeframe]);

  // Filter patients by search query
  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return patients;
    const q = searchQuery.toLowerCase().trim();
    return patients.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.condition && p.condition.toLowerCase().includes(q)) ||
        (p.room && p.room.toLowerCase().includes(q))
    );
  }, [patients, searchQuery]);

  const selectedPatient = useMemo(() => {
    return patients.find(p => p.id === selectedPatientId) || null;
  }, [patients, selectedPatientId]);

  return (
    <div className="w-full max-w-full min-w-0 space-y-6 pb-12 animate-in fade-in duration-300 overflow-hidden">
      {/* 1. Header & Timeframe Selector Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 min-w-0 max-w-full">
        <div className="min-w-0">
          {isSysAdmin ? (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-bold uppercase tracking-wider mb-2 shadow-2xs">
              <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
              ANONYMIZED GOVERNANCE MODE
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-800 text-[11px] font-bold uppercase tracking-wider mb-2 shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
              {t('AI Diagnostic Intelligence', 'Katalinuhan sa AI Diagnostic')}
            </div>
          )}
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            Patient AI Insights & <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600">Trends</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            {t(
              'Continuous health vitals trends and pattern insights based on ALAGA intelligent machine learning.',
              'Pagsusuri ng mga trend ng vitals at pagtukoy ng mga pattern gamit ang ALAGA AI machine learning.'
            )}
          </p>
        </div>

        {/* Timeframe Controls (Day, Week, Month, 6 Months, 1 Year) */}
        <div className="w-full lg:w-auto flex items-center justify-between gap-2 max-w-full min-w-0">
          <div className="overflow-x-auto no-scrollbar touch-scroll py-0.5 flex-1 min-w-0">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200 shadow-2xs shrink-0">
              {(
                [
                  { id: 'day', label: t('Day', 'Araw'), sub: '24h' },
                  { id: 'week', label: t('Week', 'Linggo'), sub: '7d' },
                  { id: 'month', label: t('Month', 'Buwan'), sub: '30d' },
                  { id: '6months', label: '6 Mos', sub: '180d' },
                  { id: 'year', label: t('1 Year', '1 Taon'), sub: '365d' }
                ] as const
              ).map(tf => (
                <button
                  key={tf.id}
                  onClick={() => setTimeframe(tf.id)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shrink-0 whitespace-nowrap ${
                    timeframe === tf.id
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span>{tf.label}</span>
                  <span className={`text-[9px] font-normal ${timeframe === tf.id ? 'text-teal-100' : 'text-slate-400'}`}>
                    ({tf.sub})
                  </span>
                </button>
              ))}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={fetchInsights}
            disabled={isLoadingInsights}
            className="h-9 px-3 rounded-xl border-slate-200 text-slate-700 hover:bg-white alaga-btn-tactile text-xs font-semibold shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 text-teal-600 ${isLoadingInsights ? 'animate-spin' : ''}`} />
            {t('Refresh', 'I-refresh')}
          </Button>
        </div>
      </div>

      {/* 2. Accessible Patient Selector & Search Bar */}
      <Card className="border border-slate-200/80 shadow-xs bg-white/95">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-teal-600 shrink-0" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                {t('Select Accessible Patient', 'Pumili ng Pasyente')}:
              </span>
              <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200 text-slate-600">
                {patients.length} {t('assigned', 'nakatalaga')}
              </Badge>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder={t('Search patient, ID, or room...', 'Maghanap ng pasyente, ID, o kwarto...')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-8 pl-8 text-xs bg-slate-50 border-slate-200 rounded-lg focus-visible:ring-teal-500"
              />
            </div>
          </div>

          {/* Patient Quick Selector Pills */}
          {isLoadingPatients ? (
            <div className="py-2 text-xs text-slate-400 animate-pulse">Loading accessible patients...</div>
          ) : filteredPatients.length === 0 ? (
            <div className="py-2 text-xs text-slate-400 italic">No matching accessible patients found.</div>
          ) : (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar touch-scroll max-w-full">
              {filteredPatients.map(p => {
                const isSelected = p.id === selectedPatientId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-2 shrink-0 ${
                      isSelected
                        ? 'bg-teal-50 border-teal-500 text-teal-900 shadow-2xs ring-1 ring-teal-500/30'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-teal-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="font-bold">{p.name}</span>
                    <span className="text-[10px] text-slate-400">({isSysAdmin ? `Subject #${p.id}` : (p.room || `ID #${p.id}`)})</span>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Main Dashboard for Selected Patient */}
      {selectedPatient && insights && (
        <div className="space-y-6">
          {/* Patient Metadata Banner & AI Clinical Stability Score */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: Patient Identity Card */}
            <div className="lg:col-span-8 bg-gradient-to-r from-teal-900 via-slate-900 to-[#061126] text-white p-5 rounded-2xl shadow-md flex flex-col justify-between relative overflow-hidden min-w-0 max-w-full">
              <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-44 h-44 rounded-full bg-teal-500/10 blur-2xl pointer-events-none" />

              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 text-xs text-teal-300 font-semibold mb-1">
                    <Building2 className="w-3.5 h-3.5 text-teal-400" />
                    <span>{insights.patient.facility || selectedPatient.facility_name || 'Independent Care'}</span>
                    <span>&bull;</span>
                    <span>{isSysAdmin ? 'Protected Governance Review' : insights.patient.room}</span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
                    <span>{isSysAdmin ? (insights.patient.anonymous_identifier || insights.patient.name) : insights.patient.name}</span>
                    {isSysAdmin && (
                      <Badge className="bg-indigo-500/30 text-indigo-200 border-indigo-400/30 text-[10px] font-semibold">
                        De-identified
                      </Badge>
                    )}
                  </h2>
                  <p className="text-xs text-slate-300 mt-1 flex items-center gap-2">
                    <span>
                      {insights.patient.age > 0 ? `${insights.patient.age} yrs` : 'Age N/A'} &bull; {insights.patient.gender}
                    </span>
                    <span>&bull;</span>
                    <span className="text-amber-300 font-medium">Condition: {insights.patient.condition}</span>
                  </p>
                </div>

                <Badge
                  className={`text-xs px-3 py-1 font-bold shrink-0 ${
                    insights.riskLevel === 'Low'
                      ? 'bg-emerald-500 text-white'
                      : insights.riskLevel === 'Moderate'
                      ? 'bg-amber-500 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {insights.riskLevel} Clinical Risk
                </Badge>
              </div>

              {/* Metric Quick Stats Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-white/10 mt-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Mean Heart Rate</span>
                  <p className="text-base font-bold text-white mt-0.5">{insights.metrics.avgHr} BPM</p>
                  <span className="text-[10px] text-slate-400">
                    Range: {insights.metrics.minHr} - {insights.metrics.maxHr}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Mean SpO₂</span>
                  <p className="text-base font-bold text-teal-300 mt-0.5">{insights.metrics.avgSpo2}%</p>
                  <span className="text-[10px] text-slate-400">Nadir: {insights.metrics.minSpo2}%</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Mean Temperature</span>
                  <p className="text-base font-bold text-white mt-0.5">{insights.metrics.avgTemp}°C</p>
                  <span className="text-[10px] text-slate-400">Peak: {insights.metrics.maxTemp}°C</span>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Moisture Exposure</span>
                  <p className="text-base font-bold text-amber-300 mt-0.5">{insights.metrics.totalWetMinutes} mins</p>
                  <span className="text-[10px] text-slate-400">{insights.metrics.wetCycles} wet cycles</span>
                </div>
              </div>
            </div>

            {/* Right: AI Clinical Stability Index Gauge */}
            <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    Stability Index
                  </span>
                  <Badge variant="outline" className="text-[10px] bg-teal-50 border-teal-200 text-teal-700">
                    {insights.timeframeLabel}
                  </Badge>
                </div>
                <div className="flex items-baseline gap-2 mt-3">
                  <span className="text-4xl font-black text-slate-900">{insights.stabilityScore}%</span>
                  <span className="text-xs font-semibold text-slate-500">Physiological Stability</span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden mt-3">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      insights.stabilityScore >= 80
                        ? 'bg-emerald-500'
                        : insights.stabilityScore >= 55
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${insights.stabilityScore}%` }}
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
                Calculated by the system’s AI engine across {insights.metrics.sampleCount} continuous readings over{' '}
                {insights.timeframeLabel.toLowerCase()}.
              </p>
            </div>
          </div>

          {/* 4. Interactive Telemetry Trend Graphs */}
          <Card className="border border-slate-200/80 shadow-xs bg-white">
            <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-600" />
                  Health Vitals Trends ({insights.timeframeLabel})
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Continuous sensor readings plotted over time with clinical reference boundaries.
                </CardDescription>
              </div>

              {/* Metric filter buttons */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto no-scrollbar touch-scroll max-w-full">
                {(
                  [
                    { id: 'all', label: 'All Vitals' },
                    { id: 'hr', label: 'HR (BPM)' },
                    { id: 'spo2', label: 'SpO₂ (%)' },
                    { id: 'temp', label: 'Temp (°C)' },
                    { id: 'moisture', label: 'Moisture' }
                  ] as const
                ).map(m => (
                  <button
                    key={m.id}
                    onClick={() => setActiveChartMetric(m.id)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all shrink-0 whitespace-nowrap ${
                      activeChartMetric === m.id
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="p-4 pt-6">
              {insights.chartData.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <Activity className="w-8 h-8 mb-2 opacity-50" />
                  No telemetry recorded in this timeframe.
                </div>
              ) : (
                <div className="h-72 w-full min-w-0 overflow-hidden">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={insights.chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="hrGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="spo2Grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="moistGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>

                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="timeLabel" tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} stroke="#cbd5e1" domain={['auto', 'auto']} />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload || !payload.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-slate-900 text-white text-xs p-3 rounded-xl shadow-lg space-y-1 border border-slate-700">
                              <p className="font-bold text-slate-300">{label}</p>
                              {d.heartRate != null && (
                                <p className="text-rose-400 font-semibold">Heart Rate: {d.heartRate} BPM</p>
                              )}
                              {d.spo2 != null && (
                                <p className="text-sky-300 font-semibold">Blood Oxygen: {d.spo2}%</p>
                              )}
                              {d.temperature != null && (
                                <p className="text-amber-300 font-semibold">Temperature: {d.temperature}°C</p>
                              )}
                              <p className="text-teal-300 font-semibold">
                                Diaper: {d.isWet ? 'Wet (Attention Needed)' : 'Dry'}
                              </p>
                            </div>
                          );
                        }}
                      />

                      {/* Reference boundaries */}
                      {activeChartMetric === 'spo2' && (
                        <>
                          <ReferenceLine y={95} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: 'Target 95%', fill: '#3b82f6', fontSize: 10 }} />
                          <ReferenceLine y={90} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Hypoxia 90%', fill: '#ef4444', fontSize: 10 }} />
                        </>
                      )}

                      {activeChartMetric === 'hr' && (
                        <>
                          <ReferenceLine y={100} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Tachycardia 100', fill: '#ef4444', fontSize: 10 }} />
                          <ReferenceLine y={60} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: 'Bradycardia 60', fill: '#3b82f6', fontSize: 10 }} />
                        </>
                      )}

                      {activeChartMetric === 'temp' && (
                        <>
                          <ReferenceLine y={38.0} stroke="#ef4444" strokeDasharray="3 3" label={{ value: 'Fever 38.0°C', fill: '#ef4444', fontSize: 10 }} />
                          <ReferenceLine y={37.5} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Subfebrile 37.5°C', fill: '#f59e0b', fontSize: 10 }} />
                        </>
                      )}

                      {/* Series rendering based on active filter */}
                      {(activeChartMetric === 'all' || activeChartMetric === 'hr') && (
                        <Area
                          type="monotone"
                          dataKey="heartRate"
                          name="Heart Rate"
                          stroke="#ef4444"
                          strokeWidth={2}
                          fill="url(#hrGrad)"
                          dot={false}
                        />
                      )}

                      {(activeChartMetric === 'all' || activeChartMetric === 'spo2') && (
                        <Area
                          type="monotone"
                          dataKey="spo2"
                          name="SpO₂"
                          stroke="#0ea5e9"
                          strokeWidth={2}
                          fill="url(#spo2Grad)"
                          dot={false}
                        />
                      )}

                      {(activeChartMetric === 'all' || activeChartMetric === 'temp') && (
                        <Area
                          type="monotone"
                          dataKey="temperature"
                          name="Temperature"
                          stroke="#f59e0b"
                          strokeWidth={2}
                          fill="url(#tempGrad)"
                          dot={false}
                        />
                      )}

                      {activeChartMetric === 'moisture' && (
                        <Area
                          type="monotone"
                          dataKey="moistureValue"
                          name="Moisture Value"
                          stroke="#14b8a6"
                          strokeWidth={2}
                          fill="url(#moistGrad)"
                          dot={false}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 5. Possible Illnesses & Physiological Indications (System AI / ILLNESS_MAP) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Stethoscope className="w-4.5 h-4.5 text-teal-600" />
                  Possible Illnesses & Physiological Indications
                </h3>
                <p className="text-xs text-slate-500">
                  Corroborated by ALAGA machine learning models and clinical safety rules for caregiver and medical staff awareness.
                </p>
              </div>
              <Badge variant="outline" className="text-xs bg-slate-50 border-slate-200">
                {insights.possibleIllnesses.length} {insights.possibleIllnesses.length === 1 ? 'condition evaluated' : 'conditions evaluated'}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {insights.possibleIllnesses.map(ill => {
                const isCritical = ill.severity === 'Critical';
                const isHigh = ill.severity === 'High';
                const isMod = ill.severity === 'Moderate';
                const isOptimal = ill.id === 'stable-optimal';

                return (
                  <Card
                    key={ill.id}
                    className={`border shadow-xs transition-all ${
                      isOptimal
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : isCritical
                        ? 'border-rose-200 bg-rose-50/20'
                        : isHigh
                        ? 'border-amber-200 bg-amber-50/20'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <CardHeader className="pb-3 border-b border-slate-100">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                            {ill.category}
                          </span>
                          <CardTitle className="text-sm font-bold text-slate-900 mt-0.5">
                            {ill.condition}
                          </CardTitle>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge
                            className={`text-[10px] font-bold ${
                              isOptimal
                                ? 'bg-emerald-600 text-white'
                                : isCritical
                                ? 'bg-rose-600 text-white'
                                : isHigh
                                ? 'bg-amber-600 text-white'
                                : 'bg-slate-700 text-white'
                            }`}
                          >
                            {ill.severity} Severity
                          </Badge>
                          <span className="text-[10px] font-semibold text-slate-500">
                            Confidence: {ill.confidence}
                          </span>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 space-y-3">
                      {/* Clinical description */}
                      <p className="text-xs text-slate-700 leading-relaxed font-normal">
                        {ill.description}
                      </p>

                      {/* Detected Indicators */}
                      <div>
                        <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                          Detected Vitals Signs & Indicators:
                        </span>
                        <ul className="space-y-1">
                          {ill.indicators.map((ind, idx) => (
                            <li key={idx} className="text-xs text-slate-600 flex items-start gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />
                              <span>{ind}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Clinical / Caregiver Action Recommendations */}
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                          Recommended Action Directives:
                        </span>
                        <ul className="space-y-1">
                          {ill.recommendations.map((rec, idx) => (
                            <li key={idx} className="text-xs text-slate-700 flex items-start gap-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100">
                              <ChevronRight className="w-3.5 h-3.5 text-teal-600 mt-0.5 shrink-0" />
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* 6. AI Insights & Health Pattern Observations */}
          <Card className="border border-slate-200 shadow-xs bg-slate-50/60">
            <CardHeader className="pb-3 border-b border-slate-200/80">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                Key Health Observations ({insights.timeframeLabel})
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Pattern observations and trends detected across historical sensor readings.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                {insights.keyInsights.map((ins, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-white border border-slate-200/80 text-xs text-slate-800 shadow-2xs">
                    <div className="p-1 rounded-md bg-teal-50 text-teal-700 shrink-0 mt-0.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                    </div>
                    <span className="leading-relaxed font-medium">{ins}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
