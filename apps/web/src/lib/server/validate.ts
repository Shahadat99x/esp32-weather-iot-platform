import { z } from 'zod';

export const ReadingPayloadSchema = z.object({
  device_id: z.string().min(1),
  fw: z.string().optional(),
  ts_ms: z.number().optional(),
  uptime_s: z.number().optional(),
  rssi: z.number().nullable().optional(),
  status: z.enum(['OK', 'WIFI_DOWN', 'SENSOR_FAIL', 'INIT']).or(z.string()).default('OK'), // Allow string fallback but prefer enum
  temp_c: z.number().nullable().optional(),
  hum_pct: z.number().nullable().optional(),
  temp_avg: z.number().nullable().optional(),
  hum_avg: z.number().nullable().optional(),
  fail_pct: z.number().min(0).optional(), // Can be 0..1 or 0..100, normalized later
  health: z.number().min(0).max(100).optional(),
});

export type ReadingPayload = z.infer<typeof ReadingPayloadSchema>;
