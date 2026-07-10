// Repositorio de prospectos activos (seguimiento de reuniones) sobre MySQL / MariaDB.
import { getPool } from './mysql.js'
import { randomUUID } from 'node:crypto'

const CAMPOS = [
  'empresa', 'tipo', 'contacto_nombre', 'telefono', 'telefono2', 'responsable',
  'fecha_1ra_reunion', 'status_1ra_reunion', 'obs_1ra_reunion',
  'fecha_2da_reunion', 'status_2da_reunion', 'obs_2da_reunion',
  'pide_cotizacion', 'pasa_forecast',
]

function valores(o) {
  return [
    o.empresa,
    o.tipo ?? null, o.contacto_nombre ?? null, o.telefono ?? null, o.telefono2 ?? null, o.responsable ?? null,
    o.fecha_1ra_reunion ?? null, o.status_1ra_reunion ?? null, o.obs_1ra_reunion ?? null,
    o.fecha_2da_reunion ?? null, o.status_2da_reunion ?? null, o.obs_2da_reunion ?? null,
    o.pide_cotizacion ? 1 : 0, o.pasa_forecast ? 1 : 0,
  ]
}

export const prospectoRepo = {
  async all() {
    const pool = await getPool()
    const [rows] = await pool.query(`
      SELECT p.*, (SELECT COUNT(*) FROM reuniones WHERE prospecto_id = p.id) AS num_reuniones
      FROM prospectos_activos p ORDER BY p.createdAt DESC
    `)
    return rows
  },
  async find(id) {
    const pool = await getPool()
    const [rows] = await pool.query('SELECT * FROM prospectos_activos WHERE id=?', [id])
    return rows[0] ?? null
  },
  async create(o) {
    const pool = await getPool()
    const row = { ...o, id: randomUUID(), createdAt: new Date().toISOString() }
    const cols = ['id', ...CAMPOS, 'createdAt']
    const vals = [row.id, ...valores(row), row.createdAt]
    await pool.query(
      `INSERT INTO prospectos_activos (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      vals,
    )
    return row
  },
  async update(id, o) {
    const pool = await getPool()
    await pool.query(
      `UPDATE prospectos_activos SET ${CAMPOS.map((c) => `${c}=?`).join(', ')} WHERE id=?`,
      [...valores(o), id],
    )
    return this.find(id)
  },
  async remove(id) {
    const pool = await getPool()
    const [r] = await pool.query('DELETE FROM prospectos_activos WHERE id=?', [id])
    return r.affectedRows > 0
  },
  async createMany(rows) {
    const resultados = []
    for (const o of rows) resultados.push(await this.create(o))
    return resultados
  },
}
