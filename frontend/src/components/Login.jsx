import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { authAPI } from '../services/api';

function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!username.trim() || !password.trim()) {
            setError('Por favor ingrese usuario y contraseña');
            return;
        }

        setLoading(true);

        try {
            const response = await authAPI.login(username.trim(), password);
            login(response.accessToken, response.user);
            navigate('/dashboard');
        } catch (err) {
            const message = err.response?.data?.message || 'Error al iniciar sesión';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem'
        }}>
            <div className="card" style={{ width: '100%', maxWidth: '420px' }}>
                <div className="card-body" style={{ padding: '2.5rem' }}>
                    {/* Logotipo */}
                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div style={{
                            width: '70px',
                            height: '70px',
                            margin: '0 auto 1rem',
                            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%)',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: 'var(--shadow-glow)'
                        }}>
                            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                <path d="M2 17l10 5 10-5" />
                                <path d="M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>LoRa Monitor</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>Sistema de monitoreo de sensores</p>
                    </div>

                    {/* Alerta de Error */}
                    {error && (
                        <div className="alert alert-error">
                            {error}
                        </div>
                    )}

                    {/* Formulario de Login */}
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label" htmlFor="username">Usuario</label>
                            <input
                                id="username"
                                type="text"
                                className="form-input"
                                placeholder="Ingrese su usuario"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={loading}
                                autoComplete="username"
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label" htmlFor="password">Contraseña</label>
                            <input
                                id="password"
                                type="password"
                                className="form-input"
                                placeholder="Ingrese su contraseña"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                                autoComplete="current-password"
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '0.5rem' }}
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <div className="spinner" style={{ width: '18px', height: '18px', borderWidth: '2px' }}></div>
                                    Ingresando...
                                </>
                            ) : (
                                'Iniciar Sesión'
                            )}
                        </button>
                    </form>

                    {/* Credenciales de Demostración */}
                    {/* COMENTADO PARA PRODUCCIÓN - Descomentar solo para desarrollo/demos
                    <div style={{
                        marginTop: '2rem',
                        padding: '1rem',
                        background: 'var(--bg-glass)',
                        borderRadius: 'var(--border-radius)',
                        fontSize: '0.85rem',
                        color: 'var(--text-secondary)'
                    }}>
                        <strong style={{ color: 'var(--text-primary)' }}>Credenciales de prueba:</strong>
                        <div style={{ marginTop: '0.5rem' }}>
                            Admin: <code>Fabian / .Fabian.123.123.</code><br />
                            Cliente: <code>lab1 / lab123</code>
                        </div>
                    </div>
                    */}
                </div>
            </div>
        </div>
    );
}

export default Login;
