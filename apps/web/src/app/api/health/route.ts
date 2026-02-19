import { NextResponse } from 'next/server';
import { SERVER_ENV } from '@/lib/server/env';

export async function GET() {
  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    version: SERVER_ENV.API_VERSION,
  });
}
