import React, { useMemo } from 'react';
import { Patient, VitalSign } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ReportPatientPicker } from './ReportPatientPicker';
import { Heart, Activity, Thermometer } from 'lucide-react';

interface DailyHealthSummaryProps {
  patients: Patient[];
  vitalSigns: VitalSign[];
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
}

export const DailyHealthSummary: React.FC<DailyHealthSummaryProps> = ({
  patients,
  vitalSigns,
  selectedPatientId,
  onSelectPatient,
}) => {
  const last24h = useMemo(() => {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);
    return vitalSigns.filter(
      (v) => v.patientId === selectedPatientId && new Date(v.timestamp) >= cutoff
    );
  }, [vitalSigns, selectedPatientId]);

  const averages = useMemo(() => {
    if (last24h.length === 0)
      return { heartRate: null, spo2: null, temperature: null, count: 0 };
    const hr = last24h.reduce((s, v) => s + v.heartRate, 0) / last24h.length;
    const spo2 = last24h.reduce((s, v) => s + v.spo2, 0) / last24h.length;
    const temp = last24h.reduce((s, v) => s + v.temperature, 0) / last24h.length;
    return { heartRate: hr, spo2, temperature: temp, count: last24h.length };
  }, [last24h]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-700">Daily Health Summary</h3>
        {/* [data-report-picker] lets the ClinicalReportsShell hide this via CSS
            when the shell is managing patient selection from its left panel. */}
        <div data-report-picker>
          <ReportPatientPicker
            patients={patients}
            value={selectedPatientId}
            onValueChange={onSelectPatient}
            placeholder="Select patient"
          />
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        At-a-glance view of the last 24 hours: average Heart Rate, SpO₂, and Temperature.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="shadow-sm border-slate-100">
          <CardHeader className="py-2 px-4 border-b border-slate-50">
            <CardTitle className="text-xs flex items-center gap-2">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              Avg. Heart Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 flex flex-col">
            <span className="text-lg font-bold text-slate-800">
              {averages.heartRate != null ? Math.round(averages.heartRate) : '--'}
            </span>
            <span className="text-[10px] text-slate-400">bpm · {averages.count} readings</span>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-100">
          <CardHeader className="py-2 px-4 border-b border-slate-50">
            <CardTitle className="text-xs flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-blue-500" />
              Avg. SpO₂
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 flex flex-col">
            <span className="text-lg font-bold text-slate-800">
              {averages.spo2 != null ? Math.round(averages.spo2) : '--'}%
            </span>
            <span className="text-[10px] text-slate-400">· {averages.count} readings</span>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-slate-100">
          <CardHeader className="py-2 px-4 border-b border-slate-50">
            <CardTitle className="text-xs flex items-center gap-2">
              <Thermometer className="w-3.5 h-3.5 text-amber-500" />
              Avg. Temperature
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 flex flex-col">
            <span className="text-lg font-bold text-slate-800">
              {averages.temperature != null ? averages.temperature.toFixed(1) : '--'}°C
            </span>
            <span className="text-[10px] text-slate-400">· {averages.count} readings</span>
          </CardContent>
        </Card>
      </div>

      {!selectedPatientId && (
        <Card className="border-slate-100 border-dashed">
          <CardContent className="py-6 text-center text-xs text-slate-400">
            Select a patient to view their 24-hour summary.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
