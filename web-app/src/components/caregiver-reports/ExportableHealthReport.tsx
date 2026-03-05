import React, { useState, useMemo } from 'react';
import { Patient, VitalSign, Alert } from '../../types';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { ReportPatientPicker } from './ReportPatientPicker';
import { FileDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ExportableHealthReportProps {
  patients: Patient[];
  vitalSigns: VitalSign[];
  alerts: Alert[];
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
}

export const ExportableHealthReport: React.FC<ExportableHealthReportProps> = ({
  patients,
  vitalSigns,
  alerts,
  selectedPatientId,
  onSelectPatient,
}) => {
  const [exporting, setExporting] = useState(false);

  const summary = useMemo(() => {
    if (!selectedPatientId) return null;
    const patient = patients.find((p) => p.id === selectedPatientId);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const recentVitals = vitalSigns.filter(
      (v) => v.patientId === selectedPatientId && new Date(v.timestamp) >= cutoff
    );
    const recentAlerts = alerts.filter(
      (a) => a.patientId === selectedPatientId && new Date(a.timestamp) >= cutoff
    );
    const hr = recentVitals.map((v) => v.heartRate);
    const spo2 = recentVitals.map((v) => v.spo2);
    const temp = recentVitals.map((v) => v.temperature);
    return {
      patientName: patient?.name ?? 'Unknown',
      generatedAt: new Date().toISOString(),
      period: 'Last 7 days',
      avgHR: hr.length ? Math.round(hr.reduce((a, b) => a + b, 0) / hr.length) : null,
      avgSpO2: spo2.length ? Math.round(spo2.reduce((a, b) => a + b, 0) / spo2.length) : null,
      avgTemp: temp.length ? (temp.reduce((a, b) => a + b, 0) / temp.length).toFixed(1) : null,
      readingsCount: recentVitals.length,
      alertsCount: recentAlerts.length,
    };
  }, [patients, vitalSigns, alerts, selectedPatientId]);

  const handleExportPDF = async () => {
    if (!selectedPatientId) {
      toast.error('Select a patient first.');
      return;
    }
    setExporting(true);
    try {
      // Client-side PDF generation: build a simple HTML print view and trigger print (user can "Save as PDF")
      const win = window.open('', '_blank');
      if (!win) {
        toast.error('Allow pop-ups to generate the report.');
        setExporting(false);
        return;
      }
      const s = summary!;
      win.document.write(`
        <!DOCTYPE html>
        <html>
        <head><title>Health Report - ${s.patientName}</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 24px; font-size: 12px; color: #334155; }
          h1 { font-size: 16px; margin-bottom: 4px; }
          .meta { color: #64748b; font-size: 11px; margin-bottom: 16px; }
          table { border-collapse: collapse; width: 100%; margin-top: 12px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
          th { background: #f8fafc; font-weight: 600; }
        </style>
        </head>
        <body>
          <h1>Alaga Health Summary</h1>
          <p class="meta">Generated ${new Date(s.generatedAt).toLocaleString()} · ${s.period}</p>
          <p><strong>Patient:</strong> ${s.patientName}</p>
          <table>
            <tr><th>Metric</th><th>Value</th></tr>
            <tr><td>Avg. Heart Rate</td><td>${s.avgHR ?? '--'} bpm</td></tr>
            <tr><td>Avg. SpO₂</td><td>${s.avgSpO2 ?? '--'}%</td></tr>
            <tr><td>Avg. Temperature</td><td>${s.avgTemp ?? '--'} °C</td></tr>
            <tr><td>Readings (7d)</td><td>${s.readingsCount}</td></tr>
            <tr><td>Alerts (7d)</td><td>${s.alertsCount}</td></tr>
          </table>
          <p style="margin-top: 20px; font-size: 10px; color: #94a3b8;">This report can be shared with a family doctor or pediatrician via email or messaging apps.</p>
        </body>
        </html>
      `);
      win.document.close();
      win.focus();
      setTimeout(() => {
        win.print();
        win.close();
      }, 250);
      toast.success('Report opened for printing or saving as PDF.');
    } catch (e) {
      toast.error('Could not generate report.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-slate-700">Exportable Health Report</h3>
        <ReportPatientPicker
          patients={patients}
          value={selectedPatientId}
          onValueChange={onSelectPatient}
        />
      </div>

      <p className="text-[11px] text-slate-500">
        Generate a clean PDF summary to send to a family doctor or pediatrician via email or messaging apps.
      </p>

      <Card className="shadow-sm border-slate-100">
        <CardHeader className="py-2 px-4 border-b border-slate-50">
          <CardTitle className="text-xs flex items-center gap-2">
            <FileDown className="w-3.5 h-3.5 text-teal-600" />
            Export report
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {!selectedPatientId ? (
            <p className="text-xs text-slate-400">Select a patient to generate their health report.</p>
          ) : (
            <>
              <p className="text-xs text-slate-600">
                Summary for <strong>{summary?.patientName}</strong> (last 7 days) will open in a new window. Use your browser&apos;s &quot;Print&quot; → &quot;Save as PDF&quot; to download.
              </p>
              <Button
                size="sm"
                className="bg-teal-600 hover:bg-teal-700 text-white h-8 text-xs"
                onClick={handleExportPDF}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" />
                ) : (
                  <FileDown className="w-3.5 h-3.5 mr-2" />
                )}
                {exporting ? 'Generating…' : 'Generate & open report'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
