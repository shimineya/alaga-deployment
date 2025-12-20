import React from 'react';
import { Patient } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Activity, Thermometer, Droplets, Battery, Wifi, WifiOff, AlertTriangle } from 'lucide-react';

interface PatientCardProps {
  patient: Patient;
  onClick?: () => void;
  compact?: boolean;
}

export const PatientCard: React.FC<PatientCardProps> = ({ patient, onClick, compact = false }) => {
  const getBatteryColor = (level: number) => {
    if (level > 50) return 'var(--status-success)';
    if (level > 20) return 'var(--status-warning)';
    return 'var(--status-critical)';
  };

  const getStatusBadge = () => {
    if (!patient.deviceConnected) {
      return <Badge variant="destructive">Disconnected</Badge>;
    }
    if (patient.deviceBattery < 20) {
      return <Badge className="bg-[var(--status-warning)] text-white">Low Battery</Badge>;
    }
    return <Badge className="bg-[var(--status-success)] text-white">Active</Badge>;
  };

  return (
    <Card 
      className={`hover:shadow-lg transition-shadow ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{patient.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{patient.age} years old</p>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!compact && patient.medicalConditions.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Medical Conditions:</p>
            <div className="flex flex-wrap gap-1">
              {patient.medicalConditions.map((condition, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {condition}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center gap-1" style={{ color: 'var(--teal-700)' }}>
            <Activity className="w-4 h-4" />
            <div>
              <p className="text-xs text-muted-foreground">HR</p>
              <p className="text-sm">{patient.baselineVitals.heartRate} bpm</p>
            </div>
          </div>
          <div className="flex items-center gap-1" style={{ color: 'var(--teal-700)' }}>
            <Thermometer className="w-4 h-4" />
            <div>
              <p className="text-xs text-muted-foreground">Temp</p>
              <p className="text-sm">{patient.baselineVitals.temperature}°C</p>
            </div>
          </div>
          <div className="flex items-center gap-1" style={{ color: 'var(--teal-700)' }}>
            <Droplets className="w-4 h-4" />
            <div>
              <p className="text-xs text-muted-foreground">SpO₂</p>
              <p className="text-sm">{patient.baselineVitals.spo2}%</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <Battery 
              className="w-4 h-4" 
              style={{ color: getBatteryColor(patient.deviceBattery) }}
            />
            <span className="text-xs" style={{ color: getBatteryColor(patient.deviceBattery) }}>
              {patient.deviceBattery}%
            </span>
          </div>
          <div className="flex items-center gap-1">
            {patient.deviceConnected ? (
              <>
                <Wifi className="w-4 h-4" style={{ color: 'var(--status-success)' }} />
                <span className="text-xs text-muted-foreground">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" style={{ color: 'var(--status-critical)' }} />
                <span className="text-xs" style={{ color: 'var(--status-critical)' }}>Offline</span>
              </>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {patient.deviceId}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};
