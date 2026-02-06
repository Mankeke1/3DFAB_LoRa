const mongoose = require('mongoose');

const measurementSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    receivedAt: {
        type: Date,
        required: true
    },
    p1: {
        type: Number,
        default: null
    },
    p2: {
        type: Number,
        default: null
    },
    temperature: {
        type: Number,
        default: null
    },
    humidity: {
        type: Number,
        default: null
    },
    battery: {
        type: Number,
        default: null
    },
    rawPayload: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: { createdAt: 'createdAt', updatedAt: false }
});

// Compound index for efficient querying by device and time range
measurementSchema.index({ deviceId: 1, receivedAt: -1 });

// IDEMPOTENCY: Unique index prevents duplicate measurements for same device + timestamp
measurementSchema.index({ deviceId: 1, receivedAt: 1 }, { unique: true });

// TTL Index: Auto-delete measurements after 90 days
// This keeps the database size manageable automatically
measurementSchema.index(
    { receivedAt: 1 },
    { expireAfterSeconds: 7776000 } // 90 days in seconds
);

// Index for date range queries without device filter
measurementSchema.index({ receivedAt: -1 });

// Static method to get latest measurement for a device
measurementSchema.statics.getLatest = function (deviceId) {
    return this.findOne({ deviceId })
        .sort({ receivedAt: -1 })
        .exec();
};

// Static method to get measurements in time range
measurementSchema.statics.getInRange = function (deviceId, startDate, endDate, variable = null) {
    const query = { deviceId };

    if (startDate || endDate) {
        query.receivedAt = {};
        if (startDate) query.receivedAt.$gte = new Date(startDate);
        if (endDate) query.receivedAt.$lte = new Date(endDate);
    }

    let projection = {};
    if (variable && ['p1', 'p2', 'temperature', 'humidity', 'battery'].includes(variable)) {
        projection = { deviceId: 1, receivedAt: 1, [variable]: 1 };
    }

    return this.find(query, projection)
        .sort({ receivedAt: -1 })
        .exec();
};

module.exports = mongoose.model('Measurement', measurementSchema);
