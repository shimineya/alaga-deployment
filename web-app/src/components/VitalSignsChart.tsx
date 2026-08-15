import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

interface VitalSignsChartProps {
  data: any[];
  dataKey: string;     // e.g., 'heart_rate', 'temperature'
  label: string;       // e.g., 'Heart Rate'
  color?: string;      // Hex or CSS var
  unit?: string;       // e.g., 'bpm'
}

export const VitalSignsChart: React.FC<VitalSignsChartProps> = ({
  data,
  dataKey,
  label,
  color = "var(--primary)",
  unit = ""
}) => {
  return (
    <div className="w-full h-[250px] p-2">
      <div className="flex items-center justify-between mb-2 px-2">
        <h4 className="text-sm font-medium text-muted-foreground">{label} Trend</h4>
      </div>
      
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          
          <XAxis 
            dataKey="timestamp" 
            tickFormatter={(str) => {
              const date = new Date(str);
              return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }}
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
          />
          
          <YAxis 
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            domain={['auto', 'auto']} // Auto-scale based on data
          />
          
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--card)', 
              borderColor: 'var(--border)', 
              borderRadius: '8px',
              fontSize: '12px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
            }}
            labelStyle={{ color: 'var(--muted-foreground)' }}
            itemStyle={{ color: color, fontWeight: 'bold' }}
            formatter={(value: number) => [`${value} ${unit}`, label]}
          />
          
          <Area 
            type="monotone" 
            dataKey={dataKey} 
            stroke={color} 
            strokeWidth={2}
            fillOpacity={1} 
            fill={`url(#gradient-${dataKey})`} 
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};