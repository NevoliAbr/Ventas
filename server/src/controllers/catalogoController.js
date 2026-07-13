// Controlador del catálogo de ventas: unidades, clientes, productos y tipos de venta.
import { unidades, clientes, productos, tiposVenta, rubros } from '../lib/catalogoStore.js'

const TIPOS_PRODUCTO = ['producto', 'servicio']

// ---------- Unidades ----------
export async function listUnidades(req, res) {
  res.json({ unidades: await unidades.all() })
}
export async function createUnidad(req, res) {
  const { nombre, nombre_largo, abreviatura, servicio } = req.body ?? {}
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' })
  res.status(201).json({ unidad: await unidades.create({ nombre: nombre.trim(), nombre_largo: nombre_largo?.trim() || null, abreviatura: abreviatura?.trim() || null, servicio: servicio?.trim() || null }) })
}
export async function updateUnidad(req, res) {
  const { nombre, nombre_largo, abreviatura, servicio } = req.body ?? {}
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' })
  const u = await unidades.update(req.params.id, { nombre: nombre.trim(), nombre_largo: nombre_largo?.trim() || null, abreviatura: abreviatura?.trim() || null, servicio: servicio?.trim() || null })
  if (!u) return res.status(404).json({ error: 'Unidad no encontrada.' })
  res.json({ unidad: u })
}
export async function deleteUnidad(req, res) {
  await unidades.remove(req.params.id)
  res.json({ ok: true })
}

// ---------- Rubros / sectores (Universo) ----------
export async function listRubros(req, res) {
  const rows = await rubros.all()
  res.json({ rubros: rows.map((r) => r.nombre) })
}
export async function createRubro(req, res) {
  const { nombre } = req.body ?? {}
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' })
  const r = await rubros.create(nombre.trim())
  res.status(201).json({ rubro: r.nombre })
}

// ---------- Clientes ----------
export async function listClientes(req, res) {
  res.json({ clientes: await clientes.all() })
}
export async function createCliente(req, res) {
  const { nombre, email, telefono } = req.body ?? {}
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' })
  res.status(201).json({ cliente: await clientes.create({ nombre: nombre.trim(), email: email?.trim() || null, telefono: telefono?.trim() || null }) })
}
export async function updateCliente(req, res) {
  const { nombre, email, telefono } = req.body ?? {}
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' })
  const c = await clientes.update(req.params.id, { nombre: nombre.trim(), email: email?.trim() || null, telefono: telefono?.trim() || null })
  if (!c) return res.status(404).json({ error: 'Cliente no encontrado.' })
  res.json({ cliente: c })
}
export async function deleteCliente(req, res) {
  await clientes.remove(req.params.id)
  res.json({ ok: true })
}

// ---------- Productos (con sus tipos de venta) ----------
export async function listProductos(req, res) {
  const lista = await productos.all()
  const tipos = await tiposVenta.all()
  // Anida los tipos de venta dentro de cada producto.
  const conTipos = lista.map((p) => ({
    ...p,
    tipos_venta: tipos.filter((t) => t.producto_id === p.id),
  }))
  res.json({ productos: conTipos })
}
export async function createProducto(req, res) {
  const { nombre, tipo, sector, unidad_id, activo } = req.body ?? {}
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' })
  if (!TIPOS_PRODUCTO.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido (producto|servicio).' })
  res.status(201).json({ producto: await productos.create({ nombre: nombre.trim(), tipo, sector: sector?.trim() || null, unidad_id: unidad_id || null, activo: activo !== false }) })
}
export async function updateProducto(req, res) {
  const { nombre, tipo, sector, unidad_id, activo } = req.body ?? {}
  if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' })
  if (!TIPOS_PRODUCTO.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido (producto|servicio).' })
  const p = await productos.update(req.params.id, { nombre: nombre.trim(), tipo, sector: sector?.trim() || null, unidad_id: unidad_id || null, activo: activo !== false })
  if (!p) return res.status(404).json({ error: 'Producto no encontrado.' })
  res.json({ producto: p })
}
export async function deleteProducto(req, res) {
  await productos.remove(req.params.id)
  res.json({ ok: true })
}

// ---------- Rangos de precio (unidades_min/max + piso/lista) ----------
function normalizarRango(body) {
  const { nombre, segmento, unidades_min, unidades_max, precio_piso, precio_lista } = body ?? {}
  if (!nombre?.trim()) return { error: 'El nombre del rango es obligatorio.' }
  const umin = Number(unidades_min)
  if (!Number.isInteger(umin) || umin < 1) return { error: 'Unidades mínimas debe ser un entero ≥ 1.' }
  // unidades_max vacío/null = "más de" (sin tope superior)
  let umax = null
  if (unidades_max !== '' && unidades_max !== null && unidades_max !== undefined) {
    umax = Number(unidades_max)
    if (!Number.isInteger(umax) || umax < umin) return { error: 'Unidades máximas debe ser un entero ≥ mínimo.' }
  }
  const piso = Number(precio_piso)
  const lista = Number(precio_lista)
  if (!Number.isFinite(piso) || !Number.isFinite(lista) || piso < 0 || lista < 0) {
    return { error: 'Precio piso y precio lista deben ser números válidos.' }
  }
  if (lista < piso) return { error: 'El precio lista no puede ser menor que el precio piso.' }
  return { datos: { nombre: nombre.trim(), segmento: segmento?.trim() || null, unidades_min: umin, unidades_max: umax, precio_piso: piso, precio_lista: lista } }
}

export async function createTipoVenta(req, res) {
  const producto = await productos.find(req.params.productoId)
  if (!producto) return res.status(404).json({ error: 'Producto no encontrado.' })
  const { error, datos } = normalizarRango(req.body)
  if (error) return res.status(400).json({ error })
  const tipo = await tiposVenta.create({ producto_id: producto.id, ...datos })
  res.status(201).json({ tipo })
}

export async function updateTipoVenta(req, res) {
  const { error, datos } = normalizarRango(req.body)
  if (error) return res.status(400).json({ error })
  const tipo = await tiposVenta.update(req.params.id, datos)
  if (!tipo) return res.status(404).json({ error: 'Rango no encontrado.' })
  res.json({ tipo })
}

export async function deleteTipoVenta(req, res) {
  await tiposVenta.remove(req.params.id)
  res.json({ ok: true })
}
