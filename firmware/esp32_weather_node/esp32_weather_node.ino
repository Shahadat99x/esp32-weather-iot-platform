#include <DHT.h>
#include "config.h"

// Initialize DHT sensor
// DHT_PIN and DHT_TYPE are defined in config.h
DHT dht(DHT_PIN, DHT_TYPE);

// --- Global State ---

// --- Global State ---

// Ring buffer for smoothing
float tempBuffer[SMOOTHING_WINDOW];
float humBuffer[SMOOTHING_WINDOW];
int bufferIndex = 0;
bool bufferFull = false;

// Statistics
unsigned long lastReadTime = 0;
unsigned long readCount = 0;
unsigned long failCount = 0;
unsigned long lastPayloadLogTime = 0;
unsigned long ticksSincePayloadLog = 0;

// Health Check
float lastTemp = NAN; 
int healthEvents = 0; 
int healthWindowIndex = 0;
uint8_t healthHistory[HEALTH_WINDOW]; 

// Wi-Fi State
// We need WiFi library
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include "outbox.h"
#if __has_include("secrets.h")
  #include "secrets.h"
#else
  // Fallback if secrets.h is missing (should not happen in real usage if followed instructions)
  #define WIFI_SSID "MISSING_SECRETS"
  #define WIFI_PASS "MISSING_SECRETS"
#endif

enum WiFiState {
  WIFI_DISCONNECTED_STATE,
  WIFI_CONNECTING_STATE,
  WIFI_CONNECTED_STATE
};

WiFiState wifiState = WIFI_DISCONNECTED_STATE;
unsigned long wifiConnectStartTime = 0;
unsigned long wifiRetryDelay = WIFI_RETRY_BASE_DELAY_MS;
unsigned long lastWifiRetryTime = 0;
unsigned long lastWifiLogTime = 0;

// Outbox & Sending (Phase 5)
Outbox outbox;
unsigned long lastSendTime = 0;
unsigned long lastOutboxLogTime = 0;

// Forward Declarations
String getDeviceId();
void updateWiFi(unsigned long currentMillis);
String buildJsonPayload(float temp, float hum, float tempAvg, float humAvg, int health);
bool sendPayload(const String& json);
void handleOutbox(unsigned long currentMillis);

void setup() {
  Serial.begin(SERIAL_BAUD);
  delay(1000);

  Serial.println("--- ESP32 Weather Node - Phase 2 ---");
  Serial.print("Device ID: "); Serial.println(getDeviceId());
  Serial.print("FW Version: "); Serial.println(FW_VERSION);
  Serial.print("DHT Pin: "); Serial.println(DHT_PIN);
  Serial.print("DHT Type (ID): "); Serial.println(DHT_TYPE); 
  
  if (String(WIFI_SSID) == "MISSING_SECRETS") {
    Serial.println("ERROR: secrets.h not found or not configured!");
  }

  Serial.println("Initializing Sensor...");
  dht.begin();
  
  // Initialize health history and buffer
  for(int i=0; i<HEALTH_WINDOW; i++) healthHistory[i] = 0;
  for(int i=0; i<SMOOTHING_WINDOW; i++) {
    tempBuffer[i] = 0;
    humBuffer[i] = 0;
  }

  // Set Wi-Fi to Station mode
  WiFi.mode(WIFI_STA);
  // Don't auto-connect to old creds, we manage it explicitly
  WiFi.setAutoConnect(false);
}

