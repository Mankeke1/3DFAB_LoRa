/**
 * Pruebas de Rutas de Autenticación
 */

const request = require('supertest');
const express = require('express');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');

// Crear aplicación de prueba
const app = express();
app.use(express.json());

// Mockear limitador de tasa para pruebas
jest.mock('express-rate-limit', () => {
    return () => (req, res, next) => next();
});

// Importar rutas de autenticación después del mock
const authRoutes = require('../routes/auth');
app.use('/api/auth', authRoutes);

describe('Auth Endpoints', () => {
    beforeEach(async () => {
        // Crear usuario de prueba con contraseña
        await User.create({
            username: 'testuser',
            passwordHash: 'testpass123', // Será hasheado por el hook pre-save
            role: 'client',
            assignedDevices: ['device-001']
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login with valid credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'testuser',
                    password: 'testpass123'
                });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('success', true);
            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
            expect(res.body).toHaveProperty('user');
            expect(res.body.user).toHaveProperty('username', 'testuser');
            expect(res.body.user).toHaveProperty('role', 'client');
        });

        it('should reject invalid username', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'nonexistent',
                    password: 'wrongpass'
                });

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error', 'No autorizado');
        });

        it('should reject invalid password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'testuser',
                    password: 'wrongpassword'
                });

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error', 'No autorizado');
        });

        it('should reject missing credentials', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({});

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error', 'Solicitud incorrecta');
        });

        it('should reject missing password', async () => {
            const res = await request(app)
                .post('/api/auth/login')
                .send({ username: 'testuser' });

            expect(res.status).toBe(400);
        });
    });

    describe('POST /api/auth/refresh', () => {
        let validRefreshToken;

        beforeEach(async () => {
            // Iniciar sesión para obtener un token de actualización
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'testuser',
                    password: 'testpass123'
                });

            validRefreshToken = loginRes.body.refreshToken;
        });

        it('should refresh access token with valid refresh token', async () => {
            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: validRefreshToken });

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('accessToken');
            expect(res.body).toHaveProperty('refreshToken');
            // El nuevo token de actualización debe ser diferente (rotación)
            expect(res.body.refreshToken).not.toBe(validRefreshToken);
        });

        it('should reject invalid refresh token', async () => {
            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: 'invalid-token' });

            expect(res.status).toBe(401);
            expect(res.body).toHaveProperty('error', 'No autorizado');
        });

        it('should reject missing refresh token', async () => {
            const res = await request(app)
                .post('/api/auth/refresh')
                .send({});

            expect(res.status).toBe(400);
        });

        it('should reject already used refresh token (rotation)', async () => {
            // Usar el token una vez
            await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: validRefreshToken });

            // Intentar usar el mismo token de nuevo
            const res = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: validRefreshToken });

            expect(res.status).toBe(401);
        });
    });

    describe('GET /api/auth/me', () => {
        let accessToken;

        beforeEach(async () => {
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({
                    username: 'testuser',
                    password: 'testpass123'
                });

            accessToken = loginRes.body.accessToken;
        });

        it('should return user info with valid token', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${accessToken}`);

            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('user');
            expect(res.body.user).toHaveProperty('username', 'testuser');
            expect(res.body.user).toHaveProperty('role', 'client');
        });

        it('should reject request without token', async () => {
            const res = await request(app)
                .get('/api/auth/me');

            expect(res.status).toBe(401);
        });

        it('should reject request with invalid token', async () => {
            const res = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalid-token');

            expect(res.status).toBe(401);
        });
    });
});
