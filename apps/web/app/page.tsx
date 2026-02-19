'use client';

import { useState, useEffect, useCallback } from 'react';
import { DASHBOARD_CONFIG } from '@/config/dashboard';
import { Reading, LatestResponse, RangeResponse } from '@/lib/types';
import { NowCard } from '@/components/dashboard/NowCard';
import { MetricGrid } from '@/components/dashboard/MetricGrid';
import { LiveChart } from '@/components/dashboard/LiveChart';
import { DeviceHealthCard } from '@/components/dashboard/DeviceHealthCard';
import { getComfortLabel } from '@/lib/metrics/comfort';
import { Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  // State
  const [deviceId, setDeviceId] = useState(DASHBOARD_CONFIG.DEFAULT_DEVICE_ID);
  const [latest, setLatest] = useState<Reading | null>(null);
  const [history, setHistory] = useState<Reading[]>([]);
  const [rangeMinutes, setRangeMinutes] = useState(60); // Default 1h
  
  // Status
  const [loadingLatest, setLoadingLatest] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [lastUpdatedSeconds, setLastUpdatedSeconds] = useState(0);

  // --- Fetchers ---

  const fetchLatest = useCallback(async () => {
    try {
      // Allow overriding device_id from URL if needed (simple check on mount?)
      // For now just use state.
      const res = await fetch(`/api/latest?device_id=${deviceId}`);
      const json: LatestResponse = await res.json();
      
      if (json.ok && json.data) {
        setLatest(json.data);
        setError(null);
        
        // Offline check
        const now = Date.now();
        const created = new Date(json.data.created_at).getTime();
        const diff = now - created;
        const isOff = diff > DASHBOARD_CONFIG.OFFLINE_THRESHOLD_MS;
        setIsOffline(isOff);
        setLastUpdatedSeconds(Math.floor(diff / 1000));
        
      } else {
        // Only set error if we don't have stale data? Or show persistent error?
        // If 404/500, maybe device is down or API issue.
        if (json.error) console.error("Latest Error:", json.error);
      }
    } catch (e) {
      console.error("Fetch Latest Failed", e);
    } finally {
      setLoadingLatest(false);
    }
  }, [deviceId]);

  const fetchHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch(`/api/range?device_id=${deviceId}&minutes=${rangeMinutes}`);
      const json: RangeResponse = await res.json();
      
      if (json.ok && json.data) {
        setHistory(json.data);
      }
    } catch (e) {
      console.error("Fetch History Failed", e);
    } finally {
      setLoadingHistory(false);
    }
  }, [deviceId, rangeMinutes]);

  // --- Polling Effects ---

  // 1. Poll Latest (Fast)
  useEffect(() => {
    fetchLatest();
    const interval = setInterval(fetchLatest, DASHBOARD_CONFIG.POLL_INTERVAL_LATEST_MS);
    return () => clearInterval(interval);
  }, [fetchLatest]);

  // 2. Poll History (Slow) & On Range Change
  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, DASHBOARD_CONFIG.POLL_INTERVAL_CHART_MS);
    return () => clearInterval(interval);
  }, [fetchHistory]);
  
  // 3. Update "Seconds Ago" timer locally every second (for smooth UI)
  useEffect(() => {
    const timer = setInterval(() => {
      if (latest) {
         const diff = Date.now() - new Date(latest.created_at).getTime();
         setLastUpdatedSeconds(Math.floor(diff / 1000));
         // Update offline status locally too
         setIsOffline(diff > DASHBOARD_CONFIG.OFFLINE_THRESHOLD_MS);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [latest]);


  // --- Render ---

  // Initial Full Loading State (only if no data at all)
  if (loadingLatest && !latest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="animate-spin text-sky-500" size={48} />
      </div>
    );
  }

  return (
    <main className="min-h-screen p-4 md:p-8 bg-gradient-to-br from-zinc-900 via-zinc-900 to-black text-zinc-100 font-sans selection:bg-sky-500/30">
      
      <div className="max-w-5xl mx-auto flex flex-col gap-8">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
              Weather Station
            </h1>
            <p className="text-sm text-zinc-500 font-mono mt-1 flex items-center gap-2">
              ID: <span className="text-zinc-400">{deviceId}</span>
              {isOffline && <span className="text-red-500 flex items-center gap-1"><AlertTriangle size={12}/> Connection Lost</span>}
            </p>
          </div>
          
          <div className="flex gap-2 bg-zinc-800/50 p-1 rounded-lg backdrop-blur-sm border border-white/5">
            {DASHBOARD_CONFIG.RANGES.map(r => (
              <button
                key={r.label}
                onClick={() => setRangeMinutes(r.minutes)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  rangeMinutes === r.minutes 
                    ? 'bg-zinc-700 text-white shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {r.label}
              </button>
            ))}
             <button
                onClick={() => { fetchLatest(); fetchHistory(); }}
                className="px-3 py-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all border-l border-white/5 ml-1"
                title="Refresh Now"
              >
                <RefreshCw size={14} className={loadingHistory ? 'animate-spin' : ''} />
              </button>
          </div>
        </header>

        {/* Hero Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <NowCard 
              reading={latest} 
              loading={loadingLatest && !latest} 
              isOffline={isOffline}
              lastUpdatedSeconds={lastUpdatedSeconds} 
            />
             <div className="mt-6">
                 <MetricGrid reading={latest} />
             </div>
          </div>
          
          <div className="flex flex-col gap-6">
            <DeviceHealthCard reading={latest} />
            
            {/* Summary / Trend Mini Card? */}
            <div className="flex-1 min-h-[150px] p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-white/10 backdrop-blur-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 p-32 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none -mr-16 -mt-16" />
               <h3 className="text-sm font-medium text-white/50 uppercase tracking-widest mb-4">Daily Insight</h3>
               <p className="text-lg text-white/90">
                 Conditions are currently <span className="text-white font-bold">{getComfortLabel(latest?.temp_c || 0, latest?.hum_pct || 0).label}</span>. 
               </p>
               <p className="text-sm text-white/50 mt-2">
                 Temperature has been {latest?.status === 'OK' ? 'stable' : 'fluctuating'} over the last hour.
               </p>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <section>
          <div className="flex items-center justify-between mb-4 px-1">
             <h2 className="text-lg font-semibold text-white/80">Temperature & Humidity History</h2>
          </div>
          <LiveChart 
             data={history} 
             loading={loadingHistory} // Pass loading state if we want spinner
             rangeLabel={DASHBOARD_CONFIG.RANGES.find(r => r.minutes === rangeMinutes)?.label || '1h'} 
          />
        </section>

      </div>
    </main>
  );
}


