export const DASHBOARD_CONFIG = {
  DEFAULT_DEVICE_ID: 'esp32-lab-01',
  POLL_INTERVAL_LATEST_MS: 1000,
  POLL_INTERVAL_CHART_MS: 10000,
  OFFLINE_THRESHOLD_MS: 15000, // 15s (if reading older than this -> offline)
  RANGES: [
    { label: '10m', minutes: 10 },
    { label: '1h', minutes: 60 },
    { label: '24h', minutes: 1440 },
  ]
};
