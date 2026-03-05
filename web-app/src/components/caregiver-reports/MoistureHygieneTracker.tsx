import React, { useMemo } from 'react';
import { Patient, VitalSign } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { ReportPatientPicker } from './ReportPatientPicker';
import { ScrollArea } from '../ui/scroll-area';
import { Droplets, Circle } from 'lucide-react';

interface MoistureEvent {
  id: string;
  time: Date;
  type: 'diaper_change' | 'moisture_peak';
  level?: number;
  label: string;
}

interface MoistureHygieneTrackerProps {
  patients: Patient[];
  vitalSigns: VitalSign[];
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
}

export const MoistureHygieneTracker: React.FC<MoistureHygieneTrackerProps> = ({
  patients,
  vitalSigns,
  selectedPatientId,
  onSelectPatient,
}) => {
  const events = useMemo(() => {
    const list: MoistureEvent[] = [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);

    vitalSigns
      .filter(
        (v) =>
          v.patientId === selectedPatientId &&
          new Date(v.timestamp) >= cutoff &&
          (v.moistureLevel ?? 0) > 0
      )
      .forEach((v, i) => {
        const t = new Date(v.timestamp);
        const level = v.moistureLevel ?? 0;
        list.push({
          id: `m-${v.id}-${i}`,
          time: t,
          type: level >= 80 ? 'diaper_change' : 'moisture_peak',
          level,
          label: level >= 80 ? 'Diaper change' : `Moisture ${Math.round(level)}%`,
        });
      });

    list.sort((a, b) => a.time.getTime() - b.time.getTime());
    return list;
  }, [vitalSigns, selectedPatientId]);

  const byHour = useMemo(() => {
    const map: Record<number, number> = {};
    events.forEach((e) => {
      const h = e.time.getHours();
      map[h] = (map[h] || 0) + 1;
    });
    return Object.entries(map)
      .map(([h, count]) => ({ hour: parseInt(h, 10), count }))
      .sort((a, b) => a.hour - b.hour);
  }, [events]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-700">Moisture & Hygiene Tracker</h3>
        <ReportPatientPicker
          patients={patients}
          value={selectedPatientId}
          onValueChange={onSelectPatient}
        />
      </div>

      <p className="text-[11px] text-slate-500">
        Timeline of diaper changes and moisture events to spot patterns (e.g. more active/wet at 2:00 AM).
      </p>

      {byHour.length > 0 && (
        <Card className="shadow-sm border-slate-100">
          <CardHeader className="py-2 px-4 border-b border-slate-50">
            <CardTitle className="text-xs">Activity by hour (last 7 days)</CardTitle>
          </CardHeader>
          <CardContent className="p-3">
            <div className="flex items-end gap-1 h-16">
              {Array.from({ length: 24 }, (_, h) => {
                const row = byHour.find((x) => x.hour === h);
                const count = row?.count ?? 0;
                const max = Math.max(...byHour.map((x) => x.count), 1);
                return (
                  <div key={h} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className="w-full bg-teal-500/60 rounded-t min-h-[4px] transition-all"
                      style={{ height: `${(count / max) * 48}px` }}
                    />
                    <span className="text-[9px] text-slate-400">{h}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="shadow-sm border-slate-100">
        <CardHeader className="py-2 px-4 border-b border-slate-50">
          <CardTitle className="text-xs flex items-center gap-2">
            <Droplets className="w-3.5 h-3.5 text-teal-500" />
            Event timeline
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[280px]">
            <ul className="divide-y divide-slate-100">
              {!selectedPatientId ? (
                <li className="px-4 py-6 text-center text-xs text-slate-400">
                  Select a patient to view moisture and hygiene events.
                </li>
              ) : events.length === 0 ? (
                <li className="px-4 py-6 text-center text-xs text-slate-400">
                  No moisture events in the last 7 days.
                </li>
              ) : (
                events.map((e) => (
                  <li key={e.id} className="px-4 py-2 flex items-center gap-3 hover:bg-slate-50/50">
                    <Circle
                      className={`w-2 h-2 flex-shrink-0 ${
                        e.type === 'diaper_change' ? 'fill-teal-500 text-teal-500' : 'text-slate-300'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-700">{e.label}</p>
                      <p className="text-[10px] text-slate-400">
                        {e.time.toLocaleString()}
                        {e.level != null ? ` · ${Math.round(e.level)}%` : ''}
                      </p>
                    </div>
                  </li>
                ))
              )}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
