require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');

// Importar logger primero
const logger = require('./config/logger');

// Validar variables de entorno requeridas al inicio
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'WEBHOOK_TOKEN'];
const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
if (missingEnvVars.length > 0) {
    logger.error('Missing required environment variables', { missing: missingEnvVars });
    process.exit(1);
}

// Importar rutas
const webhookRoutes = require('./routes/webhook');
const authRoutes = require('./routes/auth');
const devicesRoutes = require('./routes/devices');
const usersRoutes = require('./routes/users');

// Importar middleware
const { requestIdMiddleware } = require('./middleware/requestId');
const { requestLogger } = require('./middleware/requestLogger');

// Importar Redis
const { redis } = require('./config/redis');

const app = express();
const PORT = process.env.PORT || 3000;

// ===================
// Seguridad y Middleware
// ===================

// Helmet para headers de seguridad HTTP
app.use(helmet());

// ===================
// Middleware
// ===================

// Configuración CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173']; // Default para desarrollo

app.use(cors({
    origin: (origin, callback) => {
        // Permitir requests sin origin (mobile apps, curl, Postman)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            logger.warn('CORS rejected origin', { origin });
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
}));

// Parsers de body
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Seguimiento de Request ID
app.use(requestIdMiddleware);

// Request logging (Winston-based)
app.use(requestLogger);

// ===================
// Rutas
// ===================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Readiness check (para Kubernetes/Coolify)
app.get('/api/ready', async (req, res) => {
    try {
        // Hacer ping activo a MongoDB
        await mongoose.connection.db.admin().ping();
        res.json({
            status: 'ready',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(503).json({
            status: 'not ready',
            error: 'MongoDB not accessible'
        });
    }
});

// Rutas de API
app.use('/api/webhook', webhookRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/devices', devicesRoutes);
app.use('/api/users', usersRoutes);

// ===================
// Manejo de Errores
// ===================

// Manejador 404
app.use((req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.path} not found`
    });
});

// Manejador global de errores
app.use((err, req, res, next) => {
    logger.error('Unhandled error', {
        error: err.message,
        stack: err.stack,
        requestId: req.id,
        path: req.path,
        method: req.method
    });

    // Error de validación de Mongoose
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            message: err.message,
            details: Object.values(err.errors).map(e => e.message)
        });
    }

    // Error de cast de Mongoose (ObjectId inválido)
    if (err.name === 'CastError') {
        return res.status(400).json({
            error: 'Invalid ID',
            message: 'The provided ID is not valid'
        });
    }

    // Errores de JWT
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Invalid Token',
            message: 'The provided token is invalid'
        });
    }

    // Error por defecto
    res.status(err.status || 500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production'
            ? 'An error occurred'
            : err.message
    });
});

// ===================
// Base de Datos y Servidor
// ===================

const startServer = async () => {
    try {
        // Connect to MongoDB
        logger.info('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, {
            // Mongoose 8.x uses default options
        });
        logger.info('MongoDB connected successfully');

        // Test Redis connection (optional - app works without it)
        try {
            await redis.ping();
            logger.info('Redis connected successfully');
        } catch (redisError) {
            logger.warn('Redis not available (caching disabled)', { error: redisError.message });
        }

        // Start server
        app.listen(PORT, () => {
            logger.info('Server started', {
                port: PORT,
                env: process.env.NODE_ENV || 'development',
                mongodb: 'connected'
            });
            console.log(`
╔════════════════════════════════════════════╗
║   LoRa Webhook Server                      ║
╠════════════════════════════════════════════╣
║   Port:     ${PORT}                            ║
║   Env:      ${process.env.NODE_ENV || 'development'}                   ║
║   MongoDB:  Connected                      ║
╚════════════════════════════════════════════╝

Endpoints:
  POST /api/webhook/ttn    - TTN webhook receiver
  POST /api/auth/login     - User authentication
  GET  /api/devices        - List devices
  GET  /api/devices/:id/*  - Device data
  GET  /api/users          - User management (admin)
  GET  /api/health         - Health check
      `);
        });

    } catch (error) {
        logger.error('Failed to start server', { error: error.message, stack: error.stack });
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGINT', async () => {
    logger.info('Shutting down gracefully...');
    await mongoose.connection.close();
    await redis.quit().catch(() => { }); // Ignore Redis close errors
    logger.info('Connections closed');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down...');
    await mongoose.connection.close();
    await redis.quit().catch(() => { });
    process.exit(0);
});

startServer();

