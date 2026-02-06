/**
 * Pruebas de Rutas de Usuarios
 */

const request = require('supertest');
const express = require('express');
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

// Importar rutas de usuarios
const usersRoutes = require('../routes/users');
app.use('/api/users', usersRoutes);

describe('Users Endpoints', () => {
    let adminToken;
    let clientToken;
    let adminUser;
    let clientUser;
    let targetUser;

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
            assignedDevices: ['device-001']
        });

        // Crear usuario objetivo para pruebas
        targetUser = await User.create({
            username: 'targetuser',
            passwordHash: 'targetpass123',
            role: 'client',
            assignedDevices: ['device-002']
        });

        // Generar tokens
        adminToken = jwt.sign(
            { id: adminUser._id.toString(), username: 'admin', role: 'admin', assignedDevices: [] },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        clientToken = jwt.sign(
            { id: clientUser._id.toString(), username: 'client', role: 'client', assignedDevices: ['device-001'] },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
    });

    describe('GET /api/users', () => {
        it('should return all users for admin', async () => {
            const res = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('count', 3);
            expect(res.body.users).toHaveLength(3);
        });

        it('should reject request from client', async () => {
            const res = await request(app)
                .get('/api/users')
                .set('Authorization', `Bearer ${clientToken}`);

            expect(res.status).toBe(403);
        });

        it('should reject request without token', async () => {
            const res = await request(app)
                .get('/api/users');

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/users/:id', () => {
        it('should return single user for admin', async () => {
            const res = await request(app)
                .get(`/api/users/${targetUser._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body.user).toHaveProperty('username', 'targetuser');
        });

        it('should return 404 for non-existent user', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .get(`/api/users/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });
    });

    describe('POST /api/users', () => {
        it('should create new user', async () => {
            const res = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    username: 'newuser',
                    password: 'newpass123',
                    role: 'client',
                    assignedDevices: ['device-003']
                });

            expect(res.status).toBe(201);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body.user).toHaveProperty('username', 'newuser');
            expect(res.body.user).toHaveProperty('role', 'client');
        });

        it('should reject duplicate username', async () => {
            const res = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    username: 'admin',
                    password: 'newpass123'
                });

            expect(res.status).toBe(409);
            expect(res.body).toHaveProperty('error', 'Conflict');
        });

        it('should reject missing username', async () => {
            const res = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    password: 'newpass123'
                });

            expect(res.status).toBe(400);
        });

        it('should reject missing password', async () => {
            const res = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    username: 'newuser'
                });

            expect(res.status).toBe(400);
        });

        it('should reject invalid role', async () => {
            const res = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    username: 'newuser',
                    password: 'newpass123',
                    role: 'superadmin'
                });

            expect(res.status).toBe(400);
        });

        it('should default role to client if not specified', async () => {
            const res = await request(app)
                .post('/api/users')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    username: 'defaultrole',
                    password: 'pass123'
                });

            expect(res.status).toBe(201);
            expect(res.body.user).toHaveProperty('role', 'client');
        });
    });

    describe('PUT /api/users/:id', () => {
        it('should update user', async () => {
            const res = await request(app)
                .put(`/api/users/${targetUser._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    role: 'admin',
                    assignedDevices: ['device-001', 'device-002']
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body.user).toHaveProperty('role', 'admin');
        });

        it('should update username', async () => {
            const res = await request(app)
                .put(`/api/users/${targetUser._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    username: 'updateduser'
                });

            expect(res.status).toBe(200);
            expect(res.body.user).toHaveProperty('username', 'updateduser');
        });

        it('should reject duplicate username on update', async () => {
            const res = await request(app)
                .put(`/api/users/${targetUser._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    username: 'admin'
                });

            expect(res.status).toBe(409);
        });

        it('should return 404 for non-existent user', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .put(`/api/users/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    role: 'admin'
                });

            expect(res.status).toBe(404);
        });

        it('should reject invalid role', async () => {
            const res = await request(app)
                .put(`/api/users/${targetUser._id}`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    role: 'superadmin'
                });

            expect(res.status).toBe(400);
        });
    });

    describe('DELETE /api/users/:id', () => {
        it('should delete user', async () => {
            const res = await request(app)
                .delete(`/api/users/${targetUser._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);

            // Verificar que el usuario fue eliminado
            const deletedUser = await User.findById(targetUser._id);
            expect(deletedUser).toBeNull();
        });

        it('should prevent self-deletion', async () => {
            const res = await request(app)
                .delete(`/api/users/${adminUser._id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body.message).toContain('Cannot delete your own account');
        });

        it('should return 404 for non-existent user', async () => {
            const fakeId = '507f1f77bcf86cd799439011';
            const res = await request(app)
                .delete(`/api/users/${fakeId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(404);
        });
    });
});
