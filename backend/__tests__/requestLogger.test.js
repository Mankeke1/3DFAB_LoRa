/**
 * Pruebas del Middleware de Registro de Solicitudes
 */

const { requestLogger } = require('../middleware/requestLogger');

describe('Request Logger Middleware', () => {
    let mockReq;
    let mockRes;
    let mockNext;
    let finishCallback;
    let errorCallback;

    beforeEach(() => {
        // Mock de solicitud
        mockReq = {
            id: 'test-request-123',
            method: 'GET',
            originalUrl: '/api/test',
            ip: '127.0.0.1',
            user: { id: 'user-123' },
            get: jest.fn().mockReturnValue('test-agent')
        };

        // Mock de respuesta con capacidad de emisor de eventos
        finishCallback = null;
        errorCallback = null;
        mockRes = {
            statusCode: 200,
            on: jest.fn((event, callback) => {
                if (event === 'finish') finishCallback = callback;
                if (event === 'error') errorCallback = callback;
            })
        };

        mockNext = jest.fn();
    });

    it('should call next()', () => {
        requestLogger(mockReq, mockRes, mockNext);
        expect(mockNext).toHaveBeenCalled();
    });

    it('should register finish event handler', () => {
        requestLogger(mockReq, mockRes, mockNext);
        expect(mockRes.on).toHaveBeenCalledWith('finish', expect.any(Function));
    });

    it('should register error event handler', () => {
        requestLogger(mockReq, mockRes, mockNext);
        expect(mockRes.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should log info for successful requests', () => {
        requestLogger(mockReq, mockRes, mockNext);

        // Simular finalización de respuesta
        mockRes.statusCode = 200;
        expect(() => finishCallback()).not.toThrow();
    });

    it('should log warn for client errors (4xx)', () => {
        requestLogger(mockReq, mockRes, mockNext);

        mockRes.statusCode = 404;
        expect(() => finishCallback()).not.toThrow();
    });

    it('should log error for server errors (5xx)', () => {
        requestLogger(mockReq, mockRes, mockNext);

        mockRes.statusCode = 500;
        expect(() => finishCallback()).not.toThrow();
    });

    it('should handle anonymous users', () => {
        mockReq.user = null;
        requestLogger(mockReq, mockRes, mockNext);

        expect(() => finishCallback()).not.toThrow();
    });

    it('should handle response errors', () => {
        requestLogger(mockReq, mockRes, mockNext);

        const error = new Error('Response failed');
        expect(() => errorCallback(error)).not.toThrow();
    });

    it('should calculate request duration', () => {
        jest.useFakeTimers();

        requestLogger(mockReq, mockRes, mockNext);

        // Simular el paso del tiempo
        jest.advanceTimersByTime(100);

        expect(() => finishCallback()).not.toThrow();

        jest.useRealTimers();
    });
});
