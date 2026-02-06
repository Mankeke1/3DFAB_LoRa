const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// Custom format for structured logging
const customFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, requestId, userId, deviceId, duration, ...meta }) => {
        let log = `${timestamp} [${level.toUpperCase()}]`;

        if (requestId) log += ` [${requestId}]`;
        if (userId) log += ` [User:${userId}]`;
        if (deviceId) log += ` [Device:${deviceId}]`;

        log += `: ${message}`;

        if (duration) log += ` (${duration}ms)`;

        // Add additional metadata
        const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
        if (metaStr) log += ` ${metaStr}`;

        return log;
    })
);

// JSON format for audit logs
const jsonFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
);

// Transports configuration
const transports = [];

// Console transport (always enabled in development, optional in production)
if (process.env.NODE_ENV !== 'production') {
    transports.push(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                customFormat
            )
        })
    );
}

// Error file (daily rotation, keep 30 days)
transports.push(
    new DailyRotateFile({
        filename: path.join(logDir, 'error-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxFiles: '30d',
        format: customFormat
    })
);

// Combined file (daily rotation, keep 30 days)
transports.push(
    new DailyRotateFile({
        filename: path.join(logDir, 'combined-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        maxFiles: '30d',
        format: customFormat
    })
);

// Audit file (JSON format for critical actions)
transports.push(
    new DailyRotateFile({
        filename: path.join(logDir, 'audit-%DATE%.log'),
        datePattern: 'YYYY-MM-DD',
        level: 'info',
        maxFiles: '30d',
        format: jsonFormat
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    transports,
    exitOnError: false
});

// Stream for Morgan HTTP request logging (if needed)
logger.stream = {
    write: (message) => {
        logger.info(message.trim());
    }
};

/**
 * Audit helper for critical operations
 * @param {string} action - Action type (e.g., 'LOGIN_SUCCESS', 'USER_CREATED')
 * @param {object} details - Additional details about the action
 */
logger.audit = (action, details = {}) => {
    logger.info('AUDIT', {
        action,
        ...details,
        timestamp: new Date().toISOString()
    });
};

module.exports = logger;
