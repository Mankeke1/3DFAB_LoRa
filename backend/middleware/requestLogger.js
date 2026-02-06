const logger = require('../config/logger');

/**
 * Middleware for automatic HTTP request logging
 * Logs request start, completion, and timing
 */
const requestLogger = (req, res, next) => {
    const startTime = Date.now();

    // Log when response finishes
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const { method, originalUrl, ip } = req;
        const { statusCode } = res;

        const logData = {
            requestId: req.id,
            method,
            url: originalUrl,
            statusCode,
            duration,
            ip: ip || req.connection?.remoteAddress,
            userId: req.user?.id || 'anonymous',
            userAgent: req.get('user-agent')
        };

        // Log level based on status code
        if (statusCode >= 500) {
            logger.error('Request failed', logData);
        } else if (statusCode >= 400) {
            logger.warn('Request client error', logData);
        } else {
            logger.info('Request completed', logData);
        }
    });

    // Handle response error
    res.on('error', (error) => {
        logger.error('Response error', {
            requestId: req.id,
            error: error.message,
            stack: error.stack
        });
    });

    next();
};

module.exports = { requestLogger };
