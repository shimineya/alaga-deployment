import React from 'react';
import { LucideIcon } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface MiniVitalCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit: string;
  color: string;
  sparklineData?: number[];
  status?: 'normal' | 'warning' | 'critical';
}

export const MiniVitalCard: React.FC<MiniVitalCardProps> = ({
  icon: Icon,
  label,
  value,
  unit,
  color,
  sparklineData = [],
  status = 'normal',
}) => {
  const statusColors = {
    normal: '#2ECC71',
    warning: '#F39C12',
    critical: '#E74C3C',
  };

  const data = sparklineData.map((val, idx) => ({ value: val, index: idx }));

  return (
    <div 
      className="rounded-xl p-4 transition-all duration-300 hover:shadow-md"
      style={{ 
        backgroundColor: '#F0F9F7',
        border: '1px solid #E8F6F3',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div 
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ 
            backgroundColor: `${color}30`,
          }}
        >
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        {status !== 'normal' && (
          <div 
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ backgroundColor: statusColors[status] }}
          />
        )}
      </div>
      
      <p className="text-xs mb-1" style={{ color: '#7F8C8D' }}>{label}</p>
      
      <div className="flex items-baseline gap-1 mb-2">
        <p className="text-2xl" style={{ color: '#2C3E50' }}>
          {value}
        </p>
        <p className="text-xs" style={{ color: '#7F8C8D' }}>{unit}</p>
      </div>

      {sparklineData.length > 0 && (
        <div className="h-8 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={color} 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
