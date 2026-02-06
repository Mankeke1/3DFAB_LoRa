# 🚀 Guía de Despliegue para Fabi

**Sistema de Monitoreo LoRa - Paso a Paso**

> Esta guía te llevará paso a paso para desplegar el sistema. Sigue cada paso en orden y marca ✅ cuando lo completes.

---

## 📋 Lo Que Necesitas Antes de Empezar

- [ ] Acceso a **Coolify** (servidor donde se desplegará)
- [ ] Cuenta de **MongoDB Atlas** (gratis en mongodb.com)
- [ ] El **repositorio Git** con el código
- [ ] Un **dominio** configurado (ejemplo: `lora.tuempresa.com`)

---

## 🗄️ PASO 1: Crear Base de Datos en MongoDB Atlas

### 1.1 Crear Cuenta (si no tienes)

1. Ir a: **<https://www.mongodb.com/atlas>**
2. Click **"Try Free"**
3. Registrarte con email

### 1.2 Crear Cluster (Base de Datos)

1. Click **"Build a Database"**
2. Elegir **M0 FREE** (gratis)
3. Proveedor: **AWS**
4. Región: **São Paulo** (más cercano a Chile)
5. Nombre: `lora-cluster`
6. Click **"Create"**

### 1.3 Crear Usuario de Base de Datos

1. En el menú izquierdo: **Database Access**
2. Click **"Add New Database User"**
3. Llenar:
   - **Username**: `lora_app`
   - **Password**: *crear una contraseña segura y GUARDARLA*
4. Role: **Atlas admin**
5. Click **"Add User"**

### 1.4 Permitir Conexiones

1. En el menú izquierdo: **Network Access**
2. Click **"Add IP Address"**
3. Click **"Allow Access from Anywhere"** (0.0.0.0/0)
   - ⚠️ Después del deploy, cambiar esto a la IP del servidor
4. Click **"Confirm"**

### 1.5 Obtener URL de Conexión

1. En **Database** → Click **"Connect"** en tu cluster
2. Elegir **"Drivers"**
3. Copiar la URL que se ve así:

   ```
   mongodb+srv://lora_app:<password>@lora-cluster.xxxxx.mongodb.net/
   ```

4. **IMPORTANTE**:
   - Reemplazar `<password>` con TU contraseña real
   - Agregar `lora_sensors` antes del `?`:

   ```
   mongodb+srv://lora_app:TuPassword@lora-cluster.xxxxx.mongodb.net/lora_sensors?retryWrites=true&w=majority
   ```

5. **GUARDAR** esta URL, la necesitarás después

✅ **¿Completaste el Paso 1?** Deberías tener:

- [ ] Un cluster creado
- [ ] Un usuario `lora_app` con password
- [ ] La URL de conexión guardada

---

## 🔑 PASO 2: Generar Claves de Seguridad

En tu computadora, abre una terminal (PowerShell o CMD) y ejecuta:

### 2.1 Generar JWT_SECRET

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Copiar el resultado (64 caracteres hexadecimales). Ejemplo:

```
a1b2c3d4e5f6...  (muy largo)
```

**GUARDAR** como: `JWT_SECRET`

### 2.2 Generar WEBHOOK_TOKEN

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copiar el resultado. Ejemplo:

```
abc123def456...  (32 caracteres)
```

**GUARDAR** como: `WEBHOOK_TOKEN`

### 2.3 Contraseñas Personalizadas (Opcional)

Por defecto, el sistema usa estas credenciales:

- **Admin**: Usuario `Fabian`, contraseña `.Fabian.123.123.`
- **Cliente**: Usuario `lab1`, contraseña `lab123`

**Para cambiar las contraseñas** (recomendado para mayor seguridad), crear dos contraseñas seguras:

- **SEED_ADMIN_PASSWORD**: Para el usuario admin Fabian (ejemplo: `MiPasswordSegura2026!`)
- **SEED_CLIENT_PASSWORD**: Para usuarios cliente (ejemplo: `ClientePass456!`)

Estas se configurarán en Coolify en el Paso 3.4.

✅ **¿Completaste el Paso 2?** Deberías tener guardado:

- [ ] JWT_SECRET (cadena larga)
- [ ] WEBHOOK_TOKEN (cadena de 32 caracteres)
- [ ] SEED_ADMIN_PASSWORD y SEED_CLIENT_PASSWORD (opcional, para mayor seguridad)

