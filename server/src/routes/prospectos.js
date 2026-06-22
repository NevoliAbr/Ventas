import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { requireFaculty } from '../middleware/permissions.js'
import {
  listProspectos, createProspecto, updateProspecto, deleteProspecto, importarProspectos,
  listReuniones, addReunion, deleteReunion,
} from '../controllers/prospectoController.js'

const router = Router()
const ver = [authMiddleware, requireFaculty('ventasVer')]
const editar = [authMiddleware, requireFaculty('ventasModificar')]
const eliminar = [authMiddleware, requireFaculty('ventasEliminar')]

router.get('/', ...ver, listProspectos)
router.post('/', ...editar, createProspecto)
router.post('/importar', ...editar, importarProspectos)
router.patch('/:id', ...editar, updateProspecto)
router.delete('/:id', ...eliminar, deleteProspecto)

router.get('/:id/reuniones', ...ver, listReuniones)
router.post('/:id/reuniones', ...editar, addReunion)
router.delete('/:id/reuniones/:rid', ...eliminar, deleteReunion)

export default router
