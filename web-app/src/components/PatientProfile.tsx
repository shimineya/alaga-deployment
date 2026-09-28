
import React, { useState, useEffect } from 'react';
import { Patient, Alert, VitalSign } from '../types';
import { generateMockVitalSigns } from '../lib/mock-data';
import { formatBirthdateDisplay } from '../lib/dateUtils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { SmartDiaperEvents } from './patient/SmartDiaperEvents';
import { CareLogs } from './patient/CareLogs';
import { AlertHistory } from './patient/AlertHistory';
import { CaregiverManagement } from './CaregiverManagement';
import { Input } from './ui/input';
import { toast } from 'sonner';

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
  onRefresh?: () => void;
}

export const PatientProfile: React.FC<PatientProfileProps> = ({ patient: initialPatient, onBack, caregiverName, initialTab = "overview", onRefresh }) => {
  const [patient, setPatient] = useState<Patient>(initialPatient);
  const [vitalSigns, setVitalSigns] = useState<VitalSign[]>([]);
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('day');

  // Sync state with prop
  useEffect(() => {
    setPatient(initialPatient);
  }, [initialPatient]);

  // Edit details state
  const [isEditing, setIsEditing] = useState(false);
  const [editIllness, setEditIllness] = useState('');
  const [editConditions, setEditConditions] = useState('');
  const [editEmergencyContact, setEditEmergencyContact] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleStartEdit = () => {
    setEditIllness(patient.illness || '');
    setEditConditions(patient.medicalConditions?.join(', ') || '');
    
    let contactStr = '';
    if (patient.emergencyContact) {
      if (typeof patient.emergencyContact === 'string') {
        contactStr = patient.emergencyContact;
      } else {
        const parts = [];
        if (patient.emergencyContact.name) parts.push(patient.emergencyContact.name);
        if (patient.emergencyContact.relationship) parts.push(`(${patient.emergencyContact.relationship})`);
        if (patient.emergencyContact.phone) parts.push(`- ${patient.emergencyContact.phone}`);
        contactStr = parts.join(' ');
      }
    }
    setEditEmergencyContact(contactStr);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      const isMock = patient.id.startsWith('p');
      const token = localStorage.getItem('token');
      
      const newConditions = editConditions ? editConditions.split(',').map(c => c.trim()).filter(Boolean) : [];
      
      if (!isMock && token) {
        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/caregiver/patients/${patient.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: patient.name,
            illness: editIllness || null,
            medicalConditions: newConditions,
            emergencyContact: editEmergencyContact || null
          })
        });
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.message || 'Failed to update patient record.');
        }
      }
      
      // Update local state
      setPatient(prev => ({
        ...prev,
        illness: editIllness || undefined,
        medicalConditions: newConditions,
        emergencyContact: editEmergencyContact || undefined
      }));
      
      toast.success('Patient details updated successfully.');
      setIsEditing(false);
      onRefresh?.();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to update patient.');
    } finally {
      setIsSaving(false);
    }
  };

  // Load Vitals from Backend
  useEffect(() => {
    let isMounted = true;
    const patId = String(patient.id).replace(/\D/g, '') || patient.id;

    const fetchVitals = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token || !patId) return;

        const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/sensor/history/${patId}?timeframe=${timeRange}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (isMounted && data.success && Array.isArray(data.history) && data.history.length > 0) {
          setVitalSigns(data.history.map((row: any, idx: number) => ({
            id: `v-${idx}-${new Date(row.recorded_at).getTime()}`,
            timestamp: new Date(row.recorded_at),
            heartRate: Number(row.heart_rate) || 0,
            temperature: Number(row.temperature) || 0,
            spo2: Number(row.spo2) || 0,
            moistureLevel: Number(row.moisture_value) || 0,
          })));
        }
      } catch (err) {
        console.error('Error fetching live vitals:', err);
      }
    };

    fetchVitals();
    const interval = setInterval(fetchVitals, 3000); // Live poll every 3 seconds

    const handleRealtimeTelemetry = (e: any) => {
      const detail = e?.detail;
      if (!detail) return;
      if (detail.type === 'device_status_update') {
        const updatePatientId = String(detail.patient_id || detail.patientId || '');
        if (!updatePatientId || updatePatientId === patId) {
          const isAct = detail.status === 'ACTIVE';
          const sn = String(detail.serial_number || '');
          const isVS = sn.startsWith('VS-');
          const isSD = sn.startsWith('SD-');
          setPatient((prev: any) => ({
            ...prev,
            is_online: isAct,
            isOnline: isAct,
            deviceConnected: isAct,
            is_vitals_online: isVS ? isAct : prev.is_vitals_online,
            is_moisture_online: isSD ? isAct : prev.is_moisture_online,
          }));
        }
      } else if (detail.type === 'patient_telemetry_update') {
        const updatePatientId = String(detail.patient_id || detail.patientId);
        if (updatePatientId === patId) {
          const sn = String(detail.serial_number || '');
          const isVS = sn.startsWith('VS-') || detail.device_type === 'vitals';
          const isSD = sn.startsWith('SD-') || detail.device_type === 'moisture';

          const rawHr = detail.heart_rate !== undefined ? detail.heart_rate : detail.latest_telemetry?.heart_rate;
          const rawTemp = detail.temperature !== undefined ? detail.temperature : detail.latest_telemetry?.temperature;
          const rawSp = detail.spo2 !== undefined ? detail.spo2 : detail.latest_telemetry?.spo2;
          const rawMoist = detail.moisture !== undefined ? detail.moisture : detail.latest_telemetry?.moisture;
          const ts = new Date(detail.recorded_at || Date.now());

          if (isMounted) {
            setPatient((prev: any) => ({
              ...prev,
              is_online: true,
              isOnline: true,
              deviceConnected: true,
              is_vitals_online: isVS ? true : prev.is_vitals_online,
              is_moisture_online: isSD ? true : prev.is_moisture_online,
            }));
            setVitalSigns(prev => {
              const prevVital = prev[prev.length - 1];
              const finalHr = rawHr !== undefined && rawHr !== null && (Number(rawHr) > 0 || !isSD) ? Number(rawHr) : (prevVital?.heartRate ?? 0);
              const finalTemp = rawTemp !== undefined && rawTemp !== null && (Number(rawTemp) > 0 || !isSD) ? Number(rawTemp) : (prevVital?.temperature ?? 0);
              const finalSp = rawSp !== undefined && rawSp !== null && (Number(rawSp) > 0 || !isSD) ? Number(rawSp) : (prevVital?.spo2 ?? 0);
              const finalMoist = rawMoist !== undefined && rawMoist !== null ? Number(rawMoist) : (prevVital?.moistureLevel ?? 0);

              return [
                ...prev,
                {
                  id: `v-live-${ts.getTime()}`,
                  timestamp: ts,
                  heartRate: finalHr,
                  temperature: finalTemp,
                  spo2: finalSp,
                  moistureLevel: finalMoist,
                }
              ];
            });
          }
        }
      }
    };

    window.addEventListener('alaga_alert_update', handleRealtimeTelemetry);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('alaga_alert_update', handleRealtimeTelemetry);
    };
  }, [patient.id, timeRange]);

  const latestVital = vitalSigns[vitalSigns.length - 1];

  // Logic for Vital Reports Tab
  const getFilteredVitals = () => {
    const now = Date.now();
    const ranges = {
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
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
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{patient.age} years old</span>
              <span>•</span>
              <span>DOB: {formatBirthdateDisplay(patient.birthdate)}</span>
              <span>•</span>
              <span>Room {patient.roomNumber || 'N/A'}</span>
              <span>•</span>
              <Badge variant="outline" className={((patient as any).is_online ?? (patient as any).isOnline ?? patient.deviceConnected) ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500'}>
                {((patient as any).is_online ?? (patient as any).isOnline ?? patient.deviceConnected) ? 'Online' : 'Offline'}
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
        </TabsList>

        {/* TAB: OVERVIEW */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Quick Vitals Grid - Breathe & Glow Design System */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {/* Heart Rate Card */}
            {(() => {
              const pairedDevs = ((patient as any).paired_devices || (patient as any).devices || []) as any[];
              const isDevOnline = !!((patient as any).is_online ?? (patient as any).isOnline ?? patient.deviceConnected);
              const isVitalsOnline = (patient as any).is_vitals_online !== undefined 
                ? !!(patient as any).is_vitals_online 
                : pairedDevs.some((d: any) => (d.status === 'ACTIVE' || d.is_online) && (String(d.serial_number || '').startsWith('VS-') || String(d.device_name || '').toLowerCase().includes('vital')));
              const effectiveVitalsOnline = isVitalsOnline || (pairedDevs.length === 0 && isDevOnline);

              const hr = latestVital ? Math.round(latestVital.heartRate) : null;
              const isDetached = effectiveVitalsOnline && (hr === 0 || hr === null);
              const isCrit = effectiveVitalsOnline && hr !== null && !isDetached && (hr > 130 || hr < 50);
              const isWarn = effectiveVitalsOnline && hr !== null && !isDetached && (hr > 100 || hr < 60) && !isCrit;
              const statusText = !effectiveVitalsOnline ? 'Offline' : isDetached ? 'Detached' : isCrit ? 'Critical' : isWarn ? 'Elevated' : 'Normal';
              const statusBadge = !effectiveVitalsOnline ? 'bg-slate-100 text-slate-500 border-slate-200' : isDetached ? 'bg-slate-100 text-slate-600 border-slate-300' : isCrit ? 'bg-rose-50 text-rose-900 border-rose-300' : isWarn ? 'bg-amber-50 text-amber-950 border-amber-300' : 'bg-emerald-50 text-emerald-900 border-emerald-200';
              const displayVal = !effectiveVitalsOnline ? '--' : isDetached ? '0' : (hr !== null ? `${hr}` : '--');

              return (
                <Card className="bg-white/95 backdrop-blur-sm border border-teal-100/90 shadow-xs hover:-translate-y-0.5 hover:shadow-md hover:border-teal-300 transition-all rounded-2xl overflow-hidden">
                  <CardContent className="p-3.5 sm:p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="p-1.5 rounded-lg bg-rose-50 border border-rose-200/70 text-rose-600">
                          <Heart className="w-4 h-4 fill-rose-500/20" />
                        </div>
                        <span className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-tight">Heart Rate</span>
                      </div>
                      <span className={`flex h-2 w-2 rounded-full ${!effectiveVitalsOnline ? 'bg-slate-300' : isDetached ? 'bg-amber-400' : 'bg-emerald-500 alaga-streaming-radar'}`} title={!effectiveVitalsOnline ? 'Offline' : isDetached ? 'Sensor Detached' : 'Live Streaming'} />
                    </div>

                    <div className="flex items-baseline gap-1.5 pt-0.5">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {displayVal}
                      </span>
                      <span className="text-xs font-medium text-slate-500">bpm</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Badge variant="outline" className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wider ${statusBadge}`}>
                        {statusText}
                      </Badge>
                      <span className="text-[10px] font-semibold text-slate-500 hidden sm:inline">60-100 bpm</span>
                    </div>

                    {/* Micro-range bar */}
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isCrit ? 'bg-rose-500' : isWarn ? 'bg-amber-500' : effectiveVitalsOnline && !isDetached ? 'bg-gradient-to-r from-teal-500 to-emerald-500' : 'bg-slate-200'}`}
                        style={{ width: effectiveVitalsOnline && hr && !isDetached ? `${Math.min(100, Math.max(15, (hr / 160) * 100))}%` : '0%' }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Body Temperature Card */}
            {(() => {
              const pairedDevs = ((patient as any).paired_devices || (patient as any).devices || []) as any[];
              const isDevOnline = !!((patient as any).is_online ?? (patient as any).isOnline ?? patient.deviceConnected);
              const isVitalsOnline = (patient as any).is_vitals_online !== undefined 
                ? !!(patient as any).is_vitals_online 
                : pairedDevs.some((d: any) => (d.status === 'ACTIVE' || d.is_online) && (String(d.serial_number || '').startsWith('VS-') || String(d.device_name || '').toLowerCase().includes('vital')));
              const effectiveVitalsOnline = isVitalsOnline || (pairedDevs.length === 0 && isDevOnline);

              const temp = latestVital ? latestVital.temperature : null;
              const hr = latestVital ? Math.round(latestVital.heartRate) : null;
              const sp = latestVital ? Math.round(latestVital.spo2) : null;
              const isDetached = effectiveVitalsOnline && (temp === 0 || temp === null || temp <= 30.0 || (hr === 0 && (sp === 0 || sp === null)));
              const isCrit = effectiveVitalsOnline && temp !== null && !isDetached && (temp > 38.5 || temp < 35.0);
              const isWarn = effectiveVitalsOnline && temp !== null && !isDetached && (temp > 37.5 || temp < 36.0) && !isCrit;
              const statusText = !effectiveVitalsOnline ? 'Offline' : isDetached ? 'Detached' : isCrit ? (temp > 38.5 ? 'Fever / High' : 'Hypothermia') : isWarn ? 'Elevated' : 'Normal';
              const statusBadge = !effectiveVitalsOnline ? 'bg-slate-100 text-slate-500 border-slate-200' : isDetached ? 'bg-slate-100 text-slate-600 border-slate-300' : isCrit ? 'bg-rose-50 text-rose-900 border-rose-300' : isWarn ? 'bg-amber-50 text-amber-950 border-amber-300' : 'bg-emerald-50 text-emerald-900 border-emerald-200';
              const displayVal = !effectiveVitalsOnline ? '--' : isDetached ? (temp && temp > 0 ? temp.toFixed(1) : '0.0') : (temp !== null ? temp.toFixed(1) : '--');

              return (
                <Card className="bg-white/95 backdrop-blur-sm border border-teal-100/90 shadow-xs hover:-translate-y-0.5 hover:shadow-md hover:border-teal-300 transition-all rounded-2xl overflow-hidden">
                  <CardContent className="p-3.5 sm:p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="p-1.5 rounded-lg bg-amber-50 border border-amber-200/70 text-amber-600">
                          <Thermometer className="w-4 h-4 fill-amber-500/20" />
                        </div>
                        <span className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-tight">Body Temp</span>
                      </div>
                      <span className={`flex h-2 w-2 rounded-full ${!effectiveVitalsOnline ? 'bg-slate-300' : isDetached ? 'bg-amber-400' : 'bg-emerald-500 alaga-streaming-radar'}`} title={!effectiveVitalsOnline ? 'Offline' : isDetached ? 'Sensor Detached' : 'Live Streaming'} />
                    </div>

                    <div className="flex items-baseline gap-1.5 pt-0.5">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {displayVal}
                      </span>
                      <span className="text-xs font-medium text-slate-500">°C</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Badge variant="outline" className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wider ${statusBadge}`}>
                        {statusText}
                      </Badge>
                      <span className="text-[10px] font-semibold text-slate-500 hidden sm:inline">36.5-37.5°C</span>
                    </div>

                    {/* Micro-range bar */}
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isCrit ? 'bg-rose-500' : isWarn ? 'bg-amber-500' : effectiveVitalsOnline && !isDetached ? 'bg-gradient-to-r from-teal-500 to-emerald-500' : 'bg-slate-200'}`}
                        style={{ width: effectiveVitalsOnline && temp && !isDetached ? `${Math.min(100, Math.max(15, ((temp - 34) / 7) * 100))}%` : '0%' }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* SpO2 Oxygen Saturation Card */}
            {(() => {
              const pairedDevs = ((patient as any).paired_devices || (patient as any).devices || []) as any[];
              const isDevOnline = !!((patient as any).is_online ?? (patient as any).isOnline ?? patient.deviceConnected);
              const isVitalsOnline = (patient as any).is_vitals_online !== undefined 
                ? !!(patient as any).is_vitals_online 
                : pairedDevs.some((d: any) => (d.status === 'ACTIVE' || d.is_online) && (String(d.serial_number || '').startsWith('VS-') || String(d.device_name || '').toLowerCase().includes('vital')));
              const effectiveVitalsOnline = isVitalsOnline || (pairedDevs.length === 0 && isDevOnline);

              const spo2 = latestVital ? Math.round(latestVital.spo2) : null;
              const isDetached = effectiveVitalsOnline && (spo2 === 0 || spo2 === null);
              const isCrit = effectiveVitalsOnline && spo2 !== null && !isDetached && spo2 < 90;
              const isWarn = effectiveVitalsOnline && spo2 !== null && !isDetached && spo2 < 95 && !isCrit;
              const statusText = !effectiveVitalsOnline ? 'Offline' : isDetached ? 'Detached' : isCrit ? 'Hypoxia' : isWarn ? 'Low SpO₂' : 'Optimal';
              const statusBadge = !effectiveVitalsOnline ? 'bg-slate-100 text-slate-500 border-slate-200' : isDetached ? 'bg-slate-100 text-slate-600 border-slate-300' : isCrit ? 'bg-rose-50 text-rose-900 border-rose-300' : isWarn ? 'bg-amber-50 text-amber-950 border-amber-300' : 'bg-emerald-50 text-emerald-900 border-emerald-200';
              const displayVal = !effectiveVitalsOnline ? '--' : isDetached ? '0' : (spo2 !== null ? `${spo2}` : '--');

              return (
                <Card className="bg-white/95 backdrop-blur-sm border border-teal-100/90 shadow-xs hover:-translate-y-0.5 hover:shadow-md hover:border-teal-300 transition-all rounded-2xl overflow-hidden">
                  <CardContent className="p-3.5 sm:p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="p-1.5 rounded-lg bg-sky-50 border border-sky-200/70 text-sky-600">
                          <Activity className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-tight">SpO₂ Oxygen</span>
                      </div>
                      <span className={`flex h-2 w-2 rounded-full ${!effectiveVitalsOnline ? 'bg-slate-300' : isDetached ? 'bg-amber-400' : 'bg-emerald-500 alaga-streaming-radar'}`} title={!effectiveVitalsOnline ? 'Offline' : isDetached ? 'Sensor Detached' : 'Live Streaming'} />
                    </div>

                    <div className="flex items-baseline gap-1.5 pt-0.5">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {displayVal}
                      </span>
                      <span className="text-xs font-medium text-slate-500">%</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Badge variant="outline" className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wider ${statusBadge}`}>
                        {statusText}
                      </Badge>
                      <span className="text-[10px] font-semibold text-slate-500 hidden sm:inline">95-100%</span>
                    </div>

                    {/* Micro-range bar */}
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isCrit ? 'bg-rose-500' : isWarn ? 'bg-amber-500' : effectiveVitalsOnline && !isDetached ? 'bg-gradient-to-r from-teal-500 to-emerald-500' : 'bg-slate-200'}`}
                        style={{ width: effectiveVitalsOnline && spo2 && !isDetached ? `${Math.min(100, Math.max(10, spo2))}%` : '0%' }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Diaper Moisture Card */}
            {(() => {
              const pairedDevs = ((patient as any).paired_devices || (patient as any).devices || []) as any[];
              const isDevOnline = !!((patient as any).is_online ?? (patient as any).isOnline ?? patient.deviceConnected);
              const isMoistureOnline = (patient as any).is_moisture_online !== undefined 
                ? !!(patient as any).is_moisture_online 
                : pairedDevs.some((d: any) => (d.status === 'ACTIVE' || d.is_online) && (String(d.serial_number || '').startsWith('SD-') || String(d.device_name || '').toLowerCase().includes('diaper') || String(d.device_name || '').toLowerCase().includes('moisture')));
              const effectiveMoistureOnline = isMoistureOnline || (pairedDevs.length === 0 && isDevOnline);

              const moisture = latestVital ? Math.round(latestVital.moistureLevel) : null;
              const isWet = effectiveMoistureOnline && moisture !== null && moisture >= 70;
              const isDamp = effectiveMoistureOnline && moisture !== null && moisture >= 30 && !isWet;
              const statusText = !effectiveMoistureOnline ? 'Offline' : isWet ? 'Change Diaper' : isDamp ? 'Damp' : 'Dry & Clean';
              const statusBadge = !effectiveMoistureOnline ? 'bg-slate-100 text-slate-500 border-slate-200' : isWet ? 'bg-rose-50 text-rose-900 border-rose-300' : isDamp ? 'bg-amber-50 text-amber-950 border-amber-300' : 'bg-emerald-50 text-emerald-900 border-emerald-200';
              const displayVal = !effectiveMoistureOnline ? '--' : (moisture !== null ? `${moisture}` : '0');

              return (
                <Card className="bg-white/95 backdrop-blur-sm border border-teal-100/90 shadow-xs hover:-translate-y-0.5 hover:shadow-md hover:border-teal-300 transition-all rounded-2xl overflow-hidden">
                  <CardContent className="p-3.5 sm:p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className="p-1.5 rounded-lg bg-teal-50 border border-teal-200/70 text-teal-600">
                          <Droplets className="w-4 h-4 fill-teal-500/20" />
                        </div>
                        <span className="text-[10px] sm:text-xs font-bold text-slate-700 uppercase tracking-tight">Diaper Wetness</span>
                      </div>
                      <span className={`flex h-2 w-2 rounded-full ${!effectiveMoistureOnline ? 'bg-slate-300' : isWet ? 'bg-rose-500' : isDamp ? 'bg-amber-400' : 'bg-emerald-500 alaga-streaming-radar'}`} title={!effectiveMoistureOnline ? 'Offline' : 'Live Streaming'} />
                    </div>

                    <div className="flex items-baseline gap-1.5 pt-0.5">
                      <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        {displayVal}
                      </span>
                      <span className="text-xs font-medium text-slate-500">%</span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <Badge variant="outline" className={`text-[9px] sm:text-[10px] px-1.5 py-0.5 font-bold uppercase tracking-wider ${statusBadge}`}>
                        {statusText}
                      </Badge>
                      <span className="text-[10px] font-semibold text-slate-500 hidden sm:inline">&lt; 30% Ideal</span>
                    </div>

                    {/* Micro-range bar */}
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isWet ? 'bg-rose-500' : isDamp ? 'bg-amber-500' : effectiveMoistureOnline ? 'bg-gradient-to-r from-teal-500 to-emerald-500' : 'bg-slate-200'}`}
                        style={{ width: effectiveMoistureOnline && moisture !== null ? `${Math.min(100, Math.max(5, moisture))}%` : '0%' }}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Patient Info Card */}
            <Card className="md:col-span-1 border-slate-200 shadow-sm h-fit">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="w-5 h-5 text-slate-500" /> Patient Details
                </CardTitle>
                {!isEditing && (patient.accessLevel === 'Edit' || patient.accessLevel === 'Admin' || !patient.accessLevel) && (
                  <Button variant="ghost" size="sm" onClick={handleStartEdit} className="h-8 text-xs text-teal-600 hover:text-teal-700 hover:bg-teal-50">
                    Edit
                  </Button>
                )}
              </CardHeader>
              {!isEditing ? (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Age</p>
                      <p className="text-sm font-black text-slate-800">{patient.age ? `${patient.age} yrs` : 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Date of Birth</p>
                      <p className="text-sm font-bold text-teal-700">
                        {formatBirthdateDisplay(patient.birthdate)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Primary Diagnosis</p>
                    <p className="font-medium text-slate-800">{patient.illness || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Conditions</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {patient.medicalConditions && patient.medicalConditions.length > 0 ? (
                        patient.medicalConditions.map((c, i) => (
                          <Badge key={i} variant="secondary" className="text-xs mr-1">{c}</Badge>
                        ))
                      ) : (
                        <p className="text-sm text-slate-500">None</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Emergency Contact</p>
                    {patient.emergencyContact ? (
                      typeof patient.emergencyContact === 'string' ? (
                        <p className="font-medium text-slate-800">{patient.emergencyContact}</p>
                      ) : (
                        <div>
                          <p className="font-medium text-slate-800">{patient.emergencyContact.name}</p>
                          {(patient.emergencyContact.relationship || patient.emergencyContact.phone) && (
                            <p className="text-sm text-slate-600">
                              {patient.emergencyContact.relationship || ''} {patient.emergencyContact.relationship && patient.emergencyContact.phone ? '•' : ''} {patient.emergencyContact.phone || ''}
                            </p>
                          )}
                        </div>
                      )
                    ) : <p className="text-sm">N/A</p>}
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Assigned Caregiver</p>
                    <div className="flex items-center gap-2 mt-1">
                      {(() => {
                        const name = caregiverName || patient.assignedCaregiverName || (patient as any).assigned_caregiver_name || ((patient as any).caregivers?.[0]?.username) || ((patient as any).caregivers?.[0]?.name) || 'Unassigned';
                        const initial = (name && name !== 'Unassigned' ? name[0] : 'U').toUpperCase();
                        return (
                          <>
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                              {initial}
                            </div>
                            <p className="text-sm font-medium">{name}</p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </CardContent>
              ) : (
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Primary Diagnosis</label>
                    <Input 
                      value={editIllness} 
                      onChange={e => setEditIllness(e.target.value)} 
                      placeholder="e.g. Hypertension"
                      className="h-8 text-sm" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Conditions (comma-separated)</label>
                    <Input 
                      value={editConditions} 
                      onChange={e => setEditConditions(e.target.value)} 
                      placeholder="e.g. Diabetes, Asthma"
                      className="h-8 text-sm" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500">Emergency Contact</label>
                    <Input 
                      value={editEmergencyContact} 
                      onChange={e => setEditEmergencyContact(e.target.value)} 
                      placeholder="e.g. Juan Santos (Son) - +63 912 345 6789"
                      className="h-8 text-sm" 
                    />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button onClick={handleSaveEdit} disabled={isSaving} className="flex-1 h-8 text-xs bg-teal-600 hover:bg-teal-700 text-white font-medium">
                      {isSaving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button onClick={() => setIsEditing(false)} variant="outline" className="flex-1 h-8 text-xs">
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              )}
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
                <div className="flex items-center gap-2">
                  <CardTitle>Vital Signs History</CardTitle>
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    LIVE STREAMING
                  </span>
                </div>
                <div className="flex gap-2">
                  {(['day', 'week', 'month'] as const).map(range => (
                    <Button
                      key={range}
                      size="sm"
                      variant={timeRange === range ? 'default' : 'outline'}
                      onClick={() => setTimeRange(range)}
                      className={timeRange === range ? 'bg-accent text-accent-foreground hover:bg-accent/90 cursor-pointer capitalize font-semibold' : 'cursor-pointer capitalize'}
                    >
                      {range === 'day' ? 'Day (24h)' : range === 'week' ? 'Week (7d)' : 'Month (30d)'}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Heart Rate */}
              <div className="h-[230px]">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                    Heart Rate (bpm)
                  </h4>
                  <span className="text-xs font-bold text-red-600">
                    {chartData.length > 0 ? `${chartData[chartData.length - 1].heartRate} BPM` : '--'}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" fontSize={11} tickLine={false} axisLine={false} stroke="#94a3b8" />
                    <YAxis domain={[40, 160]} fontSize={11} tickLine={false} axisLine={false} stroke="#94a3b8" />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="heartRate" stroke="#ef4444" fillOpacity={1} fill="url(#colorHr)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* SpO2 Blood Oxygen */}
              <div className="h-[230px]">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    Blood Oxygen (SpO2 %)
                  </h4>
                  <span className="text-xs font-bold text-blue-600">
                    {chartData.length > 0 ? `${chartData[chartData.length - 1].spo2}%` : '--'}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSpo2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" fontSize={11} tickLine={false} axisLine={false} stroke="#94a3b8" />
                    <YAxis domain={[85, 100]} fontSize={11} tickLine={false} axisLine={false} stroke="#94a3b8" />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="spo2" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSpo2)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Temperature */}
              <div className="h-[230px]">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    Body Temperature (°C)
                  </h4>
                  <span className="text-xs font-bold text-amber-600">
                    {chartData.length > 0 ? `${chartData[chartData.length - 1].temperature}°C` : '--'}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" fontSize={11} tickLine={false} axisLine={false} stroke="#94a3b8" />
                    <YAxis domain={[34, 41]} fontSize={11} tickLine={false} axisLine={false} stroke="#94a3b8" />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Line type="monotone" dataKey="temperature" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Diaper Wetness */}
              <div className="h-[230px]">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                    Diaper Wetness (%)
                  </h4>
                  <span className="text-xs font-bold text-emerald-600">
                    {chartData.length > 0 ? `${chartData[chartData.length - 1].moisture}%` : '--'}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorMoist" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="time" fontSize={11} tickLine={false} axisLine={false} stroke="#94a3b8" />
                    <YAxis domain={[0, 100]} fontSize={11} tickLine={false} axisLine={false} stroke="#94a3b8" />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Area type="monotone" dataKey="moisture" stroke="#10b981" fillOpacity={1} fill="url(#colorMoist)" strokeWidth={2.5} />
                  </AreaChart>
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
          <CareLogs patientId={patient.id} />
        </TabsContent>

        {/* TAB: ALERTS */}
        <TabsContent value="alerts" className="mt-6">
          <AlertHistory patientId={patient.id} />
        </TabsContent>

      </Tabs>
    </div>
  );
};
