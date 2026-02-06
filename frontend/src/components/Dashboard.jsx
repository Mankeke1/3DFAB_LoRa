import { useState, useEffect, useCallback } from 'react';
import { devicesAPI } from '../services/api';
import DeviceCard from './DeviceCard';

// Intervalo de polling en milisegundos (30 segundos)
const POLLING_INTERVAL = 30000;

function Dashboard() {
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);

    // Obtener dispositivos
    const fetchDevices = useCallback(async (showLoading = false) => {
        try {
            if (showLoading) setLoading(true);
            setError(null);

            const response = await devicesAPI.getAll();
            setDevices(response.devices);
            setLastUpdate(new Date());
        } catch (err) {
            console.error('Error fetching devices:', err);
            setError('Error al cargar los dispositivos');
        } finally {
            setLoading(false);
        }
    }, []);

    // Carga inicial y polling
    useEffect(() => {
        fetchDevices(true);

        // Configurar polling
        const intervalId = setInterval(() => {
            fetchDevices(false);
        }, POLLING_INTERVAL);

        return () => clearInterval(intervalId);
    }, [fetchDevices]);

    // Contar dispositivos en línea/sin conexión
    const onlineCount = devices.filter(d =>
        d.lastMeasurement &&
        (new Date() - new Date(d.lastMeasurement.receivedAt)) < 30 * 60 * 1000
    ).length;

    if (loading && devices.length === 0) {
        return (
            <div className="loading" style={{ minHeight: '60vh' }}>
                <div className="spinner"></div>
                <span>Cargando dispositivos...</span>
            </div>
        );
    }

    return (
        <div className="container page">
            {/* Encabezado de Página */}
            <div className="page-header">
                <div className="flex justify-between items-center">
                    <div>
                        <div className="page-title">
                            <h1>Dashboard</h1>
                            <span style={{
                                padding: '0.25rem 0.75rem',
                                background: 'var(--bg-glass)',
                                borderRadius: '999px',
                                fontSize: '0.85rem',
                                color: 'var(--text-secondary)'
                            }}>
                                {devices.length} dispositivos
                            </span>
                        </div>
                        <p className="page-subtitle">
                            Monitoreo en tiempo real de sensores LoRa
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Resumen de Estado */}
                        <div style={{
                            display: 'flex',
                            gap: '1rem',
                            padding: '0.75rem 1.25rem',
                            background: 'var(--bg-glass)',
                            borderRadius: 'var(--border-radius)',
                            border: '1px solid var(--border-color)'
                        }}>
                            <div className="flex items-center gap-2">
                                <span className="status-dot status-online"></span>
                                <span style={{ fontSize: '0.9rem' }}>{onlineCount} en línea</span>
                            </div>
                            <div style={{ width: '1px', background: 'var(--border-color)' }}></div>
                            <div className="flex items-center gap-2">
                                <span className="status-dot status-offline"></span>
                                <span style={{ fontSize: '0.9rem' }}>{devices.length - onlineCount} sin conexión</span>
                            </div>
                        </div>

                        {/* Botón de Actualizar */}
                        <button
                            onClick={() => fetchDevices(true)}
                            className="btn btn-secondary"
                            disabled={loading}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M23 4v6h-6M1 20v-6h6" />
                                <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                            </svg>
                            Actualizar
                        </button>
                    </div>
                </div>

                {/* Última Actualización */}
                {lastUpdate && (
                    <p style={{
                        marginTop: '0.75rem',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)'
                    }}>
                        Última actualización: {lastUpdate.toLocaleTimeString()}
                        <span style={{ marginLeft: '0.5rem' }}>
                            (se actualiza automáticamente cada {POLLING_INTERVAL / 1000} segundos)
                        </span>
                    </p>
                )}
            </div>

            {/* Alerta de Error */}
            {error && (
                <div className="alert alert-error">
                    {error}
                </div>
            )}

            {/* Grid de Dispositivos */}
            {devices.length === 0 ? (
                <div className="empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                        <line x1="12" y1="18" x2="12.01" y2="18" />
                    </svg>
                    <h3>No hay dispositivos</h3>
                    <p>Los dispositivos aparecerán aquí cuando envíen datos</p>
                </div>
            ) : (
                <div className="grid grid-cols-3">
                    {devices.map(device => (
                        <DeviceCard key={device.deviceId} device={device} />
                    ))}
                </div>
            )}
        </div>
    );
}

export default Dashboard;
