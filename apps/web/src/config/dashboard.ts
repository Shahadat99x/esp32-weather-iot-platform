// Dashboard configuration with demo mode support.
// Demo mode: ?demo=1 in URL or NEXT_PUBLIC_DEMO_MODE=1 env var.

const isDemoMode = (): boolean => {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === '1') return true;
  }
  return process.env.NEXT_PUBLIC_DEMO_MODE === '1';
};

export const DASHBOARD_CONFIG = {
  DEFAULT_DEVICE_ID: 'esp32-lab-01',

  // Polling intervals (ms)
  get POLL_INTERVAL_LATEST_MS() {
    return isDemoMode() ? 2000 : 5000;
  },
  get POLL_INTERVAL_CHART_MS() {
    return 10000; // 10s for both modes (chart doesn't need 1s refresh)
  },

  // Offline detection
  get OFFLINE_THRESHOLD_MS() {
    return isDemoMode() ? 10000 : 60000; // Demo: 10s, Normal: 60s
  },

  // Time ranges for chart
  RANGES: [
    { label: '10m', minutes: 10 },
    { label: '1h', minutes: 60 },
    { label: '24h', minutes: 1440 },
  ],
};
