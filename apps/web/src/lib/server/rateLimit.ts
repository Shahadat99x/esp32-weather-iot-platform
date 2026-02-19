import { SERVER_ENV } from './env';

interface RateLimitEntry {
  lastRequest: number;
}

// Simple in-memory store.
// Note: In serverless (Vercel), this memory is ephemeral and may reset often.
// This is acceptable for a "best effort" simple rate limit.
// For strict enforcement, we'd need Redis or similar.
const memoryStore = new Map<string, RateLimitEntry>();

export function checkRateLimit(deviceId: string): boolean {
  const now = Date.now();
  const minInterval = SERVER_ENV.RATE_LIMIT_MIN_INTERVAL_MS;

  const entry = memoryStore.get(deviceId);
  
  if (entry) {
    const elapsed = now - entry.lastRequest;
    if (elapsed < minInterval) {
      return false; // Rate limited
    }
  }

  // Update store
  memoryStore.set(deviceId, { lastRequest: now });
  return true; // Allowed
}
