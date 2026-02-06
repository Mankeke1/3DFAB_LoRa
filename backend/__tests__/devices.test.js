/**
 * Pruebas de Rutas de Dispositivos
 */

const request = require('supertest');
const express = require('express');
const Device = require('../models/Device');
const Measurement = require('../models/Measurement');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

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

// Importar rutas de dispositivos
const devicesRoutes = require('../routes/devices');
app.use('/api/devices', devicesRoutes);

describe('Devices Endpoints', () => {
    let adminToken;
    let clientToken;
    let adminUser;
    let clientUser;

    beforeEach(async () => {
        // Crear usuario administrador
        adminUser = await User.create({
            username: 'admin',
            passwordHash: 'adminpass123',
            role: 'admin',
            assignedDevices: []
        });

        // Crear usuario cliente
        clientUser = await User.create({
            username: 'client',
            passwordHash: 'clientpass123',
            role: 'client',
            assignedDevices: ['device-001', 'device-002']
        });

        // Generar tokens
        adminToken = jwt.sign(
            { id: adminUser._id.toString(), username: 'admin', role: 'admin', assignedDevices: [] },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        clientToken = jwt.sign(
            { id: clientUser._id.toString(), username: 'client', role: 'client', assignedDevices: ['device-001', 'device-002'] },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Crear dispositivos de prueba
        await Device.create([
            { deviceId: 'device-001', name: 'Device 1', description: 'Test device 1' },
            { deviceId: 'device-002', name: 'Device 2', description: 'Test device 2' },
            { deviceId: 'device-003', name: 'Device 3', description: 'Test device 3' }
        ]);

        // Crear mediciones de prueba
        const now = new Date();
        await Measurement.create([
            { deviceId: 'device-001', receivedAt: new Date(now - 5 * 60 * 1000), temperature: 22.5, humidity: 60, p1: 10, p2: 20, battery: 3.7 },
            { deviceId: 'device-001', receivedAt: new Date(now - 10 * 60 * 1000), temperature: 22.0, humidity: 58, p1: 11, p2: 21, battery: 3.6 },
            { deviceId: 'device-001', receivedAt: new Date(now - 15 * 60 * 1000), temperature: 21.5, humidity: 55, p1: 12, p2: 22, battery: 3.5 },
            { deviceId: 'device-002', receivedAt: new Date(now - 60 * 60 * 1000), temperature: 25.0, humidity: 70, p1: 15, p2: 25, battery: 3.8 }
        ]);
    });

    describe('GET /api/devices', () => {
        it('should return all devices for admin', async () => {
            const res = await request(app)
                .get('/api/devices')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('count', 3);
            expect(res.body.devices).toHaveLength(3);
        });

        it('should return only assigned devices for client', async () => {
            const res = await request(app)
                .get('/api/devices')
                .set('Authorization', `Bearer ${clientToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('count', 2);
            expect(res.body.devices).toHaveLength(2);
        });

        it('should include status and lastMeasurement', async () => {
            const res = await request(app)
                .get('/api/devices')
                .set('Authorization', `Bearer ${adminToken}`);

            const device = res.body.devices.find(d => d.deviceId === 'device-001');
            expect(device).toHaveProperty('status');
            expect(device).toHaveProperty('lastSeen');
            expect(device).toHaveProperty('lastMeasurement');
            expect(device.lastMeasurement).toHaveProperty('temperature');
        });

        it('should reject request without token', async () => {
            const res = await request(app)
                .get('/api/devices');

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/devices/:id/latest', () => {
        it('should return latest measurement for device', async () => {
            const res = await request(app)
                .get('/api/devices/device-001/latest')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('device');
            expect(res.body.device.deviceId).toBe('device-001');
            expect(res.body).toHaveProperty('measurement');
            expect(res.body.measurement).toHaveProperty('temperature', 22.5);
        });

        it('should allow client to access assigned device', async () => {
            const res = await request(app)
                .get('/api/devices/device-001/latest')
                .set('Authorization', `Bearer ${clientToken}`);

            expect(res.status).toBe(200);
        });

        it('should deny client access to unassigned device', async () => {
            const res = await request(app)
                .get('/api/devices/device-003/latest')
                .set('Authorization', `Bearer ${clientToken}`);

            expect(res.status).toBe(403);
        });

        it('should return 404 for non-existent device', async () => {
            const res = await request(app)
                .get('/api/devices/nonexistent/latest')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });
    });

    describe('GET /api/devices/:id/measurements', () => {
        it('should return measurements for device', async () => {
            const res = await request(app)
                .get('/api/devices/device-001/measurements')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('deviceId', 'device-001');
            expect(res.body).toHaveProperty('count', 3);
            expect(res.body.measurements).toHaveLength(3);
        });

        it('should filter by variable', async () => {
            const res = await request(app)
                .get('/api/devices/device-001/measurements?variable=temperature')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.filters).toHaveProperty('variable', 'temperature');
        });

        it('should filter by date range', async () => {
            const start = new Date(Date.now() - 12 * 60 * 1000).toISOString();
            const end = new Date().toISOString();

            const res = await request(app)
                .get(`/api/devices/device-001/measurements?start=${start}&end=${end}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.count).toBe(2); // Solo las últimas 2 mediciones
        });

        it('should reject invalid variable', async () => {
            const res = await request(app)
                .get('/api/devices/device-001/measurements?variable=invalid')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Bad Request');
        });

        it('should reject invalid start date', async () => {
            const res = await request(app)
                .get('/api/devices/device-001/measurements?start=not-a-date')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Invalid start date');
        });

        it('should respect limit parameter', async () => {
            const res = await request(app)
                .get('/api/devices/device-001/measurements?limit=2')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.count).toBe(2);
        });
    });

    describe('GET /api/devices/:id/export.csv', () => {
        it('should export measurements as CSV', async () => {
            const res = await request(app)
                .get('/api/devices/device-001/export.csv')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.header['content-type']).toContain('text/csv');
            expect(res.header['content-disposition']).toContain('attachment');
            expect(res.header['content-disposition']).toContain('device-001');
            expect(res.text).toContain('deviceId');
            expect(res.text).toContain('temperature');
        });

        it('should export single variable CSV', async () => {
            const res = await request(app)
                .get('/api/devices/device-001/export.csv?variable=temperature')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.text).toContain('temperature');
            expect(res.text).not.toContain('humidity');
        });

        it('should reject invalid variable', async () => {
            const res = await request(app)
                .get('/api/devices/device-001/export.csv?variable=invalid')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
        });
    });
});
