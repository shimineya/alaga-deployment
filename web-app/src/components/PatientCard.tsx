import React from 'react';
import { Patient } from '../types'; // Ensure this matches your type definition
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Activity, Thermometer, Droplets, User, Clock } from 'lucide-react';
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
        {/* Vitals Grid - Integrated from MiniVitalCard */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          {/* Heart Rate */}
          <div className="flex flex-col items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
            <Activity className="h-4 w-4 text-rose-500 mb-1" />
            <span className="text-lg font-bold text-slate-900">{patient.heart_rate || '--'}</span>
            <span className="text-[10px] text-muted-foreground uppercase">BPM</span>
          </div>

          {/* SpO2 */}
          <div className="flex flex-col items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
            <Droplets className="h-4 w-4 text-sky-500 mb-1" />
            <span className="text-lg font-bold text-slate-900">{patient.spo2 || '--'}</span>
            <span className="text-[10px] text-muted-foreground uppercase">%</span>
          </div>

          {/* Temperature */}
          <div className="flex flex-col items-center p-2 rounded-lg bg-slate-50 border border-slate-100">
            <Thermometer className="h-4 w-4 text-amber-500 mb-1" />
            <span className="text-lg font-bold text-slate-900">{patient.temperature || '--'}</span>
            <span className="text-[10px] text-muted-foreground uppercase">°C</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};