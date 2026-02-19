import { NextRequest, NextResponse } from 'next/server';
import { ReadingPayloadSchema } from '@/lib/server/validate';
import { validateDeviceKey } from '@/lib/server/auth';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { supabaseAdmin } from '@/lib/server/supabase';

export async function POST(req: NextRequest) {
  try {
    // 1. Parse Body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } },
        { status: 400 }
      );
    }

    // 2. Validate Payload Shape (Zod)
    const payload = ReadingPayloadSchema.safeParse(body);
    if (!payload.success) {
      return NextResponse.json(
        { ok: false, error: { code: 'INVALID_PAYLOAD', details: payload.error.flatten() } },
        { status: 400 }
      );
    }
    const data = payload.data;
    const deviceId = data.device_id;

    // 3. Rate Limit
    if (!checkRateLimit(deviceId)) {
      return NextResponse.json(
        { ok: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
        { status: 429 }
      );
    }

    // 4. Authenticate
    const key = req.headers.get('x-device-key');
    if (!key || !validateDeviceKey(deviceId, key)) {
      return NextResponse.json(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or missing device key' } },
        { status: 401 }
      );
    }

    // 5. Data Normalization
    let failPct = data.fail_pct;
    if (failPct !== undefined && failPct <= 1 && failPct > 0) {
      failPct = failPct * 100;
    }

    // 6. DB Write - inserted_id will be returned
    const { data: inserted, error: readingError } = await supabaseAdmin
      .from('readings')
      .insert({
        device_id: deviceId,
        device_ts_ms: data.ts_ms,
        fw: data.fw,
        uptime_s: data.uptime_s,
        rssi: data.rssi,
        status: data.status,
        temp_c: data.temp_c,
        hum_pct: data.hum_pct,
        temp_avg: data.temp_avg,
        hum_avg: data.hum_avg,
        fail_pct: failPct,
        health: data.health,
        raw_json: body
      })
      .select('id')
      .single();

    if (readingError) {
      console.error('Reading insert failed:', readingError);
      return NextResponse.json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to save reading' } },
        { status: 500 }
      );
    }

    // 7. Update Last Seen (Fire and Forget)
    // We already validated deviceId exists in env (via auth check), so it's a known device.
    // Ideally we assume the device row exists. If not, we should probably create it.
    // Given the auth check passes, we know the device is "known" in our config.
    // So we can upsert strictly.
    /*
      Note: Since auth passed, 'deviceId' matches a key in our env variables.
      So we can treat this device as valid.
    */
    supabaseAdmin.from('devices').upsert({
      device_id: deviceId,
      last_seen_at: new Date().toISOString()
    }, { onConflict: 'device_id' }).then(({ error }) => {
      if (error) console.error('Background device upsert failed:', error);
    });

    return NextResponse.json({ ok: true, inserted_id: inserted.id });

  } catch (err) {
    console.error('Ingest error:', err);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Unknown error' } },
      { status: 500 }
    );
  }
}
