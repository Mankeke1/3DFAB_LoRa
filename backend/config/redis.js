const Redis = require('ioredis');

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: (() => {
        const p = process.env.REDIS_PORT || 6379;
        console.log('[Redis Config] Host:', process.env.REDIS_HOST || 'localhost', 'Port:', p, 'Type:', typeof p);
        return p;
    })(),
    retryStrategy: (times) => {
        if (times > 3) {
            console.warn('[Redis] Max retries reached, giving up.');
            return null; // Stop retrying
        }
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    reconnectOnError: (err) => {
        console.error('[Redis] Error:', err.message);
        return true;
    },
    lazyConnect: true // Don't connect until first command
});

redis.on('connect', () => {
    console.log('✅ Redis connected');
});

redis.on('error', (err) => {
    console.error('❌ Redis error:', err.message);
});

// Helper functions
const cache = {
    /**
     * Get cached data with JSON parsing
     */
    async get(key) {
        try {
            const data = await redis.get(key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error(`[Cache] Error getting key ${key}:`, error.message);
            return null;
        }
    },

    /**
     * Set cached data with TTL (in seconds) and JSON stringification
     */
    async set(key, value, ttl = 30) {
        try {
            await redis.setex(key, ttl, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`[Cache] Error setting key ${key}:`, error.message);
            return false;
        }
    },

    /**
     * Delete cache key(s)
     */
    async del(...keys) {
        try {
            await redis.del(...keys);
            return true;
        } catch (error) {
            console.error(`[Cache] Error deleting keys:`, error.message);
            return false;
        }
    },

    /**
     * Invalidate all keys matching a pattern
     */
    async invalidatePattern(pattern) {
        try {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(...keys);
            }
            return keys.length;
        } catch (error) {
            console.error(`[Cache] Error invalidating pattern ${pattern}:`, error.message);
            return 0;
        }
    },

    /**
     * Publish invalidation event (PUB/SUB)
     */
    async publish(channel, message) {
        try {
            await redis.publish(channel, JSON.stringify(message));
            return true;
        } catch (error) {
            console.error(`[Cache] Error publishing to ${channel}:`, error.message);
            return false;
        }
    },

    /**
     * Check if Redis is available
     */
    async isAvailable() {
        try {
            await redis.ping();
            return true;
        } catch {
            return false;
        }
    }
};

module.exports = { redis, cache };
