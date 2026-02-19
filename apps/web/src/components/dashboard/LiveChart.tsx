'use client';

import { Reading } from '@/lib/types';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart, CartesianGrid } from 'recharts';
import { clsx } from 'clsx';
// Wait, prompt said "No huge dependencies". date-fns is standard but manual JS date is fine for simple stuff.

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; }>;
  label?: string | number;
}

const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-black/80 border border-white/10 p-3 rounded-lg backdrop-blur-md shadow-xl text-xs">
        <p className="text-white/60 mb-2">{label ? new Date(label).toLocaleTimeString() : ''}</p>
        <div className="flex flex-col gap-1">
          <p className="text-white font-medium flex items-center justify-between gap-4">
            <span className="text-sky-400">Temp</span>
            <span>{Number(payload[0].value).toFixed(1)}°C</span>
          </p>
          <p className="text-white font-medium flex items-center justify-between gap-4">
            <span className="text-blue-400">Humidity</span>
            <span>{Number(payload[1].value).toFixed(1)}%</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

interface LiveChartProps {
  data: Reading[]; // Assumed sorted ascending by time
  rangeLabel: string;
  loading: boolean;
}

export function LiveChart({ data, rangeLabel, loading }: LiveChartProps) {
  if (loading && data.length === 0) {
    return <div className="w-full h-64 rounded-2xl bg-white/5 animate-pulse" />;
  }

  // Format tick
  const formatTick = (iso: string) => {
    const d = new Date(iso);
    if (rangeLabel === '24h') {
        // Show hours: 14:00
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    // For 10m/1h show mm:ss or hh:mm
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };



  return (
    <div className="w-full h-[300px] md:h-[400px] bg-white/5 rounded-2xl border border-white/10 p-4 relative">
       {/* Chart */}
       <ResponsiveContainer width="100%" height="100%">
         <AreaChart data={data}>
            <defs>
                <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorHum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis 
                dataKey="created_at" 
                tickFormatter={formatTick} 
                stroke="rgba(255,255,255,0.3)" 
                tick={{ fontSize: 12 }}
                minTickGap={30}
            />
            <YAxis 
                yAxisId="temp"
                stroke="#38bdf8" // Sky blue
                domain={['auto', 'auto']}
                tick={{ fontSize: 12 }}
                width={30}
            />
             <YAxis 
                yAxisId="hum"
                orientation="right"
                stroke="#60a5fa" // Blue
                domain={[0, 100]}
                tick={{ fontSize: 12 }}
                width={30}
            />
            <Tooltip content={<CustomTooltip />} />
            
            <Area 
                yAxisId="temp"
                type="monotone" 
                dataKey="temp_c" 
                stroke="#38bdf8" 
                strokeWidth={3}
                fillOpacity={1} 
                fill="url(#colorTemp)" 
                animationDuration={500}
            />
             <Area 
                yAxisId="hum"
                type="monotone" 
                dataKey="hum_pct" 
                stroke="#60a5fa" 
                strokeWidth={2}
                strokeDasharray="5 5"
                fillOpacity={1} 
                fill="url(#colorHum)" 
                animationDuration={500}
            />
         </AreaChart>
       </ResponsiveContainer>
       
       {data.length === 0 && !loading && (
           <div className="absolute inset-0 flex items-center justify-center text-white/30">
               No data for this range
           </div>
       )}
    </div>
  );
}
