export interface Reading {
  // DB Fields
  id?: number;
  device_id: string;
  created_at: string; // ISO string
  device_ts_ms?: number | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw_json?: Record<string, any> | null;
  
  // Sensor Data
  temp_c: number | null;
  hum_pct: number | null;
  temp_avg?: number | null;
  hum_avg?: number | null;
  
  // Metadata
  rssi?: number | null;
  uptime_s?: number | null;
  fw?: string | null;
  status?: string;
  health?: number;
  fail_pct?: number;
}

export interface LatestResponse {
  ok: boolean;
  data?: Reading;
  error?: {
    code: string;
    message: string;
  };
}

export interface RangeResponse {
  ok: boolean;
  data?: Reading[];
  error?: {
    code: string;
    message: string;
  };
}

export interface HealthResponse {
  ok: boolean;
  time: string;
  version: string;
}
