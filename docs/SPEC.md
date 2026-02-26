# Specifications

## Phase 1

- **Board**: DOIT ESP32 DEVKIT V1
- **Sensor**: DHT11/DHT22
- **Pinout**:
  - VCC -> 3V3
  - GND -> GND
  - DATA -> GPIO4
- **Serial**: 115200 baud
- **Output Format**: `ts_ms=<millis> temp_c=<raw> hum_pct=<raw> temp_avg=<avg> hum_avg=<avg> reads=<n> fails=<n> fail_pct=<pct>`
- **Interval**: 2000ms (default)

## Phase 2

- **Wi-Fi**:
  - Connection Timeout: 15s
  - Retry Backoff: 1s (base) -> 30s (max) exponential
- **Metadata**:
  - Device ID: `esp32-<mac_address_hex>`
  - FW Version: `0.2.0`
- **JSON Payload**:
  ```json
  {
    "device_id": "esp32-246f28xxxxxx",
    "fw_version": "0.2.0",
    "uptime_ms": 123456,
    "ts_ms": 123456,
    "ts_epoch_ms": 1740567890123,
    "time_synced": true,
    "rssi": -60,
    "sensor": {
      "temp_c": 24.5,
      "hum_pct": 60.0,
      "temp_c_avg": 24.4,
      "hum_pct_avg": 60.1,
      "health_score": 100
    }
  }
  ```

### Payload -> Database Mapping

| JSON Field            | DB Column (`readings`) | Type          | Notes                              |
| :-------------------- | :--------------------- | :------------ | :--------------------------------- |
| `device_id`           | `device_id`            | `text`        | Foreign Key                        |
| `fw_version`          | `fw`                   | `text`        |                                    |
| `uptime_ms`           | `uptime_s`             | `bigint`      | Convert ms -> s                    |
| `ts_ms`               | `device_ts_ms`         | `bigint`      | millis() monotonic                 |
| `ts_epoch_ms`         | _(raw_json only)_      | `bigint`      | Unix epoch ms (NTP). Phase 2 add.  |
| `time_synced`         | _(raw_json only)_      | `boolean`     | Whether NTP was obtained. Phase 2. |
| `rssi`                | `rssi`                 | `int`         |                                    |
| `sensor.temp_c`       | `temp_c`               | `real`        |                                    |
| `sensor.hum_pct`      | `hum_pct`              | `real`        |                                    |
| `sensor.temp_c_avg`   | `temp_avg`             | `real`        |                                    |
| `sensor.hum_pct_avg`  | `hum_avg`              | `real`        |                                    |
| `sensor.health_score` | `health`               | `int`         |                                    |
| `(whole json)`        | `raw_json`             | `jsonb`       |                                    |
| `(server time)`       | `created_at`           | `timestamptz` | Default `now()`                    |

## Phase 4 - Vercel API

### Endpoints

#### `POST /api/ingest`

- **Auth**: Header `x-device-key: <DEVICE_KEY>`
- **Payload**: JSON (see Phase 2)
- **Response**: `{ "ok": true, "inserted_id": 123 }` or error.

#### `GET /api/latest`

- **Params**: `device_id` (required)
- **Response**: JSON of latest reading fields.

#### `GET /api/range`

- **Params**: `device_id` (required), `from`/`to` (ISO) OR `minutes` (int)
- **Response**: `{ "ok": true, "data": [...] }`

#### `GET /api/health`

- **Response**: `{ "ok": true, "time": "...", "version": "..." }`

## Phase 5 - Firmware Integration

- **Protocol**: HTTPS POST (Insecure/No-Cert for Demo).
- **Retry Logic**:
  - Buffer up to 50 payloads in RAM (`settings.h: OUTBOX_MAX`).
  - Flush buffer when connected (FIFO).
  - Rate Limit: `SEND_MIN_INTERVAL_MS` (2s typically).
- **Error Handling**:
  - 429: Backoff.
  - 5xx: Retry.
- **Error Handling**:
  - 429: Backoff.
  - 5xx: Retry.
  - Network Fail: Buffer.

## Phase 6 - Public Dashboard

- **URL**: `/` (Public, No Auth).
- **Behavior**:
  - Refreshes "Now" data every 1s.
  - Refreshes "Chart" data every 10s.
  - Shows "Offline" if data > 15s old.
- **Query Params**:
  - `?device_id=<id>`: Override default device ID.
- **Derived Metrics**:
  - **Comfort**: Calculated from Temp/Hum.
  - **Feels Like**: Heat Index (if Hot+Humid).
  - **Dew Point**: Magnus Formula.
