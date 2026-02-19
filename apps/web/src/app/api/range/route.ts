import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get('device_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const minutes = searchParams.get('minutes');

  if (!deviceId) {
    return NextResponse.json(
      { ok: false, error: { code: 'MISSING_PARAM', message: 'device_id is required' } },
      { status: 400 }
    );
  }

  let query = supabaseAdmin
    .from('readings')
    .select('created_at, temp_c, hum_pct')
    .eq('device_id', deviceId)
    .order('created_at', { ascending: true })
    .limit(5000); // hard cap

  // Filter logic
  if (minutes) {
    const mins = parseInt(minutes, 10);
    if (!isNaN(mins) && mins > 0) {
      // created_at > now - minutes
      // Supabase filter for relative time is tricky with just .gt() unless we calculate ISO string.
      const cutoff = new Date(Date.now() - mins * 60 * 1000).toISOString();
      query = query.gt('created_at', cutoff);
    }
  } else if (from) {
    query = query.gte('created_at', from);
    if (to) {
      query = query.lte('created_at', to);
    }
  } else {
    // Default to last 1 hour if nothing specified? Or fail?
    // Requirement: "from and to ... OR minutes"
    return NextResponse.json(
      { ok: false, error: { code: 'MISSING_PARAM', message: 'Provide from/to OR minutes' } },
      { status: 400 }
    );
  }

  const { data, error } = await query;

  if (error) {
    console.error('Range fetch failed:', error);
    return NextResponse.json({ ok: false, error: { code: 'DB_ERROR', message: 'Database error' } }, { status: 500 });
  }

  return NextResponse.json({ ok: true, data: data || [] });
}
