import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/auth-context';
import { Patient, Alert, VitalSign, DoctorsOrdersData } from '../types';
// [MODIFIED] Removed mockPatients, mockAlerts, mockUsers. Kept generator for simulation.
import { generateMockVitalSigns } from '../lib/mock-data';
import { generateAlertsFromDoctorsOrders, checkVitalSignThresholds } from '../lib/alert-generator';
import { DashboardSidebar } from './DashboardSidebar';
import { NotificationPanel } from './NotificationPanel';
import { DoctorsOrders } from './DoctorsOrders';
import { Bulletin } from './Bulletin';
import { PatientProfile } from './PatientProfile';
import { AddNewDevice } from './AddNewDevice'; // Add this near top
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Textarea } from './ui/textarea';
import {
  Users,
  Activity,
  Bell,
  Heart,
  Thermometer,
  Droplets,
  Battery,
  Wifi,
  WifiOff,
  AlertTriangle,
  Check,
  Download,
  User,
  LogOut,
  UserPlus,
  Settings,
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Key,
  Shield,
  Globe,
  Volume2,
  ArrowLeft,
  TrendingUp,
  Archive,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export const CaregiverDashboardNew: React.FC = () => {
  const { user, logout } = useAuth();

  // --- State Management ---
  const [patients, setPatients] = useState<Patient[]>([]); // Starts Empty
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]); // Starts Empty
  const [vitalSigns, setVitalSigns] = useState<VitalSign[]>([]);
  const [timeRange, setTimeRange] = useState<'8h' | '24h' | '7d' | '30d'>('24h');
  const [activeNavItem, setActiveNavItem] = useState('dashboard');
  const [detailView, setDetailView] = useState<'list' | 'detail'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  // Forms & Settings
  const [newPatientForm, setNewPatientForm] = useState({
    name: '',
    age: '',
    medicalConditions: '',
    deviceId: ''
  });
  const [doctorsOrdersData, setDoctorsOrdersData] = useState<DoctorsOrdersData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [viewMode, setViewMode] = useState<'dashboard' | 'profile'>('dashboard');
  const [autoDeletePeriod, setAutoDeletePeriod] = useState<'1week' | '1month' | '3months' | '6months' | '1year'>('1month');

  // Alarm System
  const [alarmSound, setAlarmSound] = useState<HTMLAudioElement | null>(null);
  const [playingAlarms, setPlayingAlarms] = useState<Set<string>>(new Set());
  const [silencedPatients, setSilencedPatients] = useState<Set<string>>(new Set());

  // --- Derived Metrics for Dashboard ---
  const metrics = useMemo(() => {
    const activePatients = patients.filter(p => !p.deleted && !p.archived);
    const criticalCount = activePatients.filter(p =>
      alerts.some(a => a.patientId === p.id && a.severity === 'critical' && !a.acknowledged)
    ).length;

    const unassignedCount = 0;
    const stableCount = activePatients.length - criticalCount;

    return {
      critical: criticalCount,
      stable: stableCount,
      unassigned: unassignedCount,
      total: activePatients.length
    };
  }, [patients, alerts]);

  // --- Mock Data for Charts ---
  const trendData = [
    { time: '00:00', critical: 1, stable: 10 },
    { time: '04:00', critical: 2, stable: 9 },
    { time: '08:00', critical: 1, stable: 10 },
    { time: '12:00', critical: 0, stable: 11 },
    { time: '16:00', critical: metrics.critical + 1, stable: metrics.stable - 1 },
    { time: '20:00', critical: metrics.critical, stable: metrics.stable },
  ];

  const distributionData = [
    { name: 'Stable', value: metrics.stable, color: '#10B981' }, // Emerald-500
    { name: 'Critical', value: metrics.critical, color: '#EF4444' }, // Red-500
  ];

  // --- Audio Initialization ---
  useEffect(() => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUKnl7a1gGgU7k9n3zH4tBSh+zPLajUIKFV644u+nUxQJRp/i8bllHgYugM/y4Y44CBttv/DooEoMDU+t6PKjYB4EOo/Y88B+LQUofM/y14xBCRZmuuPwp1QVCkaf4fK0YyAFLIDP8t2JOQYZ');
    audio.loop = true;
    setAlarmSound(audio);
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  // --- Alarm Logic ---
  useEffect(() => {
    if (!alarmSound) return;

    const criticalPatients = patients.filter(p => {
      if (p.deleted || p.archived || silencedPatients.has(p.id)) return false;
      const patientAlerts = alerts.filter(a => a.patientId === p.id && !a.acknowledged && a.severity === 'critical');
      const deviceOffline = !p.deviceConnected || !p.hrDeviceConnected || !p.diaperDeviceConnected;
      return patientAlerts.length > 0 || deviceOffline;
    });

    const newPlayingAlarms = new Set(criticalPatients.map(p => p.id));

    if (newPlayingAlarms.size > 0) {
      alarmSound.play().catch(() => console.log('Alarm blocked'));
    } else {
      alarmSound.pause();
    }
    setPlayingAlarms(newPlayingAlarms);
  }, [patients, alerts, alarmSound, silencedPatients]);

  // --- Data Loading & Generation ---
  // [REMOVED] The useEffect that forced 'mockPatients' to load on start.
  // The 'patients' state now starts empty and relies on 'handleAddPatient'.

  useEffect(() => {
    if (selectedPatient) {
      const vitals = generateMockVitalSigns(selectedPatient.id, selectedPatient.baselineVitals);
      setVitalSigns(vitals);
    }
  }, [selectedPatient, timeRange]);

  // Alert Generation Loop
  useEffect(() => {
    if (patients.length === 0) return; // Skip if no patients

    const interval = setInterval(() => {
      const newAlerts: Alert[] = [];
      patients.forEach(patient => {
        const doctorOrderAlerts = generateAlertsFromDoctorsOrders(patient);
        newAlerts.push(...doctorOrderAlerts);

        const latestVital = vitalSigns.find(v => v.patientId === patient.id);
        if (latestVital && patient.doctorsOrders) {
          const thresholdAlert = checkVitalSignThresholds(patient, {
            heartRate: latestVital.heartRate,
            temperature: latestVital.temperature,
            spo2: latestVital.spo2
          });
          if (thresholdAlert) newAlerts.push(thresholdAlert);
        }
      });

      if (newAlerts.length > 0) {
        setAlerts(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          return [...prev, ...newAlerts.filter(a => !existingIds.has(a.id))];
        });
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [patients, vitalSigns]);

  // --- Handlers ---
  const handleAcknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert =>
      alert.id === alertId ? { ...alert, acknowledged: true, acknowledgedBy: user?.id, acknowledgedAt: new Date() } : alert
    ));
    toast.success('Alert acknowledged');
  };

  const handleMarkAllRead = () => {
    setAlerts(prev => prev.map(alert => ({ ...alert, acknowledged: true, acknowledgedBy: user?.id, acknowledgedAt: new Date() })));
    toast.success('All alerts marked as read');
  };

  const handleAddPatient = () => {
    if (!newPatientForm.name || !newPatientForm.age || !newPatientForm.deviceId) {
      toast.error('Please fill all required fields');
      return;
    }
    const newPatient: Patient = {
      id: `p${patients.length + 1}`,
      name: newPatientForm.name,
      age: parseInt(newPatientForm.age),
      medicalConditions: newPatientForm.medicalConditions.split(',').filter(c => c),
      baselineVitals: { heartRate: 75, temperature: 36.8, spo2: 97 },
      caregiverId: user?.id,
      deviceId: newPatientForm.deviceId,
      deviceBattery: 100,
      deviceConnected: true,
      lastUpdated: new Date(),
      doctorsOrders: doctorsOrdersData || undefined
    };
    setPatients(prev => [...prev, newPatient]);
    toast.success('Patient added');
    setNewPatientForm({ name: '', age: '', medicalConditions: '', deviceId: '' });
    setActiveNavItem('dashboard');
  };

  const handleDownloadReport = (type: string) => toast.success(`Downloading ${type} report...`);

  // --- Helpers ---
  const patientNamesMap = patients.reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {} as Record<string, string>);

  // --- Render Sections ---

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* ZONE A: High-Level Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Critical Card */}
        <Card className="border-l-4 border-l-red-500 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-500">Critical Status</p>
              <h3 className="text-3xl font-bold text-red-600">{metrics.critical}</h3>
            </div>
            <div className="p-3 bg-red-50 rounded-full">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
          </CardContent>
        </Card>

        {/* Stable Card */}
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-500">Stable</p>
              <h3 className="text-3xl font-bold text-emerald-600">{metrics.stable}</h3>
            </div>
            <div className="p-3 bg-emerald-50 rounded-full">
              <Activity className="w-6 h-6 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        {/* Unassigned Card */}
        <Card className="border-l-4 border-l-gray-400 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-500">Unassigned</p>
              <h3 className="text-3xl font-bold text-gray-600">{metrics.unassigned}</h3>
            </div>
            <div className="p-3 bg-gray-50 rounded-full">
              <Users className="w-6 h-6 text-gray-600" />
            </div>
          </CardContent>
        </Card>

        {/* Total Card */}
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardContent className="p-6 flex justify-between items-center">
            <div>
              <p className="text-sm font-medium text-gray-500">Total Patients</p>
              <h3 className="text-3xl font-bold text-blue-600">{metrics.total}</h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-full">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ZONE B: Analytical Context */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-slate-500" />
              Status Trends (24h)
            </CardTitle>
            <CardDescription>Monitoring alert frequency vs stability over time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorStable" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="time" stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748B" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                    itemStyle={{ fontSize: '12px' }}
                  />
                  <Area type="monotone" dataKey="stable" stroke="#10B981" fillOpacity={1} fill="url(#colorStable)" strokeWidth={2} name="Stable" />
                  <Area type="monotone" dataKey="critical" stroke="#EF4444" fillOpacity={1} fill="url(#colorCritical)" strokeWidth={2} name="Critical" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle>Distribution</CardTitle>
            <CardDescription>Current Patient Status</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center items-center h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distributionData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                  <tspan x="50%" dy="-0.5em" fontSize="24" fontWeight="bold" fill="#1E293B">{metrics.total}</tspan>
                  <tspan x="50%" dy="1.5em" fontSize="12" fill="#64748B">Patients</tspan>
                </text>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ZONE C: Patient Overview */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-xl font-bold text-slate-800">Patients Overview</h2>

          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
              />
            </div>

            {/* Pagination */}
            {(() => {
              const filtered = patients.filter(p => !p.archived && !p.deleted && p.name.toLowerCase().includes(searchQuery.toLowerCase()));
              const totalPages = Math.ceil(filtered.length / itemsPerPage);
              return (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-gray-600">Page {currentPage} of {totalPages || 1}</span>
                  <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Patient Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {(() => {
            const filtered = patients.filter(p => !p.archived && !p.deleted && p.name.toLowerCase().includes(searchQuery.toLowerCase()));
            const sorted = filtered.sort((a, b) => {
              const aCritical = alerts.some(al => al.patientId === a.id && al.severity === 'critical' && !al.acknowledged);
              const bCritical = alerts.some(al => al.patientId === b.id && al.severity === 'critical' && !al.acknowledged);
              return (aCritical === bCritical) ? 0 : aCritical ? -1 : 1;
            });
            const paginated = sorted.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

            if (paginated.length === 0) {
              return <div className="col-span-full text-center py-12 text-gray-500">No patients found. Add a patient to start.</div>;
            }

            return paginated.map(patient => {
              // Generate simulation vitals if not in history
              const vitals = generateMockVitalSigns(patient.id, patient.baselineVitals);
              const latestVital = vitals[vitals.length - 1];
              const activeAlerts = alerts.filter(a => a.patientId === patient.id && !a.acknowledged);
              const isCritical = activeAlerts.some(a => a.severity === 'critical');
              const isOffline = !patient.deviceConnected;

              return (
                <Card
                  key={patient.id}
                  className={`border-0 hover:shadow-lg transition-all cursor-pointer ${isCritical ? 'ring-2 ring-red-400 bg-red-50' : ''}`}
                  style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}
                  onClick={() => { setSelectedPatient(patient); setViewMode('profile'); }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base text-slate-800">{patient.name}</CardTitle>
                        <CardDescription className="text-xs">{patient.age} yrs • Room {patient.roomNumber || 'N/A'}</CardDescription>
                      </div>
                      <Badge variant={isCritical ? 'destructive' : isOffline ? 'secondary' : 'default'} className={!isCritical && !isOffline ? 'bg-emerald-500 hover:bg-emerald-600' : ''}>
                        {isCritical ? 'Critical' : isOffline ? 'Offline' : 'Stable'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-white/60 p-2 rounded text-center">
                        <Heart className="w-4 h-4 mx-auto text-rose-500 mb-1" />
                        <span className="text-sm font-bold text-slate-700">{Math.round(latestVital?.heartRate || 75)}</span> <span className="text-[10px] text-slate-500">bpm</span>
                      </div>
                      <div className="bg-white/60 p-2 rounded text-center">
                        <Thermometer className="w-4 h-4 mx-auto text-amber-500 mb-1" />
                        <span className="text-sm font-bold text-slate-700">{(latestVital?.temperature || 36.5).toFixed(1)}</span> <span className="text-[10px] text-slate-500">°C</span>
                      </div>
                      <div className="bg-white/60 p-2 rounded text-center">
                        <Activity className="w-4 h-4 mx-auto text-blue-500 mb-1" />
                        <span className="text-sm font-bold text-slate-700">{Math.round(latestVital?.spo2 || 98)}</span> <span className="text-[10px] text-slate-500">%</span>
                      </div>
                      <div className="bg-white/60 p-2 rounded text-center">
                        <Droplets className="w-4 h-4 mx-auto text-teal-500 mb-1" />
                        <span className="text-sm font-bold text-slate-700">{Math.round(latestVital?.moistureLevel || 0)}</span> <span className="text-[10px] text-slate-500">%</span>
                      </div>
                    </div>

                    {activeAlerts.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-7 text-xs border-red-200 text-red-700 hover:bg-red-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSilencedPatients(prev => new Set(prev).add(patient.id));
                          setAlerts(prev => prev.map(a => a.patientId === patient.id ? { ...a, acknowledged: true } : a));
                          toast.success('Alerts acknowledged');
                        }}
                      >
                        <Check className="w-3 h-3 mr-1" /> Acknowledge {activeAlerts.length}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            });
          })()}
        </div>
      </div>
    </div>
  );

  const renderAddPatient = () => (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle>Add New Patient</CardTitle>
          <CardDescription>Register a new patient to monitoring</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2"><Label>Name</Label><Input value={newPatientForm.name} onChange={e => setNewPatientForm({ ...newPatientForm, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Age</Label><Input value={newPatientForm.age} onChange={e => setNewPatientForm({ ...newPatientForm, age: e.target.value })} /></div>
          <div className="space-y-2"><Label>Device ID</Label><Input value={newPatientForm.deviceId} onChange={e => setNewPatientForm({ ...newPatientForm, deviceId: e.target.value })} /></div>
          <Button onClick={handleAddPatient} className="w-full bg-teal-500 text-white">Add Patient</Button>
        </CardContent>
      </Card>
      {newPatientForm.name && <DoctorsOrders patientName={newPatientForm.name} onSave={setDoctorsOrdersData} initialData={doctorsOrdersData || undefined} />}
    </div>
  );

  const renderContent = () => {
    if (viewMode === 'profile' && selectedPatient) {
      // [MODIFIED] Removed mockUsers lookup. Using auth context user name.
      return <PatientProfile patient={selectedPatient} onBack={() => { setViewMode('dashboard'); setSelectedPatient(null); }} caregiverName={user?.name} />;
    }
    switch (activeNavItem) {
      case 'dashboard': return renderDashboard();
      case 'add-patient': return renderAddPatient();
      case 'add-device': return (
        <AddNewDevice
          onDeviceAdded={() => {
            setActiveNavItem('dashboard');
            // Optional: Refresh lists or show notification
          }}
          onCancel={() => setActiveNavItem('dashboard')}
        />
      );
      default: return renderDashboard();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar
        activeItem={activeNavItem}
        onItemClick={(item) => { setActiveNavItem(item); setDetailView('list'); }}
        userRole="caregiver"
      />
      <div className="ml-60">
        <header className="bg-white border-b sticky top-0 z-40 px-6 py-4 shadow-sm">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-slate-800">Dashboard</h2>
              <p className="text-sm text-slate-500">Caregiver Portal</p>
            </div>
            <div className="flex items-center gap-3">
              <NotificationPanel alerts={alerts} onAcknowledge={handleAcknowledgeAlert} onMarkAllRead={handleMarkAllRead} patientNames={patientNamesMap} />
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100">
                <User className="w-4 h-4" /> <span className="text-sm">{user?.name}</span>
              </div>
              <Button variant="outline" size="sm" onClick={logout}><LogOut className="w-4 h-4 mr-2" /> Logout</Button>
            </div>
          </div>
        </header>
        <main className="p-6 overflow-x-hidden">{renderContent()}</main>
      </div>
    </div>
  );
};