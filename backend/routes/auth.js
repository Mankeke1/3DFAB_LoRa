const express = require('express');
const router = express.Router();
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const AuditLog = require('../models/AuditLog');
const {
    generateAccessToken,
    generateRefreshToken,
    getRefreshTokenExpiration,
    keysExist
} = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');
const logger = require('../config/logger');
const rateLimit = require('express-rate-limit');

// Limitador de tasa para intentos de inicio de sesión
// TEMPORALMENTE DESHABILITADO PARA TESTS
// Login rate limit: 5 intentos por ventana de 5 minutos (típicamente por IP).
// Si se excede, responde 429 y el cliente debe esperar al reset (ver RateLimit-* / Retry-After headers).

const loginLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 10, // 10 intentos por ventana
    message: {
        error: 'Muchos intentos de inicio de sesión',
        message: 'Demasiados intentos de inicio de sesión. Por favor inténtelo de nuevo en 5 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false
});


// Rate limiter deshabilitado (para testing)
/**
 * POST /api/auth/login
 * Autenticar usuario y devolver tokens
 * 
 * Body: { username, password }
 * Retorna: { accessToken, refreshToken, user }
 */
router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;

        // Validar entrada
        if (!username || !password) {
            return res.status(400).json({
                error: 'Solicitud incorrecta',
                message: 'Nombre de usuario y contraseña son requeridos'
            });
        }

        // Buscar usuario
        const user = await User.findOne({ username: username.toLowerCase().trim() });

        if (!user) {
            logger.warn('Fallido: Usuario no encontrado', { username });
            return res.status(401).json({
                error: 'No autorizado',
                message: 'Nombre de usuario o contraseña inválidos'
            });
        }

        // Verificar contraseña
        const isValidPassword = await user.comparePassword(password);

        if (!isValidPassword) {
            logger.warn('Fallido: Contraseña inválida', { username });

            await AuditLog.log('LOGIN_FAILED', {
                targetId: user._id.toString(),
                ipAddress: req.ip,
                userAgent: req.get('user-agent'),
                details: { reason: 'Contraseña inválida' }
            });

            return res.status(401).json({
                error: 'No autorizado',
                message: 'Nombre de usuario o contraseña inválidos'
            });
        }

        // Generar tokens
        let accessToken;
        if (keysExist()) {
            // Use RS256 with asymmetric keys
            accessToken = generateAccessToken(user);
        } else {
            // Fallback to HS256 if keys don't exist
            const jwt = require('jsonwebtoken');
            accessToken = jwt.sign(
                {
                    id: user._id.toString(),
                    username: user.username,
                    role: user.role,
                    assignedDevices: user.assignedDevices || []
                },
                process.env.JWT_SECRET,
                { expiresIn: '2h' }
            );
        }

        const refreshToken = generateRefreshToken();

        // Guardar token de actualización en base de datos
        await RefreshToken.create({
            token: refreshToken,
            userId: user._id,
            expiresAt: getRefreshTokenExpiration(),
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        // Audit log
        await AuditLog.log('INICIO_SESION_EXITOSO', {
            userId: user._id,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        logger.info('Inicio de sesión exitoso', { userId: user._id.toString(), username });

        res.json({
            success: true,
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                assignedDevices: user.assignedDevices
            }
        });

    } catch (error) {
        logger.error('Error de inicio de sesión', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Error Interno del Servidor',
            message: 'Inicio de sesión fallido'
        });
    }
});

