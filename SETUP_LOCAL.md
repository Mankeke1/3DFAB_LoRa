# Configuración y Testing Local - LoRa Webhook

Guía completa para configurar, desarrollar y probar el proyecto localmente.

---

## ⚡ Quick Start

```bash
# 1. Instalar dependencias
npm run install:all

# 2. Configurar backend/.env
cd backend
copy .env.example .env
# Editar MONGODB_URI con tu conexión de Atlas

# 3. Generar claves JWT
npm run generate-keys

# 4. Seed de datos de prueba
npm run seed

# 5. Iniciar todo
cd ..
npm run dev

# 6. Abrir navegador: http://localhost:5173
# Login: admin / admin123
```

---

## 📋 Prerequisitos

- **Node.js** >= 18 (`node --version`)
- **Cuenta MongoDB Atlas** (gratis)
- **Git** (opcional, para control de versiones)

---

## 🗄️ MongoDB Atlas (5 minutos)

1. **Crear cluster:** [MongoDB Atlas](https://www.mongodb.com/atlas) → M0 gratis
2. **Database Access:** Crear usuario `lora_dev` con contraseña
3. **Network Access:** `0.0.0.0/0` (desarrollo) o tu IP específica
4. **Connection string:** Copiar y agregar `/lora_sensors`

```
mongodb+srv://lora_dev:TuPassword@cluster0.abc123.mongodb.net/lora_sensors?retryWrites=true&w=majority
```

---

## 🔧 Variables de Entorno

### backend/.env

```env
# MongoDB Atlas Connection
MONGODB_URI=mongodb+srv://...tu conexión...

# Security (para desarrollo)
JWT_SECRET=dev_secret_change_in_production
WEBHOOK_TOKEN=TEST_TOKEN_123

# Server
PORT=3000
NODE_ENV=development

# CORS
ALLOWED_ORIGINS=http://localhost:5173

# Redis (opcional)
REDIS_HOST=localhost
REDIS_PORT=6379
```

> ⚠️ Los archivos `.env` están en `.gitignore` - configurar en cada equipo.

---

## 📝 Comandos Disponibles

### Desarrollo

```bash
npm run dev              # Backend + Frontend (concurrente)
npm run dev:backend      # Solo backend (puerto 3000)
npm run dev:frontend     # Solo frontend (puerto 5173)
```

### Base de Datos

```bash
npm run seed             # Crear usuarios y datos de prueba
npm run init-indexes     # Inicializar índices MongoDB
```

### JWT

```bash
npm run generate-keys    # Generar claves RSA para RS256
```

---

## 🧪 Testing

### Tests Automatizados (Jest)

```bash
# Ejecutar todos los tests con coverage
npm test

# Modo watch (re-ejecuta al cambiar código)
npm run test:watch
```

**Resultado esperado:**

```
Test Suites: 7 passed
Tests:       87 passed
Coverage:    ~80% statements, ~72% branches
```

### Smoke Tests (End-to-End)

```bash
npm run smoke
```

Verifica 8 escenarios críticos:

- ✅ Health check
- ✅ Readiness (MongoDB ping)
- ✅ Login
- ✅ List devices
- ✅ Webhook ingestion
- ✅ Persistencia en DB
- ✅ Auth requerida
- ✅ Validación de payload

---

## ✅ Verificación Manual

### 1. Health Check

```bash
curl http://localhost:3000/api/health
# {"status":"ok","timestamp":"...","mongodb":"connected"}
```

### 2. Readiness Check

```bash
curl http://localhost:3000/api/ready
# {"status":"ready","mongodb":"connected","redis":"connected"}
```

### 3. Test de Webhook

```bash
curl -X POST http://localhost:3000/api/webhook/ttn ^
  -H "Content-Type: application/json" ^
  -H "Authorization: Bearer TEST_TOKEN_123" ^
  -d "{\"end_device_ids\":{\"device_id\":\"test-local\"},\"uplink_message\":{\"decoded_payload\":{\"temp\":25},\"received_at\":\"2026-02-02T12:00:00Z\"}}"
```

### 4. Frontend

1. Abrir <http://localhost:5173>
2. Login: `admin / admin123`
3. Dashboard con dispositivos de prueba
4. Click "Ver Detalles" → Gráfico interactivo
5. "Exportar CSV" → Descarga archivo

---

## 📁 Estructura del Proyecto

```text
LoRa/
├── backend/
│   ├── __tests__/        # Tests Jest
│   ├── config/           # Redis, Logger
│   ├── keys/             # RSA keys (gitignored)
│   ├── logs/             # Winston logs (gitignored)
│   ├── middleware/       # Auth, validation
│   ├── models/           # Mongoose schemas
│   ├── routes/           # Express routes
│   ├── scripts/          # generate-keys, init-indexes
│   ├── utils/            # JWT utilities
│   └── server.js         # Entry point
│
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   └── services/     # API client
│   └── index.html
│
└── docs/adr/             # Architectural Decision Records
```

---

## 🔄 Trabajar en Diferentes Equipos

### Con Git (recomendado)

```bash
# Equipo 1: Guardar cambios
git add . && git commit -m "feat: nueva funcionalidad" && git push

# Equipo 2: Obtener cambios
git pull && npm run install:all
```

### Variables de entorno

Cada equipo debe tener su propio `backend/.env` con el `MONGODB_URI` de Atlas.
Los datos están en la nube, así que se comparten automáticamente.

---

## 🔧 Troubleshooting

| Problema | Solución |
|----------|----------|
| `Cannot find module` | `npm install` en backend/ y frontend/ |
| MongoDB connection failed | Verificar MONGODB_URI y Network Access en Atlas |
| Puerto 3000 ocupado | `Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess` |
| Frontend "Network Error" | Verificar ALLOWED_ORIGINS incluye localhost:5173 |
| Tests fallan | Ejecutar `npm run generate-keys` primero |
| Redis not available | Normal si Redis no está corriendo (funciona sin él) |

---

## 📚 Próximos Pasos

- **Producción:** Ver [DEPLOY_COOLIFY.md](./DEPLOY_COOLIFY.md)
- **API Endpoints:** Ver [README.md](./README.md)
- **Decisiones técnicas:** Ver [docs/adr/](./docs/adr/)
