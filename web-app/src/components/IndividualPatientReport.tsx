import React, { useState } from 'react';
import { Patient, VitalSign, Event } from '../types';
import { generateMockVitalSigns, mockEvents } from '../lib/mock-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, FileText, Activity, Droplets, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';
import { toast } from 'sonner@2.0.3';

interface IndividualPatientReportProps {
  patient: Patient;
  onBack: () => void;
}

export const IndividualPatientReport: React.FC<IndividualPatientReportProps> = ({ patient, onBack }) => {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  
  // Generate vital signs data
  const allVitalSigns = generateMockVitalSigns(patient.id, patient.baselineVitals);
  
  // Filter based on time range
  const now = Date.now();
  const ranges = {
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  
  const vitalSigns = allVitalSigns.filter(v => 
    now - new Date(v.timestamp).getTime() <= ranges[timeRange]
  );
  
  const patientEvents = mockEvents.filter(e => e.patientId === patient.id);
  
  // Calculate statistics
  const avgHeartRate = vitalSigns.reduce((sum, v) => sum + v.heartRate, 0) / vitalSigns.length;
  const avgTemperature = vitalSigns.reduce((sum, v) => sum + v.temperature, 0) / vitalSigns.length;
  const avgSpo2 = vitalSigns.reduce((sum, v) => sum + v.spo2, 0) / vitalSigns.length;
  const avgMoisture = vitalSigns.reduce((sum, v) => sum + v.moistureLevel, 0) / vitalSigns.length;
  
  const maxHeartRate = Math.max(...vitalSigns.map(v => v.heartRate));
  const minHeartRate = Math.min(...vitalSigns.map(v => v.heartRate));
  const maxTemperature = Math.max(...vitalSigns.map(v => v.temperature));
  const minTemperature = Math.min(...vitalSigns.map(v => v.temperature));
  
  // Event statistics
  const bedwettingEvents = patientEvents.filter(e => e.type === 'bedwetting');
  const vitalChangeEvents = patientEvents.filter(e => e.type === 'vital_change');
  const anomalyEvents = patientEvents.filter(e => e.type === 'anomaly');
  
  // Event distribution data
  const eventDistribution = [
    { name: 'Bed-wetting', value: bedwettingEvents.length, color: 'var(--teal-400)' },
    { name: 'Vital Changes', value: vitalChangeEvents.length, color: 'var(--teal-600)' },
    { name: 'Anomalies', value: anomalyEvents.length, color: 'var(--status-warning)' },
  ];
  
  // Daily averages for trends
  const dailyAverages = vitalSigns.reduce((acc, v) => {
    const date = new Date(v.timestamp).toLocaleDateString();
    if (!acc[date]) {
      acc[date] = { date, heartRate: [], temperature: [], spo2: [], count: 0 };
    }
    acc[date].heartRate.push(v.heartRate);
    acc[date].temperature.push(v.temperature);
    acc[date].spo2.push(v.spo2);
    acc[date].count++;
    return acc;
  }, {} as Record<string, any>);
  
  const trendData = Object.values(dailyAverages).map((day: any) => ({
    date: day.date,
    heartRate: (day.heartRate.reduce((a: number, b: number) => a + b, 0) / day.heartRate.length).toFixed(1),
    temperature: (day.temperature.reduce((a: number, b: number) => a + b, 0) / day.temperature.length).toFixed(2),
    spo2: (day.spo2.reduce((a: number, b: number) => a + b, 0) / day.spo2.length).toFixed(1),
  }));

  const handleExportPDF = () => {
    const reportContent = `
ALAGA PATIENT REPORT
==========================================

Patient Information:
- Name: ${patient.name}
- Age: ${patient.age} years
- Medical Conditions: ${patient.medicalConditions.join(', ')}
- Device ID: ${patient.deviceId}
- Report Period: ${timeRange === '24h' ? 'Last 24 Hours' : timeRange === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
- Generated: ${new Date().toLocaleString()}

Vital Signs Summary:
- Average Heart Rate: ${avgHeartRate.toFixed(1)} bpm (Range: ${minHeartRate.toFixed(1)} - ${maxHeartRate.toFixed(1)})
- Average Temperature: ${avgTemperature.toFixed(2)}°C (Range: ${minTemperature.toFixed(2)} - ${maxTemperature.toFixed(2)})
- Average SpO₂: ${avgSpo2.toFixed(1)}%
- Average Moisture Level: ${avgMoisture.toFixed(1)}%

Baseline Vitals:
- Target Heart Rate: ${patient.baselineVitals.heartRate} bpm
- Target Temperature: ${patient.baselineVitals.temperature}°C
- Target SpO₂: ${patient.baselineVitals.spo2}%

Event Summary:
- Bed-wetting Events: ${bedwettingEvents.length}
- Vital Sign Changes: ${vitalChangeEvents.length}
- Anomalies Detected: ${anomalyEvents.length}

Device Status:
- Battery Level: ${patient.deviceBattery}%
- Connection Status: ${patient.deviceConnected ? 'Connected' : 'Disconnected'}
- Last Updated: ${new Date(patient.lastUpdated).toLocaleString()}

Recent Events:
${patientEvents.slice(0, 10).map(e => `- ${new Date(e.timestamp).toLocaleString()}: ${e.type} ${e.confidence ? `(Confidence: ${Math.round(e.confidence * 100)}%)` : ''}`).join('\n')}

AI Analysis (One-Class SVM):
- Model Status: Active
- Anomaly Detection: Enabled
- Anomalies Found: ${anomalyEvents.length}
- Pattern Recognition: ${anomalyEvents.length > 0 ? 'Unusual patterns detected' : 'Normal behavior patterns maintained'}

==========================================
© 2025 Alaga System
Compliant with Data Privacy Act of 2012 (RA 10173)
    `.trim();

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Alaga_Report_${patient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    
    toast.success('Report exported successfully');
  };

  const handleExportCSV = () => {
    const csvContent = 'Timestamp,Heart Rate (bpm),Temperature (°C),SpO2 (%),Moisture (%)\n' +
      vitalSigns.map(v => 
        `${new Date(v.timestamp).toISOString()},${v.heartRate.toFixed(1)},${v.temperature.toFixed(2)},${v.spo2.toFixed(1)},${v.moistureLevel.toFixed(1)}`
      ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Alaga_Data_${patient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    
    toast.success('Data exported successfully');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Patient Report: {patient.name}</CardTitle>
              <CardDescription>Comprehensive analytics and insights</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={onBack}>
                Back to All Patients
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Export Buttons */}
      <div className="flex gap-3">
        <Button onClick={handleExportPDF}>
          <FileText className="w-4 h-4 mr-2" />
          Export Report (TXT)
        </Button>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export Data (CSV)
        </Button>
      </div>

      {/* Statistics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Activity className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--teal-500)' }} />
              <p className="text-xs text-muted-foreground">Avg Heart Rate</p>
              <p className="text-2xl mt-1">{avgHeartRate.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">bpm</p>
              <div className="mt-2 text-xs">
                <span style={{ color: 'var(--teal-600)' }}>Min: {minHeartRate.toFixed(1)}</span>
                <span className="mx-1">•</span>
                <span style={{ color: 'var(--teal-600)' }}>Max: {maxHeartRate.toFixed(1)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Activity className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--teal-600)' }} />
              <p className="text-xs text-muted-foreground">Avg Temperature</p>
              <p className="text-2xl mt-1">{avgTemperature.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">°C</p>
              <div className="mt-2 text-xs">
                <span style={{ color: 'var(--teal-600)' }}>Min: {minTemperature.toFixed(2)}</span>
                <span className="mx-1">•</span>
                <span style={{ color: 'var(--teal-600)' }}>Max: {maxTemperature.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <Droplets className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--teal-400)' }} />
              <p className="text-xs text-muted-foreground">Bed-wetting Events</p>
              <p className="text-2xl mt-1">{bedwettingEvents.length}</p>
              <p className="text-xs text-muted-foreground">{timeRange === '24h' ? 'Today' : timeRange === '7d' ? 'This Week' : 'This Month'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--status-warning)' }} />
              <p className="text-xs text-muted-foreground">Anomalies Detected</p>
              <p className="text-2xl mt-1">{anomalyEvents.length}</p>
              <p className="text-xs text-muted-foreground">AI-Detected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Vital Trends</TabsTrigger>
          <TabsTrigger value="events">Event Analysis</TabsTrigger>
          <TabsTrigger value="ai">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          {/* Heart Rate Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Heart Rate Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                    <Legend />
                    <Line type="monotone" dataKey="heartRate" stroke="var(--teal-500)" strokeWidth={2} name="Heart Rate (bpm)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Temperature & SpO2 Trends */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Temperature Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                      <YAxis tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                      <Line type="monotone" dataKey="temperature" stroke="var(--teal-600)" strokeWidth={2} name="Temperature (°C)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SpO₂ Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                      <YAxis tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                      <Line type="monotone" dataKey="spo2" stroke="var(--teal-700)" strokeWidth={2} name="SpO₂ (%)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Event Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Event Distribution</CardTitle>
                <CardDescription>Breakdown by event type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={eventDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value }) => `${name}: ${value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {eventDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Event Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Event Summary</CardTitle>
                <CardDescription>Detailed event counts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--teal-50)' }}>
                  <div className="flex items-center gap-2">
                    <Droplets className="w-5 h-5" style={{ color: 'var(--teal-600)' }} />
                    <span>Bed-wetting Events</span>
                  </div>
                  <Badge className="bg-[var(--teal-500)] text-white">{bedwettingEvents.length}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--teal-50)' }}>
                  <div className="flex items-center gap-2">
                    <Activity className="w-5 h-5" style={{ color: 'var(--teal-600)' }} />
                    <span>Vital Sign Changes</span>
                  </div>
                  <Badge className="bg-[var(--teal-500)] text-white">{vitalChangeEvents.length}</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-yellow-50">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                    <span>Anomalies (AI Detected)</span>
                  </div>
                  <Badge className="bg-yellow-500 text-white">{anomalyEvents.length}</Badge>
                </div>
                <div className="mt-4 p-3 border rounded-lg">
                  <p className="text-sm">
                    Total Events: <strong>{patientEvents.length}</strong>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Period: {timeRange === '24h' ? 'Last 24 Hours' : timeRange === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Events List */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {patientEvents.slice(0, 10).map(event => (
                  <div key={event.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {event.type === 'bedwetting' && <Droplets className="w-4 h-4" style={{ color: 'var(--teal-600)' }} />}
                      {event.type === 'vital_change' && <Activity className="w-4 h-4" style={{ color: 'var(--teal-600)' }} />}
                      {event.type === 'anomaly' && <AlertTriangle className="w-4 h-4 text-yellow-600" />}
                      <div>
                        <Badge variant="outline" className="text-xs">{event.type.replace('_', ' ')}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(event.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {event.confidence && (
                      <Badge className="bg-[var(--teal-500)] text-white">
                        {Math.round(event.confidence * 100)}%
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI-Powered Analysis</CardTitle>
              <CardDescription>One-Class SVM Anomaly Detection Insights</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-lg" style={{ backgroundColor: 'var(--teal-50)' }}>
                <TrendingUp className="w-6 h-6 mt-0.5" style={{ color: 'var(--teal-700)' }} />
                <div>
                  <h4 className="text-sm mb-1">Model Status: Active</h4>
                  <p className="text-sm text-muted-foreground">
                    The One-Class SVM algorithm has successfully learned {patient.name}'s normal behavior patterns from historical data. 
                    The model continuously monitors vital signs and bed-wetting patterns to detect deviations.
                  </p>
                </div>
              </div>

              {anomalyEvents.length > 0 ? (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                  <AlertTriangle className="w-6 h-6 mt-0.5 text-yellow-600" />
                  <div>
                    <h4 className="text-sm mb-1">{anomalyEvents.length} Anomal{anomalyEvents.length > 1 ? 'ies' : 'y'} Detected</h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      The AI model has identified unusual patterns that deviate from {patient.name}'s normal behavior:
                    </p>
                    <ul className="space-y-2">
                      {anomalyEvents.map(event => (
                        <li key={event.id} className="text-sm">
                          • {event.data.type || 'Pattern deviation'} - {new Date(event.timestamp).toLocaleDateString()}
                          {event.confidence && ` (${Math.round(event.confidence * 100)}% confidence)`}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
                  <Activity className="w-6 h-6 mt-0.5 text-green-600" />
                  <div>
                    <h4 className="text-sm mb-1">Normal Patterns Maintained</h4>
                    <p className="text-sm text-muted-foreground">
                      No anomalies detected during the selected time period. All vital signs and bed-wetting patterns are within expected ranges.
                    </p>
                  </div>
                </div>
              )}

              <div className="p-4 border rounded-lg">
                <h4 className="text-sm mb-3">Baseline Comparison</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Heart Rate</p>
                    <p className="text-sm">
                      Baseline: {patient.baselineVitals.heartRate} bpm
                      <br />
                      Average: {avgHeartRate.toFixed(1)} bpm
                      <br />
                      <span style={{ color: Math.abs(avgHeartRate - patient.baselineVitals.heartRate) < 10 ? 'var(--status-success)' : 'var(--status-warning)' }}>
                        {Math.abs(avgHeartRate - patient.baselineVitals.heartRate) < 10 ? '✓ Within range' : '⚠ Monitor closely'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Temperature</p>
                    <p className="text-sm">
                      Baseline: {patient.baselineVitals.temperature}°C
                      <br />
                      Average: {avgTemperature.toFixed(2)}°C
                      <br />
                      <span style={{ color: Math.abs(avgTemperature - patient.baselineVitals.temperature) < 0.5 ? 'var(--status-success)' : 'var(--status-warning)' }}>
                        {Math.abs(avgTemperature - patient.baselineVitals.temperature) < 0.5 ? '✓ Within range' : '⚠ Monitor closely'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-lg" style={{ backgroundColor: 'var(--teal-50)' }}>
                <h4 className="text-sm mb-2">Recommendations</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Continue monitoring for pattern changes</li>
                  <li>• Review anomaly events with medical staff</li>
                  <li>• Ensure device battery and connectivity are maintained</li>
                  {anomalyEvents.length > 2 && <li>• Consider consultation for frequent anomalies</li>}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
