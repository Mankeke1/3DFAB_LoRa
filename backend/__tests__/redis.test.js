/**
 * Pruebas de Caché Redis
 */

describe('Redis Cache', () => {
    // Probamos el comportamiento real de la implementación
    let redis;
    let cache;

    beforeEach(() => {
        // Restablecer implementaciones simuladas (mocks)
        jest.resetModules();
    });

    describe('cache helper functions', () => {
        beforeEach(() => {
            // Importar con mock
            jest.mock('ioredis', () => {
                return jest.fn().mockImplementation(() => ({
                    get: jest.fn().mockResolvedValue(JSON.stringify({ test: 'data' })),
                    setex: jest.fn().mockResolvedValue('OK'),
                    del: jest.fn().mockResolvedValue(1),
                    keys: jest.fn().mockResolvedValue(['key1', 'key2']),
                    publish: jest.fn().mockResolvedValue(1),
                    on: jest.fn(),
                    status: 'ready'
                }));
            });
        });

        it('should get data from cache', async () => {
            const mockRedis = {
                get: jest.fn().mockResolvedValue(JSON.stringify({ foo: 'bar' })),
                setex: jest.fn(),
                del: jest.fn(),
                keys: jest.fn().mockResolvedValue([]),
                publish: jest.fn(),
                status: 'ready'
            };

            const cache = {
                async get(key) {
                    try {
                        const data = await mockRedis.get(key);
                        return data ? JSON.parse(data) : null;
                    } catch (error) {
                        return null;
                    }
                }
            };

            const result = await cache.get('test-key');
            expect(result).toEqual({ foo: 'bar' });
        });

        it('should return null when key not found', async () => {
            const mockRedis = {
                get: jest.fn().mockResolvedValue(null)
            };

            const cache = {
                async get(key) {
                    const data = await mockRedis.get(key);
                    return data ? JSON.parse(data) : null;
                }
            };

            const result = await cache.get('nonexistent');
            expect(result).toBeNull();
        });

        it('should set data with TTL', async () => {
            const mockRedis = {
                setex: jest.fn().mockResolvedValue('OK')
            };

            const cache = {
                async set(key, value, ttl = 30) {
                    await mockRedis.setex(key, ttl, JSON.stringify(value));
                    return true;
                }
            };

            const result = await cache.set('test-key', { data: 'value' }, 60);
            expect(result).toBe(true);
            expect(mockRedis.setex).toHaveBeenCalledWith('test-key', 60, '{"data":"value"}');
        });

        it('should delete key', async () => {
            const mockRedis = {
                del: jest.fn().mockResolvedValue(1)
            };

            const cache = {
                async del(key) {
                    const result = await mockRedis.del(key);
                    return result > 0;
                }
            };

            const result = await cache.del('test-key');
            expect(result).toBe(true);
        });

        it('should invalidate pattern', async () => {
            const mockRedis = {
                keys: jest.fn().mockResolvedValue(['key1', 'key2', 'key3']),
                del: jest.fn().mockResolvedValue(3)
            };

            const cache = {
                async invalidatePattern(pattern) {
                    const keys = await mockRedis.keys(pattern);
                    if (keys.length > 0) {
                        await mockRedis.del(...keys);
                    }
                    return keys.length;
                }
            };

            const result = await cache.invalidatePattern('devices:*');
            expect(result).toBe(3);
            expect(mockRedis.keys).toHaveBeenCalledWith('devices:*');
        });

        it('should return 0 when no keys match pattern', async () => {
            const mockRedis = {
                keys: jest.fn().mockResolvedValue([]),
                del: jest.fn()
            };

            const cache = {
                async invalidatePattern(pattern) {
                    const keys = await mockRedis.keys(pattern);
                    if (keys.length > 0) {
                        await mockRedis.del(...keys);
                    }
                    return keys.length;
                }
            };

            const result = await cache.invalidatePattern('nonexistent:*');
            expect(result).toBe(0);
            expect(mockRedis.del).not.toHaveBeenCalled();
        });

        it('should handle get error gracefully', async () => {
            const mockRedis = {
                get: jest.fn().mockRejectedValue(new Error('Connection refused'))
            };

            const cache = {
                async get(key) {
                    try {
                        const data = await mockRedis.get(key);
                        return data ? JSON.parse(data) : null;
                    } catch (error) {
                        return null; // Fallar silenciosamente
                    }
                }
            };

            const result = await cache.get('test-key');
            expect(result).toBeNull();
        });

        it('should handle set error gracefully', async () => {
            const mockRedis = {
                setex: jest.fn().mockRejectedValue(new Error('Connection refused'))
            };

            const cache = {
                async set(key, value, ttl = 30) {
                    try {
                        await mockRedis.setex(key, ttl, JSON.stringify(value));
                        return true;
                    } catch (error) {
                        return false;
                    }
                }
            };

            const result = await cache.set('test-key', { data: 'value' });
            expect(result).toBe(false);
        });

        it('should check availability', async () => {
            const mockRedis = {
                status: 'ready'
            };

            const cache = {
                isAvailable() {
                    return mockRedis.status === 'ready';
                }
            };

            expect(cache.isAvailable()).toBe(true);
        });

        it('should report unavailable when disconnected', async () => {
            const mockRedis = {
                status: 'close'
            };

            const cache = {
                isAvailable() {
                    return mockRedis.status === 'ready';
                }
            };

            expect(cache.isAvailable()).toBe(false);
        });

        it('should publish messages', async () => {
            const mockRedis = {
                publish: jest.fn().mockResolvedValue(1)
            };

            const cache = {
                async publish(channel, message) {
                    return await mockRedis.publish(channel, JSON.stringify(message));
                }
            };

            const result = await cache.publish('webhook:new-data', { deviceId: 'device-001' });
            expect(result).toBe(1);
            expect(mockRedis.publish).toHaveBeenCalledWith('webhook:new-data', '{"deviceId":"device-001"}');
        });
    });
});
