#include <DHT.h>
#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <time.h>

#include "config.h"
#include "outbox.h"

#if __has_include("secrets.h")
#include "secrets.h"
#else
#error "Missing secrets.h. Copy secrets.h.example -> secrets.h and fill values."
#endif

// DHT sensor
DHT dht(DHT_PIN, DHT_TYPE);

// -------------------- WiFi State Machine --------------------
enum WiFiState {
  WIFI_DISCONNECTED_STATE,
  WIFI_CONNECTING_STATE,
  WIFI_CONNECTED_STATE
};

static WiFiState wifiState = WIFI_DISCONNECTED_STATE;
static unsigned long wifiConnectStartTime = 0;
static unsigned long wifiRetryDelay = WIFI_RETRY_BASE_DELAY_MS;
static unsigned long lastWifiRetryTime = 0;
static unsigned long lastWifiStatusLogTime = 0;

// -------------------- NTP Time --------------------
static bool ntpSynced = false;
static unsigned long ntpLastAttemptMs = 0;

// -------------------- Outbox --------------------
static Outbox outbox;
static unsigned long lastSendTime = 0;
static unsigned long lastOutboxLogTime = 0;

// -------------------- Burst Drain --------------------
static bool burstDrainActive = false;
static unsigned long burstDrainStartMs = 0;

// -------------------- Smoothing Ring Buffers --------------------
static float tempBuffer[SMOOTHING_WINDOW];
static float humBuffer[SMOOTHING_WINDOW];
static int bufferIndex = 0;
static bool bufferFull = false;

// -------------------- Stats --------------------
static unsigned long lastReadTime = 0;
static unsigned long readCount = 0;
static unsigned long failCount = 0;
static unsigned long ticksSincePayloadLog = 0;

// -------------------- Health --------------------
static float lastTemp = NAN;
static int healthWindowIndex = 0;
static uint8_t healthHistory[HEALTH_WINDOW];

// -------------------- Helpers --------------------
static String getDeviceId() {
#ifdef DEVICE_ID_FIXED
  return String(DEVICE_ID_FIXED); // dashboard default
#else
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  mac.toLowerCase();
  return String(DEVICE_ID_PREFIX) + mac;
#endif
}

static unsigned long getUptimeMs() { return millis(); }

// -------------------- NTP --------------------
static void attemptNtpSync() {
  unsigned long now = millis();
  ntpLastAttemptMs = now;

  Serial.println("[TIME] sync_attempt=START");
  configTime(0, 0, NTP_SERVER_1, NTP_SERVER_2);

  // Wait up to NTP_SYNC_TIMEOUT_MS for time to be set
  unsigned long deadline = now + NTP_SYNC_TIMEOUT_MS;
  struct tm timeinfo;
  while (millis() < deadline) {
    if (getLocalTime(&timeinfo, 100)) {
      // Year > 2020 means we got a real time
      if (timeinfo.tm_year > (2020 - 1900)) {
        ntpSynced = true;
        time_t epochSec = mktime(&timeinfo);
        Serial.print("[TIME] synced=YES epoch_s=");
        Serial.print((unsigned long)epochSec);
        Serial.print(" utc=");
        Serial.println(asctime(&timeinfo));
        return;
      }
    }
    delay(100);
  }

  Serial.println("[TIME] synced=NO (timeout)");
}

// Returns epoch milliseconds if NTP synced, or 0 if not
static unsigned long long getEpochMs() {
  if (!ntpSynced)
    return 0;
  struct timeval tv;
  gettimeofday(&tv, NULL);
  return (unsigned long long)tv.tv_sec * 1000ULL +
         (unsigned long long)(tv.tv_usec / 1000);
}

