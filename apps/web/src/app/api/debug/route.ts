import { NextResponse } from 'next/server';
import { SERVER_ENV } from '@/lib/server/env';

export async function GET(req: Request) {
  // Only allow in development OR if x-debug-key matches (if we had one)
  // For now, just check NODE_ENV
  const isDev = process.env.NODE_ENV !== 'production';
  
  // Optional: Add a secret key check if you want to run this in prod securely
  const url = new URL(req.url);
  const key = url.searchParams.get('key');
  const isAuthorized = isDev || key === process.env.DEVICE_KEY;

  if (!isAuthorized) {
    return NextResponse.json({ ok: false, error: 'Forbiden' }, { status: 403 });
  }

  return NextResponse.json({
    ok: true,
    env: {
      hasSupabaseUrl: !!process.env.SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasDeviceKey: !!process.env.DEVICE_KEY,
      nodeEnv: process.env.NODE_ENV,
      apiVersion: SERVER_ENV.API_VERSION,
    }
  });
}
