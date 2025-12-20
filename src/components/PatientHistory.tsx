import React, { useState } from 'react';
import { Patient, Event } from '../types';
import { mockEvents } from '../lib/mock-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Calendar, Droplets, Activity, AlertTriangle, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface PatientHistoryProps {
  patient: Patient;
}

export const PatientHistory: React.FC<PatientHistoryProps> = ({ patient }) => {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');
  
  const patientEvents = mockEvents.filter(e => e.patientId === patient.id);
  
  // Group events by day for chart
  const eventsByDay = patientEvents.reduce((acc, event) => {
    const day = new Date(event.timestamp).toLocaleDateString();
    if (!acc[day]) {
      acc[day] = { day, bedwetting: 0, vitalChange: 0, anomaly: 0 };
    }
    if (event.type === 'bedwetting') acc[day].bedwetting++;
    if (event.type === 'vital_change') acc[day].vitalChange++;
    if (event.type === 'anomaly') acc[day].anomaly++;
    return acc;
  }, {} as Record<string, any>);

  const chartData = Object.values(eventsByDay);

  const bedwettingEvents = patientEvents.filter(e => e.type === 'bedwetting');
  const anomalyEvents = patientEvents.filter(e => e.type === 'anomaly');
  const vitalChangeEvents = patientEvents.filter(e => e.type === 'vital_change');

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--teal-100)' }}>
                <Droplets className="w-6 h-6" style={{ color: 'var(--teal-600)' }} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bed-wetting Events</p>
                <p className="text-2xl">{bedwettingEvents.length}</p>
                <p className="text-xs text-muted-foreground">Last 7 days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--teal-100)' }}>
                <Activity className="w-6 h-6" style={{ color: 'var(--teal-600)' }} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Vital Sign Changes</p>
                <p className="text-2xl">{vitalChangeEvents.length}</p>
                <p className="text-xs text-muted-foreground">Last 7 days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--teal-100)' }}>
                <AlertTriangle className="w-6 h-6" style={{ color: 'var(--teal-600)' }} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Anomalies Detected</p>
                <p className="text-2xl">{anomalyEvents.length}</p>
                <p className="text-xs text-muted-foreground">Last 7 days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Event Timeline Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Event Timeline</CardTitle>
          <CardDescription>Daily event frequency over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
                />
                <YAxis tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="bedwetting" stackId="a" fill="var(--teal-400)" name="Bed-wetting" />
                <Bar dataKey="vitalChange" stackId="a" fill="var(--teal-600)" name="Vital Changes" />
                <Bar dataKey="anomaly" stackId="a" fill="var(--status-warning)" name="Anomalies" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Event History Tabs */}
      <Card>
        <CardHeader>
          <CardTitle>Event History</CardTitle>
          <CardDescription>Detailed records of all events</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All Events</TabsTrigger>
              <TabsTrigger value="bedwetting">Bed-wetting</TabsTrigger>
              <TabsTrigger value="vital">Vital Signs</TabsTrigger>
              <TabsTrigger value="anomaly">Anomalies</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-3 mt-4">
              {patientEvents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No events recorded yet</p>
                </div>
              ) : (
                patientEvents.map(event => (
                  <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--teal-100)' }}>
                      {event.type === 'bedwetting' && <Droplets className="w-4 h-4" style={{ color: 'var(--teal-600)' }} />}
                      {event.type === 'vital_change' && <Activity className="w-4 h-4" style={{ color: 'var(--teal-600)' }} />}
                      {event.type === 'anomaly' && <AlertTriangle className="w-4 h-4" style={{ color: 'var(--status-warning)' }} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <Badge variant="outline">{event.type.replace('_', ' ')}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(event.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {Object.entries(event.data).map(([key, value]) => (
                          <div key={key}>
                            <strong>{key}:</strong> {typeof value === 'number' ? value.toFixed(1) : value}
                          </div>
                        ))}
                      </div>
                      {event.confidence && (
                        <div className="mt-2">
                          <Badge className="bg-[var(--teal-500)] text-white">
                            Confidence: {Math.round(event.confidence * 100)}%
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="bedwetting" className="space-y-3 mt-4">
              {bedwettingEvents.map(event => (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--teal-100)' }}>
                    <Droplets className="w-4 h-4" style={{ color: 'var(--teal-600)' }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm">Bed-wetting Event</h4>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Moisture Level: {event.data.moistureLevel}%
                      {event.data.duration && ` • Duration: ${event.data.duration}s`}
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="vital" className="space-y-3 mt-4">
              {vitalChangeEvents.map(event => (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--teal-100)' }}>
                    <Activity className="w-4 h-4" style={{ color: 'var(--teal-600)' }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm">Vital Sign Change</h4>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {event.data.heartRate && `Heart Rate: ${event.data.heartRate} bpm`}
                      {event.data.temperature && ` • Temperature: ${event.data.temperature}°C`}
                    </div>
                  </div>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="anomaly" className="space-y-3 mt-4">
              {anomalyEvents.map(event => (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg border border-yellow-200">
                  <div className="p-2 rounded-lg bg-yellow-100">
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="text-sm">Anomaly Detected</h4>
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground mb-2">
                      Type: {event.data.type}
                      {event.data.pattern && ` • Pattern: ${event.data.pattern}`}
                    </div>
                    {event.confidence && (
                      <Badge className="bg-[var(--teal-500)] text-white">
                        Confidence: {Math.round(event.confidence * 100)}%
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Pattern Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Pattern Analysis</CardTitle>
          <CardDescription>AI-driven insights (One-Class SVM)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 rounded-lg" style={{ backgroundColor: 'var(--teal-50)' }}>
              <TrendingUp className="w-5 h-5 mt-0.5" style={{ color: 'var(--teal-700)' }} />
              <div>
                <h4 className="text-sm mb-1">Normal Behavior Pattern Established</h4>
                <p className="text-sm text-muted-foreground">
                  The One-Class SVM model has learned {patient.name}'s typical vital signs and bed-wetting patterns. 
                  Any significant deviations will trigger anomaly alerts.
                </p>
              </div>
            </div>
            
            {anomalyEvents.length > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                <AlertTriangle className="w-5 h-5 mt-0.5 text-yellow-600" />
                <div>
                  <h4 className="text-sm mb-1">Anomalies Detected</h4>
                  <p className="text-sm text-muted-foreground">
                    {anomalyEvents.length} unusual pattern{anomalyEvents.length > 1 ? 's' : ''} detected in the past week. 
                    Review the anomaly events for details and consider consulting medical staff.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
