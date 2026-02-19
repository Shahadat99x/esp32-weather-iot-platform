# Decisions Log

## Phase 1

- **Smoothing**: Using a simple ring buffer moving average. Window size configurable.
- **Validation**:
  - Humidity: 0-100%
  - Temperature: -10 to 60°C (reasonable range for ambient weather)
- **Retry**: 2 retries on failure before giving up for the cycle.

## Phase 1.1 - Firmware Upgrade

- **Calibration**: Applied simple additive offsets in `config.h`.
  - Justification: Allow field correction without re-flashing logic, just config.
- **Health Score**:
  - Window: Last 50 reads (approx 100 seconds at 2s interval).
  - Score: 100 - (bad_events / window_size \* 100).
  - Bad Events: Sensor read failure, Out-of-range value, or Jitter > `JITTER_TEMP_C`.
- **Pin Safety**:
  - Default is GPIO 4 (Safe).
  - Added comments warning against strap pins (0, 2, 12, 15) to prevent boot issues.

## Phase 2 - Wi-Fi & Metadata

- **Wi-Fi Strategy**:
  - Non-blocking state machine (DISCONNECTED -> CONNECTING -> CONNECTED).
  - Exponential backoff (1s -> 30s) to save power and reduce log spam on failure.
  - No "WiFiManager" library used yet (Phase 2 constraint: simple hotspot SSID/PASS).
- **Device ID**:
  - Using `ESP.getEfuseMac()` formatted as `esp32-<hex>`.
  - Justification: Guaranteed unique per board, no config needed.
- **JSON Payload**:
  - Manual string concatenation.
  - Justification: ArduinoJson is great but for this simple flat structure, raw string is lighter and fewer deps.

## Phase 3 - Database

- **RLS Strategy**:
  - Public Dashboard -> `anon` read-only access via `public_readings` view.
  - Justification: Views allow precise column selection (hiding raw_json) and device filtering (active only).
  - Writes -> `service_role` (backend) only. No direct client writes.
- **Indexes**:
  - `(device_id, created_at desc)`: Critical for "latest reading" and time-series charts.
  - `(created_at desc)`: For global admin or aggregate queries.
- **Partitioning**:
  - Not implemented yet.
  - Justification: Postgres handles millions of rows fine. Will add partitioning (pg_partman) later if scale demands.

## Phase 4 - Vercel API

- **Auth**: `x-device-key` header.
  - Justification: Simple, effective for IoT. Mutual TLS is overkill for Phase 4.
  - Secret Management: Environment variables `DEVICE_KEY` (shared) or `DEVICE_KEYS_JSON` (per device).
- **Validation**: Zod.
  - Justification: Runtime type safety, easy schema definition.
- **Rate Limiting**: In-memory (Map).
  - Justification: "Good enough" for Vercel functions (lambda). Truly distributed rate limiting (Redis) is Phase 7/Optimization territory.
- **Fail % Normalization**:
  - If 0..1, multiply by 100.
  - Justification: DB stores 0..100 for consistency with humidity.

## Phase 5 - ESP32 Integration

- **TLS Strategy**: `client.setInsecure()`.
  - Justification: MVP/Demo phase. Avoids complexity of root CA management on ESP32 (SPIFFS/Hardcoding).
  - Tradeoff: Vulnerable to MITM, but acceptable for non-critical weather data in this phase.
- **Outbox**: In-memory Ring Buffer.
  - Justification: Simple, fast. Data loss on power cycle, but acceptable for this use case. Use SPIFFS/Preferences if persistence needed later.

## Phase 6 - Dashboard

- **Polling Strategy**:
  - 1s for "Latest" (Hero Card).
  - 10s for "History" (Chart).
  - Justification: "Real-time" feel for hero, reduces API load for heavy range queries.
- **Client-Side Calc**:
  - Derived metrics (Dew Point, Feels Like) calculated in browser.
  - Justification: Reduces backend complexity and payload size.
- **Offline Threshold**: 15s.
  - Justification: > 10s implies standard polling missed or network glitch. Clear indicator for user.
