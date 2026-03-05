import React, { useMemo } from 'react';
import { Patient, VitalSign } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ReportPatientPicker } from './ReportPatientPicker';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface WeeklyTrendAnalysisProps {
  patients: Patient[];
  vitalSigns: VitalSign[];
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
}

export const WeeklyTrendAnalysis: React.FC<WeeklyTrendAnalysisProps> = ({
  patients,
  vitalSigns,
  selectedPatientId,
  onSelectPatient,
}) => {
  const weeklyData = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const filtered = vitalSigns.filter(
      (v) => v.patientId === selectedPatientId && new Date(v.timestamp) >= cutoff
    );
    const byDay: Record<string, { date: string; hr: number[]; spo2: number[]; temp: number[] }> = {};
    filtered.forEach((v) => {
      const d = new Date(v.timestamp);
      const key = d.toISOString().slice(0, 10);
      if (!byDay[key]) byDay[key] = { date: key, hr: [], spo2: [], temp: [] };
      byDay[key].hr.push(v.heartRate);
      byDay[key].spo2.push(v.spo2);
      byDay[key].temp.push(v.temperature);
    });
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        heartRate: data.hr.length ? Math.round(data.hr.reduce((a, b) => a + b, 0) / data.hr.length) : null,
        spo2: data.spo2.length ? Math.round(data.spo2.reduce((a, b) => a + b, 0) / data.spo2.length) : null,
        temperature: data.temp.length
          ? parseFloat((data.temp.reduce((a, b) => a + b, 0) / data.temp.length).toFixed(1))
          : null,
      }));
  }, [vitalSigns, selectedPatientId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-700">Weekly Trend Analysis</h3>
        <ReportPatientPicker
          patients={patients}
          value={selectedPatientId}
          onValueChange={onSelectPatient}
        />
      </div>

      <p className="text-[11px] text-slate-500">
        Vitals over the past week to see if the patient is stabilizing or if a gradual shift may require a doctor&apos;s consultation.
      </p>

      {!selectedPatientId ? (
        <Card className="border-slate-100 border-dashed">
          <CardContent className="py-6 text-center text-xs text-slate-400">
            Select a patient to view weekly trends.
          </CardContent>
        </Card>
      ) : weeklyData.length === 0 ? (
        <Card className="border-slate-100">
          <CardContent className="py-6 text-center text-xs text-slate-400">
            No vital data in the last 7 days for this patient.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="shadow-sm border-slate-100">
            <CardHeader className="py-2 px-4 border-b border-slate-50">
              <CardTitle className="text-xs">Heart Rate (avg/day)</CardTitle>
            </CardHeader>
            <CardContent className="p-2 h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} width={28} />
                  <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '4px' }} />
                  <Line type="monotone" dataKey="heartRate" stroke="#e11d48" strokeWidth={2} dot={{ r: 2 }} name="HR (bpm)" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-slate-100">
            <CardHeader className="py-2 px-4 border-b border-slate-50">
              <CardTitle className="text-xs">SpO₂ (avg/day)</CardTitle>
            </CardHeader>
            <CardContent className="p-2 h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} width={28} />
                  <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '4px' }} />
                  <Line type="monotone" dataKey="spo2" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} name="SpO₂ %" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-slate-100">
            <CardHeader className="py-2 px-4 border-b border-slate-50">
              <CardTitle className="text-xs">Temperature (avg/day °C)</CardTitle>
            </CardHeader>
            <CardContent className="p-2 h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="date" stroke="#94A3B8" fontSize={9} tickLine={false} />
                  <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} width={28} />
                  <Tooltip contentStyle={{ fontSize: '10px', borderRadius: '4px' }} />
                  <Line type="monotone" dataKey="temperature" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} name="Temp °C" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
