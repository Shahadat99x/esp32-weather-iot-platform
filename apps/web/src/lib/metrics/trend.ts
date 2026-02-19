export type Trend = 'rising' | 'falling' | 'stable';

/**
 * Determine trend based on last few readings.
 * Simple linear regression slope or just delta?
 * "Simple" -> Compare last with N-th last?
 */
export const calculateTrend = (data: { value: number }[]): Trend => {
  if (!data || data.length < 2) return 'stable';
  
  // Take last 5
  const recent = data.slice(-5);
  if (recent.length < 2) return 'stable';
  
  const first = recent[0].value;
  const last = recent[recent.length - 1].value;
  const diff = last - first;
  
  // Threshold?
  if (diff > 0.5) return 'rising';
  if (diff < -0.5) return 'falling';
  
  return 'stable';
};
