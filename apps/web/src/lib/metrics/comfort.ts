export type ComfortLevel = 'Comfortable' | 'Dry' | 'Muggy' | 'Cold' | 'Hot' | 'Normal';

export const getComfortLabel = (temp: number, hum: number): { label: ComfortLevel; color: string } => {
  if (temp < 18) return { label: 'Cold', color: 'text-blue-400' };
  if (temp > 30) return { label: 'Hot', color: 'text-red-500' };
  
  if (hum < 35) return { label: 'Dry', color: 'text-amber-400' };
  if (hum > 65 && temp > 24) return { label: 'Muggy', color: 'text-orange-500' };
  
  if (temp >= 18 && temp <= 26 && hum >= 35 && hum <= 60) {
    return { label: 'Comfortable', color: 'text-green-400' };
  }
  
  return { label: 'Normal', color: 'text-gray-400' };
};
