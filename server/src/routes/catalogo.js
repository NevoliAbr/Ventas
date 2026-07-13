// Rutas del catálogo de ventas: /api/catalogo/*
// Lectura -> facultad 'ventasVer'. Escritura -> facultad 'ventasModificar'.
import { Router } from 'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { requireFaculty } from '../middleware/permissions.js'
import {
  listUnidades, createUnidad, updateUnidad, deleteUnidad,
  listRubros, createRubro,
  listClientes, createCliente, updateCliente, deleteCliente,
  listProductos, createProducto, updateProducto, deleteProducto,
  createTipoVenta, updateTipoVenta, deleteTipoVenta,
} from '../controllers/catalogoController.js'

const router = Router()

const ver = [authMiddleware, requireFaculty('ventasVer')]
const editar = [authMiddleware, requireFaculty('ventasModificar')]

// Unidades
router.get('/unidades', ...ver, listUnidades)
router.post('/unidades', ...editar, createUnidad)
router.patch('/unidades/:id', ...editar, updateUnidad)
router.delete('/unidades/:id', ...editar, deleteUnidad)

// Rubros / sectores (Universo)
router.get('/rubros', ...ver, listRubros)
router.post('/rubros', ...editar, createRubro)

// Clientes
router.get('/clientes', ...ver, listClientes)
router.post('/clientes', ...editar, createCliente)
router.patch('/clientes/:id', ...editar, updateCliente)
router.delete('/clientes/:id', ...editar, deleteCliente)

// Productos / Servicios (incluyen sus tipos de venta anidados)
router.get('/productos', ...ver, listProductos)
router.post('/productos', ...editar, createProducto)
router.patch('/productos/:id', ...editar, updateProducto)
router.delete('/productos/:id', ...editar, deleteProducto)

// Tipos de venta (tabuladores) de un producto
router.post('/productos/:productoId/tipos', ...editar, createTipoVenta)
router.patch('/tipos/:id', ...editar, updateTipoVenta)
router.delete('/tipos/:id', ...editar, deleteTipoVenta)

export default router
