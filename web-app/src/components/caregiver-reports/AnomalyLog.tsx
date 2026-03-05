import React, { useState, useMemo } from 'react';
import { Patient, Alert } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ReportPatientPicker, ALL_PATIENTS_ID } from './ReportPatientPicker';
import { ScrollArea } from '../ui/scroll-area';
import { AlertTriangle, Check, XCircle } from 'lucide-react';

export type AnomalyStatus = 'pending' | 'resolved' | 'false_alarm';

interface AnomalyEntry {
  id: string;
  patientId: string;
  timestamp: Date;
  reason: string;
  metric?: string;
  value?: string;
  status: AnomalyStatus;
}

interface AnomalyLogProps {
  patients: Patient[];
  alerts: Alert[];
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
}

export const AnomalyLog: React.FC<AnomalyLogProps> = ({
  patients,
  alerts,
  selectedPatientId,
  onSelectPatient,
}) => {
  const [statusOverrides, setStatusOverrides] = useState<Record<string, AnomalyStatus>>({});

  const anomalies = useMemo(() => {
    const list: AnomalyEntry[] = alerts
      .filter((a) => a.type === 'anomaly' || a.type === 'vital_signs')
      .filter((a) => !selectedPatientId || selectedPatientId === ALL_PATIENTS_ID || a.patientId === selectedPatientId)
      .map((a) => ({
        id: a.id,
        patientId: a.patientId,
        timestamp: new Date(a.timestamp),
        reason: a.message || a.title,
        metric: 'vitals',
        status: (statusOverrides[a.id] as AnomalyStatus) || 'pending',
      }));
    list.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return list;
  }, [alerts, selectedPatientId, statusOverrides]);

  const handleMark = (id: string, status: AnomalyStatus) => {
    setStatusOverrides((prev) => ({ ...prev, [id]: status }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-700">Anomaly Log (Silence Check)</h3>
        <ReportPatientPicker
          patients={patients}
          value={selectedPatientId}
          onValueChange={onSelectPatient}
          placeholder="All patients"
          showAllOption
        />
      </div>

      <p className="text-[11px] text-slate-500">
        AI-detected deviations from baseline. Mark as Resolved or False Alarm to improve future alerts.
      </p>

      <Card className="shadow-sm border-slate-100">
        <CardHeader className="py-2 px-4 border-b border-slate-50">
          <CardTitle className="text-xs flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Detected anomalies
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[320px]">
            <ul className="divide-y divide-slate-100">
              {anomalies.length === 0 ? (
                <li className="px-4 py-6 text-center text-xs text-slate-400">
                  No anomalies in log. Select a patient or view all.
                </li>
              ) : (
                anomalies.map((a) => (
                  <li key={a.id} className="px-4 py-2 hover:bg-slate-50/50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-700 truncate">{a.reason}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {a.timestamp.toLocaleString()}
                        </p>
                      </div>
                      {a.status === 'pending' ? (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleMark(a.id, 'resolved')}
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Resolved
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-[10px] px-2 border-slate-200 text-slate-600 hover:bg-slate-50"
                            onClick={() => handleMark(a.id, 'false_alarm')}
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            False alarm
                          </Button>
                        </div>
                      ) : (
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                            a.status === 'resolved'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {a.status === 'resolved' ? 'Resolved' : 'False alarm'}
                        </span>
                      )}
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
