# Phase 1 — Real-Time Latency & Cadence Report

> **Date:** 2026-02-26
> **Author:** Instrumentation audit (automated)
> **Status:** Observation only — no behavioural changes applied

---

## 1. Firmware Read Interval

| Parameter          | Value              | File                                                                                            |
| ------------------ | ------------------ | ----------------------------------------------------------------------------------------------- |
| `READ_INTERVAL_MS` | **2 000 ms** (2 s) | [`config.h:14`](file:///w:/esp32-weather-iot-platform/firmware/esp32_weather_node/config.h#L14) |
| `READ_RETRIES`     | 2                  | `config.h:48`                                                                                   |
| `RETRY_DELAY_MS`   | 500 ms             | `config.h:45`                                                                                   |

**Worst-case single read cycle** = 2 s interval + (2 retries × 500 ms) = **3 s** on failure.

---

## 2. Firmware Post (Send) Interval

| Parameter              | Value              | File                                                                                            |
| ---------------------- | ------------------ | ----------------------------------------------------------------------------------------------- |
| `SEND_MIN_INTERVAL_MS` | **2 000 ms** (2 s) | [`config.h:28`](file:///w:/esp32-weather-iot-platform/firmware/esp32_weather_node/config.h#L28) |
| `HTTP_TIMEOUT_MS`      | 6 000 ms           | `config.h:29`                                                                                   |
| `OUTBOX_MAX`           | 50 payloads        | `config.h:30`                                                                                   |
| `FLUSH_MAX_PER_TICK`   | 3                  | `config.h:31`                                                                                   |

**Effective send cadence:** Every read cycle (2 s) the firmware builds a payload and either sends it directly or queues it in the outbox. The outbox is flushed up to 3 payloads per loop tick, subject to the 2 s minimum interval between sends.

**Send timing in code:** [`esp32_weather_node.ino:354-368`](file:///w:/esp32-weather-iot-platform/firmware/esp32_weather_node/esp32_weather_node.ino#L354-L368)

---

## 3. Timestamp Fields & DB Columns

| Field                 | Source                   | Description                                  |
| --------------------- | ------------------------ | -------------------------------------------- |
| `ts_ms` (payload)     | `millis()` on ESP32      | Monotonic uptime in ms at payload build time |
| `uptime_ms` (payload) | `millis()` on ESP32      | Same source as `ts_ms`                       |
| `device_ts_ms` (DB)   | Mapped from `ts_ms`      | Stored in `readings` table                   |
| `created_at` (DB)     | Supabase `now()` default | Server-side insert timestamp (UTC)           |

> **⚠ Key observation:** `ts_ms` is `millis()` — it is **not** an epoch timestamp. It counts milliseconds since boot, meaning `device_ts_ms` cannot be directly compared with `created_at` to measure true end-to-end latency. To get real wall-clock latency, we need either NTP sync on the device or to compare `received_at` (server time at request arrival) with `created_at`.

---

## 4. Dashboard Polling Intervals

| Config Key                | Value                | File                                                                                          |
| ------------------------- | -------------------- | --------------------------------------------------------------------------------------------- |
| `POLL_INTERVAL_LATEST_MS` | **1 000 ms** (1 s)   | [`dashboard.ts:3`](file:///w:/esp32-weather-iot-platform/apps/web/src/config/dashboard.ts#L3) |
| `POLL_INTERVAL_CHART_MS`  | **10 000 ms** (10 s) | [`dashboard.ts:4`](file:///w:/esp32-weather-iot-platform/apps/web/src/config/dashboard.ts#L4) |
| `OFFLINE_THRESHOLD_MS`    | 15 000 ms (15 s)     | `dashboard.ts:5`                                                                              |

**Polling code:** [`page.tsx:79-90`](file:///w:/esp32-weather-iot-platform/apps/web/src/app/page.tsx#L79-L90) — uses `setInterval` for both latest and chart history.

---

## 5. Caching Analysis

### Before Phase 1 Changes

- **`/api/latest`** had no explicit `Cache-Control` header and no `export const dynamic` directive.
- **Next.js 16 default** for Route Handlers: GET routes without dynamic segments may be statically cached at build time or by Vercel's CDN, potentially serving stale data.
- **`/api/ingest`** is a POST route — not cached by default.

### Phase 1 Fix Applied

- Added `export const dynamic = "force-dynamic"` to `latest/route.ts` to prevent static generation.
- Added `Cache-Control: no-store, no-cache, must-revalidate` response header.

---

## 6. End-to-End Latency Breakdown

```
 Device Read ──(2s)──▶ Build Payload ──(immediate)──▶ HTTP POST ──(~200-600ms)──▶ Server Receives
                                                                                        │
                                                                              Supabase INSERT (~50-200ms)
                                                                                        │
                                                                                        ▼
                                                                              created_at set (DB server time)
                                                                                        │
 Dashboard Poll ◀──(every 1s)── GET /api/latest ◀── Supabase SELECT (~50-100ms) ◀───────┘
```

### Estimated Best-Case Latency (device → dashboard)

| Segment                                | Estimate               |
| -------------------------------------- | ---------------------- |
| Read-to-send interval                  | 0 ms (sent same cycle) |
| HTTP POST round-trip (device → Vercel) | 200–600 ms             |
| Supabase INSERT                        | 50–200 ms              |
| Dashboard poll worst-case wait         | 0–1000 ms              |
| Supabase SELECT                        | 50–100 ms              |
| **Total best case**                    | **~300–1900 ms**       |

### Estimated Worst-Case Latency

- If outbox is backed up, a payload may wait `OUTBOX_MAX × SEND_MIN_INTERVAL_MS / FLUSH_MAX_PER_TICK` = ~33 s.
- If WiFi reconnects, add `WIFI_CONNECT_TIMEOUT_MS` (15 s) + retry backoff.
- If Next.js had cached `/api/latest` (pre-fix), stale data could persist indefinitely.

---

## 7. Bottleneck Conclusion

### Primary Bottleneck: **No true epoch timestamp from device**

- `ts_ms` is `millis()`, not wall-clock time. This makes it impossible to measure true device-to-cloud latency without NTP.

### Secondary Bottleneck: **Potential caching on `/api/latest`**

- **Fixed in Phase 1:** Added `force-dynamic` + `Cache-Control: no-store` headers.

### Tertiary Factor: **Outbox queue delays**

- If WiFi drops, payloads accumulate. When WiFi reconnects, the outbox flushes at most 3 per tick with 2 s intervals, so 50 queued payloads take ~33 s to drain.

### Not a Bottleneck:

- Dashboard polls every 1 s — already responsive enough for real-time.
- Firmware reads every 2 s — appropriate for DHT22 sensor minimum timing.

---

## 8. Recommended Phase 2 Targets

| Parameter                 | Current         | Recommended              | Reason                                                   |
| ------------------------- | --------------- | ------------------------ | -------------------------------------------------------- |
| `READ_INTERVAL_MS`        | 2 000 ms        | **2 000 ms** (keep)      | DHT22 min spec is ~2 s                                   |
| `SEND_MIN_INTERVAL_MS`    | 2 000 ms        | **2 000–5 000 ms**       | Tune based on Supabase free-tier rate limits             |
| `POLL_INTERVAL_LATEST_MS` | 1 000 ms        | **1 000–2 000 ms**       | 1 s is fine for demo; 2 s saves API calls                |
| `POLL_INTERVAL_CHART_MS`  | 10 000 ms       | **5 000–10 000 ms**      | Consider lowering for demo                               |
| NTP sync                  | ❌ None         | ✅ **Add**               | Enable real `device_ts_ms` epoch for latency measurement |
| Outbox drain strategy     | 3/tick, 2 s gap | Consider **burst drain** | Faster catch-up after WiFi reconnect                     |

---

## 9. How to Reproduce / Test

### 1. Run the ESP32 Device

Power on the ESP32 with the updated firmware. Open Serial Monitor at **115200 baud** and watch for:

```
[READ] millis=12000 ts_ms=12000 temp_c=23.5 hum_pct=55.0 ...
[SEND] millis_start=12001 millis_end=12350 duration_ms=349 status=200 payload_bytes=245 endpoint=https://... result=OK
[OUTBOX] millis=20000 pending=0 full=NO
```

### 2. Check Server Logs (Vercel / local `npm run dev`)

```bash
cd apps/web
npm run dev
```

Watch console output for:

```
[INGEST] device_id=esp32-lab-01 device_ts_ms=12000 rssi=-45 received_at=2026-02-26T11:32:00.000Z insert=OK inserted_id=abc123
[LATEST] device_id=esp32-lab-01 created_at=2026-02-26T11:32:00.123Z served_at=2026-02-26T11:32:01.456Z
```

### 3. Manual curl Test

```bash
# Simulate ingest
curl -X POST https://YOUR-DOMAIN/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-device-key: YOUR_KEY" \
  -d '{"device_id":"esp32-lab-01","ts_ms":99999,"fw_version":"0.2.0","uptime_ms":99999,"rssi":-50,"sensor":{"temp_c":22.0,"hum_pct":55.0,"temp_c_avg":22.0,"hum_pct_avg":55.0,"health_score":100}}'

# Fetch latest
curl "https://YOUR-DOMAIN/api/latest?device_id=esp32-lab-01" -v
# Look for Cache-Control: no-store header in response
```

---

## 10. Instrumentation Files Changed

| File                                                 | Change                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| `firmware/esp32_weather_node/esp32_weather_node.ino` | Added `[READ]`, `[SEND]`, `[OUTBOX]` structured logs               |
| `apps/web/src/app/api/ingest/route.ts`               | Added `[INGEST]` console.info log                                  |
| `apps/web/src/app/api/latest/route.ts`               | Added `[LATEST]` log + `force-dynamic` + `Cache-Control: no-store` |
