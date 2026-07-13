// Repositorio de universo de prospectos sobre MySQL / MariaDB.
import { getPool } from './mysql.js'
import { randomUUID } from 'node:crypto'

const CAMPOS = [
  'empresa', 'rubro', 'segmento', 'contacto_nombre', 'email', 'telefono', 'telefono2',
  'sitio_web', 'linkedin', 'tipo', 'responsable', 'fecha_contacto',
  'status_contacto', 'etapa_pipeline', 'observaciones',
]

function valores(o) {
  return [
    o.empresa,
    o.rubro ?? null, o.segmento ?? null, o.contacto_nombre ?? null,
    o.email ?? null, o.telefono ?? null, o.telefono2 ?? null, o.sitio_web ?? null, o.linkedin ?? null,
    o.tipo ?? null, o.responsable ?? null, o.fecha_contacto ?? null,
    o.status_contacto ?? 'Sin contactar', o.etapa_pipeline ?? 'Universo', o.observaciones ?? null,
  ]
}

export const universoRepo = {
  async all() {
    const pool = await getPool()
    const [rows] = await pool.query(
      "SELECT * FROM universo WHERE es_prospecto=0 AND etapa_pipeline != 'Prospecto' ORDER BY createdAt DESC"
    )
    return rows
  },
  async pendientes() {
    const pool = await getPool()
    const [rows] = await pool.query(
      "SELECT * FROM universo WHERE etapa_pipeline='Prospecto' AND es_prospecto=0 ORDER BY createdAt DESC"
    )
    return rows
  },
  async find(id) {
    const pool = await getPool()
    const [rows] = await pool.query('SELECT * FROM universo WHERE id=?', [id])
    return rows[0] ?? null
  },
  async create(o) {
    const pool = await getPool()
    const row = { ...o, id: randomUUID(), createdAt: new Date().toISOString() }
    const cols = ['id', ...CAMPOS, 'createdAt']
    const vals = [row.id, ...valores(row), row.createdAt]
    await pool.query(
      `INSERT INTO universo (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      vals,
    )
    return row
  },
  async crearOculto(o) {
    const pool = await getPool()
    const row = { ...o, id: randomUUID(), createdAt: new Date().toISOString() }
    const cols = ['id', ...CAMPOS, 'es_prospecto', 'createdAt']
    const vals = [row.id, ...valores(row), 1, row.createdAt]
    await pool.query(
      `INSERT INTO universo (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      vals,
    )
    return row
  },
  async update(id, o) {
    const pool = await getPool()
    await pool.query(
      `UPDATE universo SET ${CAMPOS.map((c) => `${c}=?`).join(', ')} WHERE id=?`,
      [...valores(o), id],
    )
    return this.find(id)
  },
  async remove(id) {
    const pool = await getPool()
    const [r] = await pool.query('DELETE FROM universo WHERE id=?', [id])
    return r.affectedRows > 0
  },
  async convertir(id) {
    const pool = await getPool()
    await pool.query('UPDATE universo SET es_prospecto=1 WHERE id=?', [id])
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
    const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM universo')
    if (Number(n) > 0) return
    for (const o of data) {
      await this.create({ status_contacto: 'Sin contactar', etapa_pipeline: 'Universo', ...o })
    }
    console.log(`[db] Universo: ${data.length} prospectos iniciales insertados.`)
  },
}