void loop() {
  unsigned long currentMillis = millis();

  // --- Wi-Fi Management ---
  if (WIFI_ENABLED) {
    updateWiFi(currentMillis);
  }

  // --- Sensor Reading ---
  if (currentMillis - lastReadTime >= READ_INTERVAL_MS) {
    lastReadTime = currentMillis;
    readCount++;

    float humidity = NAN;
    float temperature = NAN;
    bool readSuccess = false;
    bool isBadEvent = false;

    // Retry Loop
    for (int i = 0; i <= READ_RETRIES; i++) {
      humidity = dht.readHumidity();
      temperature = dht.readTemperature();

      if (isnan(humidity) || isnan(temperature)) {
        if (i < READ_RETRIES) delay(RETRY_DELAY_MS);
      } else {
        readSuccess = true;
        break; 
      }
    }

    if (!readSuccess) {
      failCount++;
      isBadEvent = true;
      Serial.println("Read failed.");
    } else {
        // --- 1. Apply Calibration Offsets ---
        temperature += TEMP_OFFSET_C;
        humidity += HUM_OFFSET_PCT;

        // --- 2. Validation (Range Check) ---
        if (humidity < HUM_MIN || humidity > HUM_MAX || 
            temperature < TEMP_MIN_C || temperature > TEMP_MAX_C) {
          
          failCount++; 
          isBadEvent = true;
          Serial.print("INVALID reading: H="); Serial.print(humidity, 1);
          Serial.print("% T="); Serial.print(temperature, 1); Serial.println("C");
        } else {
            // --- 3. Jitter Check ---
            if (!isnan(lastTemp)) {
                float delta = abs(temperature - lastTemp);
                if (delta > JITTER_TEMP_C) {
                    isBadEvent = true;
                }
            }
            lastTemp = temperature;

            // --- 4. Smoothing (Moving Average) ---
            tempBuffer[bufferIndex] = temperature;
            humBuffer[bufferIndex] = humidity;
            
            bufferIndex++;
            if (bufferIndex >= SMOOTHING_WINDOW) {
              bufferIndex = 0;
              bufferFull = true;
            }
        }
    }

    // --- Health Score Calculation ---
    healthHistory[healthWindowIndex] = isBadEvent ? 1 : 0;
    healthWindowIndex = (healthWindowIndex + 1) % HEALTH_WINDOW;

    int badEvents = 0;
    int samples = (readCount < HEALTH_WINDOW) ? readCount : HEALTH_WINDOW;
    for (int i = 0; i < samples; i++) {
        if (healthHistory[i]) badEvents++;
    }
    
    int healthScore = 100;
    if (samples > 0) {
        healthScore = 100 - ((badEvents * 100) / samples);
    }
    
    if (isBadEvent && (readSuccess == false || (humidity < HUM_MIN || humidity > HUM_MAX || temperature < TEMP_MIN_C || temperature > TEMP_MAX_C))) {
        return; 
    }

    // Calculate Average
    float tempSum = 0;
    float humSum = 0;
    int samplesCount = bufferFull ? SMOOTHING_WINDOW : bufferIndex;
    if (samplesCount == 0) samplesCount = 1; 

    for (int i = 0; i < samplesCount; i++) {
        tempSum += tempBuffer[i];
        humSum += humBuffer[i];
    }
    
    float tempAvg = tempSum / samplesCount;
    float humAvg = humSum / samplesCount;
    
    float failPct = (readCount > 0) ? ((float)failCount / (float)readCount * 100.0) : 0.0;

    // --- Serial Output ---
    Serial.print("ts_ms="); Serial.print(currentMillis);
    Serial.print(" temp_c="); Serial.print(temperature, 1);
    Serial.print(" hum_pct="); Serial.print(humidity, 1);
    Serial.print(" temp_avg="); Serial.print(tempAvg, 1);
    Serial.print(" hum_avg="); Serial.print(humAvg, 1);
    Serial.print(" reads="); Serial.print(readCount);
    Serial.print(" fails="); Serial.print(failCount);
    Serial.print(" fail_pct="); Serial.print(failPct, 1);
    Serial.print(" health="); Serial.print(healthScore); 
    
    if (WIFI_ENABLED && wifiState == WIFI_CONNECTED_STATE) {
        Serial.print(" rssi="); Serial.print(WiFi.RSSI());
    }
    Serial.println();

    // --- Payload Preview Log ---
    ticksSincePayloadLog++;
    if (ticksSincePayloadLog >= PAYLOAD_LOG_EVERY_N_TICKS) {
        ticksSincePayloadLog = 0;
        // Verify payload format
        String preview = buildJsonPayload(temperature, humidity, tempAvg, humAvg, healthScore);
        Serial.println("--- JSON Payload Preview ---");
        Serial.println(preview);
        Serial.println("----------------------------");
    }

    // --- Phase 5: Sending / Outbox Strategy ---
    if (SEND_ENABLED) {
        // Construct the payload for sending
        // Note: we send even if read failed? 
        // If read failed, temp/hum are last known or NAN?
        // buildJsonPayload handles NAN -> 0.
        // Let's send only if we have a valid structure or if it's a "FAIL" status event?
        // For now, simpler to send every tick that matches interval.
        
        // We throttle sending by SEND_MIN_INTERVAL_MS
        // But we must PUSH to outbox if we are "due" to send.
        // Wait, if we are offline, we still generate data at READ_INTERVAL.
        // Do we queue EVERY read? OUTBOX_MAX is 50. 50 * 2s = 100s of history.
        // If we want more history, we might skip some?
        // Let's queue every read for now.
        
        String payload = buildJsonPayload(temperature, humidity, tempAvg, humAvg, healthScore);
        
        // Push to outbox first? Or try send?
        // Strategy: Always push to outbox? No, double copy.
        // Strategy: 
        // 1. If Connected & TimeToSend -> Try Send Direct. 
        //    If Fail -> Push to Outbox.
        // 2. If Disconnected -> Push to Outbox.
        // 3. Separately: Flush Outbox if Connected.
        
        // BUT: To preserve order, if Outbox has items, we MUST send Outbox first.
        // So:
        // If Outbox !Empty -> Push Current to Outbox (to keep order) -> Try Flush.
        // If Outbox Empty & Connected -> Try Send Current. If Fail -> Push to Outbox.
        
        if (!outbox.isEmpty() || wifiState != WIFI_CONNECTED_STATE) {
             if (!outbox.push(payload)) {
                 Serial.println("Outbox FULL! Dropping payload.");
             } else {
                 // Serial.println("Buffered payload.");
             }
        } else {
             // Outbox empty and confirmed connected
             // Check if we waited enough since LAST send?
             // Actually, READ_INTERVAL >= SEND_MIN ??
             // If READ < SEND_MIN, we might skip sending some?
             // Requirement: "Attempt to send no more often than SEND_MIN_INTERVAL_MS"
             // If we read every 2s, and send_min is 2s, we send every 2s.
             // If send_min is 5s, we drop 2 out of 3? or queue them?
             // "Queue them" implies we send burst?
             // "No more often" usually implies rate limiting/sampling.
             // Let's assume 1:1 for now or simple "if ready". 
             // If not ready, do we queue? That would fill buffer with delayed data.
             // Let's assume we want to capture history. So we queue if not ready?
             // Or we just gate the "Send" logic.
             // Let's queue strict time-series.
             
             if (currentMillis - lastSendTime >= SEND_MIN_INTERVAL_MS) {
                 if (!sendPayload(payload)) {
                     outbox.push(payload); // Store if failed
                 } else {
                     lastSendTime = currentMillis;
                 }
             } else {
                 // Too soon to send. Queue it? Or Drop? 
                 // If we queue, we will send it later in a burst. This is better for data integrity.
                 outbox.push(payload); 
             }
        }
    }
  }
  
  // --- Output Flush Handler ---
  if (WIFI_ENABLED && SEND_ENABLED) {
      handleOutbox(currentMillis);
  }
}

