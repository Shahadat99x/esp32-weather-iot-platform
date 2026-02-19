'use client';

import { Reading } from '@/lib/types';
import { clsx } from 'clsx';
import { Cpu, Signal, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface DeviceHealthCardProps {
  reading: Reading | null;
}

export function DeviceHealthCard({ reading }: DeviceHealthCardProps) {
  if (!reading) return null;

  const { uptime_s, fail_pct, device_id, fw } = reading;

  // Format uptime
  const formatUptime = (sec: number | null | undefined) => {
    if (!sec) return '0s';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  return (
    <div className="w-full p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm flex flex-col gap-4 text-white">
      <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider flex items-center justify-between">
        <span>Device Status</span>
        <span className="text-[10px] bg-white/10 px-2 py-0.5 rounded text-white/70">{device_id}</span>
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
         <div className="flex flex-col gap-1">
            <span className="text-xs text-white/40 flex items-center gap-1"><Cpu size={12}/> Uptime</span>
            <span className="font-mono text-sm">{formatUptime(uptime_s)}</span>
         </div>
         
         <div className="flex flex-col gap-1">
            <span className="text-xs text-white/40 flex items-center gap-1">FW Version</span>
            <span className="font-mono text-sm">{fw ?? 'N/A'}</span>
         </div>
         
         <div className="flex flex-col gap-1">
            <span className="text-xs text-white/40 flex items-center gap-1">
                {fail_pct && fail_pct > 5 ? <AlertTriangle size={12} className="text-red-400"/> : <CheckCircle2 size={12} className="text-green-400"/>}
                Failure Rate
            </span>
            <span className={clsx("font-mono text-sm", (fail_pct ?? 0) > 5 ? "text-red-400" : "text-green-400")}>
                {fail_pct?.toFixed(1) ?? '0.0'}%
            </span>
         </div>
      </div>
    </div>
  );
}
