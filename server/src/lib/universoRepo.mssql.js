// Repositorio de universo de prospectos sobre SQL Server.
import { getPool, sql } from './mssql.js'
import { randomUUID } from 'node:crypto'

const CAMPOS = [
  'empresa', 'rubro', 'segmento', 'contacto_nombre', 'email', 'telefono',
  'sitio_web', 'linkedin', 'tipo', 'responsable', 'fecha_contacto',
  'status_contacto', 'etapa_pipeline',
]

function bind(reqst, o) {
  return reqst
    .input('empresa', sql.NVarChar, o.empresa)
    .input('rubro', sql.NVarChar, o.rubro ?? null)
    .input('segmento', sql.NVarChar, o.segmento ?? null)
    .input('contacto_nombre', sql.NVarChar, o.contacto_nombre ?? null)
    .input('email', sql.NVarChar, o.email ?? null)
    .input('telefono', sql.NVarChar, o.telefono ?? null)
    .input('sitio_web', sql.NVarChar, o.sitio_web ?? null)
    .input('linkedin', sql.NVarChar, o.linkedin ?? null)
    .input('tipo', sql.NVarChar, o.tipo ?? null)
    .input('responsable', sql.NVarChar, o.responsable ?? null)
    .input('fecha_contacto', sql.NVarChar, o.fecha_contacto ?? null)
    .input('status_contacto', sql.NVarChar, o.status_contacto ?? 'Sin contacto')
    .input('etapa_pipeline', sql.NVarChar, o.etapa_pipeline ?? 'Universo')
}

export const universoRepo = {
  async all() {
    const pool = await getPool()
    return (await pool.request().query(
      "SELECT * FROM universo WHERE es_prospecto=0 AND etapa_pipeline != 'Prospecto' ORDER BY createdAt DESC"
    )).recordset
  },
  async pendientes() {
    const pool = await getPool()
    return (await pool.request().query(
      "SELECT * FROM universo WHERE etapa_pipeline='Prospecto' AND es_prospecto=0 ORDER BY createdAt DESC"
    )).recordset
  },
  async find(id) {
    const pool = await getPool()
    return (await pool.request().input('id', sql.NVarChar, id).query('SELECT * FROM universo WHERE id=@id')).recordset[0] ?? null
  },
  async create(o) {
    const pool = await getPool()
    const row = { ...o, id: randomUUID(), createdAt: new Date().toISOString() }
    await bind(pool.request(), row)
      .input('id', sql.NVarChar, row.id)
      .input('createdAt', sql.NVarChar, row.createdAt)
      .query(`INSERT INTO universo (id, ${CAMPOS.join(', ')}, createdAt)
              VALUES (@id, ${CAMPOS.map((c) => '@' + c).join(', ')}, @createdAt)`)
    return row
  },
  async crearOculto(o) {
    const pool = await getPool()
    const row = { ...o, id: randomUUID(), createdAt: new Date().toISOString() }
    await bind(pool.request(), row)
      .input('id', sql.NVarChar, row.id)
      .input('createdAt', sql.NVarChar, row.createdAt)
      .query(`INSERT INTO universo (id, ${CAMPOS.join(', ')}, es_prospecto, createdAt)
              VALUES (@id, ${CAMPOS.map((c) => '@' + c).join(', ')}, 1, @createdAt)`)
    return row
  },
  async update(id, o) {
    const pool = await getPool()
    await bind(pool.request(), o)
      .input('id', sql.NVarChar, id)
      .query(`UPDATE universo SET ${CAMPOS.map((c) => `${c}=@${c}`).join(', ')} WHERE id=@id`)
    return this.find(id)
  },
  async remove(id) {
    const pool = await getPool()
    const r = await pool.request().input('id', sql.NVarChar, id).query('DELETE FROM universo WHERE id=@id')
    return r.rowsAffected[0] > 0
  },
  async convertir(id) {
    const pool = await getPool()
    await pool.request().input('id', sql.NVarChar, id).query('UPDATE universo SET es_prospecto=1 WHERE id=@id')
  },
  async createMany(rows) {
    const resultados = []
    for (const o of rows) {
      const row = await this.create(o)
      resultados.push(row)
    }
    return resultados
  },
  async seedIfEmpty(data) {
    const pool = await getPool()
    const { recordset } = await pool.request().query('SELECT COUNT(*) AS n FROM universo')
    if (Number(recordset[0].n) > 0) return
    for (const o of data) {
      await this.create({ status_contacto: 'Sin contacto', etapa_pipeline: 'Universo', ...o })
    }
    console.log(`[db] Universo: ${data.length} prospectos iniciales insertados.`)
  },
}
