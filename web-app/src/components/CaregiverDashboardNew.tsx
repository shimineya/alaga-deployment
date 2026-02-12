import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/auth-context';
import { Patient, Alert, VitalSign, DoctorsOrdersData } from '../types';
import { generateAlertsFromDoctorsOrders, checkVitalSignThresholds } from '../lib/alert-generator';
import { DashboardSidebar } from './DashboardSidebar';
import { NotificationPanel } from './NotificationPanel';
import { PatientProfile } from './PatientProfile';
import { AddNewPatient } from './AddNewPatient';
import { PatientList } from './PatientList';
import { AddNewDevice } from './AddNewDevice';
import { AssignmentTracker } from './AssignmentTracker';
import { CaregiverUserManagement } from './CaregiverUserManagement';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import {
  Users, Activity, Bell, Heart, Thermometer, Droplets, Wifi,
  AlertTriangle, Check, User, LogOut, Search, TrendingUp, AlertCircle, ChevronLeft, ChevronRight,
  HelpCircle,
  Link2Off
} from 'lucide-react';
import { toast } from 'sonner';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';

export const CaregiverDashboardNew: React.FC = () => {
  const { user, logout, token } = useAuth();

  // --- State ---
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [viewMode, setViewMode] = useState<'dashboard' | 'profile'>('dashboard');
  const [profileInitialTab, setProfileInitialTab] = useState<string>('overview');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [vitalSigns, setVitalSigns] = useState<VitalSign[]>([]);
  const [activeNavItem, setActiveNavItem] = useState('dashboard');
  const [detailView, setDetailView] = useState<'list' | 'detail'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // --- Derived Metrics ---
  const metrics = useMemo(() => {
    const activePatients = patients.filter(p => !p.deleted && !p.archived);

    // Critical: Patients with unacknowledged critical alerts
    const criticalCount = activePatients.filter(p =>
      alerts.some(a => a.patientId === p.id && a.severity === 'critical' && !a.acknowledged)
    ).length;

    // Unassigned: Patients with no device connected/assigned
    const unassignedCount = activePatients.filter(p => !p.deviceConnected).length;

    // Stable: The rest
    const stableCount = activePatients.length - criticalCount - unassignedCount;

    return {
      critical: criticalCount,
      stable: Math.max(0, stableCount), // Prevent negative
      unassigned: unassignedCount,
      total: activePatients.length
    };
  }, [patients, alerts]);

  // --- Chart Data ---
  const trendData = [
    { time: '08:00', critical: 1, stable: 10 },
    { time: '12:00', critical: 0, stable: 11 },
    { time: '16:00', critical: metrics.critical, stable: metrics.stable },
  ];
  const distributionData = [
    { name: 'Stable', value: metrics.stable, color: '#10B981' },
    { name: 'Critical', value: metrics.critical, color: '#EF4444' },
    { name: 'Unassigned', value: metrics.unassigned, color: '#94A3B8' },
  ];

  // --- 1. Backend Integration ---
  useEffect(() => {
    const fetchPatients = async () => {
      if (!token) return;
      try {
        const response = await fetch('http://localhost:3000/api/caregiver/patients', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success && Array.isArray(data.data)) {
          const mappedPatients: Patient[] = data.data.map((p: any) => ({
            id: p.patient_id?.toString() || Math.random().toString(),
            name: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown',
            age: p.birthdate ? new Date().getFullYear() - new Date(p.birthdate).getFullYear() : 0,
            gender: p.gender || 'Unknown',
            roomNumber: 'Home',
            condition: p.baseline_data?.condition || 'Stable',
            status: 'Stable',
            medicalConditions: p.medical_history || [],
            allergies: p.allergies || [],
            medications: p.medications || [],
            doctorsOrders: [],
            // Default Vitals (Will be overwritten by sensors later)
            baselineVitals: { heartRate: 0, spo2: 0, temperature: 0, moistureLevel: 0 },
            deviceConnected: !!p.device_serial_number, // Logic for "Unassigned"
            assignedCaregiverName: p.assigned_caregiver_name,
            emergencyContact: { name: 'N/A', phone: 'N/A', relation: 'N/A' },
            deleted: false,
            archived: false
          }));
          setPatients(mappedPatients);
        }
      } catch (err) {
        console.error("Failed to fetch patients:", err);
        toast.error("Could not load patient data");
      }
    };
    fetchPatients();
  }, [token, activeNavItem]);

  // --- 2. Alert Logic ---
  useEffect(() => {
    if (patients.length === 0) return;
    const interval = setInterval(() => {
      const newAlerts: Alert[] = [];
      patients.forEach(patient => {
        const doctorOrderAlerts = generateAlertsFromDoctorsOrders(patient);
        newAlerts.push(...doctorOrderAlerts);
      });
      if (newAlerts.length > 0) {
        setAlerts(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          return [...prev, ...newAlerts.filter(a => !existingIds.has(a.id))];
        });
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [patients]);

  const handleAcknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, acknowledged: true } : a));
    toast.success('Alert acknowledged');
  };

  const handleMarkAllRead = () => {
    setAlerts(prev => prev.map(a => ({ ...a, acknowledged: true })));
  };

  const patientNamesMap = useMemo(() => {
    return patients.reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {} as Record<string, string>);
  }, [patients]);

  // --- Render Dashboard ---
  const renderDashboard = () => (
    <div className="space-y-4">
      {/* 1. Metrics Grid (Updated to include Unassigned) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Critical', value: metrics.critical, color: 'text-red-600', icon: AlertCircle, bg: 'bg-red-50' },
          { label: 'Stable', value: metrics.stable, color: 'text-emerald-600', icon: Activity, bg: 'bg-emerald-50' },
          { label: 'Unassigned', value: metrics.unassigned, color: 'text-slate-600', icon: Link2Off, bg: 'bg-slate-100' }, // [NEW]
          { label: 'Total', value: metrics.total, color: 'text-blue-600', icon: Users, bg: 'bg-blue-50' },
        ].map((stat, i) => (
          <Card key={i} className="shadow-sm border-slate-100">
            <CardContent className="p-3 flex justify-between items-center">
              <div>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">{stat.label}</p>
                <h3 className={`text-xl font-bold ${stat.color}`}>{stat.value}</h3>
              </div>
              <div className={`p-2 rounded-full ${stat.bg}`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 2. Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card className="lg:col-span-2 shadow-sm border-slate-100">
          <CardHeader className="py-2 px-4 border-b border-slate-50">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-slate-400" /> Status Overview (24h)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-2 h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="time" stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" fontSize={10} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '4px', border: 'none', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }} />
                <Area type="monotone" dataKey="critical" stroke="#EF4444" fill="url(#colorCritical)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-100">
          <CardHeader className="py-2 px-4 border-b border-slate-50">
            <CardTitle className="text-sm">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent className="p-0 h-[160px] flex justify-center items-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={distributionData} cx="50%" cy="50%" innerRadius={40} outerRadius={55} paddingAngle={2} dataKey="value">
                  {distributionData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                  <tspan x="50%" dy="0" fontSize="16" fontWeight="bold" fill="#334155">{metrics.total}</tspan>
                </text>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* 3. Patient Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {patients
          .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
          .map(patient => {
            // Get Vitals (Mock or Real)
            const latestVital = vitalSigns.find(v => v.patientId === patient.id);
            const activeAlerts = alerts.filter(a => a.patientId === patient.id && !a.acknowledged);
            const isCritical = activeAlerts.some(a => a.severity === 'critical');
            const isUnassigned = !patient.deviceConnected;

            return (
              <Card
                key={patient.id}
                className={`border shadow-sm hover:shadow-md transition-all cursor-pointer group ${isCritical ? 'border-red-200 bg-red-50/50' : 'border-slate-100'}`}
                onClick={() => { setSelectedPatient(patient); setViewMode('profile'); }}
              >
                <CardHeader className="p-3 pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-800 group-hover:text-teal-600 transition-colors">{patient.name}</CardTitle>
                      <CardDescription className="text-[11px] text-slate-500">Room {patient.roomNumber}</CardDescription>
                    </div>
                    {/* Badge Status */}
                    <Badge variant="outline" className={`text-[10px] h-5 ${isCritical ? 'text-red-600 border-red-200 bg-red-50' :
                      isUnassigned ? 'text-slate-600 border-slate-200 bg-slate-50' :
                        'text-emerald-600 border-emerald-200 bg-emerald-50'
                      }`}>
                      {isCritical ? 'Critical' : isUnassigned ? 'Unassigned' : 'Stable'}
                    </Badge>
                  </div>
                </CardHeader>

                {/* [NEW] 4 Vital Signs Grid: Pulse, Temp, SpO2, Wetness */}
                <CardContent className="p-3 pt-0 space-y-2">
                  <div className="grid grid-cols-2 gap-2">

                    {/* 1. Pulse Rate (Heart Rate) */}
                    <div className="bg-slate-50 p-1.5 rounded text-center border border-slate-100">
                      <div className="flex justify-center items-center gap-1 mb-0.5">
                        <Heart className="w-3 h-3 text-rose-500" />
                        <span className="text-[9px] text-slate-400 font-medium">PULSE</span>
                      </div>
                      <span className="text-xs font-bold text-slate-700">
                        {latestVital ? Math.round(latestVital.heartRate) : '--'}
                      </span>
                    </div>

                    {/* 2. Temperature */}
                    <div className="bg-slate-50 p-1.5 rounded text-center border border-slate-100">
                      <div className="flex justify-center items-center gap-1 mb-0.5">
                        <Thermometer className="w-3 h-3 text-amber-500" />
                        <span className="text-[9px] text-slate-400 font-medium">TEMP</span>
                      </div>
                      <span className="text-xs font-bold text-slate-700">
                        {latestVital ? latestVital.temperature.toFixed(1) : '--'}
                      </span>
                    </div>

                    {/* 3. SpO2 */}
                    <div className="bg-slate-50 p-1.5 rounded text-center border border-slate-100">
                      <div className="flex justify-center items-center gap-1 mb-0.5">
                        <Activity className="w-3 h-3 text-blue-500" />
                        <span className="text-[9px] text-slate-400 font-medium">SPO2</span>
                      </div>
                      <span className="text-xs font-bold text-slate-700">
                        {latestVital ? Math.round(latestVital.spo2) : '--'}
                      </span>
                    </div>

                    {/* 4. Wetness (Diaper) */}
                    <div className="bg-slate-50 p-1.5 rounded text-center border border-slate-100">
                      <div className="flex justify-center items-center gap-1 mb-0.5">
                        <Droplets className="w-3 h-3 text-teal-500" />
                        <span className="text-[9px] text-slate-400 font-medium">WETNESS</span>
                      </div>
                      <span className="text-xs font-bold text-slate-700">
                        {latestVital ? `${Math.round(latestVital.moistureLevel)}%` : '--'}
                      </span>
                    </div>

                  </div>

                  {activeAlerts.length > 0 && (
                    <Button size="sm" variant="destructive" className="w-full h-6 text-[10px] bg-red-500 hover:bg-red-600 text-white"
                      onClick={(e) => { e.stopPropagation(); handleAcknowledgeAlert(activeAlerts[0].id); }}
                    >
                      <Check className="w-3 h-3 mr-1" /> Acknowledge
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );

  const renderContent = () => {
    if (viewMode === 'profile' && selectedPatient) {
      return (
        <PatientProfile
          patient={selectedPatient}
          onBack={() => { setViewMode('dashboard'); setSelectedPatient(null); setProfileInitialTab('overview'); }}
          caregiverName={selectedPatient.assignedCaregiverName || user?.name}
          initialTab={profileInitialTab}
        />
      );
    }
    switch (activeNavItem) {
      case 'dashboard': return renderDashboard();
      case 'add-patient': return <AddNewPatient onSuccess={() => { toast.success("Added"); setActiveNavItem('dashboard'); }} onCancel={() => setActiveNavItem('dashboard')} />;
      case 'patient-list': return <PatientList patients={patients} vitalSigns={vitalSigns} onSelectPatient={(p) => { setSelectedPatient(p); setViewMode('profile'); }} />;
      case 'add-device': return <AddNewDevice onDeviceAdded={() => setActiveNavItem('dashboard')} onCancel={() => setActiveNavItem('dashboard')} />;
      case 'assignment-tracker': return <AssignmentTracker />;
      case 'user-management': return <CaregiverUserManagement patients={patients} user={user} />;
      default: return renderDashboard();
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50/50">
      <DashboardSidebar
        activeItem={activeNavItem}
        onItemClick={(item) => { setActiveNavItem(item); setDetailView('list'); }}
        userRole="caregiver"
      />

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="bg-white border-b border-slate-200 flex-shrink-0 px-6 py-2 shadow-sm z-20 h-14 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-teal-900 tracking-tight">Dashboard</h2>
            <p className="text-[10px] text-slate-500 font-medium">Welcome back, {user?.name || 'Caregiver'}</p>
          </div>
          <div className="flex items-center gap-3">
            <NotificationPanel alerts={alerts} onAcknowledge={handleAcknowledgeAlert} onMarkAllRead={handleMarkAllRead} patientNames={patientNamesMap} />
            <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 font-bold text-xs">
              {user?.name?.[0] || 'C'}
            </div>
            <Button variant="ghost" size="icon" onClick={logout} className="h-8 w-8 text-slate-400 hover:text-red-500">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 scroll-smooth">
          <div className="w-full h-full pb-10">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
};