static void updateWiFi(unsigned long nowMs) {
  switch (wifiState) {
  case WIFI_DISCONNECTED_STATE: {
    if (nowMs - lastWifiRetryTime >= wifiRetryDelay) {
      Serial.print("WiFi: connecting to ");
      Serial.println(WIFI_SSID);

      WiFi.begin(WIFI_SSID, WIFI_PASS);
      wifiConnectStartTime = nowMs;
      wifiState = WIFI_CONNECTING_STATE;
    }
    break;
  }

  case WIFI_CONNECTING_STATE: {
    wl_status_t st = WiFi.status();
    if (st == WL_CONNECTED) {
      wifiState = WIFI_CONNECTED_STATE;
      wifiRetryDelay = WIFI_RETRY_BASE_DELAY_MS;

      Serial.println("WiFi: connected");
      Serial.print("WiFi: ip=");
      Serial.println(WiFi.localIP());
      Serial.print("WiFi: rssi=");
      Serial.println(WiFi.RSSI());

      // Phase 2: NTP sync on connect/reconnect
      if (!ntpSynced) {
        attemptNtpSync();
      }

      // Phase 2: Activate burst drain if outbox has items
      Serial.println("[NET] wifi_reconnected=YES");
      if (!outbox.isEmpty()) {
        burstDrainActive = true;
        burstDrainStartMs = millis();
        Serial.print("[OUTBOX] drain_mode=ON pending=");
        Serial.println(outbox.size());
      }
    } else if (nowMs - wifiConnectStartTime >= WIFI_CONNECT_TIMEOUT_MS) {
      Serial.println("WiFi: connect timeout");
      WiFi.disconnect(true, true);

      wifiState = WIFI_DISCONNECTED_STATE;
      lastWifiRetryTime = nowMs;

      wifiRetryDelay *= 2;
      if (wifiRetryDelay > WIFI_RETRY_MAX_DELAY_MS)
        wifiRetryDelay = WIFI_RETRY_MAX_DELAY_MS;

      Serial.print("WiFi: retry in ");
      Serial.print(wifiRetryDelay / 1000);
      Serial.println("s");
    }
    break;
  }

  case WIFI_CONNECTED_STATE: {
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi: lost connection");
      wifiState = WIFI_DISCONNECTED_STATE;
      lastWifiRetryTime = nowMs;
      wifiRetryDelay = WIFI_RETRY_BASE_DELAY_MS;
    }
    break;
  }
  }

  // periodic status log
  if (nowMs - lastWifiStatusLogTime >= WIFI_STATUS_LOG_INTERVAL_MS) {
    lastWifiStatusLogTime = nowMs;
    if (wifiState == WIFI_CONNECTING_STATE) {
      Serial.println("WiFi: status=CONNECTING");
    } else if (wifiState == WIFI_CONNECTED_STATE) {
      Serial.print("WiFi: rssi=");
      Serial.println(WiFi.RSSI());
    }
  }
}

static String buildJsonPayload(float temp, float hum, float tempAvg,
                               float humAvg, int healthScore) {
  if (isnan(temp))
    temp = 0;
  if (isnan(hum))
    hum = 0;
  if (isnan(tempAvg))
    tempAvg = 0;
  if (isnan(humAvg))
    humAvg = 0;

  String rssiVal =
      (wifiState == WIFI_CONNECTED_STATE) ? String(WiFi.RSSI()) : "null";

  // Phase 2: epoch timestamp
  unsigned long long epochMs = getEpochMs();
  String epochMsStr = (epochMs > 0)
                          ? String((unsigned long)(epochMs / 1000)) +
                                String((unsigned long)(epochMs % 1000))
                          : "0";
  // Proper uint64 to string
  if (epochMs > 0) {
    char buf[21];
    snprintf(buf, sizeof(buf), "%llu", epochMs);
    epochMsStr = String(buf);
  }

  String json = "{";
  json += "\"device_id\":\"" + getDeviceId() + "\",";
  json += "\"fw_version\":\"" + String(FW_VERSION) + "\",";
  json += "\"uptime_ms\":" + String(getUptimeMs()) + ",";
  json += "\"ts_ms\":" + String(millis()) + ",";
  json += "\"ts_epoch_ms\":" + epochMsStr + ",";
  json += "\"time_synced\":" + String(ntpSynced ? "true" : "false") + ",";
  json += "\"rssi\":" + rssiVal + ",";
  json += "\"sensor\":{";
  json += "\"temp_c\":" + String(temp, 1) + ",";
  json += "\"hum_pct\":" + String(hum, 1) + ",";
  json += "\"temp_c_avg\":" + String(tempAvg, 1) + ",";
  json += "\"hum_pct_avg\":" + String(humAvg, 1) + ",";
  json += "\"health_score\":" + String(healthScore);
  json += "}";
  json += "}";
  return json;
}

