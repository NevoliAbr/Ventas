// Rutas de Pipeline / Forecast: /api/oportunidades/*
import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { requireFaculty } from '../middleware/permissions.js'
import {
  listOportunidades, createOportunidad, updateOportunidad, deleteOportunidad,
} from '../controllers/oportunidadesController.js'

const router = Router()
const ver = [authMiddleware, requireFaculty('ventasVer')]
const editar = [authMiddleware, requireFaculty('ventasModificar')]

router.get('/', ...ver, listOportunidades)
router.post('/', ...editar, createOportunidad)
router.patch('/:id', ...editar, updateOportunidad)
router.delete('/:id', ...editar, deleteOportunidad)

export default router
