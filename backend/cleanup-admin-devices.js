const mongoose = require('mongoose');
const User = require('./models/User');

async function cleanAdminDevices() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        // Find admin users with assigned devices
        const adminsWithDevices = await User.find({
            role: 'admin',
            assignedDevices: { $exists: true, $ne: [] }
        });

        console.log(`Found ${adminsWithDevices.length} admin users with assigned devices:`);
        adminsWithDevices.forEach(u => {
            console.log(`  - ${u.username}: ${u.assignedDevices.join(', ')}`);
        });

        // Update all admin users to have empty assignedDevices
        const result = await User.updateMany(
            { role: 'admin' },
            { $set: { assignedDevices: [] } }
        );

        console.log(`\nUpdated ${result.modifiedCount} admin users`);
        console.log('✓ All admin users now have empty assignedDevices');

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

cleanAdminDevices();
