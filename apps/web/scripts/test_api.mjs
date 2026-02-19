// apps/web/scripts/test_api.mjs
import { join } from 'path';

const BASE_URL = 'http://localhost:3000/api';
const DEVICE_KEY = process.env.DEVICE_KEY || 'secret-123'; // Use env or fallback for local test
const DEVICE_ID = 'esp32-lab-01';

async function testHealth() {
  console.log('Testing /health...');
  try {
    const res = await fetch(`${BASE_URL}/health`);
    console.log(`Status: ${res.status}`);
    const json = await res.json();
    console.log('Response:', json);
    if (res.ok && json.ok) console.log('✅ Health Check PASS');
    else console.error('❌ Health Check FAIL');
  } catch (e) {
    console.error('❌ Health Check ERROR:', e.message);
  }
}

async function testIngest() {
  console.log('\nTesting /ingest...');
  const payload = {
    device_id: DEVICE_ID,
    ts_ms: Date.now(),
    uptime_s: 1234,
    temp_c: 25.5,
    hum_pct: 60.0,
    status: 'OK',
    fw: 'v1.0.0',
    rssi: -50,
    health: 100
  };

  try {
    const res = await fetch(`${BASE_URL}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-key': DEVICE_KEY
      },
      body: JSON.stringify(payload)
    });
    console.log(`Status: ${res.status}`);
    const json = await res.json();
    console.log('Response:', json);
    if (res.ok && json.ok) console.log('✅ Ingest PASS');
    else console.error('❌ Ingest FAIL');
  } catch (e) {
    console.error('❌ Ingest ERROR:', e.message);
  }
}

async function testIngestAuthFail() {
  console.log('\nTesting /ingest (Auth Fail)...');
  try {
    const res = await fetch(`${BASE_URL}/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_id: DEVICE_ID })
    });
    console.log(`Status: ${res.status}`);
    if (res.status === 401) console.log('✅ Auth Fail PASS');
    else console.error('❌ Auth Fail CHECK FAILED');
  } catch (e) {
    console.error('❌ Auth Fail ERROR:', e.message);
  }
}

async function run() {
  await testHealth();
  await testIngest();
  await testIngestAuthFail();
}

run();