/**
 * POST /api/auth/refresh
 * Actualizar token de acceso usando token de actualización
 * 
 * Body: { refreshToken }
 * Retorna: { accessToken, refreshToken }
 */
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                error: 'Solicitud incorrecta',
                message: 'Token de actualización requerido'
            });
        }

        // Buscar token de actualización válido
        const tokenDoc = await RefreshToken.findValid(refreshToken);

        if (!tokenDoc) {
            logger.warn('Actualización fallida: token inválido o expirado');
            return res.status(401).json({
                error: 'No autorizado',
                message: 'Token de actualización inválido o expirado'
            });
        }

        // Obtener usuario
        const user = await User.findById(tokenDoc.userId);
        if (!user) {
            return res.status(401).json({
                error: 'No autorizado',
                message: 'Usuario no encontrado'
            });
        }

        // Generar nuevos tokens (rotación de tokens)
        let newAccessToken;
        if (keysExist()) {
            newAccessToken = generateAccessToken(user);
        } else {
            const jwt = require('jsonwebtoken');
            newAccessToken = jwt.sign(
                {
                    id: user._id.toString(),
                    username: user.username,
                    role: user.role,
                    assignedDevices: user.assignedDevices || []
                },
                process.env.JWT_SECRET,
                { expiresIn: '2h' }
            );
        }

        const newRefreshToken = generateRefreshToken();

        // Revocar token antiguo (marcar como reemplazado)
        await tokenDoc.revoke(newRefreshToken);

        // Crear nuevo token de actualización
        await RefreshToken.create({
            token: newRefreshToken,
            userId: user._id,
            expiresAt: getRefreshTokenExpiration(),
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        await AuditLog.log('TOKEN_REFRESHED', {
            userId: user._id,
            ipAddress: req.ip
        });

        logger.info('Token actualizado', { userId: user._id.toString() });

        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });

    } catch (error) {
        logger.error('Error de actualización', { error: error.message });
        res.status(500).json({
            error: 'Error Interno del Servidor',
            message: 'Falló la actualización del token'
        });
    }
});

/**
 * POST /api/auth/logout
 * Invalidar token de actualización
 * 
 * Body: { refreshToken }
 */
router.post('/logout', authenticate, async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
            // Revocar token de actualización específico
            const tokenDoc = await RefreshToken.findOne({ token: refreshToken });
            if (tokenDoc) {
                await tokenDoc.revoke();
            }
        }

        await AuditLog.log('LOGOUT', {
            userId: req.user.id,
            ipAddress: req.ip
        });

        logger.info('Cierre de sesión exitoso', { userId: req.user.id });

        res.json({
            success: true,
            message: 'Sesión cerrada exitosamente'
        });

    } catch (error) {
        logger.error('Error de cierre de sesión', { error: error.message });
        res.status(500).json({
            error: 'Error Interno del Servidor',
            message: 'Falló el cierre de sesión'
        });
    }
});

/**
 * POST /api/auth/logout-all
 * Revocar todos los tokens de actualización del usuario (cerrar sesión en todos los dispositivos)
 */
router.post('/logout-all', authenticate, async (req, res) => {
    try {
        const result = await RefreshToken.revokeAllForUser(req.user.id);

        await AuditLog.log('TOKEN_REVOKED', {
            userId: req.user.id,
            ipAddress: req.ip,
            details: { revokedCount: result.modifiedCount }
        });

        logger.info('Todos los tokens revocados', {
            userId: req.user.id,
            revokedCount: result.modifiedCount
        });

        res.json({
            success: true,
            message: 'Sesión cerrada en todos los dispositivos',
            revokedCount: result.modifiedCount
        });

    } catch (error) {
        logger.error('Error al cerrar todas las sesiones', { error: error.message });
        res.status(500).json({
            error: 'Error Interno del Servidor',
            message: 'Falló el cierre de sesión en todos los dispositivos'
        });
    }
});

/**
 * GET /api/auth/me
 * Obtener información del usuario actual
 */
router.get('/me', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                error: 'No Encontrado',
                message: 'Usuario no encontrado'
            });
        }

        res.json({
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                assignedDevices: user.assignedDevices
            }
        });
    } catch (error) {
        logger.error('Error al obtener usuario', { error: error.message });
        res.status(500).json({
            error: 'Error Interno del Servidor',
            message: 'Fallo al obtener información del usuario'
        });
    }
});

module.exports = router;
