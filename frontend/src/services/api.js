import axios from 'axios';

// Determinar URL base del API
// En producción: VITE_API_URL se configura vía Build Variables de Coolify
// En desarrollo: Usa proxy de Vite (/api -> localhost:3000)
const API_BASE_URL = import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api';

// Crear instancia axios con configuración por defecto
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    },
    timeout: 30000
});

// Interceptor de request - adjuntar token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Interceptor de response - manejar errores
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Manejar 401 - redirigir a login (excepto si el error viene del login mismo)
        if (error.response?.status === 401 && !error.config?.url?.includes('/auth/login')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// API de Autenticación
export const authAPI = {
    login: async (username, password) => {
        const response = await api.post('/auth/login', { username, password });
        return response.data;
    },

    getMe: async () => {
        const response = await api.get('/auth/me');
        return response.data;
    }
};

// Devices API
export const devicesAPI = {
    getAll: async () => {
        const response = await api.get('/devices');
        return response.data;
    },

    getLatest: async (deviceId) => {
        const response = await api.get(`/devices/${deviceId}/latest`);
        return response.data;
    },

    getMeasurements: async (deviceId, params = {}) => {
        const response = await api.get(`/devices/${deviceId}/measurements`, { params });
        return response.data;
    },

    exportCSV: (deviceId, params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        const token = localStorage.getItem('token');

        // Create a link and trigger download
        const url = `/api/devices/${deviceId}/export.csv${queryString ? '?' + queryString : ''}`;

        // Use fetch with auth header for CSV download
        return fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        })
            .then(response => {
                if (!response.ok) throw new Error('Export failed');
                return response.blob();
            })
            .then(blob => {
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = `${deviceId}_export_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
            });
    }
};

// Users API (admin only)
export const usersAPI = {
    getAll: async () => {
        const response = await api.get('/users');
        return response.data;
    },

    getById: async (id) => {
        const response = await api.get(`/users/${id}`);
        return response.data;
    },

    create: async (userData) => {
        const response = await api.post('/users', userData);
        return response.data;
    },

    update: async (id, userData) => {
        const response = await api.put(`/users/${id}`, userData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/users/${id}`);
        return response.data;
    }
};

export default api;
