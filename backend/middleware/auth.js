const { verifyAccessToken, keysExist } = require('../utils/jwt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

/**
 * JWT Authentication Middleware (RS256)
 * 
 * Extracts and verifies JWT from Authorization header.
 * Supports both RS256 (with keys) and HS256 (fallback for legacy tokens).
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'No token provided',
                message: 'Authorization header with Bearer token required'
            });
        }

        const token = authHeader.split(' ')[1];

        let decoded;

        // Try RS256 first (new tokens)
        if (keysExist()) {
            try {
                decoded = verifyAccessToken(token);
            } catch (rs256Error) {
                // If RS256 fails, try HS256 for backwards compatibility
                try {
                    decoded = jwt.verify(token, process.env.JWT_SECRET);
                    // Map old token fields to new format
                    if (decoded.userId && !decoded.id) {
                        decoded.id = decoded.userId;
                    }
                } catch (hs256Error) {
                    logger.warn('Token verification failed', {
                        rs256Error: rs256Error.message,
                        hs256Error: hs256Error.message,
                        requestId: req.id
                    });

                    if (rs256Error.message === 'Token expired' || hs256Error.name === 'TokenExpiredError') {
                        return res.status(401).json({
                            error: 'Token expired',
                            message: 'Please login again or use refresh token'
                        });
                    }

                    return res.status(401).json({
                        error: 'Invalid token',
                        message: 'Token verification failed'
                    });
                }
            }
        } else {
            // No RS256 keys, use HS256 only
            try {
                decoded = jwt.verify(token, process.env.JWT_SECRET);
                if (decoded.userId && !decoded.id) {
                    decoded.id = decoded.userId;
                }
            } catch (error) {
                if (error.name === 'TokenExpiredError') {
                    return res.status(401).json({
                        error: 'Token expired',
                        message: 'Please login again'
                    });
                }
                return res.status(401).json({
                    error: 'Invalid token',
                    message: 'Token verification failed'
                });
            }
        }

        // Get user from database to ensure they still exist
        const userId = decoded.id || decoded.userId;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(401).json({
                error: 'User not found',
                message: 'Token refers to non-existent user'
            });
        }

        // Attach user info to request
        req.user = {
            id: user._id.toString(),
            username: user.username,
            role: user.role,
            assignedDevices: user.assignedDevices || []
        };

        next();
    } catch (error) {
        logger.error('Auth middleware error', {
            error: error.message,
            requestId: req.id
        });
        return res.status(500).json({
            error: 'Authentication error',
            message: 'Internal server error during authentication'
        });
    }
};

/**
 * Role-based Authorization Middleware
 * @param {...string} roles - Roles allowed to access the route
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'Not authenticated',
                message: 'Authentication required'
            });
        }

        if (!roles.includes(req.user.role)) {
            logger.warn('Authorization failed', {
                userId: req.user.id,
                requiredRoles: roles,
                userRole: req.user.role,
                requestId: req.id
            });

            return res.status(403).json({
                error: 'Forbidden',
                message: `Access denied. Required roles: ${roles.join(', ')}`
            });
        }

        next();
    };
};

/**
 * Device Authorization Middleware
 * Verifies user has access to the specified device
 */
const authorizeDevice = (req, res, next) => {
    const deviceId = req.params.id || req.params.deviceId;

    if (!deviceId) {
        return res.status(400).json({
            error: 'Missing device ID',
            message: 'Device ID is required'
        });
    }

    // Admins have access to all devices
    if (req.user.role === 'admin') {
        return next();
    }

    // Clients can only access assigned devices
    if (req.user.assignedDevices.includes(deviceId)) {
        return next();
    }

    return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this device'
    });
};

module.exports = {
    authenticate,
    authorize,
    authorizeDevice
};