// --- Phase 5: Helper Functions ---

void handleOutbox(unsigned long currentMillis) {
    if (wifiState != WIFI_CONNECTED_STATE) return;

    // Log Outbox Size occasionally
    if (ticksSincePayloadLog == 0) { // Sync with payload log for simplicity? Or separate timer
         // Let's use separate timer or logic
    }
    
    if (currentMillis - lastOutboxLogTime > 10000) {
        lastOutboxLogTime = currentMillis;
        if (!outbox.isEmpty()) {
            Serial.print("Outbox Size: "); Serial.println(outbox.size());
        }
    }

    // Attempt to flush
    // We can send multiple per tick to catch up
    int flushed = 0;
    while (!outbox.isEmpty() && flushed < FLUSH_MAX_PER_TICK) {
        // Enforce rate limit even during flush?
        // "Attempt to send no more often than SEND_MIN_INTERVAL_MS"
        // If we strictly follow this, we can never "catch up" if Read == Send Interval.
        // We must allow bursts during flush or else the buffer never drains if Read Rate >= Send Rate.
        // The backed API has rate limits (e.g. 1s). Our Send Min is 2s.
        // If we flush faster, we might hit 429.
        // Let's respect SEND_MIN_INTERVAL_MS for flush too? 
        // If so, we can't flush 3 per tick (tick=2000ms).
        // WE NEED TO DECOUPLE TICK from LOOP.
        // loop() runs fast. "Tick" in this context was "Read Interval".
        // Ah, handleOutbox is called in loop() every pass (ms).
        
        if (currentMillis - lastSendTime >= SEND_MIN_INTERVAL_MS) {
            String payload = outbox.peek();
            if (sendPayload(payload)) {
                outbox.dropOldest(); // success, remove
                lastSendTime = millis(); // Update time using FRESH millis
                flushed++;
            } else {
                // Failed top item. Stop flushing for now to avoid hammering.
                break;
            }
        } else {
            // Waiting for rate limit
            break;
        }
    }
}

