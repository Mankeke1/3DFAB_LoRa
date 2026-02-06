/** Para produccion a futuro cambiar el orden de "acknowledge first, process later" 
 *  E implementar cola de procesamiento (Redis queue o bull) solo faltaria el battle hardening para producción de
 *  Miles de nodos en caso hipotetico
 */

const express = require('express');
const router = express.Router();
const Measurement = require('../models/Measurement');
const Device = require('../models/Device');
const { cache } = require('../config/redis');
const {
    validateWebhookAuth,
    validateWebhookPayload,
    webhookRateLimiter,
    webhookLogger
} = require('../middleware/validateWebhook');

/**
 * POST /api/webhook/ttn
 * Recibe mensajes uplink desde TTN (The Things Network)
 * 
 * Formato del payload TTN v3 (REAL):
 * {
 *   "end_device_ids": { "device_id": "nodo-209" },
 *   "uplink_message": {
 *     "decoded_payload": { "p1": 15.2, "temp": 19.5, "hum": 61.3, "batt": 3.85 },
 *     "received_at": "2026-01-28T22:15:00.000Z"
 *   }
 * }
 * 
 * El middleware normaliza esto a:
 * {
 *   device_id: "nodo-209",
 *   received_at: "2026-01-28T22:15:00.000Z",
 *   p1, p2, temperature, humidity, battery,
 *   rawPayload: { ...original }
 * }
 */
router.post('/ttn',
    webhookRateLimiter,
    webhookLogger,
    validateWebhookAuth,
    validateWebhookPayload,
    async (req, res) => {
        try {
            // El payload ya viene NORMALIZADO por el middleware
            const normalizedPayload = req.validatedPayload;

            // Crear registro de medición
            const measurement = new Measurement({
                deviceId: normalizedPayload.device_id,
                receivedAt: new Date(normalizedPayload.received_at),
                p1: normalizedPayload.p1,
                p2: normalizedPayload.p2,
                temperature: normalizedPayload.temperature,
                humidity: normalizedPayload.humidity,
                battery: normalizedPayload.battery,
                rawPayload: normalizedPayload.rawPayload
            });

            await measurement.save();

            // Auto-crear dispositivo si no existe (idempotente)
            await Device.findOneAndUpdate(
                { deviceId: normalizedPayload.device_id },
                {
                    $setOnInsert: {
                        deviceId: normalizedPayload.device_id,
                        name: `Nodo ${normalizedPayload.device_id.replace('nodo-', '')}`,
                        description: 'Auto-creado desde webhook TTN',
                        createdAt: new Date()
                    },
                    $set: { updatedAt: new Date() }
                },
                { upsert: true, new: true }
            );

            // Invalidar caché cuando llegan nuevos datos
            await cache.invalidatePattern('devices:summary:*');

            // Publicar evento de invalidación (para futuras actualizaciones en tiempo real)
            await cache.publish('webhook:new-data', {
                deviceId: normalizedPayload.device_id,
                timestamp: new Date().toISOString()
            });

            console.log(`[Webhook] ✓ Datos guardados + caché invalidado para: ${normalizedPayload.device_id}`);

            res.status(200).json({
                success: true,
                message: 'Data received and stored',
                deviceId: normalizedPayload.device_id,
                receivedAt: normalizedPayload.received_at
            });

        } catch (error) {
            console.error('[Webhook] Error guardando datos:', error);

            // Manejar error de duplicado (idempotencia - el mismo dato ya existe)
            if (error.code === 11000) {
                return res.status(200).json({
                    success: true,
                    message: 'Data already exists (duplicate)',
                    deviceId: req.validatedPayload?.device_id || 'unknown'
                });
            }

            res.status(500).json({
                error: 'Internal Server Error',
                message: 'Failed to store measurement data'
            });
        }
    }
);

module.exports = router;
