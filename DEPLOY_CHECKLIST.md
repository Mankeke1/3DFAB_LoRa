# 🚀 Checklist Final - Día del Deploy

Checklist de pasos exactos a seguir para desplegar en producción.

---

## 📋 Pre-Deploy (En tu laptop)

### 1. Generar Secrets

```bash
# JWT_SECRET (64 caracteres)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# WEBHOOK_TOKEN (32 caracteres)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Guardar estos valores en un lugar seguro
```

### 2. Preparar Variables de Entorno

Copiar y completar con tus valores:

```env
MONGODB_URI=mongodb+srv://TU_USUARIO:TU_PASSWORD@cluster.mongodb.net/lora_sensors?retryWrites=true&w=majority
JWT_SECRET=<pegar-secreto-generado>
WEBHOOK_TOKEN=<pegar-token-generado>
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://tu-dominio-frontend.com
SEED_ADMIN_PASSWORD=<tu-password-admin-segura>
SEED_CLIENT_PASSWORD=<tu-password-cliente-segura>
REDIS_HOST=redis
REDIS_PORT=6379
```

### 3. Verificar Tests Pasan

```bash
npm test
# Debe mostrar: 87 passed
```

---

## 🖥️ En el Servidor

### 4. Clonar y Configurar

```bash
git clone https://github.com/tu-usuario/lora.git
cd lora/backend
npm run generate-keys
```

### 5. Deploy con Docker

```bash
cd ..
docker compose -f docker-compose.prod.yml up -d --build
```

### 6. Verificar Containers

```bash
docker compose -f docker-compose.prod.yml ps
# Debe mostrar: backend, frontend, redis (todos healthy)
```

### 7. Inicializar Base de Datos

```bash
# Seed (crear usuario admin)
docker compose -f docker-compose.prod.yml exec backend node seed.js

# Índices
docker compose -f docker-compose.prod.yml exec backend node scripts/init-indexes.js
```

---

## ✅ Validación Post-Deploy

### 8. Health Checks

```bash
# Health
curl https://api.tudominio.com/api/health
# Esperado: {"status":"ok","timestamp":"...","mongodb":"connected"}

# Ready
curl https://api.tudominio.com/api/ready
# Esperado: {"status":"ready","mongodb":"connected","redis":"connected"}
```

### 9. Test de Login

```bash
curl -X POST https://api.tudominio.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"TU_SEED_ADMIN_PASSWORD"}'
# Esperado: {"success":true,"accessToken":"eyJ...",...}
```

### 10. Test de Webhook

```bash
curl -X POST https://api.tudominio.com/api/webhook/ttn \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TU_WEBHOOK_TOKEN" \
  -d '{"end_device_ids":{"device_id":"test-prod"},"uplink_message":{"decoded_payload":{"temp":25},"received_at":"2026-02-02T12:00:00Z"}}'
# Esperado: {"success":true,...}
```

---

## 📡 Configurar TTN

### 11. Webhook en TTN Console

1. Ir a **Applications** → Tu app → **Integrations** → **Webhooks**
2. **Add webhook** → Custom
3. Configurar:
   - **Webhook ID**: `lora-prod`
   - **Base URL**: `https://api.tudominio.com`
   - **Path**: `/api/webhook/ttn`
   - **Authorization**: `Bearer TU_WEBHOOK_TOKEN`
4. Habilitar **Uplink messages**
5. **Save**

---

## 🔒 Seguridad Final

### 12. MongoDB Atlas

- [ ] Cambiar Network Access de `0.0.0.0/0` a IP del servidor
- [ ] Habilitar backups automáticos

### 13. Verificar HTTPS

- [ ] Frontend carga con `https://`
- [ ] API responde con `https://`
- [ ] Sin warnings de certificado

---

## 🎉 Deploy Completado

Si todos los pasos pasaron:

- ✅ Backend funcionando
- ✅ Frontend accesible
- ✅ Webhook recibiendo datos
- ✅ Login funcionando
- ✅ HTTPS activo

**¡Sistema en producción!** 🚀
