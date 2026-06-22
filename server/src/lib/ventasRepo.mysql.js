// Repositorio de ventas (transacciones) sobre MySQL / MariaDB. Cada venta y sus
// líneas se guardan de forma atómica usando una conexión dedicada del pool.
// Espejo de ventasRepo.mssql.js.
import { getPool } from './mysql.js'
import { randomUUID } from 'node:crypto'

const first = (rows) => rows[0] ?? null

// Inserta las líneas dentro de la transacción (conn = conexión con tx abierta).
async function insertarItems(conn, ventaId, items) {
  for (const it of items) {
    await conn.query(
      `INSERT INTO venta_items (id, venta_id, producto_id, tipo_venta_id, descripcion, unidad, cantidad, anios, precio_unitario, ingreso_mensual, ingreso_anual, subtotal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(), ventaId, it.producto_id ?? null, it.tipo_venta_id ?? null, it.descripcion ?? null,
        it.unidad ?? null, it.cantidad, it.anios ?? null, it.precio_unitario, it.ingreso_mensual ?? null,
        it.ingreso_anual ?? null, it.subtotal,
      ],
    )
  }
}

export const ventasRepo = {
  // Lista ventas con nombre de origen y número de líneas.
  async all() {
    const pool = await getPool()
    const [rows] = await pool.query(`
      SELECT v.*, COALESCE(v.origen_nombre, c.nombre) AS cliente_nombre,
             (SELECT COUNT(*) FROM venta_items WHERE venta_id = v.id) AS num_items
      FROM ventas v
      LEFT JOIN clientes c ON c.id = v.cliente_id
      ORDER BY v.fecha DESC, v.createdAt DESC`)
    return rows
  },

  // Una venta con sus líneas.
  async find(id) {
    const pool = await getPool()
    const [vrows] = await pool.query(`
      SELECT v.*, COALESCE(v.origen_nombre, c.nombre) AS cliente_nombre
      FROM ventas v LEFT JOIN clientes c ON c.id = v.cliente_id
      WHERE v.id = ?`, [id])
    const venta = first(vrows)
    if (!venta) return null
    const [items] = await pool.query('SELECT * FROM venta_items WHERE venta_id = ?', [id])
    return { ...venta, items }
  },

  // Crea venta/cotización + líneas en una transacción. Genera un folio legible.
  async create({ origen_tipo, origen_id, origen_nombre, fecha, notas, total, items, createdBy }) {
    const pool = await getPool()
    const [cnt] = await pool.query('SELECT COUNT(*) AS n FROM ventas')
    const folio = 'COT-' + String(Number(cnt[0].n) + 1).padStart(4, '0')
    const venta = { id: randomUUID(), folio, origen_tipo: origen_tipo ?? null, origen_id: origen_id ?? null, origen_nombre: origen_nombre ?? null, fecha, notas: notas ?? null, total, createdBy: createdBy ?? null, createdAt: new Date().toISOString() }
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query(
        `INSERT INTO ventas (id, folio, origen_tipo, origen_id, origen_nombre, fecha, notas, total, createdBy, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [venta.id, venta.folio, venta.origen_tipo, venta.origen_id, venta.origen_nombre, venta.fecha, venta.notas, venta.total, venta.createdBy, venta.createdAt],
      )
      await insertarItems(conn, venta.id, items)
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
    return this.find(venta.id)
  },

  // Actualiza venta y reemplaza sus líneas.
  async update(id, { origen_tipo, origen_id, origen_nombre, fecha, notas, total, items }) {
    const pool = await getPool()
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      await conn.query('UPDATE ventas SET origen_tipo=?, origen_id=?, origen_nombre=?, fecha=?, notas=?, total=? WHERE id=?', [origen_tipo ?? null, origen_id ?? null, origen_nombre ?? null, fecha, notas ?? null, total, id])
      await conn.query('DELETE FROM venta_items WHERE venta_id=?', [id])
      await insertarItems(conn, id, items)
      await conn.commit()
    } catch (e) {
      await conn.rollback()
      throw e
    } finally {
      conn.release()
    }
    return this.find(id)
  },

  async remove(id) {
    const pool = await getPool()
    await pool.query('DELETE FROM venta_items WHERE venta_id=?', [id])
    const [r] = await pool.query('DELETE FROM ventas WHERE id=?', [id])
    return r.affectedRows > 0
  },
}
