require('dotenv').config();
const mongoose = require('mongoose');
const Device = require('./models/Device');
const Measurement = require('./models/Measurement');

// Configuración
const DEVICE_ID = 'test-device-full-history';
const DEVICE_NAME = 'Dispositivo de Prueba Completo';
const DEVICE_DESCRIPTION = 'Dispositivo con datos históricos para testing de gráficos';
const WEEKS_OF_DATA = 3;
const MEASUREMENTS_PER_DAY = 48; // Una medición cada 30 minutos

// Colores para output
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    blue: "\x1b[34m",
    yellow: "\x1b[33m"
};

const log = (msg, color = colors.reset) => console.log(`${color}${msg}${colors.reset}`);

// Generar valor con variación realista
function generateValue(base, variance, min = null, max = null) {
    let value = base + (Math.random() - 0.5) * variance;
    if (min !== null) value = Math.max(min, value);
    if (max !== null) value = Math.min(max, value);
    return parseFloat(value.toFixed(2));
}

// Generar valores con tendencia temporal (simulando cambios día/noche, etc)
function generateValueWithTrend(base, variance, hourOfDay, min = null, max = null) {
    // Variación diurna (más caliente de día, más frío de noche)
    const dailyCycle = Math.sin((hourOfDay - 6) * Math.PI / 12) * (variance * 0.5);
    return generateValue(base + dailyCycle, variance * 0.5, min, max);
}

async function seedTestData() {
    try {
        log('\n🌱 Seeding Test Data for Graph Visualization\n', colors.blue);

        // Conectar a MongoDB
        log('📡 Connecting to MongoDB...', colors.yellow);
        await mongoose.connect(process.env.MONGODB_URI);
        log('✅ Connected to MongoDB\n', colors.green);

        // Eliminar datos anteriores del dispositivo de prueba
        log('🗑️  Cleaning previous test data...', colors.yellow);
        await Device.deleteOne({ deviceId: DEVICE_ID });
        await Measurement.deleteMany({ deviceId: DEVICE_ID });
        log('✅ Previous data cleaned\n', colors.green);

        // Crear dispositivo
        log('📦 Creating test device...', colors.yellow);
        const device = await Device.create({
            deviceId: DEVICE_ID,
            name: DEVICE_NAME,
            description: DEVICE_DESCRIPTION,
            lastSeen: new Date(),
            owner: null // Visible para admin
        });
        log(`✅ Device created: ${DEVICE_ID}\n`, colors.green);

        // Generar mediciones históricas
        log(`📊 Generating ${WEEKS_OF_DATA} weeks of measurements...`, colors.yellow);

        const measurements = [];
        const now = new Date();
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - (WEEKS_OF_DATA * 7));

        const totalMeasurements = WEEKS_OF_DATA * 7 * MEASUREMENTS_PER_DAY;
        const intervalMinutes = (24 * 60) / MEASUREMENTS_PER_DAY;

        for (let i = 0; i < totalMeasurements; i++) {
            const timestamp = new Date(startDate.getTime() + (i * intervalMinutes * 60 * 1000));
            const hourOfDay = timestamp.getHours();
            const dayOfWeek = timestamp.getDay();

            // Generar valores realistas con variaciones
            // Temperatura: 18-28°C con ciclo diurno
            const temperature = generateValueWithTrend(23, 8, hourOfDay, 15, 32);

            // Humedad: 40-80% inversamente proporcional a temperatura
            const humidity = generateValue(85 - temperature * 1.5, 10, 30, 90);

            // Batería: 3.3V-4.2V con decaimiento lento
            const batteryDecay = (1 - (i / totalMeasurements)) * 0.9; // Decae 0.9V en el periodo
            const battery = generateValue(3.3 + batteryDecay, 0.05, 3.0, 4.2);

            // P1 y P2: valores aleatorios (podrían ser presión, calidad de aire, etc)
            const p1 = generateValue(15, 5, 0, 30);
            const p2 = generateValue(20, 8, 0, 40);

            measurements.push({
                deviceId: DEVICE_ID,
                receivedAt: timestamp,
                temperature,
                humidity,
                battery,
                p1,
                p2,
                rawPayload: {
                    simulated: true,
                    seedScript: true
                }
            });

            // Progress indicator cada 500 mediciones
            if ((i + 1) % 500 === 0) {
                const progress = ((i + 1) / totalMeasurements * 100).toFixed(1);
                log(`   Progress: ${progress}% (${i + 1}/${totalMeasurements})`, colors.yellow);
            }
        }

        log(`\n💾 Inserting ${measurements.length} measurements into database...`, colors.yellow);

        // Insertar en lotes para mejor performance
        const batchSize = 1000;
        for (let i = 0; i < measurements.length; i += batchSize) {
            const batch = measurements.slice(i, i + batchSize);
            await Measurement.insertMany(batch, { ordered: false });
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(measurements.length / batchSize);
            log(`   Batch ${batchNum}/${totalBatches} inserted`, colors.yellow);
        }

        log('\n✅ All measurements inserted successfully\n', colors.green);

        // Resumen
        log('📈 Summary:', colors.blue);
        log(`   Device ID: ${DEVICE_ID}`);
        log(`   Total Measurements: ${measurements.length}`);
        log(`   Date Range: ${measurements[0].receivedAt.toISOString()} → ${measurements[measurements.length - 1].receivedAt.toISOString()}`);
        log(`   Variables: temperature, humidity, battery, p1, p2`);
        log(`\n🌐 View in browser: http://localhost/device/${DEVICE_ID}`, colors.green);

        log('\n🎉 Test data seeded successfully!\n', colors.green);

    } catch (error) {
        log(`\n❌ Error: ${error.message}`, colors.reset);
        console.error(error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        log('👋 Database connection closed', colors.yellow);
        process.exit(0);
    }
}

seedTestData();
