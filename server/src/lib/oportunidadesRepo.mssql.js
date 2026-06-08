// Repositorio de oportunidades (Pipeline / Forecast) sobre SQL Server.
import { getPool, sql } from './mssql.js'
import { randomUUID } from 'node:crypto'

const first = (r) => r.recordset[0] ?? null

const CAMPOS = [
  'prospecto', 'sector', 'producto_id', 'tipo_venta_id', 'descripcion', 'unidades',
  'anios', 'precio_unitario', 'ingreso_mensual', 'ingreso_anual', 'valor_total',
  'prob_cierre', 'valor_ponderado', 'etapa', 'trimestre', 'mes_estimado', 'notas', 'responsable',
]

function bind(reqst, o) {
  return reqst
    .input('prospecto', sql.NVarChar, o.prospecto)
    .input('sector', sql.NVarChar, o.sector ?? null)
    .input('producto_id', sql.NVarChar, o.producto_id ?? null)
    .input('tipo_venta_id', sql.NVarChar, o.tipo_venta_id ?? null)
    .input('descripcion', sql.NVarChar, o.descripcion ?? null)
    .input('unidades', sql.Int, o.unidades)
    .input('anios', sql.Int, o.anios)
    .input('precio_unitario', sql.Decimal(18, 2), o.precio_unitario)
    .input('ingreso_mensual', sql.Decimal(18, 2), o.ingreso_mensual ?? null)
    .input('ingreso_anual', sql.Decimal(18, 2), o.ingreso_anual ?? null)
    .input('valor_total', sql.Decimal(18, 2), o.valor_total ?? null)
    .input('prob_cierre', sql.Decimal(5, 2), o.prob_cierre ?? 0)
    .input('valor_ponderado', sql.Decimal(18, 2), o.valor_ponderado ?? null)
    .input('etapa', sql.NVarChar, o.etapa ?? null)
    .input('trimestre', sql.NVarChar, o.trimestre ?? null)
    .input('mes_estimado', sql.NVarChar, o.mes_estimado ?? null)
    .input('notas', sql.NVarChar, o.notas ?? null)
    .input('responsable', sql.NVarChar, o.responsable ?? null)
}

export const oportunidadesRepo = {
  async all() {
    const pool = await getPool()
    return (await pool.request().query('SELECT * FROM oportunidades ORDER BY createdAt DESC')).recordset
  },
  async find(id) {
    const pool = await getPool()
    return first(await pool.request().input('id', sql.NVarChar, id).query('SELECT * FROM oportunidades WHERE id=@id'))
  },
  async create(o) {
    const pool = await getPool()
    const row = { ...o, id: randomUUID(), createdAt: new Date().toISOString() }
    await bind(pool.request(), row)
      .input('id', sql.NVarChar, row.id)
      .input('createdBy', sql.NVarChar, row.createdBy ?? null)
      .input('createdAt', sql.NVarChar, row.createdAt)
      .query(`INSERT INTO oportunidades (id, ${CAMPOS.join(', ')}, createdBy, createdAt)
              VALUES (@id, ${CAMPOS.map((c) => '@' + c).join(', ')}, @createdBy, @createdAt)`)
    return row
  },
  async update(id, o) {
    const pool = await getPool()
    await bind(pool.request(), o)
      .input('id', sql.NVarChar, id)
      .query(`UPDATE oportunidades SET ${CAMPOS.map((c) => `${c}=@${c}`).join(', ')} WHERE id=@id`)
    return this.find(id)
  },
  async remove(id) {
    const pool = await getPool()
    const r = await pool.request().input('id', sql.NVarChar, id).query('DELETE FROM oportunidades WHERE id=@id')
    return r.rowsAffected[0] > 0
  },
}
