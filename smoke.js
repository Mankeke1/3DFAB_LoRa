#!/usr/bin/env node

/**
 * Script de Smoke Tests para el Sistema LoRa Webhook
 * 
 * Prueba el flujo crítico end-to-end:
 *   1. Health check
 *   2. Readiness (ping a MongoDB)
 *   3. Autenticación (login)
 *   4. Autorización (listar dispositivos)
 *   5. Ingesta de webhook
 *   6. Verificación de persistencia en DB (/latest)
 *   7-8. Validaciones de seguridad (auth y payload)
 * 
 * Código de salida 0 = todos pasan, 1 = alguna falla
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || 'TEST_TOKEN_123';

const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m"
};

function log(msg, color = colors.reset) {
    console.log(`${color}${msg}${colors.reset}`);
}

function request(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;

        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = protocol.request(reqOptions, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    json: () => Promise.resolve(JSON.parse(data))
                });
            });
        });

        req.on('error', reject);

        if (options.body) {
            req.write(options.body);
        }

        req.end();
    });
}

async function test(name, fn) {
    try {
        await fn();
        log(`✅ ${name}`, colors.green);
        return true;
    } catch (error) {
        log(`❌ ${name}: ${error.message}`, colors.red);
        return false;
    }
}

async function runSmokeTests() {
    log('\n🔍 Running Smoke Tests\n', colors.yellow);
    log(`Target: ${BASE_URL}\n`);

    const results = [];

    // Test 1: Health Check (Salud del servidor)
    results.push(await test('Health endpoint responsive', async () => {
        const res = await request(`${BASE_URL}/api/health`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.status !== 'ok') throw new Error('Status not ok');
        if (data.mongodb !== 'connected') throw new Error('MongoDB not connected');
    }));

    // Test 2: Readiness Check (Listo para recibir requests)
    results.push(await test('Readiness endpoint (MongoDB ping)', async () => {
        const res = await request(`${BASE_URL}/api/ready`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.status !== 'ready') throw new Error('Not ready');
    }));

    // Test 3: Login (Autenticación)
    let authToken;
    results.push(await test('Admin login', async () => {
        const res = await request(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: 'admin123' })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.accessToken) throw new Error('No token received');
        authToken = data.accessToken;
    }));

    // Test 4: Request autenticado (listar dispositivos)
    results.push(await test('List devices (authenticated)', async () => {
        if (!authToken) throw new Error('No auth token available');
        const res = await request(`${BASE_URL}/api/devices`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!Array.isArray(data.devices)) throw new Error('Invalid response format');
    }));

    // Test 5: Endpoint webhook (válido) - Formato TTN v3
    const testDeviceId = `smoke-test-${Date.now()}`;
    const testTimestamp = new Date().toISOString();
    results.push(await test('Webhook ingestion (valid payload)', async () => {
        const res = await request(`${BASE_URL}/api/webhook/ttn`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${WEBHOOK_TOKEN}`
            },
            body: JSON.stringify({
                // TTN v3 format: device_id está dentro de end_device_ids
                end_device_ids: {
                    device_id: testDeviceId,
                    application_ids: { application_id: 'test-app' }
                },
                uplink_message: {
                    decoded_payload: {
                        p1: 10.5,
                        p2: 15.3,
                        temperature: 22.1,
                        humidity: 58.7,
                        battery: 3.92
                    },
                    // received_at está dentro de uplink_message
                    received_at: testTimestamp
                }
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.success) throw new Error('Webhook failed');
    }));

    // Test 6: Verificar que los datos del webhook se guardaron en DB
    results.push(await test('Data persisted to database', async () => {
        if (!authToken) throw new Error('No auth token available');

        // Esperar 500ms para que se complete la escritura en DB
        await new Promise(resolve => setTimeout(resolve, 500));

        const res = await request(`${BASE_URL}/api/devices/${testDeviceId}/latest`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        // Verificar datos de medición
        if (!data.measurement) throw new Error('No measurement found');
        if (data.measurement.temperature !== 22.1) throw new Error('Temperature mismatch');
        if (data.measurement.humidity !== 58.7) throw new Error('Humidity mismatch');
        if (data.device.deviceId !== testDeviceId) throw new Error('Device ID mismatch');
    }));

    // Test 7: Autenticación del webhook (debe fallar) - Formato TTN v3
    results.push(await test('Webhook rejects invalid auth', async () => {
        const res = await request(`${BASE_URL}/api/webhook/ttn`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer INVALID_TOKEN'
            },
            body: JSON.stringify({
                end_device_ids: { device_id: 'test' },
                uplink_message: {
                    decoded_payload: {},
                    received_at: new Date().toISOString()
                }
            })
        });
        if (res.status !== 401) throw new Error('Should return 401');
    }));

    // Test 8: Validación del webhook (debe fallar)
    results.push(await test('Webhook rejects invalid payload', async () => {
        const res = await request(`${BASE_URL}/api/webhook/ttn`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${WEBHOOK_TOKEN}`
            },
            body: JSON.stringify({ invalid: 'payload' })
        });
        if (res.status !== 400) throw new Error('Should return 400');
    }));

    // Resumen
    const passed = results.filter(r => r).length;
    const total = results.length;

    log(`\n${'='.repeat(50)}`);
    log(`Results: ${passed}/${total} tests passed`, passed === total ? colors.green : colors.red);
    log('='.repeat(50) + '\n');

    if (passed !== total) {
        process.exit(1);
    }
}

runSmokeTests().catch(err => {
    log(`❌ Smoke tests crashed: ${err.message}`, colors.red);
    process.exit(1);
});
