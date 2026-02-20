import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabase';

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('device_id');

  if (!deviceId) {
    return NextResponse.json(
      { ok: false, error: { code: 'MISSING_PARAM', message: 'device_id is required' } },
      { status: 400 }
    );
  }

  // Use admin client (service role) to read.
  // Ideally, validatate if the requester is allowed to read this device?
  // Requirements say "provide fast read APIs for the dashboard".
  // Phase 4 "No frontend UI" but "Supabase Phase 3 done... public read-only dashboard".
  // If the dashboard is public, then this API is public.
  // So we don't need auth here? Or do we?
  // User Prompt: "provide fast read APIs for the dashboard".
  // RLS says: "Public dashboard must be read-only (public SELECT)".
  // So this API should be public.

  const { data, error } = await supabaseAdmin
    .from('readings')
    .select('created_at, temp_c, hum_pct, status, health, rssi, fw, uptime_s')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    // .single() returns error if 0 rows
    if (error.code === 'PGRST116') { // No rows found
      return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'No data found' } }, { status: 404 });
    }
    console.error('Latest fetch failed:', error);
    return NextResponse.json({ ok: false, error: { code: 'DB_ERROR', message: 'Database error' } }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data });
}
