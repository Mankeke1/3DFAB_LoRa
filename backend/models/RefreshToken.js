const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    replacedBy: {
        type: String,
        default: null
    },
    revokedAt: {
        type: Date,
        default: null
    },
    userAgent: {
        type: String,
        default: null
    },
    ipAddress: {
        type: String,
        default: null
    }
}, {
    collection: 'refresh_tokens'
});

// TTL index: auto-delete expired tokens
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Static method to find valid token
refreshTokenSchema.statics.findValid = function (token) {
    return this.findOne({
        token,
        revokedAt: null,
        expiresAt: { $gt: new Date() }
    });
};

// Static method to revoke all tokens for a user
refreshTokenSchema.statics.revokeAllForUser = async function (userId) {
    return this.updateMany(
        { userId, revokedAt: null },
        { $set: { revokedAt: new Date() } }
    );
};

// Instance method to revoke this token
refreshTokenSchema.methods.revoke = async function (replacedBy = null) {
    this.revokedAt = new Date();
    this.replacedBy = replacedBy;
    return this.save();
};

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
