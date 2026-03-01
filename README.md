# 🌤️ ESP32 Weather IoT Platform
*(ESP32 → Vercel API → Supabase → Next.js Dashboard)*

**Live Dashboard:** [wxlive.vercel.app](https://wxlive.vercel.app) | **Website:** [dhossain.com](https://dhossain.com) | **GitHub:** [shahadat99x](https://github.com/shahadat99x) | **LinkedIn:** [shahadat-ai](https://linkedin.com/in/shahadat-ai)

A production-ready IoT weather station platform that streams real-world sensor data from an ESP32 to a cloud pipeline and displays it in a premium, responsive Next.js dashboard.

This project emphasizes **reliability (outbox queue + reconnect drain)**, **freshness (no-cache APIs + live polling)**, and **observability (structured logs + latency measurement using NTP epoch time)**.

---

## ✨ Features

### Device / Firmware (ESP32)
* **DHT22** temperature + humidity readings.
* HTTPS posting to Vercel API (`/api/ingest`).
* **Outbox queue** for offline reliability (never lose readings).
* **Reconnect burst drain**: flush backlog quickly after Wi-Fi reconnect.
* **NTP time sync**: includes `ts_epoch_ms` + `time_synced` for latency measurement.
* Structured serial logs: `[TIME]`, `[CFG]`, `[READ]`, `[SEND]`, `[OUTBOX]`.

### Backend (Vercel + Next.js API routes)
* API endpoints: health, ingest, latest, range.
* **Nested payload mapping**: firmware sends nested sensor payload; backend maps into DB columns.
* **No caching** on real-time routes (`force-dynamic` + `Cache-Control: no-store`).
* Safe request validation (Zod).

### Data (Supabase)
* `readings` table with typed columns for fast queries.
* `raw_json` payload storage for audit/debug and forward compatibility.
* Range queries optimized for charts.

### Dashboard UI (Next.js)
* Premium responsive design (glass cards, clean states, mobile friendly).
* Live polling: latest data refresh (fast) + chart refresh (slower to reduce load).
* Offline detection with "Last updated Xs ago".

---

## 🏗 Architecture

### Flow
1. ESP32 reads sensors (DHT22).
2. ESP32 posts JSON payload to Vercel `/api/ingest` over HTTPS.
3. Vercel API validates + stores reading in Supabase.
4. Dashboard polls `/api/latest` for real-time cards and `/api/range` for history chart.

### Key Design Choices
* **Outbox-first** device design: network can fail, data remains consistent.
* **raw_json + typed columns**: best of both worlds (analytics + debuggability).
* **No-cache** endpoints for real-time UX on Vercel.

---

## 📦 Repo Structure

```text
esp32-weather-iot-platform/
├── apps/web/                    # Next.js (App Router) + API routes + UI
│   ├── src/app/api/             # health, ingest, latest, range
│   ├── src/app/page.tsx         # dashboard page (polling + freshness)
│   └── src/components/dashboard/# NowCard, MetricGrid, LiveChart, etc.
├── supabase/migrations/001_init.sql
├── firmware/esp32_weather_node/ # ESP32 Arduino firmware
│   ├── esp32_weather_node.ino
│   ├── config.h
│   ├── outbox.h
│   └── secrets.h.example
└── docs/                        # specs, architecture, runbook, decisions
```

---

## 🔌 Firmware Payload (Example)

```json
{
  "device_id": "esp32-lab-01",
  "fw_version": "0.2.0",
  "uptime_ms": 372370,
  "ts_ms": 372370,
  "ts_epoch_ms": 1740567890123,
  "time_synced": true,
  "rssi": -24,
  "sensor": {
    "temp_c": 31.8,
    "hum_pct": 23.4,
    "temp_c_avg": 31.2,
    "hum_pct_avg": 23.6,
    "health_score": 100
  }
}
```

---

## 🌐 API Endpoints

All routes live under `apps/web/src/app/api/*`.

### GET `/api/health`
Health check for deployment and monitoring.
```bash
curl -s [https://wxlive.vercel.app/api/health](https://wxlive.vercel.app/api/health)
```

### POST `/api/ingest`
Receives device payload and writes to Supabase.  
**Auth header:** `x-device-key: YOUR_KEY`
```bash
curl -X POST [https://wxlive.vercel.app/api/ingest](https://wxlive.vercel.app/api/ingest) \
  -H "Content-Type: application/json" \
  -H "x-device-key: YOUR_KEY" \
  -d '{
    "device_id":"esp32-lab-01",
    "ts_ms":99999,
    "ts_epoch_ms":1740567890123,
    "time_synced":true,
    "fw_version":"0.2.0",
    "uptime_ms":99999,
    "rssi":-50,
    "sensor":{
      "temp_c":22.0,
      "hum_pct":55.0,
      "temp_c_avg":22.0,
      "hum_pct_avg":55.0,
      "health_score":100
    }
  }'
```

### GET `/api/latest?device_id=esp32-lab-01`
Returns the latest reading. Served with `Cache-Control: no-store`.
```bash
curl -s "[https://wxlive.vercel.app/api/latest?device_id=esp32-lab-01](https://wxlive.vercel.app/api/latest?device_id=esp32-lab-01)"
```

### GET `/api/range?device_id=esp32-lab-01&minutes=60`
Returns recent readings within a time window. Used by the dashboard chart.
```bash
curl -s "[https://wxlive.vercel.app/api/range?device_id=esp32-lab-01&minutes=10](https://wxlive.vercel.app/api/range?device_id=esp32-lab-01&minutes=10)"
```

---

## 🚀 Local Development

### Web app (Next.js)
```bash
cd apps/web
npm install
npm run dev
```

**Environment variables** — create `apps/web/.env.local`:
* Supabase URL
* Supabase service role key (server-side only)
* Device ingest key

> 🚫 **Never commit `.env.local`.** Keep `secrets.h` out of Git.

### Lint & build (pre-push)
```bash
cd apps/web
npm run lint
npm run build
```

---

## 🧪 Measuring Real Latency (Supabase SQL)

```sql
SELECT
  created_at,
  (raw_json->>'ts_epoch_ms')::bigint AS device_epoch_ms,
  EXTRACT(EPOCH FROM created_at) * 1000 - (raw_json->>'ts_epoch_ms')::bigint AS latency_ms
FROM readings
WHERE raw_json->>'time_synced' = 'true'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🛡 Security Notes
* No secrets are stored in the repository.
* Firmware includes `secrets.h.example` only.
* Server uses environment variables for Supabase + device auth.
* Real-time endpoints are protected from caching.

---

## 🧰 Troubleshooting

**Dashboard feels delayed**
* Confirm `/api/latest` includes `Cache-Control: no-store` in response headers.
* Check dashboard polling intervals.
* Verify ESP32 `[SEND]` logs show frequent posts.

**Values show as null**
* Firmware sends nested fields under `sensor.*`.
* Confirm `/api/ingest` maps nested fields into DB columns.

**Wi-Fi drops cause gaps**
* Outbox buffers readings; reconnect flushes quickly.
* Check `[OUTBOX]` logs and burst drain behavior.

---

## 🗺 Roadmap
* [ ] Real-time streaming (SSE/WebSockets) instead of polling.
* [ ] Multi-device management UI.
* [ ] Alerts/notifications based on thresholds.
* [ ] Optional additional sensors (air quality, pressure, etc.).

---

## 📄 License
MIT
---

## 👤 Author
**Shahadat Hossain**
* 🌐 [dhossain.com](https://dhossain.com)
* 💻 [github.com/shahadat99x](https://github.com/shahadat99x)
* 🔗 [linkedin.com/in/shahadat-ai](https://linkedin.com/in/shahadat-ai)
