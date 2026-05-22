// Rutas de gestión de usuarios: /api/users
import { Router } from 'express'
import { listUsers, updateUser, deleteUser } from '../controllers/usersController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { requireUsersView, requireUsersEdit } from '../middleware/permissions.js'

const router = Router()

router.get('/', authMiddleware, requireUsersView, listUsers)
router.patch('/:id', authMiddleware, requireUsersEdit, updateUser)
router.delete('/:id', authMiddleware, requireUsersEdit, deleteUser)

export default router
