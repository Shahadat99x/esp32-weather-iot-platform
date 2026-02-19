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

## Verification (Curl Tests)

### 1. Health Check

```bash
curl http://localhost:3000/api/health
# Expected: {"ok":true,"time":"...","version":"0.4.0"}
```

### 2. Ingest Data (Valid)

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
