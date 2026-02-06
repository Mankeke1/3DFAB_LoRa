import { useState, useEffect, useCallback } from 'react';
import { usersAPI, devicesAPI } from '../services/api';
import { useAuth } from '../App';

function AdminPanel() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [devices, setDevices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Estado del modal de edición
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        role: 'client',
        assignedDevices: []
    });

    // Estado del modal de confirmación de eliminación
    const [deleteConfirm, setDeleteConfirm] = useState({ show: false, user: null });

    // Obtener datos
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const [usersRes, devicesRes] = await Promise.all([
                usersAPI.getAll(),
                devicesAPI.getAll()
            ]);

            setUsers(usersRes.users);
            setDevices(devicesRes.devices);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Error al cargar los datos');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Abrir modal para crear/editar
    const openModal = (user = null) => {
        setEditingUser(user);
        setFormData(user ? {
            username: user.username,
            password: '',
            role: user.role,
            assignedDevices: user.assignedDevices || []
        } : {
            username: '',
            password: '',
            role: 'client',
            assignedDevices: []
        });
        setShowModal(true);
        setError(null);
    };

    // Manejar envío del formulario
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);

        try {
            const payload = {
                username: formData.username,
                role: formData.role,
                assignedDevices: formData.assignedDevices
            };

            // Solo incluir contraseña si se proporciona
            if (formData.password) {
                payload.password = formData.password;
            }

            if (editingUser) {
                await usersAPI.update(editingUser._id, payload);
                setSuccess('Usuario actualizado correctamente');
            } else {
                if (!formData.password) {
                    setError('La contraseña es requerida para nuevos usuarios');
                    return;
                }
                payload.password = formData.password;
                await usersAPI.create(payload);
                setSuccess('Usuario creado correctamente');
            }

            setShowModal(false);
            fetchData();

            // Limpiar mensaje de éxito después de 3 segundos
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            const message = err.response?.data?.message || 'Error al guardar el usuario';
            setError(message);
        }
    };

    // Abrir confirmación de eliminación
    const confirmDelete = (user) => {
        setDeleteConfirm({ show: true, user });
    };

    // Ejecutar eliminación
    const executeDelete = async () => {
        const user = deleteConfirm.user;
        setDeleteConfirm({ show: false, user: null });

        try {
            await usersAPI.delete(user._id);
            setSuccess('Usuario eliminado correctamente');
            fetchData();
            setTimeout(() => setSuccess(null), 3000);
        } catch (err) {
            const message = err.response?.data?.message || 'Error al eliminar el usuario';
            setError(message);
        }
    };

    // Alternar asignación de dispositivo
    const toggleDevice = (deviceId) => {
        setFormData(prev => ({
            ...prev,
            assignedDevices: prev.assignedDevices.includes(deviceId)
                ? prev.assignedDevices.filter(d => d !== deviceId)
                : [...prev.assignedDevices, deviceId]
        }));
    };

    if (loading) {
        return (
            <div className="loading" style={{ minHeight: '60vh' }}>
                <div className="spinner"></div>
                <span>Cargando panel de administración...</span>
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
                            <h1>Panel de Administración</h1>
                        </div>
                        <p className="page-subtitle">Gestión de usuarios y dispositivos</p>
                    </div>

                    <button onClick={() => openModal()} className="btn btn-primary">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 5v14M5 12h14" />
                        </svg>
                        Nuevo Usuario
                    </button>
                </div>
            </div>

            {/* Alertas */}
            {error && <div className="alert alert-error">{error}</div>}
            {success && <div className="alert alert-success">{success}</div>}

            {/* Users Table */}
            <div className="card">
                <div className="card-header">
                    <h3>Usuarios ({users.length})</h3>
                </div>
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Usuario</th>
                                <th>Rol</th>
                                <th>Dispositivos Asignados</th>
                                <th>Creado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user._id}>
                                    <td>
                                        <strong>{user.username}</strong>
                                    </td>
                                    <td>
                                        <span className="user-badge" style={{
                                            background: user.role === 'admin'
                                                ? 'rgba(239, 68, 68, 0.2)'
                                                : 'rgba(99, 102, 241, 0.2)',
                                            color: user.role === 'admin'
                                                ? '#fca5a5'
                                                : 'var(--color-primary-light)'
                                        }}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td>
                                        {user.assignedDevices?.length > 0 ? (
                                            <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                                                {user.assignedDevices.map(deviceId => (
                                                    <span key={deviceId} style={{
                                                        padding: '0.25rem 0.5rem',
                                                        background: 'var(--bg-glass)',
                                                        borderRadius: 'var(--border-radius)',
                                                        fontSize: '0.8rem'
                                                    }}>
                                                        {deviceId}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)' }}>
                                                {user.role === 'admin' ? 'Todos (admin)' : 'Ninguno'}
                                            </span>
                                        )}
                                    </td>
                                    <td>
                                        {new Date(user.createdAt).toLocaleDateString()}
                                    </td>
                                    <td>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => openModal(user)}
                                                className="btn btn-secondary btn-sm"
                                                disabled={user.username === currentUser.username}
                                                title={user.username === currentUser.username ? 'No puedes editar tu propio usuario' : ''}
                                            >
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => confirmDelete(user)}
                                                className="btn btn-danger btn-sm"
                                                disabled={user.username === currentUser.username}
                                                title={user.username === currentUser.username ? 'No puedes eliminar tu propio usuario' : ''}
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">
                                {editingUser ? 'Editar Usuario' : 'Nuevo Usuario'}
                            </h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                {error && <div className="alert alert-error">{error}</div>}

                                <div className="form-group">
                                    <label className="form-label">Usuario</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                        required
                                        disabled={editingUser}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">
                                        Contraseña {editingUser && '(dejar vacío para mantener)'}
                                    </label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        placeholder={editingUser ? '••••••••' : ''}
                                        required={!editingUser}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Rol</label>
                                    <select
                                        className="form-select"
                                        value={formData.role}
                                        onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    >
                                        <option value="client">Cliente</option>
                                        <option value="admin">Administrador</option>
                                    </select>
                                </div>

                                {formData.role === 'client' && (
                                    <div className="form-group">
                                        <label className="form-label">Dispositivos Asignados</label>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(2, 1fr)',
                                            gap: '0.5rem'
                                        }}>
                                            {devices.map(device => (
                                                <label
                                                    key={device.deviceId}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '0.5rem',
                                                        padding: '0.75rem',
                                                        background: formData.assignedDevices.includes(device.deviceId)
                                                            ? 'rgba(99, 102, 241, 0.2)'
                                                            : 'var(--bg-glass)',
                                                        borderRadius: 'var(--border-radius)',
                                                        cursor: 'pointer',
                                                        border: formData.assignedDevices.includes(device.deviceId)
                                                            ? '1px solid var(--color-primary)'
                                                            : '1px solid var(--border-color)'
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={formData.assignedDevices.includes(device.deviceId)}
                                                        onChange={() => toggleDevice(device.deviceId)}
                                                    />
                                                    <span>{device.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancelar
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingUser ? 'Guardar Cambios' : 'Crear Usuario'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal de Confirmación de Eliminación */}
            {deleteConfirm.show && (
                <div className="modal-overlay" onClick={() => setDeleteConfirm({ show: false, user: null })}>
                    <div className="modal" style={{ maxWidth: '450px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Confirmar Eliminación</h3>
                            <button className="modal-close" onClick={() => setDeleteConfirm({ show: false, user: null })}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M18 6L6 18M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="modal-body">
                            <p style={{ marginBottom: '1rem' }}>
                                ¿Estás seguro de eliminar al usuario "<strong>{deleteConfirm.user?.username}</strong>"?
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                                Esta acción no se puede deshacer.
                            </p>
                        </div>

                        <div className="modal-footer">
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => setDeleteConfirm({ show: false, user: null })}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="btn btn-danger"
                                onClick={executeDelete}
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminPanel;
