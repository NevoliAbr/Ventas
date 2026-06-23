// Repositorio del catálogo de ventas (MySQL / MariaDB): unidades, clientes,
// productos y tipos de venta (tabuladores). Espejo de catalogoRepo.mssql.js.
import { getPool } from './mysql.js'
import { randomUUID } from 'node:crypto'

const first = (rows) => rows[0] ?? null

// ---------------- Unidades de medida ----------------
export const unidades = {
  async all() {
    const pool = await getPool()
    const [rows] = await pool.query('SELECT * FROM unidades ORDER BY nombre')
    return rows
  },
  async create({ nombre, abreviatura = null, servicio = null }) {
    const pool = await getPool()
    const u = { id: randomUUID(), nombre, abreviatura, servicio }
    await pool.query('INSERT INTO unidades (id, nombre, abreviatura, servicio) VALUES (?, ?, ?, ?)', [u.id, u.nombre, u.abreviatura, u.servicio])
    return u
  },
  async update(id, { nombre, abreviatura, servicio }) {
    const pool = await getPool()
    await pool.query('UPDATE unidades SET nombre=?, abreviatura=?, servicio=? WHERE id=?', [nombre, abreviatura ?? null, servicio ?? null, id])
    const [rows] = await pool.query('SELECT * FROM unidades WHERE id=?', [id])
    return first(rows)
  },
  async remove(id) {
    const pool = await getPool()
    const [r] = await pool.query('DELETE FROM unidades WHERE id=?', [id])
    return r.affectedRows > 0
  },
}

// ---------------- Clientes ----------------
export const clientes = {
  async all() {
    const pool = await getPool()
    const [rows] = await pool.query('SELECT * FROM clientes ORDER BY nombre')
    return rows
  },
  async find(id) {
    const pool = await getPool()
    const [rows] = await pool.query('SELECT * FROM clientes WHERE id=?', [id])
    return first(rows)
  },
  async create({ nombre, email = null, telefono = null }) {
    const pool = await getPool()
    const c = { id: randomUUID(), nombre, email, telefono }
    await pool.query('INSERT INTO clientes (id, nombre, email, telefono) VALUES (?, ?, ?, ?)', [c.id, c.nombre, c.email, c.telefono])
    return c
  },
  async update(id, { nombre, email, telefono }) {
    const pool = await getPool()
    await pool.query('UPDATE clientes SET nombre=?, email=?, telefono=? WHERE id=?', [nombre, email ?? null, telefono ?? null, id])
    const [rows] = await pool.query('SELECT * FROM clientes WHERE id=?', [id])
    return first(rows)
  },
  async remove(id) {
    const pool = await getPool()
    const [r] = await pool.query('DELETE FROM clientes WHERE id=?', [id])
    return r.affectedRows > 0
  },
}

// ---------------- Productos / Servicios ----------------
export const productos = {
  async all() {
    const pool = await getPool()
    const [rows] = await pool.query('SELECT * FROM productos ORDER BY nombre')
    return rows
  },
  async find(id) {
    const pool = await getPool()
    const [rows] = await pool.query('SELECT * FROM productos WHERE id=?', [id])
    return first(rows)
  },
  async create({ nombre, tipo, sector = null, unidad_id = null, activo = true }) {
    const pool = await getPool()
    const p = { id: randomUUID(), nombre, tipo, sector, unidad_id, activo: !!activo, createdAt: new Date().toISOString() }
    await pool.query(
      `INSERT INTO productos (id, nombre, tipo, sector, unidad_id, activo, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [p.id, p.nombre, p.tipo, p.sector, p.unidad_id, p.activo ? 1 : 0, p.createdAt],
    )
    return p
  },
  async update(id, { nombre, tipo, sector, unidad_id, activo }) {
    const pool = await getPool()
    await pool.query(
      'UPDATE productos SET nombre=?, tipo=?, sector=?, unidad_id=?, activo=? WHERE id=?',
      [nombre, tipo, sector ?? null, unidad_id ?? null, activo ? 1 : 0, id],
    )
    return this.find(id)
  },
  async remove(id) {
    const pool = await getPool()
    // Borra también sus tipos de venta.
    await pool.query('DELETE FROM tipos_venta WHERE producto_id=?', [id])
    const [r] = await pool.query('DELETE FROM productos WHERE id=?', [id])
    return r.affectedRows > 0
  },
}

// ---------------- Tipos de venta (tabuladores) ----------------
export const tiposVenta = {
  async byProducto(productoId) {
    const pool = await getPool()
    const [rows] = await pool.query('SELECT * FROM tipos_venta WHERE producto_id=? ORDER BY nombre', [productoId])
    return rows
  },
  async all() {
    const pool = await getPool()
    const [rows] = await pool.query('SELECT * FROM tipos_venta')
    return rows
  },
  async find(id) {
    const pool = await getPool()
    const [rows] = await pool.query('SELECT * FROM tipos_venta WHERE id=?', [id])
    return first(rows)
  },
  async create({ producto_id, nombre, segmento = null, unidades_min = 1, unidades_max = null, precio_piso = 0, precio_lista = 0 }) {
    const pool = await getPool()
    const t = { id: randomUUID(), producto_id, nombre, segmento, unidades_min, unidades_max, precio_piso, precio_lista }
    await pool.query(
      `INSERT INTO tipos_venta (id, producto_id, nombre, segmento, unidades_min, unidades_max, precio_piso, precio_lista)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.id, t.producto_id, t.nombre, t.segmento, t.unidades_min, t.unidades_max, t.precio_piso, t.precio_lista],
    )
    return t
  },
  async update(id, { nombre, segmento, unidades_min, unidades_max, precio_piso, precio_lista }) {
    const pool = await getPool()
    await pool.query(
      `UPDATE tipos_venta SET nombre=?, segmento=?, unidades_min=?, unidades_max=?, precio_piso=?, precio_lista=? WHERE id=?`,
      [nombre, segmento ?? null, unidades_min ?? 1, unidades_max ?? null, precio_piso ?? 0, precio_lista ?? 0, id],
    )
    const [rows] = await pool.query('SELECT * FROM tipos_venta WHERE id=?', [id])
    return first(rows)
  },
  async remove(id) {
    const pool = await getPool()
    const [r] = await pool.query('DELETE FROM tipos_venta WHERE id=?', [id])
    return r.affectedRows > 0
  },
}
