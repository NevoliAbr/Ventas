// Repositorio de prospectos activos sobre SQL Server.
import { getPool, sql } from './mssql.js'
import { randomUUID } from 'node:crypto'

const CAMPOS = [
  'empresa', 'tipo', 'contacto_nombre', 'telefono', 'responsable',
  'fecha_1ra_reunion', 'status_1ra_reunion', 'obs_1ra_reunion',
  'fecha_2da_reunion', 'status_2da_reunion', 'obs_2da_reunion',
  'pide_cotizacion', 'pasa_forecast',
]

function bind(reqst, o) {
  return reqst
    .input('empresa', sql.NVarChar, o.empresa)
    .input('tipo', sql.NVarChar, o.tipo ?? null)
    .input('contacto_nombre', sql.NVarChar, o.contacto_nombre ?? null)
    .input('telefono', sql.NVarChar, o.telefono ?? null)
    .input('responsable', sql.NVarChar, o.responsable ?? null)
    .input('fecha_1ra_reunion', sql.NVarChar, o.fecha_1ra_reunion ?? null)
    .input('status_1ra_reunion', sql.NVarChar, o.status_1ra_reunion ?? null)
    .input('obs_1ra_reunion', sql.NVarChar, o.obs_1ra_reunion ?? null)
    .input('fecha_2da_reunion', sql.NVarChar, o.fecha_2da_reunion ?? null)
    .input('status_2da_reunion', sql.NVarChar, o.status_2da_reunion ?? null)
    .input('obs_2da_reunion', sql.NVarChar, o.obs_2da_reunion ?? null)
    .input('pide_cotizacion', sql.Bit, o.pide_cotizacion ? 1 : 0)
    .input('pasa_forecast', sql.Bit, o.pasa_forecast ? 1 : 0)
}

export const prospectoRepo = {
  async all() {
    const pool = await getPool()
    return (await pool.request().query('SELECT * FROM prospectos_activos ORDER BY createdAt DESC')).recordset
  },
  async find(id) {
    const pool = await getPool()
    return (await pool.request().input('id', sql.NVarChar, id).query('SELECT * FROM prospectos_activos WHERE id=@id')).recordset[0] ?? null
  },
  async create(o) {
    const pool = await getPool()
    const row = { ...o, id: randomUUID(), createdAt: new Date().toISOString() }
    await bind(pool.request(), row)
      .input('id', sql.NVarChar, row.id)
      .input('createdAt', sql.NVarChar, row.createdAt)
      .query(`INSERT INTO prospectos_activos (id, ${CAMPOS.join(', ')}, createdAt)
              VALUES (@id, ${CAMPOS.map((c) => '@' + c).join(', ')}, @createdAt)`)
    return row
  },
  async update(id, o) {
    const pool = await getPool()
    await bind(pool.request(), o)
      .input('id', sql.NVarChar, id)
      .query(`UPDATE prospectos_activos SET ${CAMPOS.map((c) => `${c}=@${c}`).join(', ')} WHERE id=@id`)
    return this.find(id)
  },
  async remove(id) {
    const pool = await getPool()
    const r = await pool.request().input('id', sql.NVarChar, id).query('DELETE FROM prospectos_activos WHERE id=@id')
    return r.rowsAffected[0] > 0
  },
}
