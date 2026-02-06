const assert = require('assert');

// Configuration
const BASE_URL = 'http://localhost:3000';
const WEBHOOK_TOKEN = 'TEST_TOKEN_123';
const USERNAME = 'admin';
const PASSWORD = 'admin123';
const DEVICE_ID = `test-node-${Date.now()}`;
const RECEIVED_AT = new Date().toISOString();

// Colors for output
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    blue: "\x1b[34m",
    yellow: "\x1b[33m"
};

const log = (msg, color = colors.reset) => console.log(`${color}${msg}${colors.reset}`);

async function runTests() {
    log('🚀 Starting Integration Tests for LoRa Webhook System\n', colors.blue);
    log(`Run Context: Device=${DEVICE_ID}, Time=${RECEIVED_AT}\n`);

    try {
        // --- STEP 1: TEST WEBHOOK INGESTION ---
        log('1️⃣  Testing Webhook Ingestion...', colors.yellow);

        const webhookPayload = {
            device_id: DEVICE_ID,
            received_at: RECEIVED_AT,
            uplink_message: {
                decoded_payload: {
                    p1: 12.5,
                    p2: 20.0,
                    temperature: 25.5,
                    humidity: 60.0,
                    battery: 4.1
                }
            }
        };

        const webhookResponse = await fetch(`${BASE_URL}/api/webhook/ttn`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${WEBHOOK_TOKEN}`
            },
            body: JSON.stringify(webhookPayload)
        });

        const webhookData = await webhookResponse.json();

        if (webhookResponse.ok && webhookData.success) {
            log('   ✅ Webhook Request Successful', colors.green);
            log(`   Response: ${webhookData.message}`);
        } else {
            throw new Error(`Webhook failed: ${webhookResponse.status} - ${JSON.stringify(webhookData)}`);
        }

        // --- STEP 2: TEST LOGIN ---
        log('\n2️⃣  Testing Admin Login...', colors.yellow);

        const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: USERNAME, password: PASSWORD })
        });

        const loginData = await loginResponse.json();

        if (!loginResponse.ok || !loginData.token) {
            throw new Error(`Login failed: ${loginResponse.status} - ${JSON.stringify(loginData)}`);
        }

        log(`   ✅ Login Successful. Token received.`, colors.green);
        const authToken = loginData.token;


        // --- STEP 3: VERIFY DATA VIA API ---
        log('\n3️⃣  Verifying Data Persistence...', colors.yellow);

        const deviceResponse = await fetch(`${BASE_URL}/api/devices/${DEVICE_ID}/latest`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const deviceData = await deviceResponse.json();

        if (!deviceResponse.ok) {
            throw new Error(`Get Device failed: ${deviceResponse.status} - ${JSON.stringify(deviceData)}`);
        }

        const savedMeasurement = deviceData.measurement;

        // Assertions
        assert.strictEqual(deviceData.device.deviceId, DEVICE_ID, 'Device ID mismatch');
        assert.strictEqual(savedMeasurement.temperature, 25.5, 'Temperature mismatch');
        assert.strictEqual(savedMeasurement.humidity, 60.0, 'Humidity mismatch');

        log('   ✅ Data Verified in API:', colors.green);
        log(`      Device: ${deviceData.device.deviceId}`);
        log(`      Temp: ${savedMeasurement.temperature}°C`);
        log(`      Humidity: ${savedMeasurement.humidity}%`);

        log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! 🎉', colors.green);

    } catch (error) {
        log(`\n❌ TEST FAILED: ${error.message}`, colors.red);
        if (error.cause) console.error(error.cause);
        process.exit(1);
    }
}

runTests();
