import React from 'react';
import { Alert } from '../types';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Bell, Droplets, Activity, Wifi, AlertTriangle, Check } from 'lucide-react';

interface AlertsListProps {
  alerts: Alert[];
  onAcknowledge: (alertId: string) => void;
  showPatientName?: boolean;
}

export const AlertsList: React.FC<AlertsListProps> = ({ alerts, onAcknowledge, showPatientName = false }) => {
  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'bedwetting':
        return <Droplets className="w-5 h-5" />;
      case 'vital_signs':
        return <Activity className="w-5 h-5" />;
      case 'device':
        return <Wifi className="w-5 h-5" />;
      case 'anomaly':
        return <AlertTriangle className="w-5 h-5" />;
    }
  };

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return 'var(--status-critical)';
      case 'warning':
        return 'var(--status-warning)';
      case 'normal':
        return 'var(--status-normal)';
    }
  };

  const getSeverityBadge = (severity: Alert['severity']) => {
    const colors = {
      critical: 'bg-[var(--status-critical)] text-white',
      warning: 'bg-[var(--status-warning)] text-white',
      normal: 'bg-[var(--status-normal)] text-white',
    };
    
    return (
      <Badge className={colors[severity]}>
        {severity.toUpperCase()}
      </Badge>
    );
  };

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return new Date(date).toLocaleDateString();
  };

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No alerts at this time</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map(alert => (
        <Card 
          key={alert.id} 
          className={`${alert.acknowledged ? 'opacity-60' : ''} border-l-4`}
          style={{ borderLeftColor: getSeverityColor(alert.severity) }}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div 
                className="p-2 rounded-lg"
                style={{ backgroundColor: 'var(--teal-100)', color: getSeverityColor(alert.severity) }}
              >
                {getAlertIcon(alert.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="text-sm">{alert.title}</h4>
                  {getSeverityBadge(alert.severity)}
                </div>
                
                <p className="text-sm text-muted-foreground mb-2">{alert.message}</p>
                
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(alert.timestamp)}
                  </span>
                  
                  {!alert.acknowledged ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAcknowledge(alert.id)}
                      className="text-xs"
                    >
                      <Check className="w-3 h-3 mr-1" />
                      Acknowledge
                    </Button>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--status-success)' }}>
                      ✓ Acknowledged
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
