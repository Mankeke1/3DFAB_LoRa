/**
 * JWT Utilities with RS256 Algorithm
 * 
 * This module provides functions for generating and verifying JWTs using RS256.
 * RS256 (RSA Signature with SHA-256) uses asymmetric keys for signing.
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Key paths
const PRIVATE_KEY_PATH = path.join(__dirname, '../keys/private.pem');
const PUBLIC_KEY_PATH = path.join(__dirname, '../keys/public.pem');

// Token expiration settings
const ACCESS_TOKEN_EXPIRATION = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRATION_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

// Lazy-load keys (only when needed)
let privateKey = null;
let publicKey = null;

/**
 * Load private key (for signing tokens)
 */
function getPrivateKey() {
    if (!privateKey) {
        try {
            privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
        } catch (error) {
            throw new Error(`Failed to load private key: ${error.message}. Run 'npm run generate-keys' first.`);
        }
    }
    return privateKey;
}

/**
 * Load public key (for verifying tokens)
 */
function getPublicKey() {
    if (!publicKey) {
        try {
            publicKey = fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
        } catch (error) {
            throw new Error(`Failed to load public key: ${error.message}. Run 'npm run generate-keys' first.`);
        }
    }
    return publicKey;
}

/**
 * Generate Access Token (RS256, expires in 15 minutes)
 * @param {Object} user - User object with _id, username, role, assignedDevices
 * @returns {string} JWT access token
 */
function generateAccessToken(user) {
    const payload = {
        id: user._id.toString(),
        username: user.username,
        role: user.role,
        assignedDevices: user.assignedDevices || []
    };

    return jwt.sign(payload, getPrivateKey(), {
        algorithm: 'RS256',
        expiresIn: ACCESS_TOKEN_EXPIRATION,
        issuer: 'lora-backend',
        audience: 'lora-frontend'
    });
}

/**
 * Generate Refresh Token (random hex string)
 * @returns {string} 128-character hex string
 */
function generateRefreshToken() {
    return crypto.randomBytes(64).toString('hex');
}

/**
 * Verify Access Token (RS256)
 * @param {string} token - JWT to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
function verifyAccessToken(token) {
    try {
        return jwt.verify(token, getPublicKey(), {
            algorithms: ['RS256'],
            issuer: 'lora-backend',
            audience: 'lora-frontend'
        });
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Token expired');
        }
        if (error.name === 'JsonWebTokenError') {
            throw new Error('Invalid token');
        }
        throw new Error(`Token verification failed: ${error.message}`);
    }
}

/**
 * Calculate refresh token expiration date
 * @returns {Date} Expiration date
 */
function getRefreshTokenExpiration() {
    return new Date(Date.now() + REFRESH_TOKEN_EXPIRATION_SECONDS * 1000);
}

/**
 * Check if keys exist
 * @returns {boolean} True if both keys exist
 */
function keysExist() {
    try {
        fs.accessSync(PRIVATE_KEY_PATH);
        fs.accessSync(PUBLIC_KEY_PATH);
        return true;
    } catch {
        return false;
    }
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyAccessToken,
    getRefreshTokenExpiration,
    keysExist,
    ACCESS_TOKEN_EXPIRATION,
    REFRESH_TOKEN_EXPIRATION_SECONDS
};
