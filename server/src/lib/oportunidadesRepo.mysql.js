// Repositorio de oportunidades (Pipeline / Forecast) sobre MySQL / MariaDB.
// Espejo de oportunidadesRepo.mssql.js.
import { getPool } from './mysql.js'
import { randomUUID } from 'node:crypto'

const first = (rows) => rows[0] ?? null

const CAMPOS = [
  'prospecto', 'sector', 'producto_id', 'tipo_venta_id', 'descripcion', 'unidades',
  'anios', 'precio_unitario', 'ingreso_mensual', 'ingreso_anual', 'valor_total',
  'prob_cierre', 'valor_ponderado', 'etapa', 'trimestre', 'mes_estimado', 'notas',
]

// Devuelve los valores de CAMPOS en el mismo orden (con sus defaults/null).
function valores(o) {
  return [
    o.prospecto, o.sector ?? null, o.producto_id ?? null, o.tipo_venta_id ?? null, o.descripcion ?? null,
    o.unidades, o.anios, o.precio_unitario, o.ingreso_mensual ?? null, o.ingreso_anual ?? null, o.valor_total ?? null,
    o.prob_cierre ?? 0, o.valor_ponderado ?? null, o.etapa ?? null, o.trimestre ?? null, o.mes_estimado ?? null, o.notas ?? null,
  ]
}

export const oportunidadesRepo = {
  async all() {
    const pool = await getPool()
    const [rows] = await pool.query('SELECT * FROM oportunidades ORDER BY createdAt DESC')
    return rows
  },
  async find(id) {
    const pool = await getPool()
    const [rows] = await pool.query('SELECT * FROM oportunidades WHERE id=?', [id])
    return first(rows)
  },
  async create(o) {
    const pool = await getPool()
    const row = { ...o, id: randomUUID(), createdAt: new Date().toISOString() }
    const cols = ['id', ...CAMPOS, 'createdBy', 'createdAt']
    const vals = [row.id, ...valores(row), row.createdBy ?? null, row.createdAt]
    await pool.query(
      `INSERT INTO oportunidades (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      vals,
    )
    return row
  },
  async update(id, o) {
    const pool = await getPool()
    await pool.query(
      `UPDATE oportunidades SET ${CAMPOS.map((c) => `${c}=?`).join(', ')} WHERE id=?`,
      [...valores(o), id],
    )
    return this.find(id)
  },
  async remove(id) {
    const pool = await getPool()
    const [r] = await pool.query('DELETE FROM oportunidades WHERE id=?', [id])
    return r.affectedRows > 0
  },
}
