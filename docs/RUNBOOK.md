# Runbook

## Local Development (Vercel API)

### Prerequisites

- Node.js 18+
- Supabase Project (URL + Service Role Key)

### 1. Environment Setup

Create `.env.local` in `apps/web`:

```bash
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key-starts-with-ey..."
DEVICE_KEY="secret-123"
# OR
DEVICE_KEYS_JSON='{"esp32-lab-01": "secret-123"}'
RATE_LIMIT_MIN_INTERVAL_MS=1000
```

### 2. Run Server

```bash
cd apps/web
npm run dev
# API running at http://localhost:3000/api/...
```

## Production Verification (Curl Tests)

### 1. Health Check

```bash
curl https://wxlive.vercel.app/api/health
# Expected: {"ok":true,"time":"...","version":"0.4.0"}
```

### 2. Fetch Latest

```bash
curl "https://wxlive.vercel.app/api/latest?device_id=esp32-lab-01"
# Expected: {"ok":true,"data":{...}}
```

### 3. Fetch Range

```bash
curl "https://wxlive.vercel.app/api/range?device_id=esp32-lab-01&minutes=10"
# Expected: {"ok":true,"data":[...]}
```

### 4. Ingest Data (Flat Payload Template)

```bash
curl -X POST https://wxlive.vercel.app/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-device-key: your_device_key_here" \
  -d '{
    "device_id": "esp32-lab-01",
    "ts_ms": 10000,
    "uptime_s": 10,
    "temp_c": 25.5,
    "hum_pct": 60.0,
    "status": "OK"
  }'
# Expected: {"ok":true,"inserted_id":...}
```

### 5. Ingest Data (Nested Payload - ESP32 Firmware)

```bash
curl -X POST https://wxlive.vercel.app/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-device-key: your_device_key_here" \
  -d '{
    "device_id": "esp32-lab-01",
    "fw_version": "0.2.0",
    "uptime_ms": 159564,
    "ts_ms": 159564,
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
  }'
# Expected: {"ok":true,"inserted_id":...}
```

## Local Verification (Curl Tests)

### 1. Health Check

```bash
curl http://localhost:3000/api/health
# Expected: {"ok":true,"time":"...","version":"0.4.0"}
```

### 2. Ingest Data (Valid Flat Payload)

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-device-key: secret-123" \
  -d '{
    "device_id": "esp32-lab-01",
    "ts_ms": 10000,
    "uptime_s": 10,
    "temp_c": 25.5,
    "hum_pct": 60.0,
    "status": "OK"
  }'
# Expected: {"ok":true,"inserted_id":...}
```

### 3. Ingest Data (Valid Nested Payload)

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-device-key: secret-123" \
  -d '{
    "device_id": "esp32-lab-01",
    "fw_version": "0.2.0",
    "uptime_ms": 159564,
    "ts_ms": 159564,
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
  }'
# Expected: {"ok":true,"inserted_id":...}
```

### Latency Computation (Phase 2)

With `ts_epoch_ms` (NTP) and `created_at` (DB), compute end-to-end latency:

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

### 3. Auth Failure

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"device_id": "esp32-lab-01"}'
# Expected: 401 Unauthorized
```

### 4. Validation Failure

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -H "x-device-key: secret-123" \
  -d '{"device_id": "esp32-lab-01", "temp_c": "invalid"}'
# Expected: 400 Bad Request
```

### 5. Fetch Latest

```bash
curl "http://localhost:3000/api/latest?device_id=esp32-lab-01"
# Expected: {"ok":true,"data":{...}}
```

### 6. Fetch Range

```bash
curl "http://localhost:3000/api/range?device_id=esp32-lab-01&minutes=10"
# Expected: {"ok":true,"data":[...]}

## ESP32 Firmware Verification (Phase 5)

### 1. Setup
- Ensure `secrets.h` has correct Wi-Fi and API details.
- Flash firmware to ESP32.
- Open Serial Monitor at 115200 baud.

### 2. Expected Logs (Normal Operation)
```

WiFi: Connected!
...
JSON Payload Preview
...
HTTP: Success (200) 120ms

```

### 3. Queue & Offine Test
1. Turn off Hotspot (Simulate outage).
2. Observe logs:
```

WiFi: Connection Timeout.
Buffered payload.
WiFi: Retrying in ...

```
3. Turn on Hotspot.
4. Observe logs:
```

WiFi: Connected!
HTTP: Success (200) ... (Flushing)
HTTP: Success (200) ... (Flushing)

```

### 4. Error Cases
- **401 Unauthorized**: Check `DEVICE_KEY` in `secrets.h`.
- **429 Rate Limited**: Sending too fast? Check `SEND_MIN_INTERVAL_MS`.
```

HTTP: Error (429) Rate Limited!

````

## Dashboard Verification (Phase 6)

### 1. Run Locally
```bash
cd apps/web
npm run dev
# Open http://localhost:3000
````

### 2. Verify Features

- **Live Data**: "Now" card should update every second.
- **Chart**: Toggle 10m / 1h / 24h.
- **Offline Mode**:
  - Stop ESP32.
  - Wait 15s.
  - Badge should turn RED ("Offline").
- **Responsiveness**: Resize browser to mobile width. Layout should stack.

```

```
