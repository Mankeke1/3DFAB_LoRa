const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
    deviceId: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    location: {
        type: String,
        default: ''
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
deviceSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

// Index for efficient date-based sorting
deviceSchema.index({ updatedAt: -1 });

// Index for active devices filter
deviceSchema.index({ isActive: 1 });

module.exports = mongoose.model('Device', deviceSchema);
