import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { VitalSign } from '../types';

interface VitalSignsChartProps {
  data: VitalSign[];
  metric: 'heartRate' | 'temperature' | 'spo2' | 'moistureLevel';
  title: string;
  unit: string;
  color?: string;
}

export const VitalSignsChart: React.FC<VitalSignsChartProps> = ({
  data,
  metric,
  title,
  unit,
  color = 'var(--teal-500)',
}) => {
  const chartData = data.map(d => ({
    time: new Date(d.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    value: Number(d[metric].toFixed(1)),
  }));

  return (
    <div className="w-full h-full">
      <h4 className="mb-2">{title}</h4>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis 
            dataKey="time" 
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            interval="preserveStartEnd"
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
            label={{ value: unit, angle: -90, position: 'insideLeft', style: { fill: 'var(--muted-foreground)' } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
            }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke={color} 
            strokeWidth={2}
            dot={false}
            name={title}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
