# LoRa Sensor Monitor

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20Compatible-green.svg)

Sistema full-stack para visualización y administración de datos de sensores ambientales conectados vía LoRa.

## 🎯 Propósito

Este sistema resuelve el problema del **monitoreo distribuido de sensores ambientales** en instalaciones de gran escala. Está diseñado para escenarios reales donde múltiples sensores LoRa están dispersos en áreas extensas (campus, laboratorios, plantas industriales) y necesitan ser monitoreados de forma centralizada y en tiempo real.

**Caso de uso típico**: Un campus universitario de 2 km² con laboratorios distribuidos, cada uno equipado con sensores LoRa que miden concentración de partículas, temperatura, humedad y estado de batería. El sistema permite que investigadores accedan solo a sus dispositivos asignados, mientras que los administradores tienen visibilidad completa del estado de todos los nodos.

La arquitectura prioriza la **fiabilidad de la ingesta de datos** (webhook → MongoDB) sobre la visualización en tiempo real, garantizando que ningún dato se pierda incluso si el frontend está temporalmente inactivo.

## 📋 Características

- **Webhook TTN**: Recepción de datos desde The Things Network con autenticación y rate limiting
- **Dashboard en tiempo real**: Visualización de dispositivos con semáforo de estado (verde/rojo)
- **Short polling**: Actualización automática cada 30 segundos (sin WebSockets)
- **Gráficos históricos**: Visualización de variables con filtros temporales
- **Export CSV**: Descarga de datos filtrados
- **Sistema de roles**: Admin (acceso total) y Cliente (solo dispositivos asignados)
- **Panel de administración**: CRUD de usuarios y asignación de dispositivos

## 🏗️ Arquitectura

```text
[Nodos LoRa] → [Gateway] → [TTN] → [Webhook POST] → [Express API] → [MongoDB]
                                                                        ↓
                                                              [React Frontend]
                                                              (Short polling)
```

> **Regla de oro**: La ingesta de datos (webhook → MongoDB) funciona independientemente del estado del frontend.

## 🛠️ Tecnologías

- **Backend**: Node.js, Express, MongoDB (Mongoose), JWT
- **Frontend**: React 18, Vite, Recharts, React Router
- **Seguridad**: Rate limiting, validación Joi, autenticación JWT

## 📁 Estructura del Proyecto

```text
├── backend/
│   ├── models/           # Mongoose schemas
│   ├── routes/           # Express routes
│   ├── middleware/       # Auth, validation, rate limiting
│   ├── server.js         # Entry point
│   └── seed.js           # Database seeder
│
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── services/     # API client
│   │   ├── App.jsx       # Main app with routing
│   │   └── index.css     # Global styles
│   └── index.html
│
└── postman_collection.json
```

## ⚡ Quick Start

La forma más rápida de tener el sistema funcionando localmente (~5 minutos):

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/lora-sensor-monitor.git
cd lora-sensor-monitor

# 2. Instalar dependencias backend
cd backend
npm install

# 3. Crear datos de prueba (incluye usuarios y dispositivos con históricos)
npm run seed

# 4. Iniciar backend (en una terminal)
npm run dev

# 5. Instalar y arrancar frontend (en otra terminal)
cd ../frontend
npm install
npm run dev
```

**Credenciales de prueba:**

- Admin: `admin / admin123`
- Admin `Fabian / .Fabian.123.123` en tal caso de que no sea admin123
- Cliente: `lab1 / lab123`

Accede a: <http://localhost:5173>

Para configuración avanzada, ver guías completas:

- 📖 **Desarrollo local**: [SETUP_LOCAL.md](./SETUP_LOCAL.md)
- 🚀 **Producción/Coolify**: [DEPLOY_COOLIFY.md](./DEPLOY_COOLIFY.md)
- 📐 **Decisiones técnicas**: [docs/adr/](./docs/adr/)

## 🚀 Instalación

> 📖 **Desarrollo Local**: Ver **[SETUP_LOCAL.md](./SETUP_LOCAL.md)**
>
> 🚀 **Producción**: Ver **[DEPLOY_COOLIFY.md](./DEPLOY_COOLIFY.md)**
>
> 📐 **Decisiones Arquitectónicas**: Ver **[docs/adr/](./docs/adr/)**

### Prerrequisitos

- Node.js >= 18
- MongoDB Atlas (gratis) o MongoDB local

### 1. Clonar y configurar

```bash
git clone https://github.com/tu-usuario/lora-sensor-monitor.git
cd lora-sensor-monitor
```

### 2. Configurar Backend

```bash
cd backend
npm install
```

Editar `.env` si es necesario:

```env
MONGODB_URI=mongodb://localhost:27017/lora_sensors
JWT_SECRET=your_secret_key
WEBHOOK_TOKEN=TEST_TOKEN_123
PORT=3000
```

### 3. Seed de datos (opcional)

```bash
npm run seed
```

Esto crea:

- Usuario admin: `admin / admin123`
- Usuario cliente: `lab1 / lab123` (con acceso a nodo-209)
- 3 dispositivos con 2 semanas de datos históricos

### 4. Iniciar Backend

```bash
npm run dev
```

El servidor estará en <http://localhost:3000>

### 5. Configurar Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

El frontend estará en <http://localhost:5173>

## 📡 API Endpoints

### Webhook (TTN)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/webhook/ttn` | Recibe uplinks desde TTN |

