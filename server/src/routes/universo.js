import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { requireFaculty } from '../middleware/permissions.js'
import { listUniverso, createUniverso, crearOcultoUniverso, updateUniverso, deleteUniverso, convertirUniverso, listPendientes, importarUniverso } from '../controllers/universoController.js'

const router = Router()
const ver = [authMiddleware, requireFaculty('ventasVer')]
const editar = [authMiddleware, requireFaculty('ventasModificar')]
const eliminar = [authMiddleware, requireFaculty('ventasEliminar')]

router.get('/', ...ver, listUniverso)
router.get('/pendientes', ...ver, listPendientes)
router.post('/', ...editar, createUniverso)
router.post('/oculto', ...editar, crearOcultoUniverso)
router.post('/importar', ...editar, importarUniverso)
router.post('/:id/convertir', ...editar, convertirUniverso)
router.patch('/:id', ...editar, updateUniverso)
router.delete('/:id', ...eliminar, deleteUniverso)

export default router
