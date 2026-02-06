const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const Device = require('../models/Device');
const Measurement = require('../models/Measurement');
const { authenticate, authorizeDevice } = require('../middleware/auth');
const { cache } = require('../config/redis');

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * GET /api/devices
 * Listar todos los dispositivos (filtrados por rol de usuario) con caché de Redis
 * - Admin: ve todos los dispositivos
 * - Client: ve solo los dispositivos asignados
 * - TTL de Caché: 30 segundos
 */
router.get('/', async (req, res) => {
    try {
        const { role, id: userId, assignedDevices } = req.user;

        // Generar clave de caché única por usuario
        const cacheKey = role === 'admin'
            ? 'devices:summary:all'
            : `devices:summary:user:${userId}`;

        // Intentar obtener desde caché
        const cached = await cache.get(cacheKey);
        if (cached) {
            console.log(`[Cache HIT] ${cacheKey}`);
            return res.json(cached);
        }

        console.log(`[Cache MISS] ${cacheKey}`);

        // Construir consulta basada en el rol
        let query = {};
        if (role === 'client') {
            query.deviceId = { $in: assignedDevices || [] };
        }

        const devices = await Device.find(query).sort({ deviceId: 1 });

        // Obtener última medición para cada dispositivo con cálculo de estado
        const devicesWithLatest = await Promise.all(
            devices.map(async (device) => {
                const latest = await Measurement.getLatest(device.deviceId);

                const lastSeen = latest?.receivedAt || device.updatedAt;
                const timeSinceLastMessage = Date.now() - new Date(lastSeen).getTime();
                const minutesSinceLastMessage = Math.floor(timeSinceLastMessage / 60000);

                // Semáforo: verde < 30min, rojo >= 30min
                const status = minutesSinceLastMessage < 30 ? 'online' : 'offline';

                return {
                    ...device.toObject(),
                    status,
                    lastSeen,
                    minutesSinceLastMessage,
                    lastMeasurement: latest ? {
                        receivedAt: latest.receivedAt,
                        p1: latest.p1,
                        p2: latest.p2,
                        temperature: latest.temperature,
                        humidity: latest.humidity,
                        battery: latest.battery
                    } : null
                };
            })
        );

        const response = {
            success: true,
            count: devicesWithLatest.length,
            devices: devicesWithLatest
        };

        // Guardar en caché (TTL 30 segundos)
        await cache.set(cacheKey, response, 30);

        res.json(response);

    } catch (error) {
        console.error('[Devices] List error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch devices'
        });
    }
});

/**
 * GET /api/devices/:id/latest
 * Obtener la última medición para un dispositivo específico
 */
router.get('/:id/latest', authorizeDevice, async (req, res) => {
    try {
        const { id } = req.params;

        const device = await Device.findOne({ deviceId: id });

        if (!device) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Device not found'
            });
        }

        const latest = await Measurement.getLatest(id);

        res.json({
            success: true,
            device: {
                deviceId: device.deviceId,
                name: device.name,
                description: device.description
            },
            measurement: latest ? {
                receivedAt: latest.receivedAt,
                p1: latest.p1,
                p2: latest.p2,
                temperature: latest.temperature,
                humidity: latest.humidity,
                battery: latest.battery
            } : null
        });

    } catch (error) {
        console.error('[Devices] Latest error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch latest measurement'
        });
    }
});

/**
 * GET /api/devices/:id/measurements
 * Obtener mediciones históricas con filtros opcionales
 * 
 * Query params:
 * - start: fecha formato ISO (opcional)
 * - end: fecha formato ISO (opcional)
 * - variable: p1|p2|temperature|humidity|battery (opcional)
 * - limit: número (default: 1000)
 */
router.get('/:id/measurements', authorizeDevice, async (req, res) => {
    try {
        const { id } = req.params;
        const { start, end, variable, limit = 1000 } = req.query;

        // Validar variable si se proporciona
        const validVariables = ['p1', 'p2', 'temperature', 'humidity', 'battery'];
        if (variable && !validVariables.includes(variable)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: `Invalid variable. Must be one of: ${validVariables.join(', ')}`
            });
        }

        // Construir consulta
        const query = { deviceId: id };

        if (start || end) {
            query.receivedAt = {};
            if (start) {
                const startDate = new Date(start);
                if (isNaN(startDate)) {
                    return res.status(400).json({
                        error: 'Bad Request',
                        message: 'Invalid start date format'
                    });
                }
                query.receivedAt.$gte = startDate;
            }
            if (end) {
                const endDate = new Date(end);
                if (isNaN(endDate)) {
                    return res.status(400).json({
                        error: 'Bad Request',
                        message: 'Invalid end date format'
                    });
                }
                query.receivedAt.$lte = endDate;
            }
        }

        // Construir proyección
        let projection = { deviceId: 1, receivedAt: 1 };
        if (variable) {
            projection[variable] = 1;
        } else {
            projection = { deviceId: 1, receivedAt: 1, p1: 1, p2: 1, temperature: 1, humidity: 1, battery: 1 };
        }

        const measurements = await Measurement.find(query, projection)
            .sort({ receivedAt: -1 })
            .limit(parseInt(limit))
            .exec();

        res.json({
            success: true,
            deviceId: id,
            count: measurements.length,
            filters: { start, end, variable },
            measurements
        });

    } catch (error) {
        console.error('[Devices] Measurements error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch measurements'
        });
    }
});

/**
 * GET /api/devices/:id/export.csv
 * Exportar mediciones como archivo CSV
 * 
 * Query params: igual que /measurements
 */
router.get('/:id/export.csv', authorizeDevice, async (req, res) => {
    try {
        const { id } = req.params;
        const { start, end, variable, limit = 10000 } = req.query;

        // Validar variable si se proporciona
        const validVariables = ['p1', 'p2', 'temperature', 'humidity', 'battery'];
        if (variable && !validVariables.includes(variable)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: `Invalid variable. Must be one of: ${validVariables.join(', ')}`
            });
        }

        // Construir consulta
        const query = { deviceId: id };

        if (start || end) {
            query.receivedAt = {};
            if (start) query.receivedAt.$gte = new Date(start);
            if (end) query.receivedAt.$lte = new Date(end);
        }

        // Construir proyección
        let fields = ['deviceId', 'receivedAt'];
        if (variable) {
            fields.push(variable);
        } else {
            fields = [...fields, 'p1', 'p2', 'temperature', 'humidity', 'battery'];
        }

        const measurements = await Measurement.find(query)
            .select(fields.join(' '))
            .sort({ receivedAt: -1 })
            .limit(parseInt(limit))
            .lean()
            .exec();

        // Convertir a CSV
        const parser = new Parser({ fields });
        const csv = parser.parse(measurements.map(m => ({
            ...m,
            receivedAt: m.receivedAt.toISOString()
        })));

        // Configurar cabeceras para descarga de archivo
        const filename = `${id}_measurements_${new Date().toISOString().split('T')[0]}.csv`;
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);

    } catch (error) {
        console.error('[Devices] Export error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to export data'
        });
    }
});

module.exports = router;
