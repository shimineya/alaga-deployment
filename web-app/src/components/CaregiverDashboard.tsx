import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { Patient, Alert, VitalSign } from '../types';
import { mockPatients, mockAlerts, generateMockVitalSigns } from '../lib/mock-data';
import { PatientCard } from './PatientCard';
import { AlertsList } from './AlertsList';
import { VitalSignsChart } from './VitalSignsChart';
import { NotificationPanel } from './NotificationPanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Bell, LogOut, User, Settings, Activity, Calendar, Battery, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { Badge } from './ui/badge';
import { toast } from 'sonner@2.0.3';

export const CaregiverDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [vitalSigns, setVitalSigns] = useState<VitalSign[]>([]);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h'>('6h');

  useEffect(() => {
    // Load patients for this caregiver
    const caregiverPatients = mockPatients.filter(p => p.caregiverId === user?.id);
    setPatients(caregiverPatients);
    if (caregiverPatients.length > 0) {
      setSelectedPatient(caregiverPatients[0]);
    }
  }, [user]);

  // Check for battery and connectivity alerts
  useEffect(() => {
    patients.forEach(patient => {
      if (patient.deviceBattery < 20) {
        const existingAlert = alerts.find(a => 
          a.patientId === patient.id && 
          a.type === 'device' && 
          a.message.includes('battery')
        );
        if (!existingAlert) {
          toast.error(`Low battery alert for ${patient.name}`, {
            description: `Device battery is at ${patient.deviceBattery}%. Please charge soon.`,
          });
        }
      }
      if (!patient.deviceConnected) {
        const existingAlert = alerts.find(a => 
          a.patientId === patient.id && 
          a.type === 'device' && 
          a.message.includes('connection')
        );
        if (!existingAlert) {
          toast.error(`Device disconnected for ${patient.name}`, {
            description: 'Lost connection to monitoring device.',
          });
        }
      }
    });
  }, [patients, alerts]);

  useEffect(() => {
    if (selectedPatient) {
      // Generate mock vital signs data
      const vitals = generateMockVitalSigns(selectedPatient.id, selectedPatient.baselineVitals);
      
      // Filter based on time range
      const now = Date.now();
      const ranges = {
        '1h': 60 * 60 * 1000,
        '6h': 6 * 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
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

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);
  
  // Create patient names map for notification panel
  const patientNamesMap = patients.reduce((acc, patient) => {
    acc[patient.id] = patient.name;
    return acc;
  }, {} as Record<string, string>);
  
  const getBatteryColor = (level: number) => {
    if (level > 50) return 'var(--status-success)';
    if (level > 20) return 'var(--status-warning)';
    return 'var(--status-critical)';
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--teal-500)' }}>
                <Activity className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl">Alaga Dashboard</h1>
                <p className="text-xs text-muted-foreground">Caregiver Portal</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <NotificationPanel
                alerts={alerts}
                onAcknowledge={handleAcknowledgeAlert}
                onMarkAllRead={handleMarkAllRead}
                patientNames={patientNamesMap}
              />
              
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-muted">
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

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Patient Selection and Info */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>My Patients</CardTitle>
                <CardDescription>Select a patient to monitor</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {patients.map(patient => (
                  <div 
                    key={patient.id}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedPatient?.id === patient.id 
                        ? 'border-primary bg-muted' 
                        : 'border-transparent hover:border-border'
                    }`}
                    onClick={() => setSelectedPatient(patient)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-sm">{patient.name}</h4>
                        <p className="text-xs text-muted-foreground">{patient.age} years old</p>
                      </div>
                      {patient.deviceConnected ? (
                        <Badge className="bg-[var(--status-success)] text-white text-xs">Active</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">Offline</Badge>
                      )}
                    </div>
                    
                    {/* Device Status */}
                    <div className="flex items-center justify-between pt-2 border-t text-xs">
                      <div className="flex items-center gap-1">
                        <Battery className="w-3 h-3" style={{ color: getBatteryColor(patient.deviceBattery) }} />
                        <span style={{ color: getBatteryColor(patient.deviceBattery) }}>
                          {patient.deviceBattery}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        {patient.deviceConnected ? (
                          <Wifi className="w-3 h-3" style={{ color: 'var(--status-success)' }} />
                        ) : (
                          <WifiOff className="w-3 h-3" style={{ color: 'var(--status-critical)' }} />
                        )}
                        <span className="text-muted-foreground">{patient.deviceId}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Device Status Summary */}
            {selectedPatient && (
              <Card>
                <CardHeader>
                  <CardTitle>Device Status</CardTitle>
                  <CardDescription>{selectedPatient.name}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Battery Status */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Battery className="w-5 h-5" style={{ color: getBatteryColor(selectedPatient.deviceBattery) }} />
                        <span className="text-sm">Battery Level</span>
                      </div>
                      <span className="text-sm" style={{ color: getBatteryColor(selectedPatient.deviceBattery) }}>
                        {selectedPatient.deviceBattery}%
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="h-2 rounded-full transition-all"
                        style={{ 
                          width: `${selectedPatient.deviceBattery}%`,
                          backgroundColor: getBatteryColor(selectedPatient.deviceBattery)
                        }}
                      />
                    </div>
                    {selectedPatient.deviceBattery < 20 && (
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                        <p className="text-xs text-red-800">
                          Battery critically low. Please charge the device immediately.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Connectivity Status */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {selectedPatient.deviceConnected ? (
                          <Wifi className="w-5 h-5" style={{ color: 'var(--status-success)' }} />
                        ) : (
                          <WifiOff className="w-5 h-5" style={{ color: 'var(--status-critical)' }} />
                        )}
                        <span className="text-sm">Connection Status</span>
                      </div>
                      <Badge className={selectedPatient.deviceConnected ? 'bg-[var(--status-success)] text-white' : ''} variant={selectedPatient.deviceConnected ? 'default' : 'destructive'}>
                        {selectedPatient.deviceConnected ? 'Connected' : 'Disconnected'}
                      </Badge>
                    </div>
                    {!selectedPatient.deviceConnected && (
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-red-50 border border-red-200">
                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                        <p className="text-xs text-red-800">
                          Device is offline. Check Wi-Fi connection and device power.
                        </p>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Device ID: {selectedPatient.deviceId}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Last Updated: {new Date(selectedPatient.lastUpdated).toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Alerts */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Recent Alerts</CardTitle>
                  {unacknowledgedAlerts.length > 0 && (
                    <Badge style={{ backgroundColor: 'var(--status-critical)' }}>
                      {unacknowledgedAlerts.length} New
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <AlertsList
                  alerts={alerts.filter(a => 
                    selectedPatient ? a.patientId === selectedPatient.id : true
                  ).slice(0, 5)}
                  onAcknowledge={handleAcknowledgeAlert}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Patient Details and Monitoring */}
          <div className="lg:col-span-2 space-y-6">
            {selectedPatient ? (
              <>
                {/* Patient Selection Dropdown */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Patient Monitor</CardTitle>
                        <CardDescription>Real-time vital signs and status</CardDescription>
                      </div>
                      <Select 
                        value={selectedPatient.id} 
                        onValueChange={(id) => {
                          const patient = patients.find(p => p.id === id);
                          if (patient) setSelectedPatient(patient);
                        }}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {patients.map(patient => (
                            <SelectItem key={patient.id} value={patient.id}>
                              {patient.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                </Card>

                {/* Patient Overview */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Monitoring: {selectedPatient.name}</CardTitle>
                        <CardDescription>Real-time vital signs</CardDescription>
                      </div>
                      <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1h">Last Hour</SelectItem>
                          <SelectItem value="6h">Last 6 Hours</SelectItem>
                          <SelectItem value="24h">Last 24 Hours</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <Activity className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--teal-500)' }} />
                            <p className="text-xs text-muted-foreground">Heart Rate</p>
                            <p className="text-2xl mt-1">
                              {vitalSigns.length > 0 
                                ? Math.round(vitalSigns[vitalSigns.length - 1].heartRate)
                                : selectedPatient.baselineVitals.heartRate
                              }
                            </p>
                            <p className="text-xs text-muted-foreground">bpm</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <Activity className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--teal-600)' }} />
                            <p className="text-xs text-muted-foreground">Temperature</p>
                            <p className="text-2xl mt-1">
                              {vitalSigns.length > 0 
                                ? vitalSigns[vitalSigns.length - 1].temperature.toFixed(1)
                                : selectedPatient.baselineVitals.temperature
                              }
                            </p>
                            <p className="text-xs text-muted-foreground">°C</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <Activity className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--teal-700)' }} />
                            <p className="text-xs text-muted-foreground">SpO₂</p>
                            <p className="text-2xl mt-1">
                              {vitalSigns.length > 0 
                                ? Math.round(vitalSigns[vitalSigns.length - 1].spo2)
                                : selectedPatient.baselineVitals.spo2
                              }
                            </p>
                            <p className="text-xs text-muted-foreground">%</p>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="pt-6">
                          <div className="text-center">
                            <Activity className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--teal-400)' }} />
                            <p className="text-xs text-muted-foreground">Moisture</p>
                            <p className="text-2xl mt-1">
                              {vitalSigns.length > 0 
                                ? Math.round(vitalSigns[vitalSigns.length - 1].moistureLevel)
                                : 0
                              }
                            </p>
                            <p className="text-xs text-muted-foreground">%</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </CardContent>
                </Card>

                {/* Vital Signs Charts */}
                <Tabs defaultValue="heartRate" className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="heartRate">Heart Rate</TabsTrigger>
                    <TabsTrigger value="temperature">Temperature</TabsTrigger>
                    <TabsTrigger value="spo2">SpO₂</TabsTrigger>
                    <TabsTrigger value="moisture">Moisture</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="heartRate">
                    <Card>
                      <CardContent className="pt-6 h-80">
                        <VitalSignsChart
                          data={vitalSigns}
                          metric="heartRate"
                          title="Heart Rate"
                          unit="bpm"
                          color="var(--teal-500)"
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="temperature">
                    <Card>
                      <CardContent className="pt-6 h-80">
                        <VitalSignsChart
                          data={vitalSigns}
                          metric="temperature"
                          title="Body Temperature"
                          unit="°C"
                          color="var(--teal-600)"
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="spo2">
                    <Card>
                      <CardContent className="pt-6 h-80">
                        <VitalSignsChart
                          data={vitalSigns}
                          metric="spo2"
                          title="Blood Oxygen Saturation"
                          unit="%"
                          color="var(--teal-700)"
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="moisture">
                    <Card>
                      <CardContent className="pt-6 h-80">
                        <VitalSignsChart
                          data={vitalSigns}
                          metric="moistureLevel"
                          title="Moisture Level"
                          unit="%"
                          color="var(--teal-400)"
                        />
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>No patient selected</p>
                  <p className="text-sm mt-2">Please select a patient from the left panel to view monitoring data</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};