bool sendPayload(const String& json) {
    if (wifiState != WIFI_CONNECTED_STATE) return false;

    WiFiClientSecure client;
    client.setInsecure(); // Demo mode: skip cert validation
    client.setTimeout(HTTP_TIMEOUT_MS / 1000);

    HTTPClient http;
    
    // Begin
    if (!http.begin(client, INGEST_URL)) {
        Serial.println("HTTP: Begin failed");
        return false;
    }

    // Headers
    http.addHeader("Content-Type", "application/json");
    http.addHeader("x-device-key", DEVICE_KEY);

    // POST
    unsigned long start = millis();
    int httpCode = http.POST(json);
    unsigned long duration = millis() - start;

    bool success = false;

    if (httpCode > 0) {
        // HTTP 2xx
        if (httpCode >= 200 && httpCode < 300) {
            Serial.print("HTTP: Success ("); Serial.print(httpCode);
            Serial.print(") "); Serial.print(duration); Serial.println("ms");
            success = true;
        } else {
            Serial.print("HTTP: Error ("); Serial.print(httpCode);
            Serial.print(") ");
            
            if (httpCode == 429) {
                Serial.println("Rate Limited!");
            } else if (httpCode == 401 || httpCode == 403) {
                Serial.println("Auth Failed! Check DEVICE_KEY.");
            } else {
                Serial.println("Server Error");
            }
            // If 4xx/5xx, we treat as fail -> keep in outbox?
            // If 400 (Bad Request), retrying won't help. We should drop it?
            // If 401 (Auth), retrying won't help. Drop?
            // If 429 (Rate Limit), Retry.
            // If 5xx (Server), Retry.
            // Phase 5 requirements: "If send fails (non-200), push payload..."
            // But 401/400 will never succeed. 
            // Let's stick to requirement "If send fails... push". 
            // Maybe strict 400/401 logic later. For now, strict adherence implies "retry everything".
            success = false; 
        }
    } else {
        Serial.print("HTTP: Conn Failed: ");
        Serial.println(http.errorToString(httpCode).c_str());
        success = false;
    }

    http.end();
    return success;
}



// --- Helper Functions ---

String getDeviceId() {
    String mac = WiFi.macAddress();
    mac.replace(":", "");
    mac.toLowerCase();
    return String(DEVICE_ID_PREFIX) + mac;
}

unsigned long getUptime() {
    return millis();
}

