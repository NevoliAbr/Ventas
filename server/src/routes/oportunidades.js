// Rutas de Pipeline / Forecast: /api/oportunidades/*
import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { requireFaculty } from '../middleware/permissions.js'
import {
  listOportunidades, createOportunidad, updateOportunidad, deleteOportunidad, importarOportunidades,
} from '../controllers/oportunidadesController.js'

const router = Router()
const ver = [authMiddleware, requireFaculty('ventasVer')]
const editar = [authMiddleware, requireFaculty('ventasModificar')]
const eliminar = [authMiddleware, requireFaculty('ventasEliminar')]

router.get('/', ...ver, listOportunidades)
router.post('/', ...editar, createOportunidad)
router.post('/importar', ...editar, importarOportunidades)
router.patch('/:id', ...editar, updateOportunidad)
router.delete('/:id', ...eliminar, deleteOportunidad)

export default router
