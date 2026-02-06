# ADR-003: Short Polling vs WebSockets para Actualizaciones en Tiempo Real

**Estado**: Aceptado  
**Fecha**: 2026-02-04  
**Autores**: Equipo de Desarrollo

---

## Contexto

El dashboard LoRa necesita mostrar datos de sensores casi en tiempo real. Cuando llegan nuevas mediciones vía webhook, el frontend debe actualizarse para mostrar los últimos valores.

Consideramos tres enfoques:

1. **Short Polling** - El frontend solicita actualizaciones periódicamente
2. **Long Polling** - El servidor mantiene la conexión hasta nuevos datos
3. **WebSockets** - Conexión bidireccional en tiempo real

### Requisitos

- Actualizaciones dentro de 30 segundos de nuevos datos
- Uso mínimo de recursos del servidor
- Funciona a través de proxies/firewalls corporativos
- Implementación simple para equipo pequeño

---

## Decisión

Elegimos **Short Polling** (TTL de caché de 30 segundos con refresco del frontend).

### Implementación

**Frontend:**

```javascript
// React con intervalo de refetch de 30 segundos
useEffect(() => {
    const interval = setInterval(() => {
        fetchDevices();
    }, 30000); // 30 segundos
    
    return () => clearInterval(interval);
}, []);
```

**Backend:**

```javascript
// Caché Redis con TTL de 30 segundos
const cacheKey = `devices:summary:${role}`;
const cached = await cache.get(cacheKey);
if (cached) return res.json(cached);

// ... obtener de DB ...
await cache.set(cacheKey, response, 30); // TTL 30 segundos
```

### Razones

1. **Simplicidad**
   - Sin infraestructura de servidor WebSocket
   - Endpoints HTTP/REST estándar
   - Funciona con configuración Express existente

2. **Beneficios de Caché**
   - La caché Redis sirve la mayoría de solicitudes
   - Reduce carga en MongoDB significativamente
   - Caché invalidada con nuevos datos de webhook

3. **Arquitectura Stateless**
   - Sin conexiones persistentes que gestionar
   - Fácil escalado horizontal (agregar más instancias de backend)
   - No se requiere session stickiness

4. **Compatibilidad Corporativa**
   - HTTP funciona a través de todos los proxies
   - Sin problemas de upgrade WebSocket
   - Amigable con firewalls

5. **Eficiencia de Recursos**
   - Bajo consumo de memoria (sin conexiones abiertas)
   - Patrones de solicitud predecibles
   - Fácil de monitorear y rate limitar

### Alternativa Rechazada: WebSockets

WebSockets fueron considerados por:

- Actualizaciones verdaderamente en tiempo real (sub-segundo)
- Menor latencia para notificaciones push
- Comunicación bidireccional

Sin embargo, fueron rechazados porque:

- Los dispositivos LoRa típicamente envían datos cada 10-30 minutos
- Polling de 30 segundos es suficiente para monitoreo
- Complejidad de infraestructura añadida (Socket.IO, Redis pub/sub)
- Sobrecarga de gestión de conexiones
- Problemas de compatibilidad con proxy/firewall

### Alternativa Rechazada: Long Polling

Long polling fue rechazado porque:

- Mantiene conexiones del servidor abiertas
- Complica el escalado horizontal
- Complejidad similar a WebSockets
- Sin beneficio significativo sobre short polling para nuestro caso

---

## Consecuencias

### Positivas

- Arquitectura simple y depurable
- Excelente caché (90%+ tasa de acierto esperada)
- Fácil balanceo de carga y escalado
- Funciona en todas partes (redes corporativas, móvil)

### Negativas

- Máximo 30 segundos de retraso para actualizaciones
- Más solicitudes HTTP que WebSockets
- No apto para actualizaciones sub-segundo

### Trade-offs Aceptados

| Aspecto | Short Polling | WebSockets |
|---------|---------------|------------|
| Latencia | Hasta 30 segundos | Sub-segundo |
| Complejidad | Baja | Media |
| Escalabilidad | Excelente | Buena |
| Soporte Proxy | Universal | A veces bloqueado |
| Recursos Servidor | Bajos | Medios |

---

## Consideraciones Futuras

Si los requisitos cambian a necesitar:

- **Alertas en tiempo real**: Podría agregar server-sent events (SSE) para canal de alertas específico
- **Colaboración en vivo**: Necesitaría reconsiderar WebSockets
- **Actualizaciones sub-segundo**: No típico para LoRa (intervalo de envío de dispositivo es minutos)

### Camino de Migración

Si WebSockets se vuelven necesarios:

1. Agregar Socket.IO al backend
2. Usar Redis pub/sub para mensajes entre instancias
3. Frontend se suscribe a canales de dispositivos
4. Mantener polling como fallback

---

## ADRs Relacionados

- ADR-001: MongoDB vs PostgreSQL (relacionado con estrategia de almacenamiento de datos)
- ADR-002: Bearer Token vs HMAC (pushes de webhook invalidan caché)