static bool sendPayload(const String &json) {
  if (wifiState != WIFI_CONNECTED_STATE)
    return false;

  WiFiClientSecure client;
  client.setInsecure(); // demo mode
  uint16_t timeoutSec = (uint16_t)(HTTP_TIMEOUT_MS / 1000);
  if (timeoutSec < 1)
    timeoutSec = 1;
  client.setTimeout(timeoutSec);

  HTTPClient http;
  if (!http.begin(client, INGEST_URL)) {
    Serial.println("HTTP: begin failed");
    return false;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-device-key", DEVICE_KEY);

  unsigned long sendStartMs = millis();
  int code = http.POST(json);
  unsigned long sendEndMs = millis();
  unsigned long dur = sendEndMs - sendStartMs;

  bool ok = false;

  // Phase 1 instrumentation: [SEND] log
  Serial.print("[SEND] millis_start=");
  Serial.print(sendStartMs);
  Serial.print(" millis_end=");
  Serial.print(sendEndMs);
  Serial.print(" duration_ms=");
  Serial.print(dur);
  Serial.print(" status=");
  Serial.print(code);
  Serial.print(" payload_bytes=");
  Serial.print(json.length());
  Serial.print(" endpoint=");
  Serial.print(INGEST_URL);

  if (code > 0) {
    if (code >= 200 && code < 300) {
      Serial.println(" result=OK");
      ok = true;
    } else {
      Serial.println(" result=FAIL");

      if (code == 401 || code == 403)
        Serial.println("HTTP: auth failed (DEVICE_KEY?)");
      if (code == 429)
        Serial.println("HTTP: rate limited");
      if (code >= 500)
        Serial.println("HTTP: server error");
    }
  } else {
    Serial.print(" result=CONN_ERROR error=");
    Serial.println(http.errorToString(code).c_str());
  }

  http.end();
  return ok;
}

static void handleOutbox(unsigned long nowMs) {
  if (wifiState != WIFI_CONNECTED_STATE)
    return;

  // Phase 2: Check burst drain timeout
  if (burstDrainActive) {
    if (outbox.isEmpty() ||
        (nowMs - burstDrainStartMs >= BURST_DRAIN_TIMEOUT_MS)) {
      burstDrainActive = false;
      Serial.print("[OUTBOX] drain_mode=OFF remaining=");
      Serial.println(outbox.size());
    }
  }

  // Choose send interval based on drain mode
  unsigned long sendInterval =
      burstDrainActive ? BURST_DRAIN_INTERVAL_MS : SEND_MIN_INTERVAL_MS;
  int maxPerTick =
      burstDrainActive ? BURST_DRAIN_MAX_PER_TICK : FLUSH_MAX_PER_TICK;

  // Phase 1 instrumentation: [OUTBOX] periodic stats
  if (nowMs - lastOutboxLogTime >= 10000) {
    lastOutboxLogTime = nowMs;
    Serial.print("[OUTBOX] millis=");
    Serial.print(nowMs);
    Serial.print(" pending=");
    Serial.print(outbox.size());
    Serial.print(" full=");
    Serial.print(outbox.isFull() ? "YES" : "NO");
    Serial.print(" drain=");
    Serial.println(burstDrainActive ? "ON" : "OFF");
  }

  int flushed = 0;
  while (!outbox.isEmpty() && flushed < maxPerTick) {
    if (nowMs - lastSendTime < sendInterval)
      break;

    String payload = outbox.peek();
    if (sendPayload(payload)) {
      outbox.dropOldest();
      lastSendTime = millis();
      flushed++;
    } else {
      break;
    }
  }

  if (flushed > 0) {
    Serial.print("[OUTBOX] flushed=");
    Serial.print(flushed);
    Serial.print(" remaining=");
    Serial.print(outbox.size());
    if (burstDrainActive)
      Serial.print(" (burst)");
    Serial.println();
  }
}

// -------------------- Arduino --------------------
void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(800);

  Serial.println("✅ VERCEL FIRMWARE RUNNING ✅");
  Serial.println("--- ESP32 Weather Node ---");
  Serial.print("Device ID: ");
  Serial.println(getDeviceId());
  Serial.print("FW Version: ");
  Serial.println(FW_VERSION);
  Serial.print("INGEST_URL: ");
  Serial.println(INGEST_URL);

  // Phase 3: [CFG] boot config summary
  Serial.print("[CFG] demo=");
  Serial.print(DEMO_MODE ? "YES" : "NO");
  Serial.print(" read_ms=");
  Serial.print(READ_INTERVAL_MS);
  Serial.print(" send_ms=");
  Serial.println(SEND_MIN_INTERVAL_MS);

  dht.begin();

  for (int i = 0; i < HEALTH_WINDOW; i++)
    healthHistory[i] = 0;
  for (int i = 0; i < SMOOTHING_WINDOW; i++) {
    tempBuffer[i] = 0;
    humBuffer[i] = 0;
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
}

void loop() {
  unsigned long nowMs = millis();

  if (WIFI_ENABLED)
    updateWiFi(nowMs);

  if (nowMs - lastReadTime >= READ_INTERVAL_MS) {
    lastReadTime = nowMs;
    readCount++;

    float hum = NAN;
    float temp = NAN;
    bool readSuccess = false;
    bool badEvent = false;

    // Retry reads
    for (int i = 0; i <= READ_RETRIES; i++) {
      hum = dht.readHumidity();
      temp = dht.readTemperature();

      if (isnan(hum) || isnan(temp)) {
        if (i < READ_RETRIES)
          delay(RETRY_DELAY_MS);
      } else {
        readSuccess = true;
        break;
      }
    }

    if (!readSuccess) {
      failCount++;
      badEvent = true;
      Serial.print("[READ] FAIL millis=");
      Serial.print(nowMs);
      Serial.print(" reads=");
      Serial.print(readCount);
      Serial.print(" fails=");
      Serial.println(failCount);
      return;
    }

    // Calibration
    temp += TEMP_OFFSET_C;
    hum += HUM_OFFSET_PCT;

    // Validation
    if (hum < HUM_MIN || hum > HUM_MAX || temp < TEMP_MIN_C ||
        temp > TEMP_MAX_C) {
      failCount++;
      badEvent = true;
      Serial.println("Invalid reading (range).");
      return;
    }

    // Jitter check
    if (!isnan(lastTemp)) {
      float delta = abs(temp - lastTemp);
      if (delta > JITTER_TEMP_C)
        badEvent = true;
    }
    lastTemp = temp;

    // Smoothing
    tempBuffer[bufferIndex] = temp;
    humBuffer[bufferIndex] = hum;
    bufferIndex++;
    if (bufferIndex >= SMOOTHING_WINDOW) {
      bufferIndex = 0;
      bufferFull = true;
    }

    int n = bufferFull ? SMOOTHING_WINDOW : bufferIndex;
    if (n <= 0)
      n = 1;
    float tSum = 0, hSum = 0;
    for (int i = 0; i < n; i++) {
      tSum += tempBuffer[i];
      hSum += humBuffer[i];
    }
    float tAvg = tSum / n;
    float hAvg = hSum / n;

    // Health score
    healthHistory[healthWindowIndex] = badEvent ? 1 : 0;
    healthWindowIndex = (healthWindowIndex + 1) % HEALTH_WINDOW;

    int samples = (readCount < HEALTH_WINDOW) ? readCount : HEALTH_WINDOW;
    int bad = 0;
    for (int i = 0; i < samples; i++)
      if (healthHistory[i])
        bad++;
    int healthScore = (samples > 0) ? (100 - ((bad * 100) / samples)) : 100;

    // Phase 1 instrumentation: [READ] log
    Serial.print("[READ] millis=");
    Serial.print(nowMs);
    Serial.print(" ts_ms=");
    Serial.print(nowMs);
    Serial.print(" temp_c=");
    Serial.print(temp, 1);
    Serial.print(" hum_pct=");
    Serial.print(hum, 1);
    Serial.print(" temp_avg=");
    Serial.print(tAvg, 1);
    Serial.print(" hum_avg=");
    Serial.print(hAvg, 1);
    Serial.print(" reads=");
    Serial.print(readCount);
    Serial.print(" fails=");
    Serial.print(failCount);
    Serial.print(" health=");
    Serial.print(healthScore);
    if (wifiState == WIFI_CONNECTED_STATE) {
      Serial.print(" rssi=");
      Serial.print(WiFi.RSSI());
    }
    Serial.println();

    // Preview occasionally
    ticksSincePayloadLog++;
    if (ticksSincePayloadLog >= PAYLOAD_LOG_EVERY_N_TICKS) {
      ticksSincePayloadLog = 0;
      String preview = buildJsonPayload(temp, hum, tAvg, hAvg, healthScore);
      Serial.println("--- JSON Payload Preview ---");
      Serial.println(preview);
      Serial.println("----------------------------");
    }

    // Send strategy
    if (SEND_ENABLED) {
      String payload = buildJsonPayload(temp, hum, tAvg, hAvg, healthScore);

      if (!outbox.isEmpty() || wifiState != WIFI_CONNECTED_STATE) {
        if (!outbox.push(payload))
          Serial.println("Outbox FULL! Dropping payload.");
      } else {
        if (nowMs - lastSendTime >= SEND_MIN_INTERVAL_MS) {
          if (!sendPayload(payload))
            outbox.push(payload);
          else
            lastSendTime = nowMs;
        } else {
          outbox.push(payload);
        }
      }
    }
  }

  if (WIFI_ENABLED && SEND_ENABLED)
    handleOutbox(nowMs);
}