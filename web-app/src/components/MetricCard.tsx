import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import { cn } from './ui/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  statusColor?: string; // Optional override, e.g., "var(--status-critical)"
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon: Icon,
  trend,
  trendValue,
  statusColor = "var(--primary)",
  className,
}) => {
  return (
    <Card className={cn("overflow-hidden transition-all hover:shadow-md", className)}>
      <CardContent className="p-4 flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="flex items-baseline gap-2">
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: statusColor }}>
              {value}
            </h2>
            {trend && trendValue && (
              <span
                className={cn(
                  "text-xs font-medium flex items-center",
                  trend === 'up' ? "text-emerald-600" : "text-rose-600"
                )}
              >
                {trend === 'up' ? '↑' : '↓'} {trendValue}
              </span>
            )}
          </div>
        </div>
        
        <div 
          className="h-10 w-10 rounded-full flex items-center justify-center bg-opacity-10"
          style={{ backgroundColor: `${statusColor}20` }} // 20% opacity background
        >
          <Icon className="h-5 w-5" style={{ color: statusColor }} />
        </div>
      </CardContent>
    </Card>
  );
};