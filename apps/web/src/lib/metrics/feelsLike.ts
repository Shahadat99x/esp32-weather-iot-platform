/**
 * Calculate "Feels Like" temperature.
 * Uses Heat Index if temp >= 27C and humidity >= 40%.
 * Otherwise returns actual temp.
 */
export const calculateFeelsLike = (temp: number, hum: number): number => {
  if (temp == null) return 0;
  
  // Heat Index threshold
  if (temp >= 27 && hum >= 40) {
    // Simplified Rothfusz regression
    const c1 = -8.78469475556;
    const c2 = 1.61139411;
    const c3 = 2.33854883889;
    const c4 = -0.14611605;
    const c5 = -0.012308094;
    const c6 = -0.0164248277778;
    const c7 = 0.002211732;
    const c8 = 0.00072546;
    const c9 = -0.000003582;
    
    // Formula calls for T in Celsius? No, usually Fahrenheit.
    // Standard HI formula is Fahrenheit based.
    // Let's use a simpler approximation for Celsius or convert.
    // Convert to F
    const T = (temp * 9/5) + 32;
    const R = hum;
    
    let HI = 0.5 * (T + 61.0 + ((T-68.0)*1.2) + (R*0.094));
    
    if (HI > 80) {
      HI = -42.379 + 2.04901523*T + 10.14333127*R - 0.22475541*T*R - 0.00683783*T*T - 0.05481717*R*R + 0.00122874*T*T*R + 0.00085282*T*R*R - 0.00000199*T*T*R*R;
    }
    
    // Convert back to C
    return Math.round(((HI - 32) * 5/9) * 10) / 10;
  }
  
  return temp;
};
