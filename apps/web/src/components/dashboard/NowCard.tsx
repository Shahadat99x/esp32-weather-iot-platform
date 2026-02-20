'use client';

import { Reading } from '@/lib/types';
import { getComfortLabel } from '@/lib/metrics/comfort';
import { calculateFeelsLike } from '@/lib/metrics/feelsLike';
import { Droplets, Thermometer, Wifi, WifiOff } from 'lucide-react';
import clsx from 'clsx';
import { DASHBOARD_CONFIG } from '@/config/dashboard';

interface NowCardProps {
  reading: Reading | null;
  loading: boolean;
  isOffline: boolean;
  lastUpdatedSeconds: number;
}

export function NowCard({ reading, loading, isOffline, lastUpdatedSeconds }: NowCardProps) {
  if (loading) {
    return (
      <div className="w-full h-64 rounded-2xl bg-white/10 backdrop-blur-md animate-pulse border border-white/20" />
    );
  }

  if (!reading) {
    return (
      <div className="w-full p-8 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 text-center text-gray-400">
        Waiting for data...
      </div>
    );
  }

  const { temp_c, hum_pct } = reading;
  const temp = temp_c ?? 0;
  const hum = hum_pct ?? 0;
  
  const comfort = getComfortLabel(temp, hum);
  const feelsLike = calculateFeelsLike(temp, hum);

  return (
    <div className="relative w-full p-6 md:p-8 rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden text-white ring-1 ring-white/5">
      {/* Background Glow */}
      <div className={clsx(
        "absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none",
        comfort.color.replace('text-', 'bg-')
      )} />

      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        
        {/* Main Temp */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className={clsx("px-3 py-1 rounded-full text-sm font-medium bg-black/20 backdrop-blur-sm border border-white/10", comfort.color)}>
              {comfort.label}
            </span>
            {isOffline && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-500/20 text-red-200 border border-red-500/30 flex items-center gap-1">
                <WifiOff size={14} /> Offline
              </span>
            )}
             {!isOffline && (
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-200 border border-green-500/30 flex items-center gap-1">
                 <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> Live
              </span>
            )}
          </div>
          
          <div className="flex items-start">
            <span className="text-7xl md:text-9xl font-bold tracking-tighter">
              {temp.toFixed(1)}
            </span>
            <span className="text-3xl md:text-5xl font-light text-white/60 mt-2 md:mt-4">°C</span>
          </div>
          
          <div className="text-white/60 text-sm mt-1">
            Feels like {feelsLike.toFixed(1)}°
          </div>
        </div>

        {/* Humidity Block */}
        <div className="flex flex-col gap-4 min-w-[140px]">
          <div className="p-4 rounded-xl bg-black/20 border border-white/10 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-white/60 text-sm mb-1">
              <Droplets size={16} /> Humidity
            </div>
            <div className="text-3xl font-semibold">
              {hum.toFixed(1)}<span className="text-lg font-light text-white/50">%</span>
            </div>
          </div>

          <div className="text-right text-xs text-white/40">
            Updated {lastUpdatedSeconds}s ago
          </div>
        </div>
      </div>
    </div>
  );
}
