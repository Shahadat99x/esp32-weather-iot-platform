import { z } from 'zod';

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  // Allow either single key OR JSON map
  DEVICE_KEY: z.string().optional(),
  DEVICE_KEYS_JSON: z.string().optional(),
  RATE_LIMIT_MIN_INTERVAL_MS: z.coerce.number().default(2000),
  API_VERSION: z.string().default('0.4.0'),
}).refine(data => data.DEVICE_KEY || data.DEVICE_KEYS_JSON, {
  message: "Either DEVICE_KEY or DEVICE_KEYS_JSON must be set",
  path: ["DEVICE_KEY"],
});

type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  // In Next.js, process.env is populated at build time for public vars,
  // but for server-side vars we rely on runtime env.
  env = envSchema.parse(process.env);
} catch (err) {
  if (err instanceof z.ZodError) {
    console.error('❌ Invalid environment variables:', err.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }
  throw err;
}

export const SERVER_ENV = env;

/**
 * Helper to get device key for a specific device ID.
 * Returns null if not found.
 */
export function getDeviceKey(deviceId: string): string | null {
  // 1. Check multi-device map first
  if (SERVER_ENV.DEVICE_KEYS_JSON) {
    try {
      const keys = JSON.parse(SERVER_ENV.DEVICE_KEYS_JSON);
      if (keys[deviceId]) {
        return keys[deviceId];
      }
    } catch (e) {
      console.error("Failed to parse DEVICE_KEYS_JSON", e);
    }
  }
  
  // 2. Fallback to single shared key
  if (SERVER_ENV.DEVICE_KEY) {
    return SERVER_ENV.DEVICE_KEY;
  }

  return null;
}
