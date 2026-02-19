import { getDeviceKey } from './env';

/**
 * Validates that the provided key matches the stored key for the deviceId.
 */
export function validateDeviceKey(deviceId: string, keyProvided: string): boolean {
  if (!deviceId || !keyProvided) return false;
  
  const expectedKey = getDeviceKey(deviceId);
  
  // If no key is configured for this device (and no global key), deny access.
  if (!expectedKey) return false;
  
  return keyProvided === expectedKey;
}
