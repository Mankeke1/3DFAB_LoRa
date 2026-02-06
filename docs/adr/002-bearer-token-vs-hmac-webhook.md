# ADR-002: Bearer Token vs HMAC para Autenticación del Webhook

**Estado**: Aceptado  
**Fecha**: 2026-02-03  
**Autores**: Equipo de Desarrollo

---

## Contexto

The Things Network (TTN) envía datos de sensores a nuestro endpoint webhook. Necesitábamos autenticar que las solicitudes entrantes son legítimamente de TTN y no de actores maliciosos.

Consideramos dos métodos de autenticación:

1. **Bearer Token** - Token estático en header Authorization
2. **Firma HMAC** - Verificación de firma de solicitud

### Requisitos de Seguridad

- Prevenir inyección de datos no autorizados
- Protección contra ataques de replay (opcional)
- Configuración simple en la Consola TTN
- Baja sobrecarga computacional

---

## Decisión

Elegimos **autenticación Bearer Token** para el webhook TTN.

```
POST /api/webhook/ttn
Authorization: Bearer <WEBHOOK_TOKEN>
```

### Implementación

```javascript
// middleware/validateWebhook.js
const crypto = require('crypto');

const validateWebhookAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.WEBHOOK_TOKEN;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization required' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Comparación timing-safe para prevenir ataques de timing
    try {
        const isValid = crypto.timingSafeEqual(
            Buffer.from(token),
            Buffer.from(expectedToken)
        );
        if (!isValid) throw new Error();
    } catch {
        return res.status(401).json({ error: 'Invalid token' });
    }
    
    next();
};
```

### Razones

1. **Soporte Nativo TTN**
   - La Consola TTN tiene configuración Bearer token incorporada
   - No se necesita manipulación de headers personalizada
   - Funciona out-of-the-box con integración HTTP de TTN

2. **Simplicidad**
   - Configuración con una sola variable de entorno
   - Sin cálculos criptográficos por solicitud
   - Fácil rotación de token si está comprometido

3. **Defensa en Profundidad**
   - Combinado con HTTPS para seguridad de transporte
   - Rate limiting previene ataques de fuerza bruta
   - Tracking de Request ID para auditoría

4. **Baja Latencia**
   - Comparación simple de strings (timing-safe)
   - Sin sobrecarga de cálculo HMAC
   - Importante para llamadas webhook de alta frecuencia

### Alternativa Rechazada: Firma HMAC

La verificación de firma HMAC proporciona:

- Verificación de integridad de solicitud
- Protección contra ataques de replay (con timestamp/nonce)
- No repudio

Sin embargo, fue rechazada porque:

- TTN no soporta firma HMAC nativamente
- Requeriría formatter de payload TTN personalizado
- Complejidad añadida para beneficio mínimo sobre HTTPS+Bearer
- Validación de timestamp requiere sincronización de reloj

---

## Consecuencias

### Positivas

- Cero configuración en lado TTN (solo pegar token)
- Impacto mínimo en latencia
- Fácil rotación de token vía variable de entorno

### Negativas

- Sin verificación de integridad de solicitud (mitigado por HTTPS)
- Sin protección contra replay (mitigado por claves de idempotencia)
- El token debe mantenerse secreto

### Mitigaciones

1. **Solo HTTPS**: Todo el tráfico webhook usa cifrado TLS
2. **Idempotencia**: Índice único en `{deviceId, receivedAt}` previene procesamiento duplicado
3. **Rate Limiting**: 100 solicitudes por minuto por IP
4. **Rotación de Token**: Se puede cambiar `WEBHOOK_TOKEN` y actualizar en Consola TTN

---

## ADRs Relacionados

- ADR-003: Short Polling vs WebSockets

## Notas

Si TTN agrega soporte HMAC nativo en el futuro, deberíamos reconsiderar esta decisión para seguridad mejorada.
