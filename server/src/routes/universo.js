import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { requireFaculty } from '../middleware/permissions.js'
import { listUniverso, createUniverso, updateUniverso, deleteUniverso } from '../controllers/universoController.js'

const router = Router()
const ver = [authMiddleware, requireFaculty('ventasVer')]
const editar = [authMiddleware, requireFaculty('ventasModificar')]

router.get('/', ...ver, listUniverso)
router.post('/', ...editar, createUniverso)
router.patch('/:id', ...editar, updateUniverso)
router.delete('/:id', ...editar, deleteUniverso)

export default router
