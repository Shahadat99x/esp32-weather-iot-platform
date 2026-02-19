# ESP32 Weather Node - Phase 2 (Wi-Fi Enabled)

## Overview

Phase 1 firmware for ESP32 Weather Node. Reads temperature and humidity from a DHT11/DHT22 sensor, validates readings, smooths data using a moving average, and outputs structured logs to Serial.

## Wiring (Default)

- **Sensor + (VCC)** -> ESP32 **3V3**
- **Sensor - (GND)** -> ESP32 **GND**
- **Sensor OUT (Data)** -> ESP32 **GPIO4**

## Configuration

Edit `firmware/esp32_weather_node/config.h` to change:

- `DHT_PIN`
- `DHT_TYPE` (DHT11 or DHT22)
- `READ_INTERVAL_MS`
- `READ_INTERVAL_MS`
- Validation ranges and smoothing window size

## Wi-Fi Setup (Phase 2)

1. Rename `firmware/esp32_weather_node/secrets.h.example` to `secrets.h`.
2. Edit `secrets.h` and enter your Hotspot SSID and Password.

> **Note**: `secrets.h` is ignored by git to protect your credentials.

## Running

1. Open `firmware/esp32_weather_node/esp32_weather_node.ino` in Arduino IDE.
2. Select Board: **DOIT ESP32 DEVKIT V1**
3. Select Port.
4. Upload.
5. Open Serial Monitor at **115200 baud**.

## Verification Checklist

### 1. Compilation

- Code must compile without errors for ESP32 DevKit V1.

### 2. Output Format

- Expected output (example):
  `ts_ms=2000 temp_c=24.5 hum_pct=60.2 temp_avg=24.5 hum_avg=60.2 reads=1 fails=0 fail_pct=0.0 health=100 rssi=-55`
- Every 10 ticks (approx 20s), a JSON payload should print:
  ```json
  { "device_id": "...", "fw_version": "0.2.0", "sensor": { ... } }
  ```

### 3. Fault Tolerance

- **Simulate Failure**: Disconnect the Data wire.
- **Expected result**: Serial prints "Read failed..." and retries.
- **Recovery**: Reconnect wire. Serial resumes printing valid data lines.

### 4. Stability Gate

- Run for **10 minutes**.
- Ensure **Fail Rate < 1%**.
