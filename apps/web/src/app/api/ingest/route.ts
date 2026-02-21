import { NextRequest, NextResponse } from 'next/server';
import { ReadingPayloadSchema } from '@/lib/server/validate';
import { validateDeviceKey } from '@/lib/server/auth';
import { checkRateLimit } from '@/lib/server/rateLimit';
import { supabaseAdmin } from '@/lib/server/supabase';
import { z } from 'zod';

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    // 1. Parse Body
    const body = await req.json();

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

    // 5. Data Normalization & Mapping
    const temp_c = body.sensor?.temp_c ?? body.temp_c ?? null;
    const hum_pct = body.sensor?.hum_pct ?? body.hum_pct ?? null;
    const temp_avg = body.sensor?.temp_c_avg ?? body.temp_avg ?? null;
    const hum_avg = body.sensor?.hum_pct_avg ?? body.hum_avg ?? null;
    const health = body.sensor?.health_score ?? body.health ?? null;
    const rssi = body.rssi ?? null;
    const fw = body.fw_version ?? body.fw ?? null;
    const uptime_s = body.uptime_s ?? (body.uptime_ms ? Math.floor(body.uptime_ms / 1000) : null);
    const status = body.status ?? "OK";

    // Normalize fail_pct to 0-100 if it's 0-1
    let failPct = body.fail_pct;
    if (failPct !== undefined && failPct <= 1 && failPct > 0) {
      failPct = failPct * 100;
    }

    // 6. DB Write - Devices Table (Upsert)
    // Update last_seen_at. If device doesn't exist, create it.
    const { error: deviceError } = await supabaseAdmin
      .from('devices')
      .upsert(
        { 
          device_id: deviceId,
          last_seen_at: new Date().toISOString(),
          // Don't overwrite name if it exists, but need to provide it for insert.
          // Upsert handling in Supabase with 'ignoreDuplicates' or just letting defaults handle it is tricky if we want to update one field but keep others.
          // Simple upsert here updates everything provided. We only provide keys + last_seen_at.
          // Wait, if we upsert with just device_id and last_seen_at, name might be null if new?
          // Default for name is 'New Device' in schema. So valid.
        },
        { onConflict: 'device_id' }
      );
    
    if (deviceError) {
      console.error('Device upsert failed:', deviceError);
      // We continue? Or fail? Best to fail if we strictly track devices.
      // But readings are more important. Let's try to insert reading anyway but log this.
    }

    // 7. DB Write - Readings Table
    const { data: inserted, error: readingError } = await supabaseAdmin
      .from('readings')
      .insert({
        device_id: deviceId,
        device_ts_ms: data.ts_ms,
        fw: fw,
        uptime_s: uptime_s,
        rssi: rssi,
        status: status,
        temp_c: temp_c,
        hum_pct: hum_pct,
        temp_avg: temp_avg,
        hum_avg: hum_avg,
        fail_pct: failPct,
        health: health,
        raw_json: body // Store full original payload
      })
      .select()
      .single();

    if (readingError) {
      console.error('Reading insert failed:', readingError);
      return NextResponse.json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to save reading' } },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, inserted_id: inserted.id });

  } catch (err) {
    console.error('Ingest error:', err);
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Unknown error processing request' } },
      { status: 500 }
    );
  }
}
