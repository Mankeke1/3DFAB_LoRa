// Script para eliminar TODOS los dispositivos y sus datos de la base de datos
const mongoose = require('mongoose');

async function deleteAllDevices() {
    try {
        const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lora_db';

        await mongoose.connect(MONGO_URI);
        console.log('✓ Connected to MongoDB');

        // Definir modelos
        const Device = mongoose.model('Device', new mongoose.Schema({}, { strict: false }));
        const SensorData = mongoose.model('SensorData', new mongoose.Schema({}, { strict: false }));

        // Contar antes de eliminar
        const deviceCount = await Device.countDocuments();
        const sensorDataCount = await SensorData.countDocuments();

        console.log(`\nDatos a eliminar:`);
        console.log(`  Dispositivos: ${deviceCount}`);
        console.log(`  Datos de sensores: ${sensorDataCount}`);

        if (deviceCount === 0 && sensorDataCount === 0) {
            console.log('\n⚠️ No hay datos para eliminar');
            await mongoose.disconnect();
            process.exit(0);
        }

        // Eliminar todos los datos
        const deviceResult = await Device.deleteMany({});
        const sensorDataResult = await SensorData.deleteMany({});

        console.log(`\n✅ Eliminación completada:`);
        console.log(`  Dispositivos eliminados: ${deviceResult.deletedCount}`);
        console.log(`  Datos de sensores eliminados: ${sensorDataResult.deletedCount}`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
}

deleteAllDevices();
