import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, createContext, useContext } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import DeviceDetail from './components/DeviceDetail';
import AdminPanel from './components/AdminPanel';
import { authAPI } from './services/api';

// Contexto de Autenticación
export const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

// Componente de Ruta Protegida
function ProtectedRoute({ children, adminOnly = false }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="loading" style={{ minHeight: '100vh' }}>
                <div className="spinner"></div>
                <span>Cargando...</span>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (adminOnly && user.role !== 'admin') {
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}

// Componente Navbar
function Navbar() {
    const { user, logout } = useAuth();

    if (!user) return null;

    return (
        <nav className="navbar">
            <div className="navbar-content">
                <a href="/dashboard" className="navbar-brand">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2L2 7l10 5 10-5-10-5z" />
                        <path d="M2 17l10 5 10-5" />
                        <path d="M2 12l10 5 10-5" />
                    </svg>
                    LoRa Monitor
                </a>

                <div className="navbar-nav">
                    <a href="/dashboard" className="navbar-link">Dashboard</a>
                    {user.role === 'admin' && (
                        <a href="/admin" className="navbar-link">Admin</a>
                    )}
                </div>

                <div className="navbar-user">
                    <span className="user-badge">{user.role}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{user.username}</span>
                    <button onClick={logout} className="btn btn-secondary btn-sm">
                        Cerrar Sesión
                    </button>
                </div>
            </div>
        </nav>
    );
}

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Verificar sesión existente
    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('token');
            const storedUser = localStorage.getItem('user');

            if (token && storedUser) {
                try {
                    // Verificar que el token sigue siendo válido
                    await authAPI.getMe();
                    setUser(JSON.parse(storedUser));
                } catch (error) {
                    // Token inválido, limpiar storage
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                }
            }

            setLoading(false);
        };

        checkAuth();
    }, []);

    const login = (token, userData) => {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(userData));
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        window.location.href = '/login';
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, loading }}>
            <BrowserRouter>
                <Navbar />
                <Routes>
                    <Route path="/login" element={
                        user ? <Navigate to="/dashboard" replace /> : <Login />
                    } />

                    <Route path="/dashboard" element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    } />

                    <Route path="/device/:deviceId" element={
                        <ProtectedRoute>
                            <DeviceDetail />
                        </ProtectedRoute>
                    } />

                    <Route path="/admin" element={
                        <ProtectedRoute adminOnly>
                            <AdminPanel />
                        </ProtectedRoute>
                    } />

                    <Route path="/" element={<Navigate to="/dashboard" replace />} />

                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </BrowserRouter>
        </AuthContext.Provider>
    );
}

export default App;