---

## 🐳 PASO 3: Desplegar Backend en Coolify

### 3.1 Crear Nueva Aplicación

1. Entrar a Coolify
2. Click **"New Resource"** → **"Application"**
3. **Source**: Conectar tu repositorio Git o usar URL pública
4. **Branch**: `main`

### 3.2 Configurar Build

1. **Build Pack**: Docker
2. **Dockerfile Location**: `backend/Dockerfile`
3. **Docker Context**: `backend`
4. **Port Exposes**: `3000`

### 3.3 Configurar Dominio

1. En **Domain**: poner tu subdominio para API
   - Ejemplo: `api.lora.tuempresa.com`

### 3.4 Agregar Variables de Entorno

En la sección **"Environment Variables"**, agregar CADA una de estas:

| Variable | Valor |
|----------|-------|
| `MONGODB_URI` | *tu URL de MongoDB del Paso 1.5* |
| `JWT_SECRET` | *el valor del Paso 2.1* |
| `WEBHOOK_TOKEN` | *el valor del Paso 2.2* |
| `PORT` | `3000` |
| `NODE_ENV` | `production` |
| `ALLOWED_ORIGINS` | `https://lora.tuempresa.com` *(el dominio del frontend)* |
| `SEED_ADMIN_PASSWORD` | **(Opcional)** Contraseña personalizada para Fabian. Si no se configura, usa `.Fabian.123.123.` |
| `SEED_CLIENT_PASSWORD` | **(Opcional)** Contraseña personalizada para cliente lab1. Si no se configura, usa `lab123` |
| `REDIS_HOST` | `redis` |
| `REDIS_PORT` | `6379` |

> [!TIP]
> **Cambiar credenciales del admin**: Por defecto, el usuario admin se llama **`Fabian`** con contraseña **`.Fabian.123.123.`**
>
> Para usar una contraseña diferente, agrega la variable `SEED_ADMIN_PASSWORD` con tu contraseña deseada.
> Ejemplo: `SEED_ADMIN_PASSWORD=MiPasswordSuperSegura2026!`

### 3.5 Desplegar

1. Click **"Deploy"**
2. Esperar 2-3 minutos
3. Ver los logs hasta que diga:

   ```
   LoRa Webhook Server
   Port: 3000
   MongoDB: Connected
   ```

### 3.6 Verificar que Funciona

En tu navegador o terminal:

```bash
curl https://api.lora.tuempresa.com/api/health
```

Debería responder:

```json
{"status":"ok","timestamp":"...","mongodb":"connected"}
```

✅ **¿Completaste el Paso 3?**

- [ ] Backend desplegado
- [ ] Health check responde OK

---

## 🎨 PASO 4: Desplegar Frontend en Coolify

### 4.1 Crear Nueva Aplicación

1. Click **"New Resource"** → **"Application"**
2. Mismo repositorio, misma branch

### 4.2 Configurar Build

1. **Build Pack**: Docker
2. **Dockerfile Location**: `frontend/Dockerfile`
3. **Docker Context**: `frontend`
4. **Port Exposes**: `80`

### 4.3 Configurar Dominio

1. En **Domain**: el dominio principal
   - Ejemplo: `lora.tuempresa.com`

### 4.4 Agregar Build Variable (MUY IMPORTANTE)

En la sección **"Build Variables"** (no Environment Variables):

| Variable | Valor |
|----------|-------|
| `VITE_API_URL` | `https://api.lora.tuempresa.com` *(el dominio del backend)* |

### 4.5 Desplegar

1. Click **"Deploy"**
2. Esperar 3-4 minutos

### 4.6 Verificar que Funciona

1. Abrir `https://lora.tuempresa.com`
2. Deberías ver la página de login

✅ **¿Completaste el Paso 4?**

- [ ] Frontend desplegado
- [ ] Se ve la página de login

---

## 🌱 PASO 5: Inicializar Backend

### 5.1 Generar Claves RSA (MUY IMPORTANTE)

⚠️ **Este paso es CRÍTICO** - Las claves RSA NO se suben a GitHub por seguridad, así que debes generarlas en el servidor.

En Coolify, ir al servicio **Backend** → **Terminal** → ejecutar:

```bash
npm run generate-keys
```

Deberías ver:

```
✓ Directorio keys/ creado
✓ Clave privada generada: backend/keys/private.key
✓ Clave pública generada: backend/keys/public.key
✓ Claves RSA generadas exitosamente
```