### Autenticación

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login con usuario/contraseña |
| GET | `/api/auth/me` | Info del usuario actual |

### Dispositivos

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/devices` | Lista dispositivos (filtrado por rol) |
| GET | `/api/devices/:id/latest` | Último dato del dispositivo |
| GET | `/api/devices/:id/measurements` | Histórico con filtros |
| GET | `/api/devices/:id/export.csv` | Exportar a CSV |

### Usuarios (solo admin)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/users` | Listar usuarios |
| POST | `/api/users` | Crear usuario |
| PUT | `/api/users/:id` | Actualizar usuario |
| DELETE | `/api/users/:id` | Eliminar usuario |

## 🧪 Testing con Postman

1. Importar `postman_collection.json`
2. Configurar variables:
   - `base_url`: `http://localhost:3000`
   - `token`: Se obtiene del login
3. Ejecutar tests

### Ejemplo de Webhook TTN

```bash
POST /api/webhook/ttn
Authorization: Bearer TEST_TOKEN_123
Content-Type: application/json

{
  "end_device_ids": {
    "device_id": "nodo-209"
  },
  "uplink_message": {
    "decoded_payload": {
      "p1": 15.2,
      "p2": 22.8,
      "temperature": 19.5,
      "humidity": 61.3,
      "battery": 3.85
    },
    "received_at": "2026-01-28T22:15:00.000Z"
  }
}
```

## 📊 Frontend - Vistas

### Login

- Formulario con validación
- Almacenamiento de token en localStorage

### Dashboard

- Grid de tarjetas por dispositivo
- Semáforo de estado: 🟢 (<30 min) / 🔴 (>30 min)
- Short polling cada 30 segundos

### Detalle de Dispositivo

- Selector de variable (P1, P2, Temperatura, Humedad, Batería)
- Filtro por rango de fechas
- Gráfico interactivo con Recharts
- Botón de exportación CSV

### Panel Admin (solo admin)

- CRUD de usuarios
- Asignación de dispositivos a clientes

## 🐳 Docker / Producción

### Quick Start con Docker

```bash
# Construir imágenes
npm run docker:build

# Iniciar contenedores
npm run docker:up

# Detener contenedores
npm run docker:down
```

### Despliegue en Coolify

Sigue la **[guía completa de despliegue en Coolify](./DEPLOY_COOLIFY.md)** para instrucciones paso a paso.

**Resumen rápido**:

1. Crear cluster MongoDB Atlas (gratis)
2. Configurar aplicaciones en Coolify (backend + frontend)
3. Pegar variables de entorno (ver `.env.example`)
4. Configurar dominios y SSL
5. Configurar webhook en TTN

### Variables de Entorno para Producción

Ver archivos `.env.example` en `backend/` y `frontend/` para la lista completa.

**Críticas**:

- `MONGODB_URI`: Connection string de MongoDB Atlas
- `JWT_SECRET`: String aleatorio de 64 caracteres (generar con crypto)
- `WEBHOOK_TOKEN`: Token seguro para TTN
- `ALLOWED_ORIGINS`: Dominios frontend permitidos (CORS)
- `VITE_API_URL`: URL del backend (para el frontend)

### Smoke Tests

Ejecutar tests de humo para verificar el sistema end-to-end:

```bash
npm run smoke
```

Esto verifica (8 tests críticos):

- ✅ Health check (/api/health)
- ✅ Readiness check (/api/ready - MongoDB ping)
- ✅ Autenticación (login)
- ✅ Autorización (list devices)
- ✅ Webhook ingestion
- ✅ Persistencia en DB (verifica que webhook → MongoDB funciona)
- ✅ Validación de seguridad (auth + payload)

## 👥 Gestión de Usuarios Post-Deploy

### Cambiar Contraseñas

Después del primer deploy, **es crítico cambiar las contraseñas predeterminadas**:

1. Configurar variables de entorno en el servidor:

   ```env
   SEED_ADMIN_PASSWORD=TuContraseñaSegura2026!
   SEED_CLIENT_PASSWORD=OtraContraseñaSegura2026!
   ```

