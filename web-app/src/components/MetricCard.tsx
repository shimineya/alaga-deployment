import React from 'react';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from './ui/card';

interface MetricCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: string;
  percentage?: number; // For circular progress
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendValue,
  color = '#7DD3C0',
  percentage,
}) => {
  return (
    <Card 
      className="border-0 transition-all duration-300 hover:scale-[1.02]"
      style={{ 
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      }}
    >
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm mb-1" style={{ color: '#7F8C8D' }}>{label}</p>
            <p className="text-3xl mb-1" style={{ color }}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs" style={{ color: '#7F8C8D' }}>{subtitle}</p>
            )}
            {trend && trendValue && (
              <div className="flex items-center gap-1 mt-2">
                <span 
                  className="text-xs"
                  style={{ 
                    color: trend === 'up' ? '#2ECC71' : trend === 'down' ? '#E74C3C' : '#7F8C8D' 
                  }}
                >
                  {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
                </span>
              </div>
            )}
          </div>
          
          <div className="flex flex-col items-center gap-2">
            {percentage !== undefined ? (
              <div className="relative w-12 h-12">
                <svg className="w-12 h-12 transform -rotate-90">
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                    className="text-muted"
                    style={{ opacity: 0.2 }}
                  />
                  <circle
                    cx="24"
                    cy="24"
                    r="20"
                    stroke={color}
                    strokeWidth="4"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 20}`}
                    strokeDashoffset={`${2 * Math.PI * 20 * (1 - percentage / 100)}`}
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs" style={{ color }}>
                    {Math.round(percentage)}%
                  </span>
                </div>
              </div>
            ) : (
              <div 
                className="w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-300"
                style={{ 
                  backgroundColor: `${color}20`,
                }}
              >
                <Icon className="w-6 h-6" style={{ color }} />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