### 5.2 Ejecutar Seed

En Coolify, ir al servicio **Backend** → **Terminal** → ejecutar:

```bash
node seed.js
```

Deberías ver:

```
✓ Usuario admin creado/actualizado
✓ Usuario lab1 creado/actualizado
✓ Dispositivos de muestra creados
```

### 5.3 Probar Login

1. Ir a `https://lora.tuempresa.com`
2. Ingresar:
   - Usuario: `Fabian`
   - Contraseña: `.Fabian.123.123.` *(o tu `SEED_ADMIN_PASSWORD` si lo configuraste)*
3. Deberías ver el Dashboard

> [!NOTE]
> **Sobre los dispositivos de ejemplo**: El seed crea 3 dispositivos (nodo-209, nodo-210, nodo-211) con 2 semanas de datos históricos simulados. Esto es útil para:
>
> - Probar que el sistema funciona correctamente
> - Ver ejemplos de gráficos
> - Entrenar usuarios
>
> **Para producción sin datos de ejemplo**, agregar esta variable de entorno en Coolify ANTES de ejecutar seed:
>
> ```
> SEED_GENERATE_DATA=false
> ```
>
> Esto creará solo los usuarios, sin dispositivos ni datos de prueba.

✅ **¿Completaste el Paso 5?**

- [ ] Claves RSA generadas
- [ ] Seed ejecutado
- [ ] Login funciona

---

## 📡 PASO 6: Configurar Webhook de TTN

### 6.1 Entrar a The Things Network

1. Ir a: **<https://console.cloud.thethings.network/>**
2. Elegir tu región
3. Seleccionar tu **Aplicación**

### 6.2 Crear Webhook

1. Ir a **Integrations** → **Webhooks**
2. Click **"+ Add webhook"**
3. Elegir **"Custom webhook"**

### 6.3 Configurar

Llenar los campos:

| Campo | Valor |
|-------|-------|
| **Webhook ID** | `lora-prod` |
| **Webhook format** | `JSON` |
| **Base URL** | `https://api.lora.tuempresa.com` |
| **Downlink API key** | *(dejar vacío)* |

### 6.4 Configurar Mensaje Uplink

1. Expandir **"Uplink message"**
2. Marcar **"Enabled"** ✅
3. En **Path** poner: `/api/webhook/ttn`

### 6.5 Configurar Autenticación

1. Expandir **"Additional headers"**
2. Click **"+ Add header"**
3. Agregar:
   - **Name**: `Authorization`
   - **Value**: `Bearer TU_WEBHOOK_TOKEN` *(reemplazar con tu token del Paso 2.2)*

### 6.6 Guardar

Click **"Add webhook"**

✅ **¿Completaste el Paso 6?**

- [ ] Webhook creado en TTN
- [ ] Token configurado correctamente

---

## ✅ PASO 7: Verificación Final

### 7.1 Probar que Todo Funciona

Ejecutar este comando (reemplazando los valores):

```bash
curl -X POST https://api.lora.tuempresa.com/api/webhook/ttn \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_WEBHOOK_TOKEN" \
  -d '{
    "end_device_ids": {"device_id": "test-sensor"},
    "uplink_message": {
      "decoded_payload": {"temperature": 25.5, "humidity": 60},
      "received_at": "2026-02-06T12:00:00Z"
    }
  }'
```

Debería responder:

```json
{"success":true,"message":"Data received and stored","deviceId":"test-sensor"}
```

### 7.2 Ver en Frontend

1. Ir a `https://lora.tuempresa.com`
2. En el Dashboard deberías ver el dispositivo `test-sensor`
3. Click "Ver Detalles" para ver el gráfico

### 7.3 Seguridad Final (IMPORTANTE)

Volver a MongoDB Atlas:

1. **Network Access**
2. Eliminar `0.0.0.0/0`
3. Agregar solo la IP de tu servidor Coolify

---

## 🔄 PASO 8: ¿Qué Hacer Después del Deploy?

### 8.1 Cambiar Tu Contraseña

**Por seguridad, cambia la contraseña predeterminada:**

1. En Coolify → Backend → **Environment Variables**
2. Agregar o actualizar:

   ```env
   SEED_ADMIN_PASSWORD=TuNuevaContraseñaSegura2026!
   SEED_CLIENT_PASSWORD=OtraContraseñaSegura2026!
   ```

