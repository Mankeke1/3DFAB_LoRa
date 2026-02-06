/**
 * MongoDB Index Initialization Script
 * 
 * This script ensures all indexes are created in the database.
 * Run this after deploying or when indexes have been modified.
 * 
 * Usage: npm run init-indexes
 */

require('dotenv').config();
const mongoose = require('mongoose');

// Import all models (this registers them and their indexes)
const models = [
    { name: 'User', model: require('../models/User') },
    { name: 'Device', model: require('../models/Device') },
    { name: 'Measurement', model: require('../models/Measurement') },
    { name: 'RefreshToken', model: require('../models/RefreshToken') },
    { name: 'AuditLog', model: require('../models/AuditLog') }
];

async function initIndexes() {
    try {
        console.log('📦 Connecting to MongoDB...');

        if (!process.env.MONGODB_URI) {
            console.error('❌ MONGODB_URI environment variable is not set');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ MongoDB connected\n');

        console.log('🔨 Creating indexes...\n');

        // Create indexes for each model
        for (const { name, model } of models) {
            try {
                await model.createIndexes();
                console.log(`✅ ${name}: Indexes created`);

                // List created indexes
                const indexes = await model.collection.indexes();
                indexes.forEach(idx => {
                    if (idx.name !== '_id_') {
                        const keys = Object.entries(idx.key)
                            .map(([k, v]) => `${k}:${v}`)
                            .join(', ');
                        const options = [];
                        if (idx.unique) options.push('unique');
                        if (idx.expireAfterSeconds) options.push(`TTL:${idx.expireAfterSeconds}s`);
                        const optStr = options.length > 0 ? ` (${options.join(', ')})` : '';
                        console.log(`   - ${idx.name}: {${keys}}${optStr}`);
                    }
                });
            } catch (error) {
                console.error(`❌ ${name}: Failed to create indexes -`, error.message);
            }
        }

        console.log('\n✅ Index initialization complete');

        // Show collection stats
        console.log('\n📊 Collection Stats:');
        for (const { name, model } of models) {
            try {
                const count = await model.countDocuments();
                console.log(`   - ${name}: ${count} documents`);
            } catch (e) {
                console.log(`   - ${name}: Unable to count`);
            }
        }

        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
        process.exit(0);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

initIndexes();
