/**
 * Pruebas de Rutas Webhook
 */

const request = require('supertest');
const express = require('express');
const Device = require('../models/Device');
const Measurement = require('../models/Measurement');

// Mock de caché Redis
jest.mock('../config/redis', () => ({
    cache: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(true),
        del: jest.fn().mockResolvedValue(true),
        invalidatePattern: jest.fn().mockResolvedValue(1),
        publish: jest.fn().mockResolvedValue(true),
        isAvailable: jest.fn().mockResolvedValue(true)
    },
    redis: {
        ping: jest.fn().mockResolvedValue('PONG'),
        quit: jest.fn().mockResolvedValue(undefined)
    }
}));

// Crear aplicación de prueba
const app = express();
app.use(express.json());

// Importar rutas de webhook
const webhookRoutes = require('../routes/webhook');
app.use('/api/webhook', webhookRoutes);

describe('Webhook Endpoints', () => {
    const validTTNPayload = {
        end_device_ids: {
            device_id: 'test-device-001'
        },
        uplink_message: {
            decoded_payload: {
                p1: 15.5,
                p2: 22.3,
                temp: 19.8,
                hum: 65.2,
                batt: 3.7
            },
            received_at: '2026-02-02T15:00:00.000Z'
        }
    };

    describe('POST /api/webhook/ttn', () => {
        it('should accept valid TTN payload with Bearer token', async () => {
            const res = await request(app)
                .post('/api/webhook/ttn')
                .set('Authorization', 'Bearer TEST_TOKEN_123')
                .send(validTTNPayload);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('deviceId', 'test-device-001');

            // Verificar que la medición fue guardada
            const measurement = await Measurement.findOne({
                deviceId: 'test-device-001'
            });
            expect(measurement).toBeTruthy();
            expect(measurement.temperature).toBe(19.8);
            expect(measurement.humidity).toBe(65.2);
        });

        it('should reject request without auth token', async () => {
            const res = await request(app)
                .post('/api/webhook/ttn')
                .send(validTTNPayload);

            expect(res.status).toBe(401);
        });

        it('should reject request with invalid token', async () => {
            const res = await request(app)
                .post('/api/webhook/ttn')
                .set('Authorization', 'Bearer WRONG_TOKEN')
                .send(validTTNPayload);

            expect(res.status).toBe(401);
        });

        it('should reject invalid payload structure', async () => {
            const res = await request(app)
                .post('/api/webhook/ttn')
                .set('Authorization', 'Bearer TEST_TOKEN_123')
                .send({ invalid: 'data' });

            expect(res.status).toBe(400);
        });

        it('should auto-create device if not exists', async () => {
            await request(app)
                .post('/api/webhook/ttn')
                .set('Authorization', 'Bearer TEST_TOKEN_123')
                .send(validTTNPayload);

            const device = await Device.findOne({
                deviceId: 'test-device-001'
            });

            expect(device).toBeTruthy();
            expect(device.name).toContain('001');
        });

        it('should handle duplicate data idempotently', async () => {
            // Enviar primera vez
            await request(app)
                .post('/api/webhook/ttn')
                .set('Authorization', 'Bearer TEST_TOKEN_123')
                .send(validTTNPayload);

            // Enviar los mismos datos nuevamente
            const res = await request(app)
                .post('/api/webhook/ttn')
                .set('Authorization', 'Bearer TEST_TOKEN_123')
                .send(validTTNPayload);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);

            // Verificar que solo existe 1 medición
            const count = await Measurement.countDocuments({
                deviceId: 'test-device-001'
            });
            expect(count).toBe(1);
        });

        it('should handle payload with missing optional fields', async () => {
            const minimalPayload = {
                end_device_ids: {
                    device_id: 'minimal-device'
                },
                uplink_message: {
                    decoded_payload: {
                        temp: 20.0
                    },
                    received_at: '2026-02-02T16:00:00.000Z'
                }
            };

            const res = await request(app)
                .post('/api/webhook/ttn')
                .set('Authorization', 'Bearer TEST_TOKEN_123')
                .send(minimalPayload);

            expect(res.status).toBe(200);

            const measurement = await Measurement.findOne({
                deviceId: 'minimal-device'
            });
            expect(measurement).toBeTruthy();
            expect(measurement.temperature).toBe(20.0);
            expect(measurement.p1).toBeNull();
        });

        it('should handle alternative field names (temperature vs temp)', async () => {
            const altPayload = {
                end_device_ids: {
                    device_id: 'alt-device'
                },
                uplink_message: {
                    decoded_payload: {
                        temperature: 25.0,
                        humidity: 50.0,
                        battery: 3.5
                    },
                    received_at: '2026-02-02T17:00:00.000Z'
                }
            };

            const res = await request(app)
                .post('/api/webhook/ttn')
                .set('Authorization', 'Bearer TEST_TOKEN_123')
                .send(altPayload);

            expect(res.status).toBe(200);

            const measurement = await Measurement.findOne({
                deviceId: 'alt-device'
            });
            expect(measurement.temperature).toBe(25.0);
            expect(measurement.humidity).toBe(50.0);
            expect(measurement.battery).toBe(3.5);
        });
    });
});
