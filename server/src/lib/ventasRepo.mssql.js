// Repositorio de ventas (transacciones) sobre SQL Server. Cada venta y sus
// líneas se guardan de forma atómica (transacción).
import { getPool, sql } from './mssql.js'
import { randomUUID } from 'node:crypto'

const first = (r) => r.recordset[0] ?? null

// Inserta las líneas usando un Request NUEVO por cada una (los nombres de
// parámetro no se pueden redeclarar en un mismo Request).
async function insertarItems(tx, ventaId, items) {
  for (const it of items) {
    await new sql.Request(tx)
      .input('id', sql.NVarChar, randomUUID())
      .input('venta_id', sql.NVarChar, ventaId)
      .input('producto_id', sql.NVarChar, it.producto_id ?? null)
      .input('tipo_venta_id', sql.NVarChar, it.tipo_venta_id ?? null)
      .input('descripcion', sql.NVarChar, it.descripcion ?? null)
      .input('unidad', sql.NVarChar, it.unidad ?? null)
      .input('cantidad', sql.Decimal(18, 2), it.cantidad)
      .input('anios', sql.Int, it.anios ?? null)
      .input('precio_unitario', sql.Decimal(18, 2), it.precio_unitario)
      .input('ingreso_mensual', sql.Decimal(18, 2), it.ingreso_mensual ?? null)
      .input('ingreso_anual', sql.Decimal(18, 2), it.ingreso_anual ?? null)
      .input('subtotal', sql.Decimal(18, 2), it.subtotal)
      .query(`INSERT INTO venta_items (id, venta_id, producto_id, tipo_venta_id, descripcion, unidad, cantidad, anios, precio_unitario, ingreso_mensual, ingreso_anual, subtotal)
              VALUES (@id, @venta_id, @producto_id, @tipo_venta_id, @descripcion, @unidad, @cantidad, @anios, @precio_unitario, @ingreso_mensual, @ingreso_anual, @subtotal)`)
  }
}

export const ventasRepo = {
  // Lista ventas con nombre de cliente y número de líneas.
  async all() {
    const pool = await getPool()
    return (await pool.request().query(`
      SELECT v.*, c.nombre AS cliente_nombre,
             (SELECT COUNT(*) FROM venta_items WHERE venta_id = v.id) AS num_items
      FROM ventas v
      LEFT JOIN clientes c ON c.id = v.cliente_id
      ORDER BY v.fecha DESC, v.createdAt DESC
    `)).recordset
  },

  // Una venta con sus líneas.
  async find(id) {
    const pool = await getPool()
    const venta = first(await pool.request().input('id', sql.NVarChar, id).query(`
      SELECT v.*, c.nombre AS cliente_nombre
      FROM ventas v LEFT JOIN clientes c ON c.id = v.cliente_id
      WHERE v.id = @id`))
    if (!venta) return null
    const items = (await pool.request().input('vid', sql.NVarChar, id)
      .query('SELECT * FROM venta_items WHERE venta_id = @vid')).recordset
    return { ...venta, items }
  },

  // Crea venta/cotización + líneas en una transacción. Genera un folio legible.
  async create({ cliente_id, fecha, notas, total, items, createdBy }) {
    const pool = await getPool()
    const { recordset } = await pool.request().query('SELECT COUNT(*) AS n FROM ventas')
    const folio = 'COT-' + String(recordset[0].n + 1).padStart(4, '0')
    const venta = { id: randomUUID(), folio, cliente_id: cliente_id ?? null, fecha, notas: notas ?? null, total, createdBy: createdBy ?? null, createdAt: new Date().toISOString() }
    const tx = new sql.Transaction(pool)
    await tx.begin()
    try {
      await new sql.Request(tx)
        .input('id', sql.NVarChar, venta.id)
        .input('folio', sql.NVarChar, venta.folio)
        .input('cliente_id', sql.NVarChar, venta.cliente_id)
        .input('fecha', sql.NVarChar, venta.fecha)
        .input('notas', sql.NVarChar, venta.notas)
        .input('total', sql.Decimal(18, 2), venta.total)
        .input('createdBy', sql.NVarChar, venta.createdBy)
        .input('createdAt', sql.NVarChar, venta.createdAt)
        .query(`INSERT INTO ventas (id, folio, cliente_id, fecha, notas, total, createdBy, createdAt)
                VALUES (@id, @folio, @cliente_id, @fecha, @notas, @total, @createdBy, @createdAt)`)
      await insertarItems(tx, venta.id, items)
      await tx.commit()
    } catch (e) {
      await tx.rollback()
      throw e
    }
    return this.find(venta.id)
  },

  // Actualiza venta y reemplaza sus líneas.
  async update(id, { cliente_id, fecha, notas, total, items }) {
    const pool = await getPool()
    const tx = new sql.Transaction(pool)
    await tx.begin()
    try {
      await new sql.Request(tx)
        .input('id', sql.NVarChar, id)
        .input('cliente_id', sql.NVarChar, cliente_id ?? null)
        .input('fecha', sql.NVarChar, fecha)
        .input('notas', sql.NVarChar, notas ?? null)
        .input('total', sql.Decimal(18, 2), total)
        .query('UPDATE ventas SET cliente_id=@cliente_id, fecha=@fecha, notas=@notas, total=@total WHERE id=@id')
      await new sql.Request(tx).input('vid', sql.NVarChar, id).query('DELETE FROM venta_items WHERE venta_id=@vid')
      await insertarItems(tx, id, items)
      await tx.commit()
    } catch (e) {
      await tx.rollback()
      throw e
    }
    return this.find(id)
  },

  async remove(id) {
    const pool = await getPool()
    await pool.request().input('vid', sql.NVarChar, id).query('DELETE FROM venta_items WHERE venta_id=@vid')
    const r = await pool.request().input('id', sql.NVarChar, id).query('DELETE FROM ventas WHERE id=@id')
    return r.rowsAffected[0] > 0
  },
}
