const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticate, authorize } = require('../middleware/auth');

// Todas las rutas requieren autenticación y rol de administrador
router.use(authenticate);
router.use(authorize('admin'));

/**
 * GET /api/users
 * Listar todos los usuarios (solo admin)
 */
router.get('/', async (req, res) => {
    try {
        const users = await User.find().sort({ username: 1 });

        res.json({
            success: true,
            count: users.length,
            users
        });

    } catch (error) {
        console.error('[Users] List error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch users'
        });
    }
});

/**
 * GET /api/users/:id
 * Obtener usuario individual por ID
 */
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            user
        });

    } catch (error) {
        console.error('[Users] Get error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to fetch user'
        });
    }
});

/**
 * POST /api/users
 * Crear nuevo usuario (solo admin)
 * 
 * Body: { username, password, role, assignedDevices }
 */
router.post('/', async (req, res) => {
    try {
        const { username, password, role, assignedDevices } = req.body;

        // Validar campos requeridos
        if (!username || !password) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Username and password are required'
            });
        }

        // Validar rol
        if (role && !['admin', 'client'].includes(role)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Role must be "admin" or "client"'
            });
        }

        // Verificar si el nombre de usuario ya existe
        const existingUser = await User.findOne({ username: username.toLowerCase().trim() });
        if (existingUser) {
            return res.status(409).json({
                error: 'Conflict',
                message: 'Username already exists'
            });
        }

        // Crear usuario (los usuarios admin no deberían tener dispositivos asignados)
        const user = new User({
            username: username.toLowerCase().trim(),
            passwordHash: password, // Será hasheado por el hook pre-save
            role: role || 'client',
            assignedDevices: (role === 'admin') ? [] : (assignedDevices || [])
        });

        await user.save();

        console.log(`[Users] ✓ Created user: ${user.username}`);

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            user
        });

    } catch (error) {
        console.error('[Users] Create error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to create user'
        });
    }
});

/**
 * PUT /api/users/:id
 * Actualizar usuario (solo admin)
 * 
 * Body: { username?, password?, role?, assignedDevices? }
 */
router.put('/:id', async (req, res) => {
    try {
        const { username, password, role, assignedDevices } = req.body;

        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'User not found'
            });
        }

        // Validar rol si se proporciona
        if (role && !['admin', 'client'].includes(role)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Role must be "admin" or "client"'
            });
        }

        // Verificar unicidad del nombre de usuario si cambia
        if (username && username.toLowerCase().trim() !== user.username) {
            const existingUser = await User.findOne({ username: username.toLowerCase().trim() });
            if (existingUser) {
                return res.status(409).json({
                    error: 'Conflict',
                    message: 'Username already exists'
                });
            }
            user.username = username.toLowerCase().trim();
        }

        // Actualizar campos
        if (password) user.passwordHash = password; // Será hasheado por el hook pre-save
        if (role) {
            user.role = role;
            // Los usuarios admin no deben tener dispositivos asignados
            if (role === 'admin') {
                user.assignedDevices = [];
            }
        }
        if (assignedDevices !== undefined && user.role !== 'admin') {
            user.assignedDevices = assignedDevices;
        }

        await user.save();

        console.log(`[Users] ✓ Updated user: ${user.username}`);

        res.json({
            success: true,
            message: 'User updated successfully',
            user
        });

    } catch (error) {
        console.error('[Users] Update error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to update user'
        });
    }
});

/**
 * DELETE /api/users/:id
 * Eliminar usuario (solo admin)
 */
router.delete('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'User not found'
            });
        }

        // Prevenir auto-eliminación
        if (user._id.toString() === req.user.id.toString()) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'Cannot delete your own account'
            });
        }

        await User.deleteOne({ _id: req.params.id });

        console.log(`[Users] ✓ Deleted user: ${user.username}`);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('[Users] Delete error:', error);
        res.status(500).json({
            error: 'Internal Server Error',
            message: 'Failed to delete user'
        });
    }
});

module.exports = router;
