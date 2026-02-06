const assert = require('assert');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || 'TEST_TOKEN_123';
const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'admin123';

// Colors for output
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    blue: "\x1b[34m",
    yellow: "\x1b[33m"
};

const log = (msg, color = colors.reset) => console.log(`${color}${msg}${colors.reset}`);

let passedTests = 0;
let failedTests = 0;

async function test(name, fn) {
    try {
        await fn();
        log(`✅ ${name}`, colors.green);
        passedTests++;
    } catch (error) {
        log(`❌ ${name}`, colors.red);
        log(`   ${error.message}`, colors.red);
        failedTests++;
    }
}

async function runSmokeTests() {
    log('\n🔥 Running Smoke Tests for LoRa Monitor System\n', colors.blue);

    let authToken = null;
    const testDeviceId = `smoke-test-${Date.now()}`;

    // Test 1: Health endpoint
    await test('Health endpoint responsive', async () => {
        const res = await fetch(`${BASE_URL}/api/health`);
        assert.strictEqual(res.status, 200, 'Health endpoint should return 200');
        const data = await res.json();
        assert.strictEqual(data.status, 'ok', 'Health status should be ok');
    });

    // Test 2: Readiness endpoint
    await test('Readiness endpoint (MongoDB ping)', async () => {
        const res = await fetch(`${BASE_URL}/api/ready`);
        assert.strictEqual(res.status, 200, 'Ready endpoint should return 200');
        const data = await res.json();
        assert.strictEqual(data.status, 'ready', 'Ready status should be ready');
    });

    // Test 3: Admin login
    await test('Admin login', async () => {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: ADMIN_USERNAME,
                password: ADMIN_PASSWORD
            })
        });
        assert.strictEqual(res.status, 200, 'Login should return 200');
        const data = await res.json();
        assert.ok(data.accessToken, 'Should receive JWT token');
        authToken = data.accessToken;
    });

    // Test 4: List devices (authenticated)
    await test('List devices (authenticated)', async () => {
        assert.ok(authToken, 'Auth token must exist');
        const res = await fetch(`${BASE_URL}/api/devices`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        assert.strictEqual(res.status, 200, 'Devices list should return 200');
        const data = await res.json();
        assert.ok(Array.isArray(data.devices), 'Should return devices array');
    });

    // Test 5: Webhook ingestion (valid payload)
    await test('Webhook ingestion (valid payload)', async () => {
        const payload = {
            end_device_ids: {
                device_id: testDeviceId
            },
            uplink_message: {
                received_at: new Date().toISOString(),
                decoded_payload: {
                    temperature: 22.1,
                    humidity: 58.7,
                    battery: 3.92,
                    p1: 10.5,
                    p2: 15.3
                }
            }
        };

        const res = await fetch(`${BASE_URL}/api/webhook/ttn`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${WEBHOOK_TOKEN}`
            },
            body: JSON.stringify(payload)
        });

        assert.ok(res.status === 200 || res.status === 201, `Webhook should return 200/201, got ${res.status}`);
    });

    // Test 6: Data persisted to database
    await test('Data persisted to database', async () => {
        // Wait a bit for data to be written
        await new Promise(resolve => setTimeout(resolve, 500));

        const res = await fetch(`${BASE_URL}/api/devices/${testDeviceId}/latest`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        assert.strictEqual(res.status, 200, 'Latest data endpoint should return 200');
        const data = await res.json();
        assert.strictEqual(data.device.deviceId, testDeviceId, 'Device ID should match');
        assert.strictEqual(data.measurement.temperature, 22.1, 'Temperature should be persisted');
    });

    // Test 7: Webhook rejects invalid auth
    await test('Webhook rejects invalid auth', async () => {
        const payload = {
            end_device_ids: { device_id: 'test' },
            uplink_message: {
                received_at: new Date().toISOString(),
                decoded_payload: { temperature: 20 }
            }
        };

        const res = await fetch(`${BASE_URL}/api/webhook/ttn`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer INVALID_TOKEN'
            },
            body: JSON.stringify(payload)
        });

        assert.strictEqual(res.status, 401, 'Should reject with 401');
    });

    // Test 8: Webhook rejects invalid payload
    await test('Webhook rejects invalid payload', async () => {
        const res = await fetch(`${BASE_URL}/api/webhook/ttn`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${WEBHOOK_TOKEN}`
            },
            body: JSON.stringify({ invalid: 'payload' })
        });

        assert.ok(res.status === 400 || res.status === 422, 'Should reject invalid payload');
    });

    // Print results
    log('\n' + '='.repeat(50), colors.blue);
    log(`Results: ${passedTests}/${passedTests + failedTests} tests passed`,
        failedTests === 0 ? colors.green : colors.yellow);

    if (failedTests > 0) {
        log(`\n⚠️  ${failedTests} test(s) failed`, colors.red);
        process.exit(1);
    } else {
        log('\n🎉 All smoke tests passed!', colors.green);
        process.exit(0);
    }
}

runSmokeTests().catch(err => {
    log(`\n💥 Fatal error: ${err.message}`, colors.red);
    console.error(err);
    process.exit(1);
});