void updateWiFi(unsigned long currentMillis) {
    // State machine for non-blocking Wi-Fi
    switch (wifiState) {
        case WIFI_DISCONNECTED_STATE:
            // Check if we waited long enough for backoff
            if (currentMillis - lastWifiRetryTime >= wifiRetryDelay) {
                Serial.print("WiFi: Connecting to "); Serial.println(WIFI_SSID);
                WiFi.begin(WIFI_SSID, WIFI_PASS);
                wifiConnectStartTime = currentMillis;
                wifiState = WIFI_CONNECTING_STATE;
            }
            break;

        case WIFI_CONNECTING_STATE:
            if (WiFi.status() == WL_CONNECTED) {
                Serial.println("WiFi: Connected!");
                Serial.print("WiFi: IP Address: "); Serial.println(WiFi.localIP());
                wifiState = WIFI_CONNECTED_STATE;
                wifiRetryDelay = WIFI_RETRY_BASE_DELAY_MS; // Reset backoff
            } else if (currentMillis - wifiConnectStartTime >= WIFI_CONNECT_TIMEOUT_MS) {
                Serial.println("WiFi: Connection Timeout.");
                WiFi.disconnect(); 
                wifiState = WIFI_DISCONNECTED_STATE;
                lastWifiRetryTime = currentMillis;
                
                // Exponential Backoff
                wifiRetryDelay *= 2;
                if (wifiRetryDelay > WIFI_RETRY_MAX_DELAY_MS) {
                    wifiRetryDelay = WIFI_RETRY_MAX_DELAY_MS;
                }
                Serial.print("WiFi: Retrying in "); Serial.print(wifiRetryDelay / 1000); Serial.println("s");
            }
            break;

        case WIFI_CONNECTED_STATE:
            if (WiFi.status() != WL_CONNECTED) {
                Serial.println("WiFi: Lost connection.");
                wifiState = WIFI_DISCONNECTED_STATE;
                lastWifiRetryTime = currentMillis;
                wifiRetryDelay = WIFI_RETRY_BASE_DELAY_MS; 
            }
            break;
    }

    // Periodic Status Log
    if (currentMillis - lastWifiLogTime >= WIFI_STATUS_LOG_INTERVAL_MS) {
        lastWifiLogTime = currentMillis;
        // Don't spam unless strictly necessary, or maybe just summary?
        // Spec says: "Add separate Wi-Fi state logs (concise, not spammy)"
        // The transitions above handle the main logs. Maybe just log RSSI if connected?
        // Or if still connecting?
        if (wifiState == WIFI_CONNECTING_STATE) {
             Serial.println("WiFi: Status = CONNECTING...");
        } 
    }
}

String buildJsonPayload(float temp, float hum, float tempAvg, float humAvg, int health) {
    // Manual JSON construction to avoid external libraries for now, 
    // or use ArduinoJson if permitted? Spec says "keep memory small", "valid JSON".
    // "no board-specific weird libs" - ArduinoJson is standard but manual is fine for flat structure.
    
    // Safety check for null/NAN
    if (isnan(temp)) temp = 0;
    if (isnan(hum)) hum = 0;
    if (isnan(tempAvg)) tempAvg = 0;
    if (isnan(humAvg)) humAvg = 0;

    String rssiVal = (wifiState == WIFI_CONNECTED_STATE) ? String(WiFi.RSSI()) : "null";

    String json = "{";
    json += "\"device_id\":\"" + getDeviceId() + "\",";
    json += "\"fw_version\":\"" + String(FW_VERSION) + "\",";
    json += "\"uptime_ms\":" + String(getUptime()) + ",";
    json += "\"ts_ms\":" + String(millis()) + ","; // Using local millis as timestamp for now per spec
    json += "\"rssi\":" + rssiVal + ",";
    json += "\"sensor\":{";
    json += "\"temp_c\":" + String(temp, 1) + ",";
    json += "\"hum_pct\":" + String(hum, 1) + ",";
    json += "\"temp_c_avg\":" + String(tempAvg, 1) + ",";
    json += "\"hum_pct_avg\":" + String(humAvg, 1) + ",";
    json += "\"health_score\":" + String(health) + "";
    json += "}";
    json += "}";
    
    return json;
}
