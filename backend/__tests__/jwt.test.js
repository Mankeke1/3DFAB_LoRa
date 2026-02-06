/**
 * Pruebas de Utilidades JWT
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Generar claves de prueba antes de importar utilidades jwt
const keysDir = path.join(__dirname, '../keys');
if (!fs.existsSync(keysDir)) {
    fs.mkdirSync(keysDir, { recursive: true });
}

// Comprobar si existen claves, si no, crear claves de prueba
const privateKeyPath = path.join(keysDir, 'private.pem');
const publicKeyPath = path.join(keysDir, 'public.pem');

if (!fs.existsSync(privateKeyPath) || !fs.existsSync(publicKeyPath)) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });
    fs.writeFileSync(privateKeyPath, privateKey);
    fs.writeFileSync(publicKeyPath, publicKey);
}

const {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    keysExist
} = require('../utils/jwt');

describe('JWT Utilities', () => {
    const mockUser = {
        _id: '507f1f77bcf86cd799439011',
        username: 'testuser',
        role: 'client',
        assignedDevices: ['device-001', 'device-002']
    };

    describe('keysExist', () => {
        it('should return true when keys exist', () => {
            expect(keysExist()).toBe(true);
        });
    });

    describe('generateAccessToken', () => {
        it('should generate a valid JWT access token', () => {
            const token = generateAccessToken(mockUser);

            expect(token).toBeTruthy();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3); // JWT tiene 3 partes
        });

        it('should include user data in token payload', () => {
            const token = generateAccessToken(mockUser);
            const decoded = verifyAccessToken(token);

            expect(decoded).toHaveProperty('id', mockUser._id.toString());
            expect(decoded).toHaveProperty('username', mockUser.username);
            expect(decoded).toHaveProperty('role', mockUser.role);
            expect(decoded).toHaveProperty('assignedDevices');
            expect(decoded.assignedDevices).toEqual(mockUser.assignedDevices);
        });

        it('should include issuer and audience claims', () => {
            const token = generateAccessToken(mockUser);
            const decoded = verifyAccessToken(token);

            expect(decoded).toHaveProperty('iss', 'lora-backend');
            expect(decoded).toHaveProperty('aud', 'lora-frontend');
        });
    });

    describe('generateRefreshToken', () => {
        it('should generate a random hex string', () => {
            const token = generateRefreshToken();

            expect(token).toBeTruthy();
            expect(typeof token).toBe('string');
            expect(token.length).toBe(128); // 64 bytes hex = 128 caracteres
        });

        it('should generate unique tokens each time', () => {
            const token1 = generateRefreshToken();
            const token2 = generateRefreshToken();
            const token3 = generateRefreshToken();

            expect(token1).not.toBe(token2);
            expect(token2).not.toBe(token3);
            expect(token1).not.toBe(token3);
        });

        it('should only contain hexadecimal characters', () => {
            const token = generateRefreshToken();
            expect(/^[0-9a-f]+$/.test(token)).toBe(true);
        });
    });

    describe('verifyAccessToken', () => {
        it('should verify a valid token', () => {
            const token = generateAccessToken(mockUser);
            const decoded = verifyAccessToken(token);

            expect(decoded).toHaveProperty('id');
            expect(decoded).toHaveProperty('username');
            expect(decoded).toHaveProperty('role');
        });

        it('should throw error for invalid token', () => {
            expect(() => {
                verifyAccessToken('invalid.token.here');
            }).toThrow();
        });

        it('should throw error for malformed token', () => {
            expect(() => {
                verifyAccessToken('not-a-jwt');
            }).toThrow();
        });

        it('should throw error for empty token', () => {
            expect(() => {
                verifyAccessToken('');
            }).toThrow();
        });
    });
});
