#ifndef CONFIG_H
#define CONFIG_H

// --- Demo Mode ---
// Set to 1 for live demos (fast send, aggressive polling)
// Set to 0 for normal/production (slower, cheaper)
#define DEMO_MODE 1

// --- Hardware Settings ---
// Pin connected to the DHT sensor
// Recommended Pins: 27, 32, 33 (Avoid strap pins 0, 2, 12, 15)
#define DHT_PIN 4

// Sensor Type: DHT11, DHT22, or DHT21 (AM2301)
#define DHT_TYPE DHT22

// --- Timing Settings ---
// Interval between sensor reads in milliseconds
#define READ_INTERVAL_MS 2000

// --- Wi-Fi Settings ---
// Enable Wi-Fi? (true/false)
#define WIFI_ENABLED true
// Timeout for a single connection attempt
#define WIFI_CONNECT_TIMEOUT_MS 15000
// Base delay for retry backoff
#define WIFI_RETRY_BASE_DELAY_MS 1000
// Max delay for retry backoff
#define WIFI_RETRY_MAX_DELAY_MS 30000

// Phase 5: Sending & Outbox
#define SEND_ENABLED true
#if DEMO_MODE
#define SEND_MIN_INTERVAL_MS 3000 // Demo: send every 3s
#else
#define SEND_MIN_INTERVAL_MS 15000 // Normal: send every 15s
#endif
#define HTTP_TIMEOUT_MS 6000
#define OUTBOX_MAX 50
#define FLUSH_MAX_PER_TICK 3
#define LOG_OUTBOX_EVERY_N_TICKS 10

// Phase 2: NTP Time Sync
#define NTP_SERVER_1 "pool.ntp.org"
#define NTP_SERVER_2 "time.nist.gov"
#define NTP_SYNC_TIMEOUT_MS 10000

// Phase 2: Burst Drain (fast outbox flush after Wi-Fi reconnect)
#define BURST_DRAIN_INTERVAL_MS 500
#define BURST_DRAIN_TIMEOUT_MS 20000
#define BURST_DRAIN_MAX_PER_TICK 10

// --- Metadata Settings ---
#define FW_VERSION "0.3.0"
#define DEVICE_ID_FIXED "esp32-lab-01" // set to null/empty to use MAC id

// --- Logging Settings ---
// Milliseconds between printing Wi-Fi status summary
#define WIFI_STATUS_LOG_INTERVAL_MS 5000
// How many ticks to skip before printing the JSON payload
#define PAYLOAD_LOG_EVERY_N_TICKS 10

// Delay between retries in milliseconds
#define RETRY_DELAY_MS 500

// Number of retries before marking a read as failed
#define READ_RETRIES 2

// Serial communication baud rate
#define SERIAL_BAUD 115200

// --- Validation Settings ---
// Minimum valid humidity percentage
#define HUM_MIN 0.0
// Maximum valid humidity percentage
#define HUM_MAX 100.0
// Minimum valid temperature in Celsius
#define TEMP_MIN_C -10.0
// Maximum valid temperature in Celsius(
#define TEMP_MAX_C 60.0

// --- Calibration Settings ---
// Offset added to raw temperature reading (Celsius)
#define TEMP_OFFSET_C 0.0
// Offset added to raw humidity reading (Percent)
#define HUM_OFFSET_PCT 0.0

// --- Health Check Settings ---
// Number of recent reads to consider for health score
#define HEALTH_WINDOW 50
// Temperature change threshold to consider as jitter (Celsius)
#define JITTER_TEMP_C 2.0

// --- Smoothing Settings ---
// Number of samples for the moving average window
#define SMOOTHING_WINDOW 5

#endif
