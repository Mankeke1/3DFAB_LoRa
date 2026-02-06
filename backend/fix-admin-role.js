// Script para corregir el rol del usuario admin
const mongoose = require('mongoose');

async function fixAdminRole() {
    try {
        const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lora_db';

        await mongoose.connect(MONGO_URI);
        console.log('✓ Connected to MongoDB');

        // Importar modelo
        const User = mongoose.model('User', new mongoose.Schema({
            username: String,
            passwordHash: String,
            role: String,
            assignedDevices: [String]
        }));

        // Encontrar usuario admin
        const admin = await User.findOne({ username: 'admin' });

        if (!admin) {
            console.log('❌ Usuario admin no encontrado');
            await mongoose.disconnect();
            process.exit(1);
        }

        console.log(`\nUsuario encontrado: ${admin.username}`);
        console.log(`  Rol actual: ${admin.role}`);
        console.log(`  Dispositivos asignados: ${JSON.stringify(admin.assignedDevices)}`);

        // Actualizar a rol admin y limpiar dispositivos
        admin.role = 'admin';
        admin.assignedDevices = [];
        await admin.save();

        console.log(`\n✓ Usuario actualizado:`);
        console.log(`  Nuevo rol: ${admin.role}`);
        console.log(`  Dispositivos: ${JSON.stringify(admin.assignedDevices)}`);
        console.log(`\n✅ Corrección completada exitosamente`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
}

fixAdminRole();