3. En Backend → **Terminal**, ejecutar:

   ```bash
   node seed.js
   ```

4. Ahora puedes hacer login con tu nueva contraseña

### 8.2 Agregar Más Usuarios

Para crear un nuevo usuario cliente:

**Vía API (usando Postman o curl)**:

```bash
curl -X POST https://api.lora.tuempresa.com/api/users \
  -H "Authorization: Bearer TOKEN_DE_FABIAN" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "nuevo_cliente",
    "password": "password123",
    "role": "client",
    "assignedDevices": ["nodo-209"]
  }'
```

**Cómo obtener el token**:

1. Hacer login en el frontend como Fabian
2. Presionar **F12** (abrir DevTools)
3. Ir a **Application** → **LocalStorage**
4. Copiar el valor de `token`

### 8.3 Eliminar Dispositivos de Ejemplo

Si solo quieres datos reales y quieres eliminar los dispositivos de ejemplo (nodo-209, nodo-210, nodo-211):

**Opción A: Desde el Frontend**

1. Login como Fabian
2. Ir a **Panel Admin**
3. Eliminar manualmente cada dispositivo

**Opción B: Desde Terminal (más rápido)**

En Coolify → Backend → Terminal:

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

### 8.4 Ver Logs del Servidor

Si algo no funciona o quieres ver qué está pasando:

1. En Coolify → Backend → **Logs**
2. Verás los logs en tiempo real

### 8.5 Actualizar la Aplicación

Cuando hagas cambios al código:

1. Hacer push a Git:

   ```bash
   git add .
   git commit -m "descripción del cambio"
   git push
   ```

2. En Coolify → Backend/Frontend → Click **"Redeploy"**
3. Esperar a que termine
4. Verificar que funciona: `curl https://api.lora.tuempresa.com/api/health`

---

## ❓ Preguntas Frecuentes (FAQ)

**P: ¿Cómo veo los logs del backend?**

R: En Coolify → Backend → **Logs**. Ahí verás todo lo que está pasando en tiempo real.

---

**P: ¿Olvidé mi contraseña de Fabian?**

R: Ejecutar seed nuevamente con la variable `SEED_ADMIN_PASSWORD` configurada. El script actualizará la contraseña.

---

**P: ¿Puedo tener múltiples administradores?**

R: Sí, crear usuarios con `role: "admin"` usando la API o Terminal.

---

**P: ¿Cómo hago backup de la base de datos?**

R: En MongoDB Atlas:

1. Ir a tu Cluster → **Collections**
2. Para cada colección: Click "..." → **Export Collection**
3. Guardar el archivo JSON

---

**P: El Dashboard no muestra datos nuevos**

R: Esperar 30 segundos (el polling automático se actualiza cada 30s) o refrescar la página manualmente.

---

**P: ¿Cómo elimino un usuario?**

R: Usar la API DELETE:

```bash
curl -X DELETE https://api.lora.tuempresa.com/api/users/USER_ID \
  -H "Authorization: Bearer TOKEN_DE_ADMIN"
```

---

**P: El webhook de TTN dice "401 Unauthorized"**

R: Verificar que el token configurado en TTN coincida exactamente con `WEBHOOK_TOKEN` del backend.

---

## 🎉 ¡LISTO

Si todos los pasos funcionaron, el sistema está desplegado y funcionando.

### Resumen de Accesos

| Servicio | URL | Credenciales |
|----------|-----|-------------|
| **Frontend** | `https://lora.tuempresa.com` | Usuario: `Fabian` / Contraseña: `.Fabian.123.123.` *(o tu SEED_ADMIN_PASSWORD)* |
| **API** | `https://api.lora.tuempresa.com` | - |
| **Webhook TTN** | `https://api.lora.tuempresa.com/api/webhook/ttn` | Bearer *WEBHOOK_TOKEN* |

### Si Algo Falla

1. **Backend no inicia**: Revisar logs en Coolify, verificar MONGODB_URI
2. **Frontend dice "Network Error"**: Verificar que VITE_API_URL es correcto
3. **Login no funciona**: Ejecutar `node seed.js` de nuevo
4. **Webhook rechaza**: Verificar que el token coincide exactamente

---

## 📞 Soporte

Si tienes problemas, revisar:

- Logs del backend en Coolify
- Consola del navegador (F12)
- Documentación detallada en `DEPLOY_COOLIFY.md`

---

*Documento creado: Febrero 2026*
