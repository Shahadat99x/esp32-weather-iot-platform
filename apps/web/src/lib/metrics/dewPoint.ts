/**
 * Calculate Dew Point using Magnus formula
 * Ts = (b * alpha(T,RH)) / (a - alpha(T,RH))
 * alpha(T,RH) = ln(RH/100) + (a*T)/(b+T)
 * a = 17.625, b = 243.04
 */
export const calculateDewPoint = (temp: number, hum: number): number => {
  if (temp == null || hum == null) return 0;
  
  const a = 17.625;
  const b = 243.04;
  
  const alpha = Math.log(hum / 100) + ((a * temp) / (b + temp));
  const dewPoint = (b * alpha) / (a - alpha);
  
  return Math.round(dewPoint * 10) / 10;
};
