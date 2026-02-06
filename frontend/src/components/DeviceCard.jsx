import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

function DeviceCard({ device }) {
    const navigate = useNavigate();
    const measurement = device.lastMeasurement;

    // Calcular si el dispositivo está en línea (datos recientes < 30 minutos)
    const isOnline = measurement &&
        (new Date() - new Date(measurement.receivedAt)) < 30 * 60 * 1000;

    // Formatear hora de última actualización
    const lastUpdate = measurement
        ? formatDistanceToNow(new Date(measurement.receivedAt), {
            addSuffix: true,
            locale: es
        })
        : 'Sin datos';

    return (
        <div className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/device/${device.deviceId}`)}>
            <div className="card-body">
                {/* Encabezado */}
                <div className="flex justify-between items-center" style={{ marginBottom: '1.25rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{device.name}</h3>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{device.deviceId}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className={`status-dot ${isOnline ? 'status-online' : 'status-offline'}`}></span>
                        <span style={{ fontSize: '0.8rem', color: isOnline ? 'var(--color-success)' : 'var(--color-danger)' }}>
                            {isOnline ? 'En línea' : 'Sin conexión'}
                        </span>
                    </div>
                </div>

                {/* Grid de Mediciones */}
                {measurement ? (
                    <div className="grid grid-cols-3" style={{ gap: '1rem', marginBottom: '1rem' }}>
                        <div className="value-display">
                            <span className="value-label">P1</span>
                            <span className="value-number">{measurement.p1?.toFixed(1) ?? '--'}</span>
                        </div>
                        <div className="value-display">
                            <span className="value-label">P2</span>
                            <span className="value-number">{measurement.p2?.toFixed(1) ?? '--'}</span>
                        </div>
                        <div className="value-display">
                            <span className="value-label">Temp</span>
                            <span className="value-number">{measurement.temperature?.toFixed(1) ?? '--'}<span className="value-unit">°C</span></span>
                        </div>
                        <div className="value-display">
                            <span className="value-label">Humedad</span>
                            <span className="value-number">{measurement.humidity?.toFixed(0) ?? '--'}<span className="value-unit">%</span></span>
                        </div>
                        <div className="value-display">
                            <span className="value-label">Batería</span>
                            <span className="value-number">{measurement.battery?.toFixed(2) ?? '--'}<span className="value-unit">V</span></span>
                        </div>
                    </div>
                ) : (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
                        Sin mediciones recientes
                    </div>
                )}

                {/* Pie de Tarjeta */}
                <div className="flex justify-between items-center" style={{
                    paddingTop: '1rem',
                    borderTop: '1px solid var(--border-color)',
                    marginTop: 'auto'
                }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        🕐 {lastUpdate}
                    </span>
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/device/${device.deviceId}`);
                        }}
                    >
                        Ver Detalles
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DeviceCard;
