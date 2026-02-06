# ADR-001: MongoDB vs PostgreSQL para Datos de Series Temporales

**Estado**: Aceptado  
**Fecha**: 2026-02-02  
**Autores**: Equipo de Desarrollo

---

## Contexto

El proyecto LoRa IoT necesita almacenar millones de mediciones de series temporales de dispositivos sensores. Cada medición contiene:

- Identificador del dispositivo
- Timestamp
- Múltiples lecturas de sensores (temperatura, humedad, presión, nivel de batería)

Necesitábamos decidir entre:

1. **MongoDB** - Base de datos NoSQL orientada a documentos
2. **PostgreSQL** - Base de datos relacional con soporte JSONB

### Requisitos Técnicos

- Manejar alto rendimiento de escritura desde múltiples webhooks
- Consultas eficientes por dispositivo y rango temporal
- Expiración automática de datos (TTL)
- Escalabilidad horizontal para crecimiento futuro
- Fácil integración con Node.js/Express

---

## Decisión

Elegimos **MongoDB** para almacenar datos de series temporales de sensores.

### Razones

1. **Flexibilidad de Esquema**
   - Los payloads del webhook TTN varían según configuración del decoder
   - Diferentes tipos de dispositivos envían diferentes campos
   - El esquema flexible de MongoDB acomoda payloads variables sin migraciones

2. **Soporte de Colecciones Time-Series**
   - MongoDB 5.0+ tiene colecciones time-series nativas
   - Agrupación automática de datos para compresión
   - Indexación time-series incorporada

3. **Índices TTL**
   - Soporte nativo para expiración automática de documentos
   - `expireAfterSeconds: 7776000` elimina mediciones después de 90 días
   - No se necesitan trabajos programados de limpieza

4. **Rendimiento de Consultas**
   - Índices compuestos `{deviceId: 1, receivedAt: -1}` optimizan consultas comunes
   - Consultas cubiertas devuelven resultados directamente del índice

5. **Experiencia del Desarrollador**
   - Mongoose proporciona excelente integración con Node.js
   - Mapeo directo entre objetos JS y documentos
   - Sin desajuste de impedancia ORM

6. **Simplicidad Operacional**
   - MongoDB Atlas proporciona hosting gestionado
   - Backups automáticos y monitoreo
   - Fácil configuración de replica set

### Alternativa Rechazada: PostgreSQL

PostgreSQL fue considerado por:

- Fuertes garantías ACID
- Herramientas y ecosistema maduros
- Extensión TimescaleDB para series temporales

Sin embargo, fue rechazado porque:

- Requiere definiciones de esquema rígidas
- Migraciones de esquema necesarias para cambios de payload
- Configuración más compleja para TTL (requiere pg_cron o triggers)
- Mayor carga operacional para nuestro pequeño equipo

---

## Consecuencias

### Positivas

- Tiempo de desarrollo reducido para integración de webhook
- Gestión automática de retención de datos
- Soporte nativo para payloads de sensores variables
- Buen tier gratuito de MongoDB Atlas para desarrollo

### Negativas

- Sin JOINs para consultas relacionales complejas
- Validación de datos menos estricta (mitigado por esquemas Mongoose)
- Agregación estilo SQL limitada (compensado por pipeline de agregación)

### Neutral

- El equipo necesitó aprender pipeline de agregación de MongoDB
- Procedimientos diferentes de backup/restore que PostgreSQL

---

## ADRs Relacionados

- Ninguno

## Notas

Si el proyecto necesita datos relacionales complejos (jerarquías de usuarios, grupos de dispositivos con permisos), podemos considerar agregar PostgreSQL para esos datos específicos mientras mantenemos MongoDB para mediciones.
