const crypto = require('crypto');

/**
 * Request ID Middleware
 * Generates or extracts request ID for traceability
 */
const requestIdMiddleware = (req, res, next) => {
    // Use existing request ID from header or generate new one
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();

    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);

    next();
};

module.exports = {
    requestIdMiddleware
};
