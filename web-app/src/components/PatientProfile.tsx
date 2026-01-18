import React, { useState, useEffect } from 'react';
import { Patient, Alert, VitalSign } from '../types';
import { generateMockVitalSigns } from '../lib/mock-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  ArrowLeft,
  Heart,
  Thermometer,
  Activity,
  Droplets,
  Phone,
  MapPin,
  User,
  Calendar,
  Pill,
  FileText,
  Download,
  Battery,
  Wifi,
  WifiOff,
  AlertCircle,
  TrendingUp,
  Clock
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface PatientProfileProps {
  patient: Patient;
  onBack: () => void;
  caregiverName?: string;
}

export const PatientProfile: React.FC<PatientProfileProps> = ({ patient, onBack, caregiverName }) => {
  const [vitalSigns, setVitalSigns] = useState<VitalSign[]>([]);
  const [timeRange, setTimeRange] = useState<'8h' | '24h' | '7d'>('24h');

  useEffect(() => {
    const vitals = generateMockVitalSigns(patient.id, patient.baselineVitals);
    setVitalSigns(vitals);
  }, [patient.id, patient.baselineVitals]);

  const latestVital = vitalSigns[vitalSigns.length - 1];

  // Filter vitals based on time range
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
    time: v.timestamp.toLocaleTimeString(),
    heartRate: v.heartRate,
    temperature: v.temperature,
    spo2: v.spo2,
    moisture: v.moistureLevel,
  }));

  // Suggested diagnosis based on conditions and vitals
  const getSuggestedDiagnosis = () => {
    const suggestions = [];
    
    if (patient.medicalConditions.includes('Diabetes')) {
      suggestions.push('Continue blood glucose monitoring every 4 hours');
    }
    if (patient.medicalConditions.includes('Hypertension')) {
      suggestions.push('Monitor blood pressure twice daily');
    }
    if (latestVital && latestVital.heartRate > patient.baselineVitals.heartRate + 10) {
      suggestions.push('Elevated heart rate detected - consider ECG if persistent');
    }
    if (latestVital && latestVital.spo2 < 95) {
      suggestions.push('Low oxygen saturation - consider oxygen therapy consultation');
    }
    if (patient.medicalConditions.includes('Nocturnal Enuresis') || patient.medicalConditions.includes('Incontinence')) {
      suggestions.push('Scheduled toileting every 2-3 hours during daytime');
    }
    
    return suggestions;
  };

  const downloadReport = () => {
    const report = `
Patient Profile Report
======================
Name: ${patient.name}
Age: ${patient.age} years
Room: ${patient.roomNumber || 'N/A'}
Illness: ${patient.illness || 'N/A'}

Medical Conditions:
${patient.medicalConditions.join(', ')}

Current Vital Signs:
- Heart Rate: ${latestVital ? Math.round(latestVital.heartRate) : 'N/A'} bpm
- Temperature: ${latestVital ? latestVital.temperature.toFixed(1) : 'N/A'}°C
- SpO₂: ${latestVital ? Math.round(latestVital.spo2) : 'N/A'}%
- Moisture Level: ${latestVital ? Math.round(latestVital.moistureLevel) : 'N/A'}%

Devices:
- Main Device: ${patient.deviceId} (Battery: ${patient.deviceBattery}%, ${patient.deviceConnected ? 'Connected' : 'Disconnected'})
- HR Sensor: ${patient.hrDeviceId || 'N/A'} (Battery: ${patient.hrDeviceBattery || 'N/A'}%, ${patient.hrDeviceConnected ? 'Connected' : 'Disconnected'})
- Diaper Sensor: ${patient.diaperDeviceId || 'N/A'} (Battery: ${patient.diaperDeviceBattery || 'N/A'}%, ${patient.diaperDeviceConnected ? 'Connected' : 'Disconnected'})

Emergency Contact:
${patient.emergencyContact ? `${patient.emergencyContact.name} (${patient.emergencyContact.relationship}): ${patient.emergencyContact.phone}` : 'N/A'}

Suggested Diagnosis & Care Plan:
${getSuggestedDiagnosis().map((s, i) => `${i + 1}. ${s}`).join('\n')}

Generated: ${new Date().toLocaleString()}
    `;

    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${patient.name.replace(/\s+/g, '_')}_profile_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h2 className="text-2xl" style={{ color: '#2C3E50' }}>{patient.name}</h2>
            <p className="text-sm" style={{ color: '#7F8C8D' }}>{patient.age} years old • Room {patient.roomNumber || 'N/A'}</p>
          </div>
        </div>
        <Button onClick={downloadReport} style={{ backgroundColor: '#7DD3C0' }} className="text-white">
          <Download className="w-4 h-4 mr-2" />
          Download Report
        </Button>
      </div>

      {/* Personal Information Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Basic Info */}
        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2" style={{ color: '#2C3E50' }}>
              <User className="w-4 h-4" />
              Patient Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs" style={{ color: '#7F8C8D' }}>Full Name</p>
              <p className="text-sm" style={{ color: '#2C3E50' }}>{patient.name}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: '#7F8C8D' }}>Age</p>
              <p className="text-sm" style={{ color: '#2C3E50' }}>{patient.age} years</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: '#7F8C8D' }}>Room Number</p>
              <p className="text-sm" style={{ color: '#2C3E50' }}>{patient.roomNumber || 'Not Assigned'}</p>
            </div>
            <div>
              <p className="text-xs" style={{ color: '#7F8C8D' }}>Assigned Caregiver</p>
              <p className="text-sm" style={{ color: '#2C3E50' }}>{caregiverName || 'Unassigned'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Medical Info */}
        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2" style={{ color: '#2C3E50' }}>
              <FileText className="w-4 h-4" />
              Medical Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs" style={{ color: '#7F8C8D' }}>Primary Illness</p>
              <p className="text-sm" style={{ color: '#2C3E50' }}>{patient.illness || 'Not specified'}</p>
            </div>
            <div>
              <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Medical Conditions</p>
              <div className="flex flex-wrap gap-1">
                {patient.medicalConditions.map((condition, idx) => (
                  <Badge key={idx} className="bg-[#E8F6F3] text-[#0a4a47] border-0">
                    {condition}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2" style={{ color: '#2C3E50' }}>
              <Phone className="w-4 h-4" />
              Emergency Contact
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {patient.emergencyContact ? (
              <>
                <div>
                  <p className="text-xs" style={{ color: '#7F8C8D' }}>Name</p>
                  <p className="text-sm" style={{ color: '#2C3E50' }}>{patient.emergencyContact.name}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: '#7F8C8D' }}>Relationship</p>
                  <p className="text-sm" style={{ color: '#2C3E50' }}>{patient.emergencyContact.relationship}</p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: '#7F8C8D' }}>Phone Number</p>
                  <p className="text-sm" style={{ color: '#2C3E50' }}>{patient.emergencyContact.phone}</p>
                </div>
              </>
            ) : (
              <p className="text-sm" style={{ color: '#7F8C8D' }}>No emergency contact on file</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Current Vital Signs */}
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Current Vital Signs</CardTitle>
          <CardDescription>Real-time monitoring data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: '#FEF2F2' }}>
              <Heart className="w-6 h-6 mx-auto mb-2" style={{ color: '#E74C3C' }} />
              <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Heart Rate</p>
              <p className="text-2xl mb-1" style={{ color: '#2C3E50' }}>
                {latestVital ? Math.round(latestVital.heartRate) : '--'}
              </p>
              <p className="text-xs" style={{ color: '#7F8C8D' }}>bpm</p>
            </div>
            
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: '#FFFBEB' }}>
              <Thermometer className="w-6 h-6 mx-auto mb-2" style={{ color: '#F39C12' }} />
              <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Temperature</p>
              <p className="text-2xl mb-1" style={{ color: '#2C3E50' }}>
                {latestVital ? latestVital.temperature.toFixed(1) : '--'}
              </p>
              <p className="text-xs" style={{ color: '#7F8C8D' }}>°C</p>
            </div>
            
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: '#EFF6FF' }}>
              <Activity className="w-6 h-6 mx-auto mb-2" style={{ color: '#3498DB' }} />
              <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>SpO₂</p>
              <p className="text-2xl mb-1" style={{ color: '#2C3E50' }}>
                {latestVital ? Math.round(latestVital.spo2) : '--'}
              </p>
              <p className="text-xs" style={{ color: '#7F8C8D' }}>%</p>
            </div>
            
            <div className="text-center p-4 rounded-lg" style={{ backgroundColor: '#F0FAF9' }}>
              <Droplets className="w-6 h-6 mx-auto mb-2" style={{ color: '#7DD3C0' }} />
              <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Moisture Level</p>
              <p className="text-2xl mb-1" style={{ color: '#2C3E50' }}>
                {latestVital ? Math.round(latestVital.moistureLevel) : '--'}
              </p>
              <p className="text-xs" style={{ color: '#7F8C8D' }}>%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Device Status */}
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle style={{ color: '#2C3E50' }}>Device Status</CardTitle>
          <CardDescription>Monitoring device health</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Main Device */}
            <div className="p-4 rounded-lg border" style={{ backgroundColor: '#FAFAFA' }}>
              <div className="flex items-center justify-between mb-3">
                <p style={{ color: '#2C3E50' }}>Main Controller</p>
                {patient.deviceConnected ? 
                  <Wifi className="w-4 h-4" style={{ color: '#2ECC71' }} /> :
                  <WifiOff className="w-4 h-4" style={{ color: '#E74C3C' }} />
                }
              </div>
              <p className="text-xs mb-2" style={{ color: '#7F8C8D' }}>{patient.deviceId}</p>
              <div className="flex items-center gap-2">
                <Battery className="w-4 h-4" style={{ 
                  color: patient.deviceBattery > 50 ? '#2ECC71' : patient.deviceBattery > 20 ? '#F39C12' : '#E74C3C' 
                }} />
                <span className="text-sm" style={{ color: '#2C3E50' }}>{patient.deviceBattery}%</span>
              </div>
              <Badge className={patient.deviceConnected ? 'bg-[#2ECC71] text-white mt-2' : 'bg-[#E74C3C] text-white mt-2'}>
                {patient.deviceConnected ? 'Online' : 'Offline'}
              </Badge>
            </div>

            {/* HR Device */}
            <div className="p-4 rounded-lg border" style={{ backgroundColor: '#FAFAFA' }}>
              <div className="flex items-center justify-between mb-3">
                <p style={{ color: '#2C3E50' }}>Heart Rate Sensor</p>
                {patient.hrDeviceConnected ? 
                  <Wifi className="w-4 h-4" style={{ color: '#2ECC71' }} /> :
                  <WifiOff className="w-4 h-4" style={{ color: '#E74C3C' }} />
                }
              </div>
              <p className="text-xs mb-2" style={{ color: '#7F8C8D' }}>{patient.hrDeviceId || 'Not configured'}</p>
              <div className="flex items-center gap-2">
                <Battery className="w-4 h-4" style={{ 
                  color: (patient.hrDeviceBattery || 0) > 50 ? '#2ECC71' : (patient.hrDeviceBattery || 0) > 20 ? '#F39C12' : '#E74C3C' 
                }} />
                <span className="text-sm" style={{ color: '#2C3E50' }}>{patient.hrDeviceBattery || 0}%</span>
              </div>
              <Badge className={patient.hrDeviceConnected ? 'bg-[#2ECC71] text-white mt-2' : 'bg-[#E74C3C] text-white mt-2'}>
                {patient.hrDeviceConnected ? 'Online' : 'Offline'}
              </Badge>
            </div>

            {/* Diaper Device */}
            <div className="p-4 rounded-lg border" style={{ backgroundColor: '#FAFAFA' }}>
              <div className="flex items-center justify-between mb-3">
                <p style={{ color: '#2C3E50' }}>Diaper Sensor</p>
                {patient.diaperDeviceConnected ? 
                  <Wifi className="w-4 h-4" style={{ color: '#2ECC71' }} /> :
                  <WifiOff className="w-4 h-4" style={{ color: '#E74C3C' }} />
                }
              </div>
              <p className="text-xs mb-2" style={{ color: '#7F8C8D' }}>{patient.diaperDeviceId || 'Not configured'}</p>
              <div className="flex items-center gap-2">
                <Battery className="w-4 h-4" style={{ 
                  color: (patient.diaperDeviceBattery || 0) > 50 ? '#2ECC71' : (patient.diaperDeviceBattery || 0) > 20 ? '#F39C12' : '#E74C3C' 
                }} />
                <span className="text-sm" style={{ color: '#2C3E50' }}>{patient.diaperDeviceBattery || 0}%</span>
              </div>
              <Badge className={patient.diaperDeviceConnected ? 'bg-[#2ECC71] text-white mt-2' : 'bg-[#E74C3C] text-white mt-2'}>
                {patient.diaperDeviceConnected ? 'Online' : 'Offline'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Vital Signs Charts */}
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle style={{ color: '#2C3E50' }}>Vital Signs Trends</CardTitle>
              <CardDescription>Historical monitoring data</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={timeRange === '8h' ? 'default' : 'outline'}
                onClick={() => setTimeRange('8h')}
                style={timeRange === '8h' ? { backgroundColor: '#7DD3C0' } : {}}
                className={timeRange === '8h' ? 'text-white' : ''}
              >
                8H
              </Button>
              <Button
                size="sm"
                variant={timeRange === '24h' ? 'default' : 'outline'}
                onClick={() => setTimeRange('24h')}
                style={timeRange === '24h' ? { backgroundColor: '#7DD3C0' } : {}}
                className={timeRange === '24h' ? 'text-white' : ''}
              >
                24H
              </Button>
              <Button
                size="sm"
                variant={timeRange === '7d' ? 'default' : 'outline'}
                onClick={() => setTimeRange('7d')}
                style={timeRange === '7d' ? { backgroundColor: '#7DD3C0' } : {}}
                className={timeRange === '7d' ? 'text-white' : ''}
              >
                7D
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Heart Rate Chart */}
          <div>
            <p className="text-sm mb-2" style={{ color: '#2C3E50' }}>Heart Rate</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="heartRate" stroke="#E74C3C" fill="#FEF2F2" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Temperature Chart */}
          <div>
            <p className="text-sm mb-2" style={{ color: '#2C3E50' }}>Temperature</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                <YAxis domain={[36, 38]} />
                <Tooltip />
                <Line type="monotone" dataKey="temperature" stroke="#F39C12" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* SpO2 Chart */}
          <div>
            <p className="text-sm mb-2" style={{ color: '#2C3E50' }}>SpO₂</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                <YAxis domain={[90, 100]} />
                <Tooltip />
                <Area type="monotone" dataKey="spo2" stroke="#3498DB" fill="#EFF6FF" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Analytics & Suggested Diagnosis */}
      <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" style={{ color: '#2C3E50' }}>
            <TrendingUp className="w-5 h-5" />
            Analytics & Suggested Diagnosis
          </CardTitle>
          <CardDescription>AI-powered recommendations based on patient data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {getSuggestedDiagnosis().map((suggestion, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: '#F0FAF9' }}>
                <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: '#7DD3C0' }} />
                <p className="text-sm" style={{ color: '#2C3E50' }}>{suggestion}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Doctor's Orders - Vital Sign Thresholds */}
      {patient.doctorsOrders?.vitalSignThresholds && (
        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: '#2C3E50' }}>
              <Activity className="w-5 h-5" />
              Vital Sign Thresholds
            </CardTitle>
            <CardDescription>Customized alert thresholds and AI sensitivity</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg" style={{ backgroundColor: '#FEF2F2' }}>
                <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Heart Rate High</p>
                <p className="text-xl" style={{ color: '#E74C3C' }}>{patient.doctorsOrders.vitalSignThresholds.heartRateHigh} bpm</p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: '#EFF6FF' }}>
                <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Heart Rate Low</p>
                <p className="text-xl" style={{ color: '#3498DB' }}>{patient.doctorsOrders.vitalSignThresholds.heartRateLow} bpm</p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: '#FFFBEB' }}>
                <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>SpO₂ Floor</p>
                <p className="text-xl" style={{ color: '#F39C12' }}>{patient.doctorsOrders.vitalSignThresholds.spo2Floor}%</p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: '#FEF2F2' }}>
                <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Temp Ceiling</p>
                <p className="text-xl" style={{ color: '#E74C3C' }}>{patient.doctorsOrders.vitalSignThresholds.temperatureCeiling}°C</p>
              </div>
            </div>
            <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#F0FAF9' }}>
              <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>AI Sensitivity (OC-SVM)</p>
              <Badge className="text-white" style={{ 
                backgroundColor: patient.doctorsOrders.vitalSignThresholds.aiSensitivity === 'high' ? '#E74C3C' :
                  patient.doctorsOrders.vitalSignThresholds.aiSensitivity === 'medium' ? '#F39C12' : '#2ECC71'
              }}>
                {patient.doctorsOrders.vitalSignThresholds.aiSensitivity.toUpperCase()}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Medications */}
      {patient.doctorsOrders?.medications && patient.doctorsOrders.medications.length > 0 && (
        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: '#2C3E50' }}>
              <Pill className="w-5 h-5" />
              Medications & Treatment Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {patient.doctorsOrders.medications.map((med) => (
                <div key={med.id} className="p-4 rounded-lg border" style={{ backgroundColor: '#FAFAFA' }}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p style={{ color: '#2C3E50' }}>{med.name}</p>
                      <p className="text-sm" style={{ color: '#7F8C8D' }}>{med.dosage} - {med.frequency}</p>
                    </div>
                    {med.prn && <Badge className="bg-[#F39C12] text-white">PRN</Badge>}
                  </div>
                  {med.instructions && (
                    <p className="text-xs mt-2" style={{ color: '#7F8C8D' }}>Instructions: {med.instructions}</p>
                  )}
                  {med.prnCondition && (
                    <p className="text-xs mt-1 p-2 rounded" style={{ backgroundColor: '#FFF3CD', color: '#856404' }}>PRN: {med.prnCondition}</p>
                  )}
                  {med.refillThreshold && (
                    <p className="text-xs mt-1" style={{ color: '#7F8C8D' }}>Refill: {med.refillThreshold}</p>
                  )}
                  {med.times && med.times.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {med.times.map((time, idx) => (
                        <Badge key={idx} className="bg-[#E8F6F3] text-[#0a4a47] border-0 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {time}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activity & Positioning Orders */}
      {patient.doctorsOrders?.activityOrders && (
        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: '#2C3E50' }}>
              <User className="w-5 h-5" />
              Activity & Positioning Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {patient.doctorsOrders.activityOrders.turningSchedule && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#F0FAF9' }}>
                  <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Turning Schedule</p>
                  <p className="text-sm" style={{ color: '#2C3E50' }}>
                    {patient.doctorsOrders.activityOrders.turningSchedule}
                    {patient.doctorsOrders.activityOrders.turningPattern && ` - ${patient.doctorsOrders.activityOrders.turningPattern}`}
                  </p>
                </div>
              )}
              {patient.doctorsOrders.activityOrders.ambulationGoals && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#F0FAF9' }}>
                  <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Ambulation Goals</p>
                  <p className="text-sm" style={{ color: '#2C3E50' }}>{patient.doctorsOrders.activityOrders.ambulationGoals}</p>
                </div>
              )}
              {patient.doctorsOrders.activityOrders.dietaryOrders && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#F0FAF9' }}>
                  <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Dietary Orders</p>
                  <p className="text-sm" style={{ color: '#2C3E50' }}>{patient.doctorsOrders.activityOrders.dietaryOrders}</p>
                </div>
              )}
              {patient.doctorsOrders.activityOrders.fluidIntakeGoal && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#F0FAF9' }}>
                  <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Fluid Intake Goal</p>
                  <p className="text-sm" style={{ color: '#2C3E50' }}>{patient.doctorsOrders.activityOrders.fluidIntakeGoal}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monitoring & Laboratory Orders */}
      {patient.doctorsOrders?.monitoringOrders && (
        <Card className="border-0" style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)' }}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2" style={{ color: '#2C3E50' }}>
              <FileText className="w-5 h-5" />
              Monitoring & Laboratory Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {patient.doctorsOrders.monitoringOrders.checkupFrequency && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#EFF6FF' }}>
                  <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Check-up Frequency</p>
                  <p className="text-sm" style={{ color: '#2C3E50' }}>{patient.doctorsOrders.monitoringOrders.checkupFrequency}</p>
                </div>
              )}
              {patient.doctorsOrders.monitoringOrders.labSchedule && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#EFF6FF' }}>
                  <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Laboratory Schedule</p>
                  <p className="text-sm" style={{ color: '#2C3E50' }}>{patient.doctorsOrders.monitoringOrders.labSchedule}</p>
                </div>
              )}
              {patient.doctorsOrders.monitoringOrders.observationFocus && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: '#EFF6FF' }}>
                  <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>Observation Focus</p>
                  <p className="text-sm" style={{ color: '#2C3E50' }}>{patient.doctorsOrders.monitoringOrders.observationFocus}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
