// Repositorio del catálogo de ventas (SQL Server): unidades, clientes, productos
// y tipos de venta (tabuladores). Usa el pool/esquema compartido (mssql.js).
import { getPool, sql } from './mssql.js'
import { randomUUID } from 'node:crypto'

const first = (r) => r.recordset[0] ?? null

// ---------------- Unidades de medida ----------------
export const unidades = {
  async all() {
    const pool = await getPool()
    return (await pool.request().query('SELECT * FROM unidades ORDER BY nombre')).recordset
  },
  async create({ nombre, abreviatura = null }) {
    const pool = await getPool()
    const u = { id: randomUUID(), nombre, abreviatura }
    await pool.request()
      .input('id', sql.NVarChar, u.id)
      .input('nombre', sql.NVarChar, u.nombre)
      .input('abreviatura', sql.NVarChar, u.abreviatura)
      .query('INSERT INTO unidades (id, nombre, abreviatura) VALUES (@id, @nombre, @abreviatura)')
    return u
  },
  async update(id, { nombre, abreviatura }) {
    const pool = await getPool()
    await pool.request()
      .input('id', sql.NVarChar, id)
      .input('nombre', sql.NVarChar, nombre)
      .input('abreviatura', sql.NVarChar, abreviatura ?? null)
      .query('UPDATE unidades SET nombre=@nombre, abreviatura=@abreviatura WHERE id=@id')
    return first(await pool.request().input('id', sql.NVarChar, id).query('SELECT * FROM unidades WHERE id=@id'))
  },
  async remove(id) {
    const pool = await getPool()
    const r = await pool.request().input('id', sql.NVarChar, id).query('DELETE FROM unidades WHERE id=@id')
    return r.rowsAffected[0] > 0
  },
}

// ---------------- Clientes ----------------
export const clientes = {
  async all() {
    const pool = await getPool()
    return (await pool.request().query('SELECT * FROM clientes ORDER BY nombre')).recordset
  },
  async find(id) {
    const pool = await getPool()
    return first(await pool.request().input('id', sql.NVarChar, id).query('SELECT * FROM clientes WHERE id=@id'))
  },
  async create({ nombre, email = null, telefono = null }) {
    const pool = await getPool()
    const c = { id: randomUUID(), nombre, email, telefono }
    await pool.request()
      .input('id', sql.NVarChar, c.id)
      .input('nombre', sql.NVarChar, c.nombre)
      .input('email', sql.NVarChar, c.email)
      .input('telefono', sql.NVarChar, c.telefono)
      .query('INSERT INTO clientes (id, nombre, email, telefono) VALUES (@id, @nombre, @email, @telefono)')
    return c
  },
  async update(id, { nombre, email, telefono }) {
    const pool = await getPool()
    await pool.request()
      .input('id', sql.NVarChar, id)
      .input('nombre', sql.NVarChar, nombre)
      .input('email', sql.NVarChar, email ?? null)
      .input('telefono', sql.NVarChar, telefono ?? null)
      .query('UPDATE clientes SET nombre=@nombre, email=@email, telefono=@telefono WHERE id=@id')
    return first(await pool.request().input('id', sql.NVarChar, id).query('SELECT * FROM clientes WHERE id=@id'))
  },
  async remove(id) {
    const pool = await getPool()
    const r = await pool.request().input('id', sql.NVarChar, id).query('DELETE FROM clientes WHERE id=@id')
    return r.rowsAffected[0] > 0
  },
}