2. Ejecutar `node seed.js` nuevamente
3. El script actualizará las contraseñas automáticamente

### Crear Usuarios Adicionales

#### Vía API (requiere autenticación de admin)

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer TOKEN_DEL_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "nuevo_usuario",
    "password": "password_segura",
    "role": "client",
    "assignedDevices": ["nodo-209", "nodo-210"]
  }'
```

**Para obtener el token del admin**:

1. Login en el frontend como admin
2. Abrir DevTools (F12) → Application → LocalStorage
3. Copiar el valor de `token`

### Eliminar Datos de Ejemplo

Si desplegaste con datos de ejemplo (dispositivos nodo-209, nodo-210, nodo-211):

```bash
node -e "
const mongoose = require('mongoose');
const Device = require('./models/Device');
const Measurement = require('./models/Measurement');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const ejemplos = ['nodo-209', 'nodo-210', 'nodo-211'];
  await Measurement.deleteMany({ deviceId: { \$in: ejemplos } });
  await Device.deleteMany({ deviceId: { \$in: ejemplos } });
  console.log('✓ Datos de ejemplo eliminados');
  process.exit(0);
});
"
```

## 🔒 Seguridad

- **Webhook**: Rate limiting (100 req/min), validación de token, validación de schema
- **API**: JWT authentication, verificación de roles, sanitización de inputs
- **Login**: Rate limiting (5 intentos/15 min)
- **Idempotencia**: Índice único compuesto para prevent duplicados

## 🚧 Limitaciones Conocidas

- **Escalabilidad**: El sistema está optimizado para hasta ~100 dispositivos. Para deployments mayores se requiere implementar paginación en el dashboard y caching más agresivo.
- **Alertas**: No hay sistema de notificaciones automáticas cuando un sensor se desconecta o reporta valores anómalos.
- **UI de eliminación de dispositivos**: Actualmente no existe interfaz para eliminar dispositivos (solo se puede hacer vía MongoDB directamente).
- **Historiales indefinidos**: No hay rotación automática de datos antiguos, lo que puede hacer crecer la base de datos indefinidamente.

## 🗺️ Roadmap

Características planeadas para futuras versiones:

- [ ] **Sistema de alertas**: Notificaciones vía email/Telegram cuando un sensor se desconecta o reporta valores fuera de rango
- [ ] **Exportación avanzada**: Generación de reportes PDF con gráficos y estadísticas
- [ ] **Mapas geográficos**: Visualización de ubicación de sensores en un mapa interactivo
- [ ] **API pública**: Endpoints REST documentados para integración con sistemas externos
- [ ] **Dashboard en tiempo real**: Migración a WebSockets para actualizaciones instantáneas
- [ ] **Gestión de dispositivos**: Interfaz para agregar/eliminar/editar dispositivos desde el admin panel
- [ ] **Rotación de datos**: Archivado automático de mediciones antiguas (>1 año)
- [ ] **Multitenancy**: Soporte para múltiples organizaciones en la misma instancia

## 🔧 Troubleshooting

### Webhook responde 401 Unauthorized

**Causa**: El token en la cabecera `Authorization` no coincide con `WEBHOOK_TOKEN` del backend.

**Solución**: Verifica que el token en TTN Console → Webhooks → Authorization header sea exactamente `Bearer TU_WEBHOOK_TOKEN`.

### Dashboard muestra todos los dispositivos en rojo

**Causa**: El frontend no puede comunicarse con el backend (variable `VITE_API_URL` incorrecta).

**Solución**:

- En desarrollo: Verifica que el backend esté corriendo en `http://localhost:3000`
- En producción: Verifica que `VITE_API_URL` en Coolify apunte a tu dominio backend (ejemplo: `https://api.tudominio.com`)

### Error: "E11000 duplicate key error"

**Causa**: Intentas guardar una medición que ya existe (comportamiento esperado por idempotencia).

**Solución**: No es un error crítico. El webhook responderá 200 OK y el frontend seguirá funcionando. TTN puede reenviar el mismo mensaje múltiples veces, el sistema lo maneja correctamente.

### MongoDB connection failed

**Causa**: El string de conexión `MONGODB_URI` es incorrecto o MongoDB Atlas no permite la conexión desde tu IP.

**Solución**:

- Verifica que el connection string sea el correcto (incluye usuario, password y nombre de base de datos)
- En MongoDB Atlas: Network Access → Add IP Address → Allow Access from Anywhere (0.0.0.0/0)
- Para Coolify: Agrega la IP del servidor en la whitelist de Atlas

## 📝 Licencia

Mankeke
