const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    action: {
        type: String,
        required: true,
        enum: [
            'USER_CREATED', 'USER_UPDATED', 'USER_DELETED',
            'DEVICE_CREATED', 'DEVICE_UPDATED', 'DEVICE_DELETED',
            'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT',
            'TOKEN_REFRESHED', 'TOKEN_REVOKED',
            'WEBHOOK_RECEIVED', 'DATA_EXPORTED',
            'PASSWORD_CHANGED', 'ROLE_CHANGED'
        ],
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
        index: true
    },
    targetId: {
        type: String, // deviceId, userId, etc.
        required: false
    },
    targetType: {
        type: String,
        enum: ['User', 'Device', 'Token', null],
        default: null
    },
    ipAddress: {
        type: String,
        default: null
    },
    userAgent: {
        type: String,
        default: null
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    collection: 'audit_logs'
});

// TTL index: auto-delete logs after 30 days
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 });

// Compound index for querying by action and time
auditLogSchema.index({ action: 1, timestamp: -1 });

// Static method to create audit entry
auditLogSchema.statics.log = async function (action, options = {}) {
    try {
        return await this.create({
            action,
            userId: options.userId || null,
            targetId: options.targetId || null,
            targetType: options.targetType || null,
            ipAddress: options.ipAddress || null,
            userAgent: options.userAgent || null,
            details: options.details || {}
        });
    } catch (error) {
        console.error('[AuditLog] Failed to create log:', error.message);
        return null;
    }
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