// ---------------- Productos / Servicios ----------------
export const productos = {
  async all() {
    const pool = await getPool()
    return (await pool.request().query('SELECT * FROM productos ORDER BY nombre')).recordset
  },
  async find(id) {
    const pool = await getPool()
    return first(await pool.request().input('id', sql.NVarChar, id).query('SELECT * FROM productos WHERE id=@id'))
  },
  async create({ nombre, tipo, sector = null, unidad_id = null, activo = true }) {
    const pool = await getPool()
    const p = { id: randomUUID(), nombre, tipo, sector, unidad_id, activo: !!activo, createdAt: new Date().toISOString() }
    await pool.request()
      .input('id', sql.NVarChar, p.id)
      .input('nombre', sql.NVarChar, p.nombre)
      .input('tipo', sql.NVarChar, p.tipo)
      .input('sector', sql.NVarChar, p.sector)
      .input('unidad_id', sql.NVarChar, p.unidad_id)
      .input('activo', sql.Bit, p.activo)
      .input('createdAt', sql.NVarChar, p.createdAt)
      .query(`INSERT INTO productos (id, nombre, tipo, sector, unidad_id, activo, createdAt)
              VALUES (@id, @nombre, @tipo, @sector, @unidad_id, @activo, @createdAt)`)
    return p
  },
  async update(id, { nombre, tipo, sector, unidad_id, activo }) {
    const pool = await getPool()
    await pool.request()
      .input('id', sql.NVarChar, id)
      .input('nombre', sql.NVarChar, nombre)
      .input('tipo', sql.NVarChar, tipo)
      .input('sector', sql.NVarChar, sector ?? null)
      .input('unidad_id', sql.NVarChar, unidad_id ?? null)
      .input('activo', sql.Bit, activo ? 1 : 0)
      .query('UPDATE productos SET nombre=@nombre, tipo=@tipo, sector=@sector, unidad_id=@unidad_id, activo=@activo WHERE id=@id')
    return this.find(id)
  },
  async remove(id) {
    const pool = await getPool()
    // Borra también sus tipos de venta.
    await pool.request().input('pid', sql.NVarChar, id).query('DELETE FROM tipos_venta WHERE producto_id=@pid')
    const r = await pool.request().input('id', sql.NVarChar, id).query('DELETE FROM productos WHERE id=@id')
    return r.rowsAffected[0] > 0
  },
}

// ---------------- Tipos de venta (tabuladores) ----------------
export const tiposVenta = {
  async byProducto(productoId) {
    const pool = await getPool()
    return (await pool.request().input('pid', sql.NVarChar, productoId)
      .query('SELECT * FROM tipos_venta WHERE producto_id=@pid ORDER BY nombre')).recordset
  },
  async all() {
    const pool = await getPool()
    return (await pool.request().query('SELECT * FROM tipos_venta')).recordset
  },
  async find(id) {
    const pool = await getPool()
    return first(await pool.request().input('id', sql.NVarChar, id).query('SELECT * FROM tipos_venta WHERE id=@id'))
  },
  async create({ producto_id, nombre, segmento = null, unidades_min = 1, unidades_max = null, precio_piso = 0, precio_lista = 0 }) {
    const pool = await getPool()
    const t = { id: randomUUID(), producto_id, nombre, segmento, unidades_min, unidades_max, precio_piso, precio_lista }
    await pool.request()
      .input('id', sql.NVarChar, t.id)
      .input('producto_id', sql.NVarChar, t.producto_id)
      .input('nombre', sql.NVarChar, t.nombre)
      .input('segmento', sql.NVarChar, t.segmento)
      .input('unidades_min', sql.Int, t.unidades_min)
      .input('unidades_max', sql.Int, t.unidades_max)
      .input('precio_piso', sql.Decimal(18, 2), t.precio_piso)
      .input('precio_lista', sql.Decimal(18, 2), t.precio_lista)
      .query(`INSERT INTO tipos_venta (id, producto_id, nombre, segmento, unidades_min, unidades_max, precio_piso, precio_lista)
              VALUES (@id, @producto_id, @nombre, @segmento, @unidades_min, @unidades_max, @precio_piso, @precio_lista)`)
    return t
  },
  async update(id, { nombre, segmento, unidades_min, unidades_max, precio_piso, precio_lista }) {
    const pool = await getPool()
    await pool.request()
      .input('id', sql.NVarChar, id)
      .input('nombre', sql.NVarChar, nombre)
      .input('segmento', sql.NVarChar, segmento ?? null)
      .input('unidades_min', sql.Int, unidades_min ?? 1)
      .input('unidades_max', sql.Int, unidades_max ?? null)
      .input('precio_piso', sql.Decimal(18, 2), precio_piso ?? 0)
      .input('precio_lista', sql.Decimal(18, 2), precio_lista ?? 0)
      .query(`UPDATE tipos_venta SET nombre=@nombre, segmento=@segmento, unidades_min=@unidades_min, unidades_max=@unidades_max,
              precio_piso=@precio_piso, precio_lista=@precio_lista WHERE id=@id`)
    return first(await pool.request().input('id', sql.NVarChar, id).query('SELECT * FROM tipos_venta WHERE id=@id'))
  },
  async remove(id) {
    const pool = await getPool()
    const r = await pool.request().input('id', sql.NVarChar, id).query('DELETE FROM tipos_venta WHERE id=@id')
    return r.rowsAffected[0] > 0
  },
}
