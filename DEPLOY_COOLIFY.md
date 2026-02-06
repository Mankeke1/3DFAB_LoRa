# Guía de Despliegue: Sistema LoRa Webhook en Coolify

## Descripción General

Esta guía proporciona instrucciones paso a paso para desplegar el Sistema LoRa Webhook en [Coolify](https://coolify.io), una plataforma de despliegue auto-hospedada.

**Arquitectura**: TTN → Webhook → API Express → MongoDB Atlas → Frontend React

---

## Prerequisitos

### Resumen Rápido

1. Crear cluster MongoDB Atlas (gratis)
2. Configurar backend en Coolify → pegar env vars
3. Configurar frontend en Coolify → **Build Variable**: `VITE_API_URL`
4. Configurar dominios y SSL
5. Ejecutar seed (con passwords por env vars en producción)
6. Configurar webhook en TTN

### Requerimientos

- ✅ Instancia de Coolify corriendo (auto-hospedada o en la nube)
- ✅ Cluster de MongoDB Atlas creado (tier gratuito funciona)
- ✅ Nombre de dominio configurado (o usar subdominio de Coolify)
- ✅ Repositorio Git con este código

---

## Paso 1: Preparar MongoDB Atlas

### 1.1 Crear Cluster Gratuito

1. Ir a [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Registrarse o iniciar sesión
3. Crear nuevo proyecto: `lora-iot-prod`
4. Crear cluster M0 GRATIS en la región más cercana

### 1.2 Configurar Acceso

1. **Database Access** → Add Database User
   - Usuario: `lora_app`
   - Contraseña: `<generar-contraseña-segura>`
   - Rol: `Atlas admin` (o rol personalizado con lectura/escritura)

2. **Network Access** → Add IP Address
   - **RECOMENDADO**: Agregar la dirección IP pública de tu servidor Coolify
     - IR a la terminal de tu servidor Coolify: `curl ifconfig.me`
     - Copiar la IP (ej: `203.0.113.45`)
     - En Atlas: Add IP Address → pegar `203.0.113.45/32`
   - **SOLO TEMPORAL**: Si aún no conoces la IP, usa `0.0.0.0/0` (permite todas las IPs)
     - ⚠️ **RIESGO DE SEGURIDAD**: Esto es inseguro para producción
     - **DEBES cambiarlo** a tu IP específica después del despliegue
     - Úsalo solo durante la configuración inicial para probar conectividad

### 1.3 Obtener Cadena de Conexión

1. Click **Connect** → **Drivers**
2. Seleccionar: Node.js driver
3. Copiar cadena de conexión:

   ```
   mongodb+srv://lora_app:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

4. Reemplazar `<password>` con tu contraseña real
5. Agregar nombre de base de datos: `/lora_sensors` antes del `?`

   **Formato final**:

   ```
   mongodb+srv://lora_app:TuContraseña@cluster0.abc123.mongodb.net/lora_sensors?retryWrites=true&w=majority
   ```

---

## Paso 2: Desplegar en Coolify

### 2.1 Crear Nuevo Servicio - API Backend

1. En el dashboard de Coolify → **New Resource** → **Application**
2. **Source**: Seleccionar "Public Repository" o conectar tu Git
   - URL del Repositorio: `https://github.com/tu-usuario/lora-webhook.git`
   - Rama: `main`
3. **Build Pack**: Docker
   - Dockerfile Location: `backend/Dockerfile`
   - Docker Context: `backend`
4. **Port**: `3000`
5. **Domain** (elegir uno):
   - Auto-generado: `backend-xxx.coolify.tu-servidor.com`
   - Dominio personalizado: `api.tudominio.com`

### 2.2 Configurar Variables de Entorno del Backend

Click **Environment Variables** y agregar:

```env
MONGODB_URI=mongodb+srv://lora_app:TuContraseña@cluster0.abc123.mongodb.net/lora_sensors?retryWrites=true&w=majority
JWT_SECRET=<generar-cadena-hex-64-caracteres>
WEBHOOK_TOKEN=<tu-token-seguro-aleatorio>
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://tu-dominio-frontend.com
```

**Opcional (pero CRÍTICO para seguridad en producción)**:

```env
SEED_ADMIN_PASSWORD=<tu-contraseña-admin-segura>
SEED_CLIENT_PASSWORD=<tu-contraseña-cliente-segura>
```

**Cómo generar secretos**:

```bash
# JWT_SECRET (hex de 64 caracteres)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# WEBHOOK_TOKEN (base64 aleatorio)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Contraseñas seguras (usar gestor de contraseñas o similar)
```

> **IMPORTANTE**: Si no estableces `SEED_ADMIN_PASSWORD` y `SEED_CLIENT_PASSWORD`, el script de seed creará usuarios con contraseñas predeterminadas (`admin123`/`lab123`), lo cual es **INSEGURO para producción**. Siempre establece estas variables en entornos de producción.

### 2.3 Desplegar Backend

1. Click **Deploy**
2. Esperar a que la compilación complete (~2-3 minutos)
3. Revisar **Logs** para el mensaje de inicio
4. Probar health check:

   ```bash
   curl https://api.tudominio.com/api/health
   ```

   Esperado: `{"status":"ok","timestamp":"...","mongodb":"connected"}`

---

### 2.4 Crear Nuevo Servicio - Frontend

1. **New Resource** → **Application**
2. **Source**: Mismo repositorio
   - Dockerfile Location: `frontend/Dockerfile`
   - Docker Context: `frontend`
3. **Port**: `80`
4. **Domain**: `app.tudominio.com` o `lora.tudominio.com`

### 2.5 Configurar URL del API del Frontend

**NO se requiere editar archivos** - configurar vía Build Variables de Coolify.

1. En la configuración del servicio Frontend → **Build Variables** (o **Environment** → **Build**)
2. Agregar Build Variable:
   - **Name**: `VITE_API_URL`
   - **Value**: `https://api.tudominio.com` (reemplazar con tu dominio backend real)
3. Este valor se usará en tiempo de compilación (incorporado en el bundle JavaScript)

> **Cómo funciona**: El Dockerfile acepta `VITE_API_URL` como argumento de compilación. Vite lee esto durante `npm run build` y reemplaza `import.meta.env.VITE_API_URL` con la URL real en el código compilado.

> **Fallback**: Si no estableces esto, la compilación usará `http://localhost:3000` de `frontend/.env.production` (solo para desarrollo local).

### 2.6 Desplegar Frontend

1. Click **Deploy**
2. Esperar compilación (~3-4 minutos)
3. Acceder a la URL de tu frontend
4. Deberías ver la página de login

---

## Paso 3: Configurar SSL/HTTPS

Coolify maneja esto automáticamente si usas un dominio personalizado:

1. Asegurarte que el DNS de tu dominio apunte al servidor Coolify:
   - Registro A: `api.tudominio.com` → `<ip_servidor_coolify>`
   - Registro A: `app.tudominio.com` → `<ip_servidor_coolify>`

2. Coolify provisionará automáticamente certificados Let's Encrypt

3. Verificar:

   ```bash
   curl https://api.tudominio.com/api/health
   ```

---

## Paso 4: Inicializar Backend

### 4.1 Generar Claves RSA (CRÍTICO)

> [!WARNING]
> **Las claves RSA NO se suben a GitHub** por seguridad. Debes generarlas en el servidor después del despliegue.

1. Ir al servicio Backend → **Terminal**
2. Ejecutar:

   ```bash
   npm run generate-keys
   ```

   Esto crea:
   - `keys/private.pem` - Clave privada para firmar JWT
   - `keys/public.pem` - Clave pública para verificar JWT

3. Verificar que las claves fueron creadas:

   ```bash
   ls -la keys/
   ```

### 4.2 Ejecutar Seed de Base de Datos

El script de seed es **idempotente** (se puede ejecutar múltiples veces de forma segura).

#### Opción A: Vía Consola de Coolify

1. Ir al servicio Backend → **Terminal**
2. Ejecutar:

   ```bash
   node seed.js
   ```

#### Opción B: Localmente con conexión de producción

1. En tu máquina local:

   ```bash
   cd backend
   MONGODB_URI="mongodb+srv://..." SEED_ADMIN_PASSWORD="TuContraseñaSegura" SEED_CLIENT_PASSWORD="TuContraseñaSegura" node seed.js
   ```

Esto crea/actualiza:

- Usuario admin: `admin` con contraseña de `SEED_ADMIN_PASSWORD` (o `admin123` si no está establecido)
- Usuario cliente: `lab1` con contraseña de `SEED_CLIENT_PASSWORD` (o `lab123` si no está establecido)
- 3 dispositivos de muestra con 2 semanas de datos históricos (solo si no existen datos)

**⚠️ SEGURIDAD EN PRODUCCIÓN**:

- **Siempre establecer** variables de entorno `SEED_ADMIN_PASSWORD` y `SEED_CLIENT_PASSWORD` en producción
- Las contraseñas predeterminadas (`admin123`/`lab123`) son **INSEGURAS**
- Si ya ejecutaste seed con valores predeterminados, ejecútalo nuevamente con las env vars establecidas para actualizar contraseñas

**💡 DATOS DE EJEMPLO**:

El script crea 3 dispositivos de muestra (`nodo-209`, `nodo-210`, `nodo-211`) con 2 semanas de datos históricos. Esto es útil para:

- Verificar que el sistema funciona
- Probar visualizaciones
- Entrenar usuarios

**Para evitar datos de ejemplo en producción**, establecer antes de ejecutar seed:

```env
SEED_GENERATE_DATA=false
```

El script es **inteligente**: Si ya existen mediciones reales en la base de datos, NO genera datos de ejemplo (incluso si `SEED_GENERATE_DATA=true`).

---

## Paso 5: Configurar Webhook de TTN

1. Iniciar sesión en [Consola de The Things Network](https://console.cloud.thethings.network/)
2. Seleccionar tu aplicación
3. Ir a **Integrations** → **Webhooks** → **Add Webhook**
4. Seleccionar **Custom webhook**

Configurar:

- **Webhook ID**: `lora-webhook-prod`
- **Webhook format**: `JSON`
- **Base URL**: `https://api.tudominio.com`
- **Uplink message**:
  - **Enabled**: ✅
  - **Path**: `/api/webhook/ttn`
- **Authentication**:
  - Nombre de header: `Authorization`
  - Valor de header: `Bearer <tu-WEBHOOK_TOKEN>`

1. Click **Add webhook**

---

## Paso 6: Probar End-to-End

### 6.1 Probar Webhook (Simular TTN)

**IMPORTANTE**: Este es el formato **REAL** que TTN v3 envía. Usa este payload para pruebas:

```bash
curl -X POST https://api.tudominio.com/api/webhook/ttn \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_WEBHOOK_TOKEN" \
  -d '{
    "end_device_ids": {
      "device_id": "test-node-001",
      "application_ids": {
        "application_id": "mi-app-lora"
      }
    },
    "uplink_message": {
      "decoded_payload": {
        "p1": 12.5,
        "p2": 20.3,
        "temperature": 22.1,
        "humidity": 58.2,
        "battery": 4.05
      },
      "received_at": "2026-01-30T15:00:00.000Z"
    }
  }'
```

**Formato alternativo** (si tu decoder de TTN usa nombres abreviados):

```bash
curl -X POST https://api.tudominio.com/api/webhook/ttn \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_WEBHOOK_TOKEN" \
  -d '{
    "end_device_ids": {
      "device_id": "nodo-209"
    },
    "uplink_message": {
      "decoded_payload": {
        "p1": 12.3,
        "p2": 18.7,
        "temp": 21.4,
        "hum": 53.2,
        "batt": 3.91
      },
      "received_at": "2023-10-27T10:00:00Z"
    }
  }'
```

> **Nota**: El sistema acepta **ambos formatos** de nombres de campos:
>
> - `temperature` o `temp`
> - `humidity` o `hum`
> - `battery` o `batt`

**Respuesta esperada**: `{"success":true,"message":"Data received and stored","deviceId":"test-node-001",...}`

### 6.2 Probar Frontend

1. Abrir `https://app.tudominio.com`
2. Iniciar sesión con `admin / admin123` (o tu `SEED_ADMIN_PASSWORD`)
3. Deberías ver el dashboard con dispositivos
4. Esperar 30 segundos → el dashboard se actualiza automáticamente
5. Click **Ver Detalles** en un dispositivo → ver gráfico

---

## Paso 7: Checklist de Producción

- [ ] IP allowlist de MongoDB Atlas configurada (IP específica, no 0.0.0.0/0)
- [ ] Variables de entorno del backend establecidas (incluyendo SEED_*_PASSWORD)
- [ ] Build Variable del frontend establecida: `VITE_API_URL=https://api.tudominio.com`
- [ ] Contraseñas personalizadas de admin/cliente establecidas vía env vars (no predeterminadas)
- [ ] Certificados SSL activos (https://)
- [ ] Webhook de TTN configurado y probado
- [ ] Frontend carga y autentica
- [ ] Dashboard muestra datos de dispositivos
- [ ] Health checks de Coolify pasando
- [ ] Smoke tests pasan: `npm run smoke`

---

## Solución de Problemas

### El backend no inicia

1. Revisar logs en Coolify
2. Problemas comunes:
   - Formato de MONGODB_URI incorrecto
   - Acceso de red de MongoDB Atlas bloqueado
   - Faltan variables de entorno requeridas

### Frontend muestra "Network Error"

1. Verificar CORS: `ALLOWED_ORIGINS` en backend debe incluir el dominio del frontend
   - Ejemplo: `ALLOWED_ORIGINS=https://app.tudominio.com`
   - Para múltiples: `ALLOWED_ORIGINS=https://app.tudominio.com,https://dashboard.tudominio.com`
2. Verificar que la URL del API en Build Variable del frontend coincida con el dominio del backend
3. Revisar consola del navegador para error exacto

### Webhook retorna 401

1. Verificar que el header `Authorization: Bearer <token>` coincida con `WEBHOOK_TOKEN`
2. Revisar logs del backend para fallas de autenticación

### Los datos no aparecen

1. Revisar logs del backend para solicitudes de webhook
2. Verificar conexión MongoDB: `curl https://api.tudominio.com/api/ready`
3. Revisar logs de webhook de TTN para estado de entrega

---

## Actualizar la Aplicación

### Vía Auto-Deploy de Coolify

1. Push de cambios a tu repositorio Git
2. En Coolify → Ir al servicio → **Settings**
3. Habilitar **Automatic Deployment**
4. Cada push de git activa reconstrucción

### Deploy Manual

1. Ir al servicio en Coolify
2. Click **Redeploy**

---

## Referencia de Variables de Entorno

### Backend Requeridas

| Variable | Ejemplo | Descripción |
|----------|---------|-------------|
| MONGODB_URI | mongodb+srv://... | Cadena de conexión de Atlas |
| JWT_SECRET | cadena hex de 64 caracteres | Secreto para firmar tokens |
| WEBHOOK_TOKEN | cadena aleatoria | Token de autenticación TTN |
| NODE_ENV | production | Entorno de runtime |
| ALLOWED_ORIGINS | <https://app.domain.com,https://dash.domain.com> | Orígenes frontend separados por comas para CORS |

### Backend Opcionales (Recomendadas para Producción)

| Variable | Ejemplo | Descripción |
|----------|---------|-------------|
| SEED_ADMIN_PASSWORD | ContraseñaSegura123! | Contraseña usuario admin (si no está: admin123) |
| SEED_CLIENT_PASSWORD | ContraseñaSegura456! | Contraseña usuario cliente (si no está: lab123) |
| SEED_GENERATE_DATA | false | Establecer en 'false' para omitir generación de mediciones de muestra |

### Frontend Requeridas

| Variable | Ejemplo | Descripción |
|----------|---------|-------------|
| VITE_API_URL | <https://api.domain.com> | URL base del API backend (en .env.production) |

---

## Paso 8: Mantenimiento Post-Deploy

### 8.1 Cambiar Contraseña del Admin

**Después del primer despliegue, es CRÍTICO cambiar la contraseña del admin por seguridad.**

#### Opción A: Recrear con Variables de Entorno (Recomendado)

1. En Coolify → Backend → Environment Variables
2. Agregar o actualizar:

   ```env
   SEED_ADMIN_PASSWORD=TuNuevaContraseñaSegura2026!
   SEED_CLIENT_PASSWORD=OtraContraseñaSegura2026!
   ```

3. En Backend → Terminal, ejecutar:

   ```bash
   node seed.js
   ```

4. El script actualizará las contraseñas automáticamente
5. Login nuevamente con las nuevas credenciales

#### Opción B: Vía MongoDB Directamente

Conectarte a MongoDB Atlas y actualizar manualmente el documento del usuario.

### 8.2 Crear Usuarios Adicionales

Para crear nuevos usuarios después del deploy:

#### Vía API (Postman/curl)

```bash
curl -X POST https://api.tudominio.com/api/users \
  -H "Authorization: Bearer TOKEN_DEL_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "nuevo_usuario",
    "password": "password_segura",
    "role": "client",
    "assignedDevices": ["nodo-209", "nodo-210"]
  }'
```

**Pasos**:

1. Login como admin en el frontend
2. Obtener token de las DevTools (Application → LocalStorage → `token`)
3. Usar el token en la llamada API

#### Vía Terminal del Backend

```bash
node -e "
const mongoose = require('mongoose');
const User = require('./models/User');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const user = new User({
    username: 'nuevo_usuario',
    passwordHash: 'password_segura',
    role: 'client',
    assignedDevices: ['nodo-209']
  });
  await user.save();
  console.log('Usuario creado:', user.username);
  process.exit(0);
});
"
```

### 8.3 Eliminar Datos de Ejemplo

Si desplegaste con datos de ejemplo (dispositivos nodo-209, nodo-210, nodo-211) y quieres limpiarlos:

#### Opción A: Vía Panel Admin (Frontend)

1. Login como admin
2. Ir a Panel Admin → Dispositivos
3. Eliminar manualmente cada dispositivo de ejemplo

#### Opción B: Vía Terminal (Más rápido)

```bash
# Eliminar solo los dispositivos de ejemplo
node -e "
const mongoose = require('mongoose');
const Device = require('./models/Device');
const Measurement = require('./models/Measurement');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const exampleDevices = ['nodo-209', 'nodo-210', 'nodo-211'];
  
  await Measurement.deleteMany({ deviceId: { \$in: exampleDevices } });
  await Device.deleteMany({ deviceId: { \$in: exampleDevices } });
  
  console.log('✓ Datos de ejemplo eliminados');
  process.exit(0);
});
"
```

### 8.4 Backup de MongoDB Atlas

#### Backup Automático (Tier M10+)

Para clusters pagos, MongoDB Atlas ofrece backups automáticos. Para el tier gratuito M0:

#### Backup Manual (M0 Gratis)

1. En MongoDB Atlas → Cluster → Collections
2. Para cada colección (users, devices, measurements):
   - Click "..." → **Export Collection**
   - Formato: JSON o CSV
   - Guardar archivo localmente

#### Restauración desde Backup

1. En MongoDB Atlas → Collections
2. Click "..." → **Import Data**
3. Seleccionar archivo de backup

### 8.5 Actualizar la Aplicación

Cuando hagas cambios al código y quieras desplegarlos:

#### Si tienes Auto-Deploy habilitado

1. Push cambios a tu repositorio Git:

   ```bash
   git add .
   git commit -m "feat: nueva funcionalidad"
   git push origin main
   ```

2. Coolify detectará el push y reconstruirá automáticamente

#### Deploy Manual

1. Push cambios a Git
2. En Coolify → Backend/Frontend → Click **"Redeploy"**
3. Esperar a que complete la reconstrucción
4. Verificar health check:

   ```bash
   curl https://api.tudominio.com/api/health
   ```

### 8.6 Rollback (Volver a Versión Anterior)

Si una actualización falla:

1. En Coolify → Servicio → **Deployment History**
2. Buscar el último deploy exitoso
3. Click **"Redeploy"** en esa versión

### 8.7 Ver Logs en Producción

#### Logs en Tiempo Real

1. En Coolify → Backend → **Logs**
2. Ver streaming en vivo de logs del servidor

#### Logs de Errores Específicos

En el Terminal del Backend:

```bash
# Ver últimas 100 líneas de logs
tail -n 100 /app/logs/error.log

# Seguir logs en tiempo real
tail -f /app/logs/combined.log
```

### 8.8 Monitoreo de Salud

#### Health Checks Automáticos

Coolify ejecuta health checks automáticamente. Para verificarlos manualmente:

```bash
# Health check básico
curl https://api.tudominio.com/api/health

# Readiness check (verifica MongoDB)
curl https://api.tudominio.com/api/ready
```

**Respuesta esperada**:

```json
{"status":"ready","timestamp":"..."}
```

#### Configurar Alertas (Opcional)

En Coolify, puedes configurar notificaciones cuando el servicio falla:

1. Coolify → Notifications
2. Agregar webhook de Slack/Discord/Email
3. Configurar para alertas de deploy fallido

---

## Recursos Adicionales

- [Documentación de Coolify](https://coolify.io/docs)
- [Docs de MongoDB Atlas](https://www.mongodb.com/docs/atlas/)
- [Integración de Webhook TTN](https://www.thethingsindustries.com/docs/integrations/webhooks/)

---

## Soporte

Para problemas específicos de:

- **Despliegue en Coolify**: Revisar comunidad de Coolify
- **MongoDB Atlas**: Foros de soporte de MongoDB
- **Configuración TTN**: Documentación de The Things Network
- **Bugs de la aplicación**: Abrir issue en tu repositorio

---
