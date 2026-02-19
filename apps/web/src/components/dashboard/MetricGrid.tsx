'use client';

import { Reading } from '@/lib/types';
import { calculateDewPoint } from '@/lib/metrics/dewPoint';
import { CloudRain, Gauge, Activity, Radio } from 'lucide-react';

interface MetricGridProps {
  reading: Reading | null;
}

export function MetricGrid({ reading }: MetricGridProps) {
  if (!reading) return null;

  const { temp_c, hum_pct, rssi, health } = reading;
  const dewPoint = calculateDewPoint(temp_c ?? 0, hum_pct ?? 0);

  const metrics = [
    { label: 'Dew Point', value: `${dewPoint}°`, icon: CloudRain, color: 'text-cyan-400' },
    { label: 'Health Score', value: `${health ?? 100}%`, icon: Activity, color: 'text-emerald-400' },
    { label: 'Signal (RSSI)', value: `${rssi ?? -100} dBm`, icon: Radio, color: 'text-violet-400' },
    // Placeholder for pressure if we had it, or maybe uptime?
    { label: 'System Status', value: reading.status ?? 'OK', icon: Gauge, color: 'text-blue-400' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
      {metrics.map((m) => (
        <div key={m.label} className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm flex flex-col gap-1">
          <div className="flex items-center gap-2 text-white/50 text-xs font-medium uppercase tracking-wider">
            <m.icon size={14} className={m.color} /> {m.label}
          </div>
          <div className="text-xl md:text-2xl font-semibold text-white/90">
            {m.value}
          </div>
        </div>
      ))}
    </div>
  );
}
