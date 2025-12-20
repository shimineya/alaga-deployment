import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { Patient, Alert, VitalSign } from '../types';
import { mockPatients, mockAlerts, mockUsers, generateMockVitalSigns } from '../lib/mock-data';
import { DashboardSidebar } from './DashboardSidebar';
import { NotificationPanel } from './NotificationPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { 
  Bell, 
  LogOut, 
  User, 
  Download, 
  TrendingUp, 
  Users, 
  Activity, 
  AlertTriangle, 
  UserPlus,
  CheckCircle,
  XCircle,
  Clock,
  Heart,
  Thermometer,
  Droplets,
  Battery,
  Wifi,
  WifiOff,
  Search,
  Shield,
  Key,
  ArrowLeft
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, BarChart, Bar } from 'recharts';

interface AssignmentRequest {
  id: string;
  patientId: string;
  caregiverId: string;
  status: 'pending' | 'accepted' | 'rejected';
  reason?: string;
  timestamp: Date;
  respondedAt?: Date;
}

export const MedicalStaffDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [patients, setPatients] = useState<Patient[]>(mockPatients);
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [activeNavItem, setActiveNavItem] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [detailView, setDetailView] = useState<'list' | 'detail'>('list');
  const [timeRange, setTimeRange] = useState<'8h' | '24h' | '7d' | '30d'>('24h');
  const [vitalSigns, setVitalSigns] = useState<VitalSign[]>([]);
  
  const [assignments, setAssignments] = useState<AssignmentRequest[]>([
    {
      id: 'req1',
      patientId: 'p1',
      caregiverId: '1',
      status: 'accepted',
      timestamp: new Date(Date.now() - 3600000),
      respondedAt: new Date(Date.now() - 3000000)
    },
    {
      id: 'req2',
      patientId: 'p2',
      caregiverId: '1',
      status: 'pending',
      timestamp: new Date(Date.now() - 1800000)
    },
  ]);

  const [newPatientForm, setNewPatientForm] = useState({
    name: '',
    age: '',
    medicalConditions: '',
    deviceId: '',
    caregiverEmail: ''
  });

  useEffect(() => {
    if (selectedPatient) {
      const vitals = generateMockVitalSigns(selectedPatient.id, selectedPatient.baselineVitals);
      const now = Date.now();
      const ranges = {
        '8h': 8 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      const filtered = vitals.filter(v => 
        now - new Date(v.timestamp).getTime() <= ranges[timeRange]
      );
      setVitalSigns(filtered);
    }
  }, [selectedPatient, timeRange]);

  const handleAcknowledgeAlert = (alertId: string) => {
    setAlerts(prev => 
      prev.map(alert => 
        alert.id === alertId 
          ? { ...alert, acknowledged: true, acknowledgedBy: user?.id, acknowledgedAt: new Date() }
          : alert
      )
    );
    toast.success('Alert acknowledged');
  };

  const handleMarkAllRead = () => {
    setAlerts(prev => 
      prev.map(alert => ({ ...alert, acknowledged: true, acknowledgedBy: user?.id, acknowledgedAt: new Date() }))
    );
    toast.success('All alerts marked as read');
  };

  const handleAssignPatient = () => {
    if (!newPatientForm.name || !newPatientForm.age || !newPatientForm.deviceId || !newPatientForm.caregiverEmail) {
      toast.error('Please fill all required fields');
      return;
    }

    // Find caregiver by email
    const caregiver = mockUsers.find(u => u.email === newPatientForm.caregiverEmail && u.role === 'caregiver');
    
    if (!caregiver) {
      toast.error('Caregiver with this email not found');
      return;
    }

    const newPatient: Patient = {
      id: `p${patients.length + 1}`,
      name: newPatientForm.name,
      age: parseInt(newPatientForm.age),
      medicalConditions: newPatientForm.medicalConditions.split(',').map(c => c.trim()).filter(c => c),
      baselineVitals: {
        heartRate: 75,
        temperature: 36.8,
        spo2: 97
      },
      caregiverId: caregiver.id,
      deviceId: newPatientForm.deviceId,
      deviceBattery: 100,
      deviceConnected: true,
      lastUpdated: new Date()
    };

    setPatients(prev => [...prev, newPatient]);
    
    const newAssignment: AssignmentRequest = {
      id: `req${assignments.length + 1}`,
      patientId: newPatient.id,
      caregiverId: caregiver.id,
      status: 'pending',
      timestamp: new Date()
    };
    
    setAssignments(prev => [...prev, newAssignment]);
    
    toast.success(`Assignment request sent to ${caregiver.name}. Awaiting response.`);
    setNewPatientForm({ name: '', age: '', medicalConditions: '', deviceId: '', caregiverEmail: '' });
  };

  const handleDownloadReport = (type: 'analytics') => {
    if (!selectedPatient) return;
    
    const filename = `${selectedPatient.name}_${type}_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`;
    toast.success(`Downloading ${filename}`);
  };

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);
  const criticalAlerts = unacknowledgedAlerts.filter(a => a.severity === 'critical');
  
  const patientNamesMap = patients.reduce((acc, patient) => {
    acc[patient.id] = patient.name;
    return acc;
  }, {} as Record<string, string>);

  const patientsByStatus = {
    critical: patients.filter(p => criticalAlerts.some(a => a.patientId === p.id)),
    stable: patients.filter(p => p.deviceConnected && !criticalAlerts.some(a => a.patientId === p.id)),
    unassigned: patients.filter(p => !p.caregiverId)
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return new Date(date).toLocaleDateString();
  };

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'bedwetting': return Droplets;
      case 'vital_signs': return Activity;
      case 'device': return Wifi;
      case 'anomaly': return AlertTriangle;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      critical: 'bg-[#E74C3C] text-white',
      warning: 'bg-[#F39C12] text-white',
      normal: 'bg-[#2ECC71] text-white',
    };
    return colors[severity as keyof typeof colors] || colors.normal;
  };

  const renderContent = () => {
    switch (activeNavItem) {
      case 'dashboard':
        return renderDashboard();
      case 'add-patient':
        return renderAddPatient();
      case 'master-list':
        return renderMasterList();
      case 'analytics-reports':
        return detailView === 'detail' ? renderAnalyticsDetail() : renderAnalyticsList();
      case 'health-trends':
        return detailView === 'detail' ? renderHealthTrendsDetail() : renderHealthTrendsList();
      case 'activity-logs':
        return renderActivityLogs();
      case 'sensor-health':
        return renderSensorHealth();
      case 'system-settings':
        return renderSystemSettings();
      case 'profile':
        return renderProfile();
      default:
        return renderDashboard();
    }
  };

  // Main Dashboard
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full bg-[#E74C3C]" />
              <p className="text-sm" style={{ color: '#7F8C8D' }}>Critical</p>
            </div>
            <p className="text-3xl" style={{ color: '#2C3E50' }}>{patientsByStatus.critical.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full bg-[#2ECC71]" />
              <p className="text-sm" style={{ color: '#7F8C8D' }}>Stable</p>
            </div>
            <p className="text-3xl" style={{ color: '#2C3E50' }}>{patientsByStatus.stable.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-3 h-3 rounded-full bg-[#95A5A6]" />
              <p className="text-sm" style={{ color: '#7F8C8D' }}>Unassigned</p>
            </div>
            <p className="text-3xl" style={{ color: '#2C3E50' }}>{patientsByStatus.unassigned.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-4 h-4" style={{ color: '#7DD3C0' }} />
              <p className="text-sm" style={{ color: '#7F8C8D' }}>Total</p>
            </div>
            <p className="text-3xl" style={{ color: '#2C3E50' }}>{patients.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search for Patient */}
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search patients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Patients List with Quick Overview */}
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Patients Overview</CardTitle>
          <CardDescription>Quick status of all patients in facility</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {patients.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(patient => {
              const vitals = generateMockVitalSigns(patient.id, patient.baselineVitals);
              const latestVital = vitals[vitals.length - 1];
              const caregiver = mockUsers.find(u => u.id === patient.caregiverId);
              
              return (
                <div 
                  key={patient.id}
                  className="p-4 rounded-lg border hover:shadow-md transition-all cursor-pointer"
                  style={{ backgroundColor: '#FAFAFA' }}
                  onClick={() => {
                    setSelectedPatient(patient);
                    setActiveNavItem('health-trends');
                    setDetailView('detail');
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${patient.deviceConnected ? 'bg-[#2ECC71] animate-pulse' : 'bg-[#E74C3C]'}`} />
                      <div>
                        <h4 style={{ color: '#2C3E50' }}>{patient.name}</h4>
                        <p className="text-xs" style={{ color: '#7F8C8D' }}>
                          {patient.age} years • {caregiver?.name || 'Unassigned'}
                        </p>
                      </div>
                    </div>
                    <Badge className={patient.deviceConnected ? 'bg-[#2ECC71] text-white' : 'bg-[#E74C3C] text-white'}>
                      {patient.deviceConnected ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-2 rounded bg-white">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Heart className="w-3 h-3" style={{ color: '#E74C3C' }} />
                        <p className="text-xs" style={{ color: '#7F8C8D' }}>HR</p>
                      </div>
                      <p className="text-lg" style={{ color: '#2C3E50' }}>{Math.round(latestVital?.heartRate || patient.baselineVitals.heartRate)}</p>
                      <p className="text-xs" style={{ color: '#7F8C8D' }}>bpm</p>
                    </div>
                    
                    <div className="text-center p-2 rounded bg-white">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Thermometer className="w-3 h-3" style={{ color: '#F39C12' }} />
                        <p className="text-xs" style={{ color: '#7F8C8D' }}>Temp</p>
                      </div>
                      <p className="text-lg" style={{ color: '#2C3E50' }}>{(latestVital?.temperature || patient.baselineVitals.temperature).toFixed(1)}</p>
                      <p className="text-xs" style={{ color: '#7F8C8D' }}>°C</p>
                    </div>
                    
                    <div className="text-center p-2 rounded bg-white">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Activity className="w-3 h-3" style={{ color: '#3498DB' }} />
                        <p className="text-xs" style={{ color: '#7F8C8D' }}>SpO₂</p>
                      </div>
                      <p className="text-lg" style={{ color: '#2C3E50' }}>{Math.round(latestVital?.spo2 || patient.baselineVitals.spo2)}</p>
                      <p className="text-xs" style={{ color: '#7F8C8D' }}>%</p>
                    </div>
                    
                    <div className="text-center p-2 rounded bg-white">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        <Droplets className="w-3 h-3" style={{ color: '#7DD3C0' }} />
                        <p className="text-xs" style={{ color: '#7F8C8D' }}>Moisture</p>
                      </div>
                      <p className="text-lg" style={{ color: '#2C3E50' }}>{Math.round(latestVital?.moistureLevel || 0)}</p>
                      <p className="text-xs" style={{ color: '#7F8C8D' }}>%</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Alerts Section */}
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle style={{ color: '#2C3E50' }}>System Alerts</CardTitle>
              <CardDescription>Sensor and system notifications</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {alerts.slice(0, 5).map(alert => {
              const Icon = getAlertIcon(alert.type);
              const patient = patients.find(p => p.id === alert.patientId);
              
              return (
                <div 
                  key={alert.id}
                  className="p-3 rounded-lg border-l-4"
                  style={{ 
                    borderLeftColor: alert.severity === 'critical' ? '#E74C3C' : '#F39C12',
                    backgroundColor: '#F9FAFB'
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 flex-1">
                      <Icon className="w-4 h-4 mt-0.5" style={{ color: alert.severity === 'critical' ? '#E74C3C' : '#F39C12' }} />
                      <div className="flex-1">
                        <p className="text-sm" style={{ color: '#2C3E50' }}>{patient?.name}: {alert.title}</p>
                        <p className="text-xs" style={{ color: '#7F8C8D' }}>{formatTimestamp(alert.timestamp)}</p>
                      </div>
                    </div>
                    <Badge className={getSeverityBadge(alert.severity)}>
                      {alert.severity}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Analytics Button */}
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardContent className="pt-6">
          <Button 
            onClick={() => setActiveNavItem('analytics-reports')}
            className="w-full text-white"
            style={{ backgroundColor: '#7DD3C0' }}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            View Analytics & Reports
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // Add New Patient (with proper spacing)
  const renderAddPatient = () => (
    <div className="max-w-2xl">
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Patient Enrollment</CardTitle>
          <CardDescription>Register a new patient and send assignment request</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Patient Name *</Label>
            <Input
              placeholder="Enter patient name"
              value={newPatientForm.name}
              onChange={(e) => setNewPatientForm({ ...newPatientForm, name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Age *</Label>
            <Input
              type="number"
              placeholder="Enter age"
              value={newPatientForm.age}
              onChange={(e) => setNewPatientForm({ ...newPatientForm, age: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Medical Conditions</Label>
            <Textarea
              placeholder="Enter conditions separated by commas"
              value={newPatientForm.medicalConditions}
              onChange={(e) => setNewPatientForm({ ...newPatientForm, medicalConditions: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>ESP32 Device ID *</Label>
            <Input
              placeholder="e.g., ESP32-004"
              value={newPatientForm.deviceId}
              onChange={(e) => setNewPatientForm({ ...newPatientForm, deviceId: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Caregiver Email *</Label>
            <Input
              type="email"
              placeholder="Enter caregiver email"
              value={newPatientForm.caregiverEmail}
              onChange={(e) => setNewPatientForm({ ...newPatientForm, caregiverEmail: e.target.value })}
            />
            <p className="text-xs" style={{ color: '#7F8C8D' }}>
              Enter the email address of the caregiver you want to assign
            </p>
          </div>
          <Button 
            onClick={handleAssignPatient}
            className="w-full text-white"
            style={{ backgroundColor: '#7DD3C0' }}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Send Assignment Request
          </Button>
        </CardContent>
      </Card>

      {/* Pending Assignment Requests */}
      <Card className="border-0 mt-6" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Assignment Requests</CardTitle>
          <CardDescription>Track caregiver responses</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {assignments.map(assignment => {
              const patient = patients.find(p => p.id === assignment.patientId);
              const caregiver = mockUsers.find(u => u.id === assignment.caregiverId);
              
              return (
                <div 
                  key={assignment.id}
                  className="p-4 rounded-lg border"
                  style={{ backgroundColor: '#FAFAFA' }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <p style={{ color: '#2C3E50' }}>
                        {patient?.name} → {caregiver?.name}
                      </p>
                      <p className="text-xs" style={{ color: '#7F8C8D' }}>
                        Sent {formatTimestamp(assignment.timestamp)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {assignment.status === 'pending' && (
                        <Badge className="bg-[#F39C12] text-white">
                          <Clock className="w-3 h-3 mr-1" />
                          Pending
                        </Badge>
                      )}
                      {assignment.status === 'accepted' && (
                        <Badge className="bg-[#2ECC71] text-white">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Accepted
                        </Badge>
                      )}
                      {assignment.status === 'rejected' && (
                        <Badge className="bg-[#E74C3C] text-white">
                          <XCircle className="w-3 h-3 mr-1" />
                          Rejected
                        </Badge>
                      )}
                    </div>
                  </div>
                  {assignment.reason && (
                    <div className="mt-2 p-2 rounded bg-red-50">
                      <p className="text-xs text-red-600">Reason: {assignment.reason}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Master Patient List
  const renderMasterList = () => {
    if (detailView === 'detail' && selectedPatient) {
      return renderPatientDetail();
    }

    const filteredPatients = patients.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="space-y-4">
        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search patients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPatients.map(patient => {
            const caregiver = mockUsers.find(u => u.id === patient.caregiverId);
            const patientAlerts = alerts.filter(a => a.patientId === patient.id && !a.acknowledged);
            const vitals = generateMockVitalSigns(patient.id, patient.baselineVitals);
            const latestVital = vitals[vitals.length - 1];
            
            return (
              <Card 
                key={patient.id}
                className="border-0 cursor-pointer hover:shadow-lg transition-all"
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}
                onClick={() => {
                  setSelectedPatient(patient);
                  setDetailView('detail');
                }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base" style={{ color: '#2C3E50' }}>{patient.name}</CardTitle>
                      <CardDescription>{patient.age} years old</CardDescription>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${patient.deviceConnected ? 'bg-[#2ECC71]' : 'bg-[#E74C3C]'}`} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Assigned Caregiver</p>
                    <p className="text-sm" style={{ color: '#2C3E50' }}>
                      {caregiver?.name || 'Unassigned'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Device ID</p>
                    <p className="text-sm" style={{ color: '#2C3E50' }}>{patient.deviceId}</p>
                  </div>
                  
                  {/* Quick Overview */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t">
                    <div>
                      <p className="text-xs" style={{ color: '#7F8C8D' }}>HR</p>
                      <p className="text-sm" style={{ color: '#2C3E50' }}>{Math.round(latestVital?.heartRate || patient.baselineVitals.heartRate)} bpm</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: '#7F8C8D' }}>Temp</p>
                      <p className="text-sm" style={{ color: '#2C3E50' }}>{(latestVital?.temperature || patient.baselineVitals.temperature).toFixed(1)}°C</p>
                    </div>
                  </div>
                  
                  {patientAlerts.length > 0 && (
                    <Badge className="bg-[#E74C3C] text-white">
                      {patientAlerts.length} Alert{patientAlerts.length > 1 ? 's' : ''}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  // Patient Detail View
  const renderPatientDetail = () => {
    if (!selectedPatient) return null;

    const caregiver = mockUsers.find(u => u.id === selectedPatient.caregiverId);
    const patientAlerts = alerts.filter(a => a.patientId === selectedPatient.id);
    const vitals = generateMockVitalSigns(selectedPatient.id, selectedPatient.baselineVitals);
    const latestVital = vitals[vitals.length - 1];

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setDetailView('list')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to List
          </Button>
          <h2 className="text-xl" style={{ color: '#2C3E50' }}>
            Patient Details: {selectedPatient.name}
          </h2>
        </div>

        {/* Patient Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
            <CardHeader>
              <CardTitle style={{ color: '#2C3E50' }}>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Full Name</p>
                  <p style={{ color: '#2C3E50' }}>{selectedPatient.name}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Age</p>
                  <p style={{ color: '#2C3E50' }}>{selectedPatient.age} years</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Device ID</p>
                  <p style={{ color: '#2C3E50' }}>{selectedPatient.deviceId}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Status</p>
                  <Badge className={selectedPatient.deviceConnected ? 'bg-[#2ECC71] text-white' : 'bg-[#E74C3C] text-white'}>
                    {selectedPatient.deviceConnected ? 'Online' : 'Offline'}
                  </Badge>
                </div>
              </div>
              
              <div>
                <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Assigned Caregiver</p>
                <p style={{ color: '#2C3E50' }}>{caregiver?.name || 'Unassigned'}</p>
                {caregiver && <p className="text-xs" style={{ color: '#7F8C8D' }}>{caregiver.email}</p>}
              </div>

              {selectedPatient.medicalConditions.length > 0 && (
                <div>
                  <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Medical Conditions</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedPatient.medicalConditions.map((condition, idx) => (
                      <Badge key={idx} className="bg-gray-200 text-gray-700">{condition}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
            <CardHeader>
              <CardTitle style={{ color: '#2C3E50' }}>Current Vital Signs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 rounded bg-gray-50">
                  <Heart className="w-6 h-6 mx-auto mb-2" style={{ color: '#E74C3C' }} />
                  <p className="text-2xl mb-1" style={{ color: '#2C3E50' }}>{Math.round(latestVital?.heartRate || selectedPatient.baselineVitals.heartRate)}</p>
                  <p className="text-xs" style={{ color: '#7F8C8D' }}>bpm</p>
                </div>
                <div className="text-center p-3 rounded bg-gray-50">
                  <Thermometer className="w-6 h-6 mx-auto mb-2" style={{ color: '#F39C12' }} />
                  <p className="text-2xl mb-1" style={{ color: '#2C3E50' }}>{(latestVital?.temperature || selectedPatient.baselineVitals.temperature).toFixed(1)}</p>
                  <p className="text-xs" style={{ color: '#7F8C8D' }}>°C</p>
                </div>
                <div className="text-center p-3 rounded bg-gray-50">
                  <Activity className="w-6 h-6 mx-auto mb-2" style={{ color: '#3498DB' }} />
                  <p className="text-2xl mb-1" style={{ color: '#2C3E50' }}>{Math.round(latestVital?.spo2 || selectedPatient.baselineVitals.spo2)}</p>
                  <p className="text-xs" style={{ color: '#7F8C8D' }}>%</p>
                </div>
                <div className="text-center p-3 rounded bg-gray-50">
                  <Droplets className="w-6 h-6 mx-auto mb-2" style={{ color: '#7DD3C0' }} />
                  <p className="text-2xl mb-1" style={{ color: '#2C3E50' }}>{Math.round(latestVital?.moistureLevel || 0)}</p>
                  <p className="text-xs" style={{ color: '#7F8C8D' }}>%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Device Status */}
        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardHeader>
            <CardTitle style={{ color: '#2C3E50' }}>Device Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                {selectedPatient.deviceConnected ? (
                  <Wifi className="w-5 h-5" style={{ color: '#2ECC71' }} />
                ) : (
                  <WifiOff className="w-5 h-5" style={{ color: '#E74C3C' }} />
                )}
                <div>
                  <p className="text-xs" style={{ color: '#7F8C8D' }}>Connection</p>
                  <p style={{ color: '#2C3E50' }}>{selectedPatient.deviceConnected ? 'Online' : 'Offline'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Battery className="w-5 h-5" style={{ 
                  color: selectedPatient.deviceBattery > 50 ? '#2ECC71' : selectedPatient.deviceBattery > 20 ? '#F39C12' : '#E74C3C'
                }} />
                <div>
                  <p className="text-xs" style={{ color: '#7F8C8D' }}>Battery</p>
                  <p style={{ color: '#2C3E50' }}>{selectedPatient.deviceBattery}%</p>
                </div>
              </div>
              <div>
                <p className="text-xs" style={{ color: '#7F8C8D' }}>Last Updated</p>
                <p style={{ color: '#2C3E50' }}>{new Date(selectedPatient.lastUpdated).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Alerts */}
        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardHeader>
            <CardTitle style={{ color: '#2C3E50' }}>Recent Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {patientAlerts.slice(0, 5).map(alert => {
                const Icon = getAlertIcon(alert.type);
                return (
                  <div key={alert.id} className="p-3 rounded-lg border-l-4" style={{ 
                    borderLeftColor: alert.severity === 'critical' ? '#E74C3C' : '#F39C12',
                    backgroundColor: '#FAFAFA'
                  }}>
                    <div className="flex items-start gap-2">
                      <Icon className="w-4 h-4 mt-0.5" style={{ color: alert.severity === 'critical' ? '#E74C3C' : '#F39C12' }} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm" style={{ color: '#2C3E50' }}>{alert.title}</p>
                          <Badge className={getSeverityBadge(alert.severity)}>{alert.severity}</Badge>
                        </div>
                        <p className="text-xs" style={{ color: '#7F8C8D' }}>{formatTimestamp(alert.timestamp)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {patientAlerts.length === 0 && (
                <p className="text-center py-4" style={{ color: '#7F8C8D' }}>No recent alerts</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Analytics & Reports List
  const renderAnalyticsList = () => (
    <div className="space-y-4">
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Patient Analytics & Reports</CardTitle>
          <CardDescription>Select a patient to view detailed analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {patients.map(patient => {
              const vitals = generateMockVitalSigns(patient.id, patient.baselineVitals);
              const avgHR = vitals.reduce((sum, v) => sum + v.heartRate, 0) / vitals.length;
              const avgTemp = vitals.reduce((sum, v) => sum + v.temperature, 0) / vitals.length;
              
              return (
                <div
                  key={patient.id}
                  className="p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all"
                  style={{ backgroundColor: '#FAFAFA' }}
                  onClick={() => {
                    setSelectedPatient(patient);
                    setDetailView('detail');
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 style={{ color: '#2C3E50' }}>{patient.name}</h4>
                      <p className="text-xs" style={{ color: '#7F8C8D' }}>{patient.age} years</p>
                    </div>
                    <TrendingUp className="w-5 h-5" style={{ color: '#7DD3C0' }} />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Avg Heart Rate</p>
                      <p className="text-lg" style={{ color: '#2C3E50' }}>{Math.round(avgHR)} bpm</p>
                    </div>
                    <div>
                      <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Avg Temperature</p>
                      <p className="text-lg" style={{ color: '#2C3E50' }}>{avgTemp.toFixed(1)}°C</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Analytics Detail View
  const renderAnalyticsDetail = () => {
    if (!selectedPatient) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setDetailView('list')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h2 className="text-xl" style={{ color: '#2C3E50' }}>
            Analytics: {selectedPatient.name}
          </h2>
        </div>

        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle style={{ color: '#2C3E50' }}>Comprehensive Analytics Report</CardTitle>
              <div className="flex items-center gap-3">
                <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="8h">Last 8 Hours</SelectItem>
                    <SelectItem value="24h">Last Day</SelectItem>
                    <SelectItem value="7d">Last Week</SelectItem>
                    <SelectItem value="30d">Last Month</SelectItem>
                  </SelectContent>
                </Select>
                <Button 
                  onClick={() => handleDownloadReport('analytics')}
                  size="sm"
                  style={{ backgroundColor: '#7DD3C0', color: 'white' }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="mb-3" style={{ color: '#2C3E50' }}>Heart Rate Trends</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={vitalSigns}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8F6F3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      tick={{ fontSize: 12, fill: '#7F8C8D' }}
                    />
                    <YAxis tick={{ fontSize: 12, fill: '#7F8C8D' }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="heartRate" stroke="#E74C3C" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h4 className="mb-3" style={{ color: '#2C3E50' }}>Temperature Monitoring</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={vitalSigns}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8F6F3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      tick={{ fontSize: 12, fill: '#7F8C8D' }}
                    />
                    <YAxis domain={[35, 40]} tick={{ fontSize: 12, fill: '#7F8C8D' }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="temperature" stroke="#F39C12" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h4 className="mb-3" style={{ color: '#2C3E50' }}>SpO₂ Levels</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={vitalSigns}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8F6F3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      tick={{ fontSize: 12, fill: '#7F8C8D' }}
                    />
                    <YAxis domain={[90, 100]} tick={{ fontSize: 12, fill: '#7F8C8D' }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="spo2" stroke="#3498DB" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h4 className="mb-3" style={{ color: '#2C3E50' }}>Moisture Detection</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={vitalSigns}>
                    <defs>
                      <linearGradient id="moistGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7DD3C0" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7DD3C0" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8F6F3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      tick={{ fontSize: 12, fill: '#7F8C8D' }}
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#7F8C8D' }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="moistureLevel" stroke="#7DD3C0" strokeWidth={2} fill="url(#moistGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Health Trends List
  const renderHealthTrendsList = () => (
    <div className="space-y-4">
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Patient Health Trends</CardTitle>
          <CardDescription>Select a patient to view detailed health trends</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {patients.map(patient => {
              const vitals = generateMockVitalSigns(patient.id, patient.baselineVitals);
              const trend = vitals.length > 10 ? 'Stable' : 'Monitoring';
              
              return (
                <div
                  key={patient.id}
                  className="p-4 rounded-lg border cursor-pointer hover:shadow-md transition-all"
                  style={{ backgroundColor: '#FAFAFA' }}
                  onClick={() => {
                    setSelectedPatient(patient);
                    setDetailView('detail');
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 style={{ color: '#2C3E50' }}>{patient.name}</h4>
                      <p className="text-xs" style={{ color: '#7F8C8D' }}>{patient.age} years</p>
                    </div>
                    <Badge className="bg-[#7DD3C0] text-white">{trend}</Badge>
                  </div>
                  <p className="text-xs" style={{ color: '#7F8C8D' }}>
                    Click to view detailed health trends
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Health Trends Detail
  const renderHealthTrendsDetail = () => {
    if (!selectedPatient) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setDetailView('list')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h2 className="text-xl" style={{ color: '#2C3E50' }}>
            Health Trends: {selectedPatient.name}
          </h2>
        </div>

        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardHeader>
            <CardTitle style={{ color: '#2C3E50' }}>Longitudinal Health Analysis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="mb-3" style={{ color: '#2C3E50' }}>Heart Rate & SpO₂ Correlation</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={vitalSigns}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8F6F3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      tick={{ fontSize: 12, fill: '#7F8C8D' }}
                    />
                    <YAxis yAxisId="left" tick={{ fontSize: 12, fill: '#7F8C8D' }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12, fill: '#7F8C8D' }} />
                    <Tooltip />
                    <Line yAxisId="left" type="monotone" dataKey="heartRate" stroke="#E74C3C" strokeWidth={2} name="HR" />
                    <Line yAxisId="right" type="monotone" dataKey="spo2" stroke="#3498DB" strokeWidth={2} name="SpO₂" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div>
              <h4 className="mb-3" style={{ color: '#2C3E50' }}>Temperature Stability</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={vitalSigns}>
                    <defs>
                      <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F39C12" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#F39C12" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8F6F3" />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={(ts) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      tick={{ fontSize: 12, fill: '#7F8C8D' }}
                    />
                    <YAxis domain={[35, 40]} tick={{ fontSize: 12, fill: '#7F8C8D' }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="temperature" stroke="#F39C12" strokeWidth={2} fill="url(#tempGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Activity & Logs (sensor notifications + caregiver actions)
  const renderActivityLogs = () => (
    <div className="space-y-6">
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Sensor Notifications & Caregiver Actions</CardTitle>
          <CardDescription>Complete activity trail</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {alerts.map(alert => {
              const patient = patients.find(p => p.id === alert.patientId);
              const Icon = getAlertIcon(alert.type);
              
              return (
                <div key={alert.id} className="p-4 rounded-lg border-l-4" style={{ 
                  borderLeftColor: alert.acknowledged ? '#2ECC71' : '#F39C12',
                  backgroundColor: '#FAFAFA'
                }}>
                  <div className="flex items-start gap-3">
                    <Icon className="w-5 h-5 mt-0.5" style={{ color: alert.severity === 'critical' ? '#E74C3C' : '#F39C12' }} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p style={{ color: '#2C3E50' }}>{patient?.name}: {alert.title}</p>
                        <Badge className={getSeverityBadge(alert.severity)}>{alert.severity}</Badge>
                      </div>
                      <p className="text-sm mb-2" style={{ color: '#7F8C8D' }}>{alert.message}</p>
                      <div className="flex items-center gap-4 text-xs" style={{ color: '#7F8C8D' }}>
                        <span>Sensor: {formatTimestamp(alert.timestamp)}</span>
                        {alert.acknowledged && alert.acknowledgedAt && (
                          <span className="text-green-600">
                            ✓ Acknowledged: {formatTimestamp(alert.acknowledgedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Assignment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {assignments.map(assignment => {
              const patient = patients.find(p => p.id === assignment.patientId);
              const caregiver = mockUsers.find(u => u.id === assignment.caregiverId);
              
              return (
                <div key={assignment.id} className="p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm" style={{ color: '#2C3E50' }}>
                        {caregiver?.name} {assignment.status === 'rejected' ? 'rejected' : assignment.status === 'accepted' ? 'accepted' : 'pending'} {patient?.name}
                      </p>
                      <p className="text-xs" style={{ color: '#7F8C8D' }}>
                        {new Date(assignment.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Badge className={
                      assignment.status === 'accepted' ? 'bg-[#2ECC71] text-white' :
                      assignment.status === 'pending' ? 'bg-[#F39C12] text-white' :
                      'bg-[#E74C3C] text-white'
                    }>
                      {assignment.status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Sensor Health
  const renderSensorHealth = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {patients.map(patient => (
          <Card key={patient.id} className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
            <CardHeader>
              <CardTitle className="text-base" style={{ color: '#2C3E50' }}>{patient.name}</CardTitle>
              <CardDescription>{patient.deviceId}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Battery className="w-4 h-4" style={{ 
                    color: patient.deviceBattery > 50 ? '#2ECC71' : patient.deviceBattery > 20 ? '#F39C12' : '#E74C3C'
                  }} />
                  <span className="text-sm">Battery</span>
                </div>
                <span className="text-sm" style={{ 
                  color: patient.deviceBattery > 50 ? '#2ECC71' : patient.deviceBattery > 20 ? '#F39C12' : '#E74C3C'
                }}>
                  {patient.deviceBattery}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {patient.deviceConnected ? (
                    <Wifi className="w-4 h-4 text-green-600" />
                  ) : (
                    <WifiOff className="w-4 h-4 text-red-600" />
                  )}
                  <span className="text-sm">Signal</span>
                </div>
                <Badge className={patient.deviceConnected ? 'bg-[#2ECC71] text-white' : 'bg-[#E74C3C] text-white'}>
                  {patient.deviceConnected ? 'Strong' : 'Offline'}
                </Badge>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs" style={{ color: '#7F8C8D' }}>
                  Last sync: {new Date(patient.lastUpdated).toLocaleString()}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  // System Settings (without rejection settings, with proper spacing)
  const renderSystemSettings = () => (
    <div className="max-w-2xl space-y-6">
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Global Alarms</CardTitle>
          <CardDescription>Set hard limits for facility-wide alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Critical Heart Rate (bpm)</Label>
            <Input type="number" defaultValue="140" />
          </div>
          <div className="space-y-2">
            <Label>Critical Temperature (°C)</Label>
            <Input type="number" defaultValue="39.0" step="0.1" />
          </div>
          <div className="space-y-2">
            <Label>Minimum SpO₂ (%)</Label>
            <Input type="number" defaultValue="88" />
          </div>
          <Button className="text-white" style={{ backgroundColor: '#7DD3C0' }}>
            Save Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // Profile (with 2FA and proper spacing)
  const renderProfile = () => (
    <div className="max-w-2xl space-y-6">
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Medical Staff Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input defaultValue={user?.name} />
          </div>
          <div className="space-y-2">
            <Label>Staff ID</Label>
            <Input defaultValue={user?.id} disabled />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Input defaultValue="Medical Staff" disabled />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input defaultValue={user?.email} />
          </div>
          <Button className="text-white" style={{ backgroundColor: '#7DD3C0' }}>
            Update Profile
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Security</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full justify-start">
            <Key className="w-4 h-4 mr-2" />
            Change Password
          </Button>
          <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <div>
                <p className="text-sm" style={{ color: '#2C3E50' }}>Two-Factor Authentication</p>
                <p className="text-xs" style={{ color: '#7F8C8D' }}>Add extra security to your account</p>
              </div>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar 
        activeItem={activeNavItem} 
        onItemClick={(item) => {
          setActiveNavItem(item);
          setDetailView('list');
        }}
        userRole="medical_staff"
      />

      <div className="ml-60">
        <header className="bg-white border-b sticky top-0 z-40" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl" style={{ color: '#2C3E50' }}>Dashboard</h2>
                <p className="text-sm" style={{ color: '#7F8C8D' }}>
                  Medical Staff Dashboard
                </p>
              </div>

              <div className="flex items-center gap-3">
                <NotificationPanel
                  alerts={alerts}
                  onAcknowledge={handleAcknowledgeAlert}
                  onMarkAllRead={handleMarkAllRead}
                  patientNames={patientNamesMap}
                />
                
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted">
                  <User className="w-4 h-4" />
                  <span className="text-sm">{user?.name}</span>
                </div>
                
                <Button variant="outline" size="sm" onClick={logout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};
