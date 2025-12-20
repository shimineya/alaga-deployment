import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { Patient, Alert, VitalSign } from '../types';
import { mockPatients, mockAlerts, generateMockVitalSigns } from '../lib/mock-data';
import { DashboardSidebar } from './DashboardSidebar';
import { NotificationPanel } from './NotificationPanel';
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
  TrendingUp
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export const CaregiverDashboardNew: React.FC = () => {
  const { user, logout } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [vitalSigns, setVitalSigns] = useState<VitalSign[]>([]);
  const [timeRange, setTimeRange] = useState<'8h' | '24h' | '7d' | '30d'>('24h');
  const [activeNavItem, setActiveNavItem] = useState('dashboard');
  const [detailView, setDetailView] = useState<'list' | 'detail'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  // New patient form state
  const [newPatientForm, setNewPatientForm] = useState({
    name: '',
    age: '',
    medicalConditions: '',
    deviceId: ''
  });

  useEffect(() => {
    const caregiverPatients = mockPatients.filter(p => p.caregiverId === user?.id);
    setPatients(caregiverPatients);
    if (caregiverPatients.length > 0 && !selectedPatient) {
      setSelectedPatient(caregiverPatients[0]);
    }
  }, [user]);

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

  const handleAddPatient = () => {
    if (!newPatientForm.name || !newPatientForm.age || !newPatientForm.deviceId) {
      toast.error('Please fill all required fields');
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
      caregiverId: user?.id,
      deviceId: newPatientForm.deviceId,
      deviceBattery: 100,
      deviceConnected: true,
      lastUpdated: new Date()
    };

    setPatients(prev => [...prev, newPatient]);
    toast.success(`Patient ${newPatient.name} added successfully`);
    setNewPatientForm({ name: '', age: '', medicalConditions: '', deviceId: '' });
    setActiveNavItem('my-patients');
  };

  const handleDownloadReport = (type: 'analytics' | 'vitals') => {
    if (!selectedPatient) return;
    
    const filename = `${selectedPatient.name}_${type}_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`;
    toast.success(`Downloading ${filename}`);
  };

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);
  const criticalAlerts = unacknowledgedAlerts.filter(a => a.severity === 'critical');
  const activeMonitors = patients.filter(p => p.deviceConnected).length;
  
  const patientNamesMap = patients.reduce((acc, patient) => {
    acc[patient.id] = patient.name;
    return acc;
  }, {} as Record<string, string>);

  const getBatteryColor = (level: number) => {
    if (level > 50) return '#2ECC71';
    if (level > 20) return '#F39C12';
    return '#E74C3C';
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
      case 'my-patients':
        return renderMyPatients();
      case 'add-patient':
        return renderAddPatient();
      case 'alerts-reports':
        return renderAlertsReports();
      case 'analytics':
        return detailView === 'detail' ? renderAnalyticsDetail() : renderAnalyticsList();
      case 'vital-signs':
        return detailView === 'detail' ? renderVitalSignsDetail() : renderVitalSignsList();
      case 'device-status':
        return renderDeviceStatus();
      case 'settings':
        return renderSettings();
      case 'profile':
        return renderProfile();
      default:
        return renderDashboard();
    }
  };

  // Dashboard with Patient List, Alerts, and Analytics Preview
  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Top Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5" style={{ color: '#7DD3C0' }} />
              <p className="text-sm" style={{ color: '#7F8C8D' }}>Total Patients</p>
            </div>
            <p className="text-3xl" style={{ color: '#2C3E50' }}>{patients.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <Activity className="w-5 h-5" style={{ color: '#2ECC71' }} />
              <p className="text-sm" style={{ color: '#7F8C8D' }}>Online</p>
            </div>
            <p className="text-3xl" style={{ color: '#2C3E50' }}>{activeMonitors}/{patients.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <Bell className="w-5 h-5" style={{ color: '#E74C3C' }} />
              <p className="text-sm" style={{ color: '#7F8C8D' }}>Critical Alerts</p>
            </div>
            <p className="text-3xl" style={{ color: '#2C3E50' }}>{criticalAlerts.length}</p>
          </CardContent>
        </Card>
        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-4 h-4 rounded-full ${
                criticalAlerts.length > 0 ? 'bg-[#E74C3C]' : 
                unacknowledgedAlerts.length > 0 ? 'bg-[#F39C12]' : 
                'bg-[#2ECC71]'
              }`} />
              <p className="text-sm" style={{ color: '#7F8C8D' }}>Status</p>
            </div>
            <p className="text-xl" style={{ color: '#2C3E50' }}>
              {criticalAlerts.length > 0 ? 'Critical' : 
               unacknowledgedAlerts.length > 0 ? 'Warning' : 
               'Normal'}
            </p>
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
          <CardDescription>Quick status of all monitored patients</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {patients.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(patient => {
              const vitals = generateMockVitalSigns(patient.id, patient.baselineVitals);
              const latestVital = vitals[vitals.length - 1];
              
              return (
                <div 
                  key={patient.id}
                  className="p-4 rounded-lg border hover:shadow-md transition-all cursor-pointer"
                  style={{ backgroundColor: '#FAFAFA' }}
                  onClick={() => {
                    setSelectedPatient(patient);
                    setActiveNavItem('vital-signs');
                    setDetailView('detail');
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${patient.deviceConnected ? 'bg-[#2ECC71] animate-pulse' : 'bg-[#E74C3C]'}`} />
                      <div>
                        <h4 style={{ color: '#2C3E50' }}>{patient.name}</h4>
                        <p className="text-xs" style={{ color: '#7F8C8D' }}>{patient.age} years • {patient.deviceId}</p>
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
              <CardDescription>Recent notifications from sensors and system</CardDescription>
            </div>
            <Button onClick={() => setActiveNavItem('alerts-reports')} variant="outline" size="sm">
              View All
            </Button>
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
    </div>
  );

  // My Patients (without assigned caregiver)
  const renderMyPatients = () => {
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
            const patientAlerts = alerts.filter(a => a.patientId === patient.id && !a.acknowledged);
            const learningProgress = 75;

            return (
              <Card 
                key={patient.id}
                className="border-0 cursor-pointer hover:shadow-lg transition-all"
                style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}
                onClick={() => {
                  setSelectedPatient(patient);
                  setActiveNavItem('vital-signs');
                  setDetailView('detail');
                }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base" style={{ color: '#2C3E50' }}>{patient.name}</CardTitle>
                      <CardDescription>{patient.age} years old</CardDescription>
                    </div>
                    <div className={`w-3 h-3 rounded-full ${patient.deviceConnected ? 'bg-[#2ECC71]' : 'bg-[#E74C3C]'} animate-pulse`} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Status</p>
                    <Badge className={patient.deviceConnected ? 'bg-[#2ECC71] text-white' : 'bg-[#E74C3C] text-white'}>
                      {patient.deviceConnected ? 'Online' : 'Offline'}
                    </Badge>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs" style={{ color: '#7F8C8D' }}>Baseline Learning</p>
                      <p className="text-xs" style={{ color: '#7DD3C0' }}>{learningProgress}%</p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-2 rounded-full transition-all"
                        style={{ 
                          width: `${learningProgress}%`, 
                          backgroundColor: '#7DD3C0' 
                        }}
                      />
                    </div>
                  </div>

                  {patientAlerts.length > 0 && (
                    <Badge className="bg-[#F39C12] text-white">
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

  // Add Patient (for caregivers)
  const renderAddPatient = () => (
    <div className="max-w-2xl">
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Add A New Patient</CardTitle>
          <CardDescription>Register a new patient to your monitoring list</CardDescription>
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
              placeholder="e.g., ESP32-005"
              value={newPatientForm.deviceId}
              onChange={(e) => setNewPatientForm({ ...newPatientForm, deviceId: e.target.value })}
            />
          </div>
          <Button 
            onClick={handleAddPatient}
            className="w-full text-white"
            style={{ backgroundColor: '#7DD3C0' }}
          >
            <UserPlus className="w-4 h-4 mr-2" />
            Add Patient
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  // Alerts & Reports
  const renderAlertsReports = () => (
    <div className="space-y-6">
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle style={{ color: '#2C3E50' }}>Active Alerts</CardTitle>
              <CardDescription>Current system and sensor notifications</CardDescription>
            </div>
            <Button onClick={handleMarkAllRead} variant="outline" size="sm">
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {unacknowledgedAlerts.length === 0 ? (
              <div className="text-center py-12" style={{ color: '#7F8C8D' }}>
                <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No active alerts</p>
              </div>
            ) : (
              unacknowledgedAlerts.map(alert => {
                const Icon = getAlertIcon(alert.type);
                const patient = patients.find(p => p.id === alert.patientId);

                return (
                  <div 
                    key={alert.id}
                    className="p-4 rounded-lg border-l-4"
                    style={{ 
                      borderLeftColor: alert.severity === 'critical' ? '#E74C3C' : '#F39C12',
                      backgroundColor: '#F9FAFB'
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <Icon className="w-5 h-5 mt-0.5" style={{ color: alert.severity === 'critical' ? '#E74C3C' : '#F39C12' }} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 style={{ color: '#2C3E50' }}>{patient?.name}: {alert.title}</h4>
                            <Badge className={getSeverityBadge(alert.severity)}>
                              {alert.severity.toUpperCase()}
                            </Badge>
                          </div>
                          <p className="text-sm mb-2" style={{ color: '#7F8C8D' }}>{alert.message}</p>
                          <div className="flex items-center gap-1 text-xs" style={{ color: '#7F8C8D' }}>
                            <Clock className="w-3 h-3" />
                            <span>{formatTimestamp(alert.timestamp)}</span>
                          </div>
                        </div>
                      </div>
                      <Button 
                        onClick={() => handleAcknowledgeAlert(alert.id)}
                        size="sm"
                        style={{ backgroundColor: '#7DD3C0', color: 'white' }}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Acknowledge
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Alert History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {alerts.filter(a => a.acknowledged).slice(0, 10).map(alert => {
              const patient = patients.find(p => p.id === alert.patientId);
              return (
                <div key={alert.id} className="p-3 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm" style={{ color: '#2C3E50' }}>
                        {patient?.name} - {alert.title}
                      </p>
                      <p className="text-xs" style={{ color: '#7F8C8D' }}>
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
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
    </div>
  );

  // Analytics List View
  const renderAnalyticsList = () => (
    <div className="space-y-4">
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Patient Analytics</CardTitle>
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
              <CardTitle style={{ color: '#2C3E50' }}>Vital Signs Trends</CardTitle>
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
                  Download Report
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Heart Rate Chart */}
            <div>
              <h4 className="mb-3" style={{ color: '#2C3E50' }}>Heart Rate</h4>
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
                    <Line type="monotone" dataKey="heartRate" stroke="#E74C3C" strokeWidth={2} name="Heart Rate (bpm)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Temperature Chart */}
            <div>
              <h4 className="mb-3" style={{ color: '#2C3E50' }}>Body Temperature</h4>
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
                    <Line type="monotone" dataKey="temperature" stroke="#F39C12" strokeWidth={2} name="Temperature (°C)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* SpO2 Chart */}
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
                    <Line type="monotone" dataKey="spo2" stroke="#3498DB" strokeWidth={2} name="SpO₂ (%)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Moisture Levels Chart */}
            <div>
              <h4 className="mb-3" style={{ color: '#2C3E50' }}>Moisture Levels</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={vitalSigns}>
                    <defs>
                      <linearGradient id="moistureGradient" x1="0" y1="0" x2="0" y2="1">
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
                    <Area type="monotone" dataKey="moistureLevel" stroke="#7DD3C0" strokeWidth={2} fill="url(#moistureGradient)" name="Moisture (%)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  // Vital Signs List View
  const renderVitalSignsList = () => (
    <div className="space-y-4">
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Patient Vital Signs</CardTitle>
          <CardDescription>Select a patient to view detailed vital signs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {patients.map(patient => {
              const vitals = generateMockVitalSigns(patient.id, patient.baselineVitals);
              const latestVital = vitals[vitals.length - 1];
              
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
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${patient.deviceConnected ? 'bg-[#2ECC71]' : 'bg-[#E74C3C]'}`} />
                      <div>
                        <h4 style={{ color: '#2C3E50' }}>{patient.name}</h4>
                        <p className="text-xs" style={{ color: '#7F8C8D' }}>Last updated: {formatTimestamp(patient.lastUpdated)}</p>
                      </div>
                    </div>
                    <Heart className="w-5 h-5" style={{ color: '#E74C3C' }} />
                  </div>
                  
                  <div className="grid grid-cols-4 gap-2">
                    <div className="text-center">
                      <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>HR</p>
                      <p style={{ color: '#2C3E50' }}>{Math.round(latestVital?.heartRate || patient.baselineVitals.heartRate)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Temp</p>
                      <p style={{ color: '#2C3E50' }}>{(latestVital?.temperature || patient.baselineVitals.temperature).toFixed(1)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>SpO₂</p>
                      <p style={{ color: '#2C3E50' }}>{Math.round(latestVital?.spo2 || patient.baselineVitals.spo2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Moisture</p>
                      <p style={{ color: '#2C3E50' }}>{Math.round(latestVital?.moistureLevel || 0)}%</p>
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

  // Vital Signs Detail View
  const renderVitalSignsDetail = () => {
    if (!selectedPatient) return null;

    const currentVitals = vitalSigns.length > 0 ? vitalSigns[vitalSigns.length - 1] : null;
    const heartRate = currentVitals?.heartRate || selectedPatient?.baselineVitals.heartRate || 0;
    const temperature = currentVitals?.temperature || selectedPatient?.baselineVitals.temperature || 0;
    const spo2 = currentVitals?.spo2 || selectedPatient?.baselineVitals.spo2 || 0;
    const moisture = currentVitals?.moistureLevel || 0;

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
            Vital Signs: {selectedPatient.name}
          </h2>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
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
            onClick={() => handleDownloadReport('vitals')}
            size="sm"
            style={{ backgroundColor: '#7DD3C0', color: 'white' }}
          >
            <Download className="w-4 h-4 mr-2" />
            Download Report
          </Button>
        </div>

        {/* Current Readings */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
            <CardContent className="pt-6 text-center">
              <Heart className="w-8 h-8 mx-auto mb-2" style={{ color: '#E74C3C' }} />
              <p className="text-3xl mb-1" style={{ color: '#2C3E50' }}>{Math.round(heartRate)}</p>
              <p className="text-sm" style={{ color: '#7F8C8D' }}>bpm</p>
            </CardContent>
          </Card>
          
          <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
            <CardContent className="pt-6 text-center">
              <Thermometer className="w-8 h-8 mx-auto mb-2" style={{ color: '#F39C12' }} />
              <p className="text-3xl mb-1" style={{ color: '#2C3E50' }}>{temperature.toFixed(1)}</p>
              <p className="text-sm" style={{ color: '#7F8C8D' }}>°C</p>
            </CardContent>
          </Card>
          
          <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
            <CardContent className="pt-6 text-center">
              <Activity className="w-8 h-8 mx-auto mb-2" style={{ color: '#3498DB' }} />
              <p className="text-3xl mb-1" style={{ color: '#2C3E50' }}>{Math.round(spo2)}</p>
              <p className="text-sm" style={{ color: '#7F8C8D' }}>%</p>
            </CardContent>
          </Card>
          
          <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
            <CardContent className="pt-6 text-center">
              <Droplets className="w-8 h-8 mx-auto mb-2" style={{ color: '#7DD3C0' }} />
              <p className="text-3xl mb-1" style={{ color: '#2C3E50' }}>{Math.round(moisture)}</p>
              <p className="text-sm" style={{ color: '#7F8C8D' }}>%</p>
            </CardContent>
          </Card>
        </div>

        {/* Live Waveforms */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
            <CardHeader>
              <CardTitle className="text-base">Heart Rate Monitor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={vitalSigns.slice(-20)}>
                    <defs>
                      <linearGradient id="hrGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E74C3C" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#E74C3C" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="heartRate" stroke="#E74C3C" strokeWidth={2} fill="url(#hrGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
            <CardHeader>
              <CardTitle className="text-base">SpO₂ Monitor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={vitalSigns.slice(-20)}>
                    <defs>
                      <linearGradient id="spo2Gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3498DB" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3498DB" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="spo2" stroke="#3498DB" strokeWidth={2} fill="url(#spo2Gradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  // Device Status
  const renderDeviceStatus = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {patients.map(patient => (
          <Card key={patient.id} className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
            <CardHeader>
              <CardTitle className="text-base" style={{ color: '#2C3E50' }}>{patient.name}</CardTitle>
              <CardDescription>{patient.deviceId}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {patient.deviceConnected ? (
                      <Wifi className="w-4 h-4" style={{ color: '#2ECC71' }} />
                    ) : (
                      <WifiOff className="w-4 h-4" style={{ color: '#E74C3C' }} />
                    )}
                    <span className="text-sm">Connection</span>
                  </div>
                  <Badge className={patient.deviceConnected ? 'bg-[#2ECC71] text-white' : 'bg-[#E74C3C] text-white'}>
                    {patient.deviceConnected ? 'Online' : 'Offline'}
                  </Badge>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Battery className="w-4 h-4" style={{ color: getBatteryColor(patient.deviceBattery) }} />
                    <span className="text-sm">Battery</span>
                  </div>
                  <span className="text-sm" style={{ color: getBatteryColor(patient.deviceBattery) }}>
                    {patient.deviceBattery}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="h-2 rounded-full transition-all"
                    style={{ 
                      width: `${patient.deviceBattery}%`, 
                      backgroundColor: getBatteryColor(patient.deviceBattery)
                    }}
                  />
                </div>
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

  // Settings (with proper spacing)
  const renderSettings = () => (
    <div className="space-y-6">
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Threshold Overrides</CardTitle>
          <CardDescription>Set manual safety limits for alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Maximum Temperature (°C)</Label>
              <Input type="number" defaultValue="38.0" step="0.1" />
            </div>
            <div className="space-y-2">
              <Label>Minimum SpO₂ (%)</Label>
              <Input type="number" defaultValue="90" />
            </div>
            <div className="space-y-2">
              <Label>Maximum Heart Rate (bpm)</Label>
              <Input type="number" defaultValue="120" />
            </div>
            <div className="space-y-2">
              <Label>Moisture Threshold (%)</Label>
              <Input type="number" defaultValue="50" />
            </div>
          </div>
          <Button style={{ backgroundColor: '#7DD3C0', color: 'white' }}>
            Save Thresholds
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Notification Methods</CardTitle>
          <CardDescription>Choose how you receive alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4" />
              <Label>Sound Alerts</Label>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              <Label>Browser Pop-ups</Label>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <Label>SMS/Push Notifications</Label>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Language & Unit Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Language</Label>
            <Select defaultValue="en">
              <SelectTrigger>
                <Globe className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="tl">Tagalog</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Temperature Unit</Label>
            <Select defaultValue="celsius">
              <SelectTrigger>
                <Thermometer className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="celsius">Celsius (°C)</SelectItem>
                <SelectItem value="fahrenheit">Fahrenheit (°F)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Profile (without shift performance)
  const renderProfile = () => (
    <div className="space-y-6">
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>User Credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input defaultValue={user?.name} />
          </div>
          <div className="space-y-2">
            <Label>ID Number</Label>
            <Input defaultValue={user?.id} disabled />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Input defaultValue="Caregiver/Nurse" disabled />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input defaultValue={user?.email} />
          </div>
          <Button style={{ backgroundColor: '#7DD3C0', color: 'white' }}>
            Update Profile
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Security</CardTitle>
          <CardDescription>Data privacy and authentication settings</CardDescription>
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
        userRole="caregiver"
      />

      <div className="ml-60">
        <header className="bg-white border-b sticky top-0 z-40" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' }}>
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl" style={{ color: '#2C3E50' }}>Dashboard</h2>
                <p className="text-sm" style={{ color: '#7F8C8D' }}>
                  Caregiver Dashboard
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
