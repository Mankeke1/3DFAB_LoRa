/**
 * Seed Script for LoRa Webhook System
 * 
 * Creates initial users and sample data for development/testing
 * IDEMPOTENT: Can be run multiple times safely (uses upsert)
 * 
 * Production: Set SEED_ADMIN_PASSWORD and SEED_CLIENT_PASSWORD env vars
 * Development: Uses defaults (admin123/lab123)
 * 
 * Run with: npm run seed
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Device = require('./models/Device');
const Measurement = require('./models/Measurement');

// Configuration from environment or defaults
const SEED_CONFIG = {
    users: [
        {
            username: 'Fabian',
            password: process.env.SEED_ADMIN_PASSWORD || '.Fabian.123.123.',
            role: 'admin',
            assignedDevices: []
        },
        {
            username: 'lab1',
            password: process.env.SEED_CLIENT_PASSWORD || 'lab123',
            role: 'client',
            assignedDevices: ['nodo-209']
        }
    ],
    devices: [
        {
            deviceId: 'nodo-209',
            name: 'Nodo 209',
            description: 'Laboratorio principal - Sensor ambiental',
            location: 'Edificio A, Piso 2'
        },
        {
            deviceId: 'nodo-210',
            name: 'Nodo 210',
            description: 'Almacén - Monitoreo de temperatura',
            location: 'Bodega Central'
        },
        {
            deviceId: 'nodo-211',
            name: 'Nodo 211',
            description: 'Exterior - Estación meteorológica',
            location: 'Jardín Norte'
        }
    ],
    // Generate sample data only if measurements don't exist
    generateSampleData: process.env.SEED_GENERATE_DATA !== 'false',
    measurementsPerDevice: 14 * 24 * 2 // ~2 readings per hour for 14 days
};

// Helper function to generate random measurement values
function generateMeasurement(deviceId, timestamp) {
    // Base values with some variation between devices
    const deviceIndex = parseInt(deviceId.replace('nodo-', '')) - 209;
    const baseTemp = 20 + deviceIndex * 2;
    const baseHum = 50 + deviceIndex * 5;

    // Add time-based variation (simulate day/night cycles)
    const hour = timestamp.getHours();
    const dayModifier = Math.sin((hour - 6) * Math.PI / 12) * 3; // Peak at noon

    // Add random noise
    const noise = () => (Math.random() - 0.5) * 2;

    return {
        deviceId,
        receivedAt: timestamp,
        p1: parseFloat((10 + Math.random() * 20 + noise()).toFixed(2)),
        p2: parseFloat((15 + Math.random() * 25 + noise()).toFixed(2)),
        temperature: parseFloat((baseTemp + dayModifier + noise()).toFixed(2)),
        humidity: parseFloat((baseHum - dayModifier * 2 + noise() * 3).toFixed(2)),
        battery: parseFloat((3.3 + Math.random() * 0.7).toFixed(2)),
        rawPayload: {
            device_id: deviceId,
            received_at: timestamp.toISOString(),
            uplink_message: {
                decoded_payload: {
                    source: 'seed_script'
                }
            }
        }
    };
}

async function seed() {
    console.log('🌱 Starting seed process (IDEMPOTENT)...\n');

    try {
        // Connect to MongoDB
        console.log('📦 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // IDEMPOTENT: Upsert users
        console.log('👤 Creating/Updating users...');
        for (const userData of SEED_CONFIG.users) {
            const existingUser = await User.findOne({ username: userData.username });

            if (existingUser) {
                // Update password only if it changed
                const passwordChanged = !(await existingUser.comparePassword(userData.password));
                if (passwordChanged) {
                    existingUser.passwordHash = userData.password; // Will be hashed by pre-save hook
                    await existingUser.save();
                    console.log(`   ✓ Updated user: ${userData.username} (password changed)`);
                } else {
                    console.log(`   → User exists: ${userData.username} (no changes)`);
                }
            } else {
                const user = new User({
                    username: userData.username,
                    passwordHash: userData.password, // Will be hashed by pre-save hook
                    role: userData.role,
                    assignedDevices: userData.assignedDevices
                });
                await user.save();
                console.log(`   ✓ Created user: ${user.username} (${user.role})`);
            }
        }
        console.log('');

        // IDEMPOTENT: Upsert devices
        console.log('📡 Creating/Updating devices...');
        for (const deviceData of SEED_CONFIG.devices) {
            await Device.findOneAndUpdate(
                { deviceId: deviceData.deviceId },
                { $set: deviceData },
                { upsert: true }
            );
            console.log(`   ✓ Upserted device: ${deviceData.deviceId} - ${deviceData.name}`);
        }
        console.log('');

        // Generate measurements only if requested and if they don't exist
        if (SEED_CONFIG.generateSampleData) {
            console.log('📊 Checking for existing measurements...');
            const existingCount = await Measurement.countDocuments();

            if (existingCount > 0) {
                console.log(`   → Found ${existingCount} existing measurements, skipping sample data generation`);
                console.log('   (Set SEED_GENERATE_DATA=false to skip this check)\n');
            } else {
                console.log('   → No existing measurements, generating sample data...\n');
                const now = new Date();
                const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

                let totalMeasurements = 0;

                for (const device of SEED_CONFIG.devices) {
                    const measurements = [];
                    const timeStep = (now.getTime() - twoWeeksAgo.getTime()) / SEED_CONFIG.measurementsPerDevice;

                    for (let i = 0; i < SEED_CONFIG.measurementsPerDevice; i++) {
                        const timestamp = new Date(twoWeeksAgo.getTime() + i * timeStep);
                        measurements.push(generateMeasurement(device.deviceId, timestamp));
                    }

                    // Bulk insert for performance (will skip duplicates due to unique index)
                    try {
                        await Measurement.insertMany(measurements, { ordered: false });
                        totalMeasurements += measurements.length;
                        console.log(`   ✓ ${device.deviceId}: ${measurements.length} measurements`);
                    } catch (error) {
                        // Ignore duplicate key errors (code 11000)
                        if (error.code === 11000) {
                            console.log(`   → ${device.deviceId}: some measurements already exist (skipped duplicates)`);
                        } else {
                            throw error;
                        }
                    }
                }
                console.log(`   Total new measurements: ${totalMeasurements}\n`);
            }
        } else {
            console.log('📊 Sample data generation disabled (SEED_GENERATE_DATA=false)\n');
        }

        // Summary
        console.log('═══════════════════════════════════════════════');
        console.log('✓ Entorno listo (seed completo)');
        console.log('═══════════════════════════════════════════════');
        console.log('');
        console.log('Usuarios configurados:');
        SEED_CONFIG.users.forEach(u => {
            const pwdSource = (u.username === 'admin' && process.env.SEED_ADMIN_PASSWORD) ||
                (u.username === 'lab1' && process.env.SEED_CLIENT_PASSWORD)
                ? 'env var' : 'default';
            console.log(`  • ${u.username} (${u.role}) - password from ${pwdSource}`);
        });
        console.log('');
        console.log('Dispositivos:');
        SEED_CONFIG.devices.forEach(d => {
            console.log(`  • ${d.deviceId} (${d.name})`);
        });
        console.log('');
        if (!SEED_CONFIG.generateSampleData) {
            console.log('Datos históricos: no generados (usar datos reales del webhook)');
        }
        console.log('═══════════════════════════════════════════════');

    } catch (error) {
        console.error('❌ Seed error:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n📦 MongoDB connection closed');
        process.exit(0);
    }
}

// Run seed
seed();

