// Rutas de ventas (transacciones): /api/ventas/*
// Lectura -> facultad 'ventasVer'. Escritura -> facultad 'ventasModificar'.
import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { requireFaculty } from '../middleware/permissions.js'
import {
  listVentas, getVenta, createVenta, updateVenta, deleteVenta,
} from '../controllers/ventasController.js'

const router = Router()

const ver = [authMiddleware, requireFaculty('ventasVer')]
const editar = [authMiddleware, requireFaculty('ventasModificar')]

router.get('/', ...ver, listVentas)
router.get('/:id', ...ver, getVenta)
router.post('/', ...editar, createVenta)
router.patch('/:id', ...editar, updateVenta)
router.delete('/:id', ...editar, deleteVenta)

export default router
