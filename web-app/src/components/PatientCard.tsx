import React from 'react';
import { Patient } from '../types'; // Ensure this matches your type definition
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Activity, Thermometer, Droplets, User, Clock, Loader2, AlertTriangle } from 'lucide-react';

import { cn } from './ui/utils';

interface PatientCardProps {
  patient: Patient;
  onClick?: (patient: Patient) => void;
}

export const PatientCard: React.FC<PatientCardProps> = ({ patient, onClick }) => {
  // [LOGIC] Determine status color based on patient condition
  // Adjust 'is_critical' field name based on your actual DB schema (e.g., patient.status === 'Critical')
  const isCritical = patient.status === 'Critical' || patient.status === 'Emergency';
  
  const statusColor = isCritical ? 'var(--status-critical)' : 'var(--status-stable)';
  const borderColor = isCritical ? 'border-red-200' : 'border-teal-100';
  const bgColor = isCritical ? 'bg-red-50/30' : 'bg-card';

  return (
    <Card 
      className={cn(
        "transition-all duration-200 hover:shadow-lg hover:border-primary/50 cursor-pointer group",
        borderColor,
        bgColor
      )}
      onClick={() => onClick?.(patient)}
    >
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-3">
          <div className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center",
            isCritical ? "bg-red-100 text-red-600" : "bg-teal-100 text-teal-600"
          )}>
            <User className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold leading-none">
              {patient.first_name} {patient.last_name}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <Badge 
          variant="outline" 
          className={cn(
            "capitalize",
            isCritical ? "border-red-500 text-red-600 bg-red-50" : "border-teal-500 text-teal-600 bg-teal-50"
          )}
        >
          {patient.status || 'Stable'}
        </Badge>
      </CardHeader>

      <CardContent className="p-4 pt-2">
        {(() => {
          const telem = (patient as any)?.latest_telemetry || {};
          const isOnline = !!((patient as any).is_online ?? (patient as any).isOnline ?? patient.deviceConnected);
          const hr = (patient as any).heart_rate ?? (patient as any).heartRate ?? telem.heart_rate;
          const sp = (patient as any).spo2 ?? telem.spo2;
          const temp = (patient as any).temperature ?? telem.temperature;
          const moist = (patient as any).moisture ?? (patient as any).moisture_value ?? telem.moisture ?? telem.moisture_value;

          const hasTelem = !!(telem.recorded_at || (hr !== undefined && hr !== null && hr > 0) || (temp !== undefined && temp !== null && temp > 0));
          const isCalibrating = isOnline && !hasTelem;
          const isMisaligned = isOnline && hasTelem && (hr === 0 || hr === null);

          return (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {/* Heart Rate */}
              <div 
                className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                  isCalibrating 
                    ? 'bg-cyan-50/60 border-cyan-200' 
                    : isMisaligned 
                    ? 'bg-amber-50/70 border-amber-200' 
                    : 'bg-slate-50 border-slate-100'
                }`}
                title={!isOnline ? 'Sensor offline' : isCalibrating ? 'Acquiring vitals baseline...' : isMisaligned ? 'Sensor misaligned - Check probe placement on patient' : 'Live streaming'}
              >
                <Activity className={`h-4 w-4 mb-1 ${isCalibrating ? 'text-cyan-600 animate-pulse' : isMisaligned ? 'text-amber-600' : 'text-rose-500'}`} />
                {isCalibrating ? (
                  <Loader2 className="h-4 w-4 text-cyan-600 animate-spin my-0.5" />
                ) : isMisaligned ? (
                  <AlertTriangle className="h-4 w-4 text-amber-600 animate-bounce my-0.5" />
                ) : (
                  <span className="text-sm sm:text-base font-bold text-slate-900">{hr !== undefined && hr !== null ? hr : '--'}</span>
                )}
                <span className="text-[9px] text-muted-foreground uppercase">{isCalibrating ? 'Init' : isMisaligned ? 'Check' : 'BPM'}</span>
              </div>

              {/* SpO2 */}
              <div 
                className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                  isCalibrating 
                    ? 'bg-cyan-50/60 border-cyan-200' 
                    : isMisaligned 
                    ? 'bg-amber-50/70 border-amber-200' 
                    : 'bg-slate-50 border-slate-100'
                }`}
                title={!isOnline ? 'Sensor offline' : isCalibrating ? 'Detecting pulse signal...' : isMisaligned ? 'Pulse probe misaligned' : 'Live streaming'}
              >
                <Droplets className={`h-4 w-4 mb-1 ${isCalibrating ? 'text-cyan-600 animate-pulse' : isMisaligned ? 'text-amber-600' : 'text-sky-500'}`} />
                {isCalibrating ? (
                  <Loader2 className="h-4 w-4 text-cyan-600 animate-spin my-0.5" />
                ) : isMisaligned ? (
                  <AlertTriangle className="h-4 w-4 text-amber-600 animate-bounce my-0.5" />
                ) : (
                  <span className="text-sm sm:text-base font-bold text-slate-900">{sp !== undefined && sp !== null ? `${sp}%` : '--'}</span>
                )}
                <span className="text-[9px] text-muted-foreground uppercase">{isCalibrating ? 'Init' : isMisaligned ? 'Check' : 'SpO2'}</span>
              </div>

              {/* Temperature */}
              <div 
                className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                  isCalibrating 
                    ? 'bg-cyan-50/60 border-cyan-200' 
                    : 'bg-slate-50 border-slate-100'
                }`}
                title={!isOnline ? 'Sensor offline' : isCalibrating ? 'Stabilizing temperature probe...' : 'Live streaming'}
              >
                <Thermometer className={`h-4 w-4 mb-1 ${isCalibrating ? 'text-cyan-600 animate-pulse' : 'text-amber-500'}`} />
                {isCalibrating ? (
                  <Loader2 className="h-4 w-4 text-cyan-600 animate-spin my-0.5" />
                ) : (
                  <span className="text-sm sm:text-base font-bold text-slate-900">{temp !== undefined && temp !== null ? `${Number(temp).toFixed(1)}°` : '--'}</span>
                )}
                <span className="text-[9px] text-muted-foreground uppercase">{isCalibrating ? 'Init' : '°C'}</span>
              </div>

              {/* Diaper Wetness / Moisture */}
              <div 
                className={`flex flex-col items-center p-2 rounded-lg border transition-all ${
                  isCalibrating 
                    ? 'bg-cyan-50/60 border-cyan-200' 
                    : 'bg-slate-50 border-slate-100'
                }`}
                title={!isOnline ? 'Sensor offline' : isCalibrating ? 'Smart diaper sensor ready' : 'Live streaming'}
              >
                <Droplets className={`h-4 w-4 mb-1 ${isCalibrating ? 'text-cyan-600 animate-pulse' : 'text-teal-500'}`} />
                {isCalibrating ? (
                  <Loader2 className="h-4 w-4 text-cyan-600 animate-spin my-0.5" />
                ) : (
                  <span className="text-sm sm:text-base font-bold text-slate-900">{moist !== undefined && moist !== null ? `${Math.round(Number(moist))}%` : '--'}</span>
                )}
                <span className="text-[9px] text-muted-foreground uppercase">{isCalibrating ? 'Init' : 'Wet'}</span>
              </div>
            </div>
          );
        })()}
      </CardContent>

    </Card>
  );
};