
import React, { useState, useEffect } from 'react';
import { Patient, Alert, VitalSign } from '../types';
import { generateMockVitalSigns } from '../lib/mock-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { SmartDiaperEvents } from './patient/SmartDiaperEvents';
import { CareLogs } from './patient/CareLogs';
import { AlertHistory } from './patient/AlertHistory';
import { CaregiverManagement } from './CaregiverManagement';

import {
  ArrowLeft,
  Heart,
  Thermometer,
  Activity,
  Droplets,
  Phone,
  User,
  Pill,
  FileText,
  Download,
  Battery,
  Wifi,
  WifiOff,
  AlertCircle,
  TrendingUp,
  Clock,
  ClipboardList
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface PatientProfileProps {
  patient: Patient;
  onBack: () => void;
  caregiverName?: string;
  // currentUserAccessLevel is now implicitly part of patient prop or should be passed?
  // Since we updated Patient interface, patient.accessLevel should be available.
  initialTab?: string; // [NEW] Allow setting the starting tab
}

export const PatientProfile: React.FC<PatientProfileProps> = ({ patient, onBack, caregiverName, initialTab = "overview" }) => {
  const [vitalSigns, setVitalSigns] = useState<VitalSign[]>([]);
  const [timeRange, setTimeRange] = useState<'8h' | '24h' | '7d'>('24h');

  // Load Vitals
  useEffect(() => {
    // In a real app, this would fetch from API
    // [MODIFIED] Removed mock data generation as requested. 
    // In the future, this will fetch real data from the API.
    setVitalSigns([]);
  }, [patient.id, patient.baselineVitals]);

  const latestVital = vitalSigns[vitalSigns.length - 1];

  // Logic for Vital Reports Tab
  const getFilteredVitals = () => {
    const now = Date.now();
    const ranges = {
      '8h': 8 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    };
    return vitalSigns.filter(v => now - v.timestamp.getTime() < ranges[timeRange]);
  };

  const chartData = getFilteredVitals().map(v => ({
    time: v.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    heartRate: v.heartRate,
    temperature: v.temperature,
    spo2: v.spo2,
    moisture: v.moistureLevel,
  }));

  // Logic for Overview Diagnosis
  const getSuggestedDiagnosis = () => {
    const suggestions = [];
    if (patient.medicalConditions.includes('Diabetes')) suggestions.push('Continue blood glucose monitoring every 4 hours');
    if (patient.medicalConditions.includes('Hypertension')) suggestions.push('Monitor blood pressure twice daily');
    if (latestVital && latestVital.heartRate > patient.baselineVitals.heartRate + 10) suggestions.push('Elevated heart rate detected - consider ECG if persistent');
    if (latestVital && latestVital.spo2 < 95) suggestions.push('Low oxygen saturation - consider oxygen therapy consultation');
    if (patient.medicalConditions.includes('Nocturnal Enuresis') || patient.medicalConditions.includes('Incontinence')) suggestions.push('Scheduled toileting every 2-3 hours during daytime');
    return suggestions;
  };

  const downloadReport = () => {
    // Mock download logic
    alert("Downloading Patient Report...");
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{patient.name}</h2>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>{patient.age} years old</span>
              <span>•</span>
              <span>Room {patient.roomNumber || 'N/A'}</span>
              <span>•</span>
              <Badge variant="outline" className={patient.deviceConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500'}>
                {patient.deviceConnected ? 'Online' : 'Offline'}
              </Badge>
              {patient.accessLevel && (
                <Badge variant="secondary" className="ml-2">
                  {patient.accessLevel} Access
                </Badge>
              )}
            </div>
          </div>
        </div>
        <Button variant="outline" onClick={downloadReport} className="cursor-pointer font-medium">
          <Download className="w-4 h-4 mr-2" />
          Download Report
        </Button>
      </div>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="flex w-full justify-start border-b border-slate-200 bg-transparent h-auto p-0 space-x-6 overflow-x-auto scrollbar-none">
          <TabsTrigger
            value="overview"
            className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:!border-primary data-[state=active]:!text-accent-foreground data-[state=active]:!bg-accent data-[state=active]:!shadow-none px-4 py-3 bg-transparent font-medium text-slate-500 hover:text-accent-foreground hover:bg-accent transition-colors"
          >
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="vitals"
            className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:!border-primary data-[state=active]:!text-accent-foreground data-[state=active]:!bg-accent data-[state=active]:!shadow-none px-4 py-3 bg-transparent font-medium text-slate-500 hover:text-accent-foreground hover:bg-accent transition-colors"
          >
            Vitals History
          </TabsTrigger>
          <TabsTrigger
            value="diaper"
            className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:!border-primary data-[state=active]:!text-accent-foreground data-[state=active]:!bg-accent data-[state=active]:!shadow-none px-4 py-3 bg-transparent font-medium text-slate-500 hover:text-accent-foreground hover:bg-accent transition-colors"
          >
            Smart Diaper
          </TabsTrigger>
          <TabsTrigger
            value="logs"
            className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:!border-primary data-[state=active]:!text-accent-foreground data-[state=active]:!bg-accent data-[state=active]:!shadow-none px-4 py-3 bg-transparent font-medium text-slate-500 hover:text-accent-foreground hover:bg-accent transition-colors"
          >
            Care Logs
          </TabsTrigger>
          <TabsTrigger
            value="alerts"
            className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:!border-primary data-[state=active]:!text-accent-foreground data-[state=active]:!bg-accent data-[state=active]:!shadow-none px-4 py-3 bg-transparent font-medium text-slate-500 hover:text-accent-foreground hover:bg-accent transition-colors"
          >
            Alerts
          </TabsTrigger>
          <TabsTrigger
            value="care-team"
            className="cursor-pointer rounded-none border-b-2 border-transparent data-[state=active]:!border-primary data-[state=active]:!text-accent-foreground data-[state=active]:!bg-accent data-[state=active]:!shadow-none px-4 py-3 bg-transparent font-medium text-slate-500 hover:text-accent-foreground hover:bg-accent transition-colors"
          >
            Care Team
          </TabsTrigger>
        </TabsList>

        {/* TAB: OVERVIEW */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Quick Vitals Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-rose-500 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Heart Rate</p>
                  <p className="text-2xl font-bold text-slate-800">{latestVital ? Math.round(latestVital.heartRate) : '--'} <span className="text-sm font-normal text-slate-400">bpm</span></p>
                </div>
                <Heart className="w-8 h-8 text-rose-100 fill-rose-500" />
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-amber-500 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Body Temp</p>
                  <p className="text-2xl font-bold text-slate-800">{latestVital ? latestVital.temperature.toFixed(1) : '--'} <span className="text-sm font-normal text-slate-400">°C</span></p>
                </div>
                <Thermometer className="w-8 h-8 text-amber-100 fill-amber-500" />
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">SpO2</p>
                  <p className="text-2xl font-bold text-slate-800">{latestVital ? Math.round(latestVital.spo2) : '--'} <span className="text-sm font-normal text-slate-400">%</span></p>
                </div>
                <Activity className="w-8 h-8 text-blue-100 fill-blue-500" />
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-teal-500 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-medium uppercase">Moisture</p>
                  <p className="text-2xl font-bold text-slate-800">{latestVital ? Math.round(latestVital.moistureLevel) : '--'} <span className="text-sm font-normal text-slate-400">%</span></p>
                </div>
                <Droplets className="w-8 h-8 text-teal-100 fill-teal-500" />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Patient Info Card */}
            <Card className="md:col-span-1 border-slate-200 shadow-sm h-fit">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-slate-500" /> Patient Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-slate-400">Primary Diagnosis</p>
                  <p className="font-medium text-slate-800">{patient.illness || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Conditions</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {patient.medicalConditions.map((c, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Emergency Contact</p>
                  {patient.emergencyContact ? (
                    <div>
                      <p className="font-medium text-slate-800">{patient.emergencyContact.name}</p>
                      <p className="text-sm text-slate-600">{patient.emergencyContact.relationship} • {patient.emergencyContact.phone}</p>
                    </div>
                  ) : <p className="text-sm">N/A</p>}
                </div>
                <div>
                  <p className="text-xs text-slate-400">Assigned Caregiver</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                      {(caregiverName || 'U')[0]}
                    </div>
                    <p className="text-sm font-medium">{caregiverName || 'Unassigned'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Suggestions / Status */}
            <div className="md:col-span-2 space-y-6">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-slate-500" /> AI Insights & Care Requirements
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {getSuggestedDiagnosis().map((suggestion, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 rounded-lg border border-teal-100 bg-teal-50/50">
                        <AlertCircle className="w-5 h-5 mt-0.5 text-teal-600" />
                        <p className="text-sm text-slate-700">{suggestion}</p>
                      </div>
                    ))}
                    {getSuggestedDiagnosis().length === 0 && <p className="text-sm text-slate-500">No active alerts or suggestions at this time.</p>}
                  </div>
                </CardContent>
              </Card>

              {/* Device Battery Status (Mini) */}
              <div className="grid grid-cols-3 gap-4">
                <div className={`p-3 rounded-lg border flex flex-col items-center justify-center text-center ${patient.deviceConnected ? 'bg-white border-slate-200' : 'bg-slate-50'}`}>
                  {patient.deviceConnected ? <Wifi className="w-5 h-5 text-emerald-500 mb-1" /> : <WifiOff className="w-5 h-5 text-slate-400 mb-1" />}
                  <p className="text-xs font-semibold text-slate-600">Main Controller</p>
                  <p className={`text-xs ${patient.deviceBattery < 20 ? 'text-red-500' : 'text-emerald-600'}`}>{patient.deviceBattery}% Battery</p>
                </div>
                <div className={`p-3 rounded-lg border flex flex-col items-center justify-center text-center ${patient.hrDeviceConnected ? 'bg-white border-slate-200' : 'bg-slate-50'}`}>
                  <Heart className="w-5 h-5 text-rose-400 mb-1" />
                  <p className="text-xs font-semibold text-slate-600">HR Monitor</p>
                  <p className={`text-xs ${patient.hrDeviceBattery && patient.hrDeviceBattery < 20 ? 'text-red-500' : 'text-emerald-600'}`}>{patient.hrDeviceBattery}% Battery</p>
                </div>
                <div className={`p-3 rounded-lg border flex flex-col items-center justify-center text-center ${patient.diaperDeviceConnected ? 'bg-white border-slate-200' : 'bg-slate-50'}`}>
                  <Droplets className="w-5 h-5 text-blue-400 mb-1" />
                  <p className="text-xs font-semibold text-slate-600">Diaper Sensor</p>
                  <p className={`text-xs ${patient.diaperDeviceBattery && patient.diaperDeviceBattery < 20 ? 'text-red-500' : 'text-emerald-600'}`}>{patient.diaperDeviceBattery}% Battery</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB: VITALS */}
        <TabsContent value="vitals" className="mt-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Vital Signs History</CardTitle>
                <div className="flex gap-2">
                  {(['8h', '24h', '7d'] as const).map(range => (
                    <Button
                      key={range}
                      size="sm"
                      variant={timeRange === range ? 'default' : 'outline'}
                      onClick={() => setTimeRange(range)}
                      className={timeRange === range ? 'bg-accent text-accent-foreground hover:bg-accent/90 cursor-pointer' : 'cursor-pointer'}
                    >
                      {range.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="h-[250px]">
                <h4 className="text-sm font-medium text-slate-500 mb-4">Heart Rate (bpm)</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis domain={[40, 160]} fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '8px' }} />
                    <Area type="monotone" dataKey="heartRate" stroke="#ef4444" fillOpacity={1} fill="url(#colorHr)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="h-[250px]">
                <h4 className="text-sm font-medium text-slate-500 mb-4">Temperature (°C)</h4>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="time" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis domain={[35, 40]} fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '8px' }} />
                    <Line type="monotone" dataKey="temperature" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB: DIAPER */}
        <TabsContent value="diaper" className="mt-6">
          <SmartDiaperEvents />
        </TabsContent>

        {/* TAB: LOGS */}
        <TabsContent value="logs" className="mt-6">
          <CareLogs />
        </TabsContent>

        {/* TAB: ALERTS */}
        <TabsContent value="alerts" className="mt-6">
          <AlertHistory />
        </TabsContent>

        {/* TAB: CARE TEAM */}
        <TabsContent value="care-team" className="mt-6">
          <CaregiverManagement
            patientId={patient.id}
            patientName={patient.name}
            currentUserAccessLevel={patient.accessLevel || 'View'}
          />
        </TabsContent>

      </Tabs>
    </div>
  );
};
