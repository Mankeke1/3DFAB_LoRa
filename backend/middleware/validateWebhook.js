const Joi = require('joi');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

/**
 * Validación de Schema del Payload Webhook TTN
 * IMPORTANTE: TTN envía el payload con estructura anidada específica
 * Ver: https://www.thethingsindustries.com/docs/integrations/webhooks/
 * 
 * Estructura REAL de TTN v3:
 * {
 *   "end_device_ids": { "device_id": "nodo-209", ... },
 *   "uplink_message": {
 *     "decoded_payload": { "p1": 12.3, "temp": 21.4, ... },
 *     "received_at": "2023-10-27T10:00:00Z"
 *   }
 * }
 */
const ttnPayloadSchema = Joi.object({
    // TTN v3 envía device_id dentro de end_device_ids
    end_device_ids: Joi.object({
        device_id: Joi.string().required(),
        application_ids: Joi.object().unknown(true),
        dev_eui: Joi.string(),
        join_eui: Joi.string(),
        dev_addr: Joi.string()
    }).required(),

    // Mensaje uplink con payload decodificado
    uplink_message: Joi.object({
        // Payload decodificado por el decoder de TTN
        // Soporta AMBOS formatos: abreviado (temp/hum/batt) y completo
        decoded_payload: Joi.object({
            p1: Joi.number().allow(null),
            p2: Joi.number().allow(null),
            // Soportar ambos nombres: abreviado y completo
            temp: Joi.number().allow(null),
            temperature: Joi.number().allow(null),
            hum: Joi.number().allow(null),
            humidity: Joi.number().allow(null),
            batt: Joi.number().allow(null),
            battery: Joi.number().allow(null)
        }).required(),
        // received_at está dentro de uplink_message, NO en la raíz
        received_at: Joi.string().isoDate().required()
    }).required()
}).unknown(true); // Permitir campos adicionales de TTN (correlationIds, etc)

/**
 * Función helper para normalizar el payload de TTN
 * Convierte la estructura de TTN a un formato interno consistente
 */
const normalizeTTNPayload = (rawPayload) => {
    const endDeviceIds = rawPayload.end_device_ids || {};
    const uplinkMessage = rawPayload.uplink_message || {};
    const decodedPayload = uplinkMessage.decoded_payload || {};

    return {
        // Extraer device_id de la ubicación correcta
        device_id: endDeviceIds.device_id,

        // received_at está en uplink_message, NO en la raíz
        received_at: uplinkMessage.received_at,

        // Normalizar nombres de campos (soportar ambos formatos)
        p1: decodedPayload.p1,
        p2: decodedPayload.p2,
        temperature: decodedPayload.temperature ?? decodedPayload.temp,
        humidity: decodedPayload.humidity ?? decodedPayload.hum,
        battery: decodedPayload.battery ?? decodedPayload.batt,

        // Mantener payload original para debugging
        rawPayload: rawPayload
    };
};

/**
 * Middleware de Autenticación de Token Webhook
 * Soporta tanto Bearer token como Basic Auth
 * Usa comparación timing-safe para prevenir timing attacks
 */
const validateWebhookAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.WEBHOOK_TOKEN;

    if (!authHeader) {
        console.warn(`[Webhook] Unauthorized: No auth header - IP: ${req.ip}`);
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authorization header required'
        });
    }

    let isValid = false;

    // Verificar Bearer token (comparación timing-safe)
    if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            // Usar comparación timing-safe para prevenir ataques de timing
            isValid = crypto.timingSafeEqual(
                Buffer.from(token),
                Buffer.from(expectedToken)
            );
        } catch (e) {
            // Longitudes no coinciden u otro error
            isValid = false;
        }
    }

    // Verificar Basic Auth (comparación timing-safe)
    if (authHeader.startsWith('Basic ')) {
        try {
            const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString();
            const [, password] = credentials.split(':');
            // Usar comparación timing-safe
            isValid = crypto.timingSafeEqual(
                Buffer.from(password),
                Buffer.from(expectedToken)
            );
        } catch (e) {
            // Error de decodificación o longitudes no coinciden
            isValid = false;
        }
    }

    if (!isValid) {
        console.warn(`[Webhook] Unauthorized: Invalid token - IP: ${req.ip}`);
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid authentication credentials'
        });
    }

    next();
};

/**
 * Middleware de Validación de Payload Webhook
 * Valida estructura TTN y normaliza los campos
 */
const validateWebhookPayload = (req, res, next) => {
    const { error, value } = ttnPayloadSchema.validate(req.body, {
        stripUnknown: false,
        abortEarly: false
    });

    if (error) {
        const details = error.details.map(d => d.message).join(', ');
        console.warn(`[Webhook] Invalid payload: ${details}`);
        console.warn(`[Webhook] Received payload structure:`, JSON.stringify(req.body, null, 2));
        return res.status(400).json({
            error: 'Bad Request',
            message: 'Invalid payload format',
            details: error.details.map(d => ({
                field: d.path.join('.'),
                message: d.message
            })),
            hint: 'TTN payload debe tener estructura: { end_device_ids: { device_id }, uplink_message: { decoded_payload, received_at } }'
        });
    }

    // Adjuntar payload NORMALIZADO al request (no el raw)
    req.validatedPayload = normalizeTTNPayload(value);
    next();
};

/**
 * Rate Limiter para Endpoint Webhook
 * Previene ataques DoS
 */
const webhookRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // Ventana de 1 minuto
    max: 100, // Máximo 100 requests por minuto por IP
    message: {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Usar X-Forwarded-For para requests con proxy (Coolify/Traefik), sino usar IP
        return req.headers['x-forwarded-for']?.split(',')[0] || req.ip;
    },
    handler: (req, res) => {
        console.warn(`[Webhook] Rate limit exceeded - IP: ${req.ip}`);
        res.setHeader('Retry-After', '60');
        res.status(429).json({
            error: 'Too Many Requests',
            message: 'Rate limit exceeded. Please try again in 60 seconds.',
            retryAfter: 60
        });
    }
});

/**
 * Middleware de Logging Estructurado para Webhook
 */
const webhookLogger = (req, res, next) => {
    const startTime = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        // Extraer device_id de la ubicación correcta de TTN
        const deviceId = req.body?.end_device_ids?.device_id || req.body?.device_id || 'unknown';
        const receivedAt = req.body?.uplink_message?.received_at || req.body?.received_at || 'unknown';

        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'webhook',
            requestId: req.id || 'N/A',
            deviceId,
            receivedAt,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip
        };

        if (res.statusCode >= 400) {
            console.error('[Webhook Log]', JSON.stringify(logEntry));
        } else {
            console.log('[Webhook Log]', JSON.stringify(logEntry));
        }
    });

    next();
};

module.exports = {
    validateWebhookAuth,
    validateWebhookPayload,
    webhookRateLimiter,
    webhookLogger,
    normalizeTTNPayload // Exportar para testing
};
