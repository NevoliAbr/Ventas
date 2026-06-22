import { getPool } from './mysql.js'
import { randomUUID } from 'node:crypto'

export const reunionesRepo = {
  async byProspecto(prospectoId) {
    const pool = await getPool()
    const [rows] = await pool.query(
      'SELECT * FROM reuniones WHERE prospecto_id = ? ORDER BY numero ASC, createdAt ASC',
      [prospectoId],
    )
    return rows
  },

  async add({ prospecto_id, fecha, status, observaciones }) {
    const pool = await getPool()
    const [[{ maxn }]] = await pool.query(
      'SELECT COALESCE(MAX(numero), 0) AS maxn FROM reuniones WHERE prospecto_id = ?',
      [prospecto_id],
    )
    const numero = Number(maxn) + 1
    const id = randomUUID()
    const createdAt = new Date().toISOString()
    await pool.query(
      'INSERT INTO reuniones (id, prospecto_id, numero, fecha, status, observaciones, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, prospecto_id, numero, fecha, status ?? null, observaciones ?? null, createdAt],
    )
    const [[row]] = await pool.query('SELECT * FROM reuniones WHERE id = ?', [id])
    return row
  },

  async remove(id) {
    const pool = await getPool()
    await pool.query('DELETE FROM reuniones WHERE id = ?', [id])
  },
}
