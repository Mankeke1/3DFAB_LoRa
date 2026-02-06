import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend, ReferenceArea
} from 'recharts';
import { format, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { devicesAPI } from '../services/api';

// Configuración de variables
const VARIABLES = {
    p1: { label: 'P1', color: '#6366f1', unit: '' },
    p2: { label: 'P2', color: '#10b981', unit: '' },
    temperature: { label: 'Temperatura', color: '#f59e0b', unit: '°C' },
    humidity: { label: 'Humedad', color: '#3b82f6', unit: '%' },
    battery: { label: 'Batería', color: '#ef4444', unit: 'V' }
};

function DeviceDetail() {
    const { deviceId } = useParams();
    const navigate = useNavigate();

    const [device, setDevice] = useState(null);
    const [measurements, setMeasurements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [exporting, setExporting] = useState(false);

    // Filtros
    const [variable, setVariable] = useState('temperature');
    const [startDate, setStartDate] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    // Estado del zoom
    const [zoomEnabled, setZoomEnabled] = useState(false);
    const [refAreaLeft, setRefAreaLeft] = useState('');
    const [refAreaRight, setRefAreaRight] = useState('');
    const [left, setLeft] = useState(0);
    const [right, setRight] = useState(0);

    // Obtener datos del dispositivo
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Obtener información del dispositivo y mediciones
            const [latestRes, measurementsRes] = await Promise.all([
                devicesAPI.getLatest(deviceId),
                devicesAPI.getMeasurements(deviceId, {
                    start: startDate ? new Date(startDate).toISOString() : undefined,
                    end: endDate ? new Date(endDate + 'T23:59:59').toISOString() : undefined,
                    variable,
                    limit: 2000
                })
            ]);

            setDevice(latestRes.device);

            // Formatear mediciones para el gráfico
            const formatted = measurementsRes.measurements
                .map(m => ({
                    time: new Date(m.receivedAt).getTime(),
                    value: m[variable],
                    formattedTime: format(new Date(m.receivedAt), 'dd/MM HH:mm', { locale: es })
                }))
                .filter(m => m.value !== null && m.value !== undefined) // Filtrar valores inválidos
                .reverse(); // Orden cronológico

            setMeasurements(formatted);
            // Resetear zoom cuando cambian los datos
            setLeft(0);
            setRight(formatted.length - 1);
        } catch (err) {
            console.error('Error fetching device data:', err);
            setError('Error al cargar los datos del dispositivo');
        } finally {
            setLoading(false);
        }
    }, [deviceId, startDate, endDate, variable]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Exportar CSV
    const handleExport = async () => {
        try {
            setExporting(true);
            await devicesAPI.exportCSV(deviceId, {
                start: startDate ? new Date(startDate).toISOString() : undefined,
                end: endDate ? new Date(endDate + 'T23:59:59').toISOString() : undefined,
                variable
            });
        } catch (err) {
            console.error('Export error:', err);
            setError('Error al exportar los datos');
        } finally {
            setExporting(false);
        }
    };

    // Manejadores de zoom
    const zoom = () => {
        if (refAreaLeft === refAreaRight || refAreaRight === '') {
            setRefAreaLeft('');
            setRefAreaRight('');
            return;
        }

        // Encontrar índices en el array de mediciones
        const leftIndex = measurements.findIndex(m => m.formattedTime === refAreaLeft);
        const rightIndex = measurements.findIndex(m => m.formattedTime === refAreaRight);

        if (leftIndex === -1 || rightIndex === -1) {
            setRefAreaLeft('');
            setRefAreaRight('');
            return;
        }

        // Asegurar que left es menor que right
        const newLeft = Math.min(leftIndex, rightIndex);
        const newRight = Math.max(leftIndex, rightIndex);

        setLeft(newLeft);
        setRight(newRight);
        setRefAreaLeft('');
        setRefAreaRight('');
    };

    const resetZoom = () => {
        setLeft(0);
        setRight(measurements.length - 1);
        setRefAreaLeft('');
        setRefAreaRight('');
    };

    // Tooltip personalizado
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            return (
                <div style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--border-radius)',
                    padding: '0.75rem 1rem'
                }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
                        {payload[0].payload.formattedTime}
                    </p>
                    <p style={{ color: VARIABLES[variable].color, fontWeight: 600 }}>
                        {payload[0].value?.toFixed(2)} {VARIABLES[variable].unit}
                    </p>
                </div>
            );
        }
        return null;
    };

    if (loading && !device) {
        return (
            <div className="loading" style={{ minHeight: '60vh' }}>
                <div className="spinner"></div>
                <span>Cargando datos...</span>
            </div>
        );
    }

    return (
        <div className="container page">
            {/* Botón de Volver */}
            <button
                onClick={() => navigate('/dashboard')}
                className="btn btn-secondary btn-sm"
                style={{ marginBottom: '1.5rem' }}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                Volver al Dashboard
            </button>

            {/* Encabezado de Página */}
            <div className="page-header">
                <div className="page-title">
                    <h1>{device?.name || deviceId}</h1>
                    <span style={{
                        padding: '0.25rem 0.75rem',
                        background: 'var(--bg-glass)',
                        borderRadius: '999px',
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)'
                    }}>
                        {deviceId}
                    </span>
                </div>
                <p className="page-subtitle">{device?.description || 'Detalle del dispositivo'}</p>
            </div>

            {/* Alerta de Error */}
            {error && (
                <div className="alert alert-error">
                    {error}
                </div>
            )}

            {/* Tarjeta de Filtros */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div className="card-body">
                    <div className="flex items-center gap-4" style={{ flexWrap: 'wrap' }}>
                        {/* Selector de Variable */}
                        <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
                            <label className="form-label">Variable</label>
                            <select
                                className="form-select"
                                value={variable}
                                onChange={(e) => setVariable(e.target.value)}
                            >
                                {Object.entries(VARIABLES).map(([key, config]) => (
                                    <option key={key} value={key}>{config.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Rango de Fechas */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Fecha Inicio</label>
                            <input
                                type="date"
                                className="form-input"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label">Fecha Fin</label>
                            <input
                                type="date"
                                className="form-input"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>

                        {/* Botones */}
                        <div style={{ display: 'flex', gap: '0.75rem', marginLeft: 'auto', alignSelf: 'flex-end' }}>
                            <button
                                onClick={fetchData}
                                className="btn btn-secondary"
                                disabled={loading}
                            >
                                {loading ? (
                                    <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M23 4v6h-6M1 20v-6h6" />
                                        <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
                                    </svg>
                                )}
                                Actualizar
                            </button>

                            <button
                                onClick={handleExport}
                                className="btn btn-primary"
                                disabled={exporting}
                            >
                                {exporting ? (
                                    <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }}></div>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
                                    </svg>
                                )}
                                Exportar CSV
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tarjeta del Gráfico */}
            <div className="card">
                <div className="card-header">
                    <div className="flex justify-between items-center">
                        <h3>{VARIABLES[variable].label}</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                {measurements.length} mediciones
                            </span>
                            <button
                                onClick={() => {
                                    if (zoomEnabled) {
                                        resetZoom();
                                        setZoomEnabled(false);
                                    } else {
                                        setZoomEnabled(true);
                                    }
                                }}
                                className="btn btn-secondary btn-sm"
                                style={{
                                    background: zoomEnabled ? 'var(--primary-color)' : 'var(--bg-glass)',
                                    padding: '0.5rem',
                                    minWidth: 'auto'
                                }}
                                title={zoomEnabled ? 'Desactivar zoom (click para resetear)' : 'Activar zoom interactivo'}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="11" cy="11" r="8" />
                                    <path d="m21 21-4.35-4.35" />
                                    {zoomEnabled && <path d="M11 8v6M8 11h6" strokeLinecap="round" />}
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
                <div className="card-body">
                    {measurements.length === 0 ? (
                        <div className="empty-state">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M3 3v18h18" />
                                <path d="M18 9l-5 5-4-4-3 3" />
                            </svg>
                            <h3>Sin datos</h3>
                            <p>No hay mediciones en el rango seleccionado</p>
                        </div>
                    ) : (
                        <div style={{ width: '100%', height: 400 }}>
                            <ResponsiveContainer>
                                <LineChart
                                    data={measurements.slice(left, right + 1)}
                                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                                    onMouseDown={(e) => zoomEnabled && e && setRefAreaLeft(e.activeLabel)}
                                    onMouseMove={(e) => zoomEnabled && refAreaLeft && e && setRefAreaRight(e.activeLabel)}
                                    onMouseUp={zoomEnabled ? zoom : undefined}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                    <XAxis
                                        dataKey="formattedTime"
                                        stroke="var(--text-muted)"
                                        tick={{ fontSize: 11 }}
                                        interval="preserveStartEnd"
                                        domain={[left, right]}
                                        allowDataOverflow
                                        type="category"
                                    />
                                    <YAxis
                                        stroke="var(--text-muted)"
                                        tick={{ fontSize: 12 }}
                                        domain={['auto', 'auto']}
                                        tickFormatter={(v) => v.toFixed(1)}
                                        allowDataOverflow
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        name={VARIABLES[variable].label}
                                        stroke={VARIABLES[variable].color}
                                        strokeWidth={2}
                                        dot={false}
                                        activeDot={{ r: 6, strokeWidth: 2 }}
                                    />
                                    {refAreaLeft && refAreaRight && (
                                        <ReferenceArea
                                            x1={refAreaLeft}
                                            x2={refAreaRight}
                                            strokeOpacity={0.3}
                                            fill="var(--primary-color)"
                                            fillOpacity={0.3}
                                        />
                                    )}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default DeviceDetail;
