/**
 * Configuración de Pruebas Jest
 * 
 * Configura el servidor MongoDB en memoria para pruebas
 * y maneja la configuración/limpieza de conexiones de base de datos.
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongoServer;

// Configuración antes de todas las pruebas
beforeAll(async () => {
    // Crear servidor de memoria MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();

    // Conectar mongoose a la base de datos en memoria
    await mongoose.connect(uri);
});

// Limpieza después de cada prueba
afterEach(async () => {
    // Limpiar todas las colecciones
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
        await collection.deleteMany({});
    }
});

// Limpieza después de todas las pruebas
afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
});

// Mockear variables de entorno para pruebas
process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
process.env.WEBHOOK_TOKEN = 'TEST_TOKEN_123';
process.env.NODE_ENV = 'test';

