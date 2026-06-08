import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { requireFaculty } from '../middleware/permissions.js'
import { listProspectos, createProspecto, updateProspecto, deleteProspecto } from '../controllers/prospectoController.js'

const router = Router()
const ver = [authMiddleware, requireFaculty('ventasVer')]
const editar = [authMiddleware, requireFaculty('ventasModificar')]

router.get('/', ...ver, listProspectos)
router.post('/', ...editar, createProspecto)
router.patch('/:id', ...editar, updateProspecto)
router.delete('/:id', ...editar, deleteProspecto)

export default router
