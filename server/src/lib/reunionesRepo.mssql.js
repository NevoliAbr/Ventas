import { getPool, sql } from './mssql.js'
import { randomUUID } from 'node:crypto'

export const reunionesRepo = {
  async byProspecto(prospectoId) {
    const pool = await getPool()
    return (await pool.request()
      .input('pid', sql.NVarChar, prospectoId)
      .query('SELECT * FROM reuniones WHERE prospecto_id = @pid ORDER BY numero ASC, createdAt ASC')
    ).recordset
  },

  async add({ prospecto_id, fecha, status, observaciones }) {
    const pool = await getPool()
    const { recordset } = await pool.request()
      .input('pid', sql.NVarChar, prospecto_id)
      .query('SELECT ISNULL(MAX(numero), 0) AS maxn FROM reuniones WHERE prospecto_id = @pid')
    const numero = Number(recordset[0].maxn) + 1
    const id = randomUUID()
    const createdAt = new Date().toISOString()
    await pool.request()
      .input('id', sql.NVarChar, id)
      .input('prospecto_id', sql.NVarChar, prospecto_id)
      .input('numero', sql.Int, numero)
      .input('fecha', sql.NVarChar, fecha)
      .input('status', sql.NVarChar, status ?? null)
      .input('observaciones', sql.NVarChar, observaciones ?? null)
      .input('createdAt', sql.NVarChar, createdAt)
      .query(`INSERT INTO reuniones (id, prospecto_id, numero, fecha, status, observaciones, createdAt)
              VALUES (@id, @prospecto_id, @numero, @fecha, @status, @observaciones, @createdAt)`)
    return (await pool.request()
      .input('id', sql.NVarChar, id)
      .query('SELECT * FROM reuniones WHERE id = @id')
    ).recordset[0]
  },

  async remove(id) {
    const pool = await getPool()
    await pool.request().input('id', sql.NVarChar, id).query('DELETE FROM reuniones WHERE id = @id')
  },
}
