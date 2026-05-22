// Repositorio de usuarios sobre SQL Server. Usa el pool/esquema compartido
// (server/src/lib/mssql.js). Misma interfaz async que los demás repos.
import { getPool, sql } from './mssql.js'
import { randomUUID } from 'node:crypto'

const first = (result) => result.recordset[0] ?? null

export const usersRepo = {
  async findByEmail(email) {
    const pool = await getPool()
    const r = await pool.request().input('email', sql.NVarChar, email).query('SELECT * FROM users WHERE email = @email')
    return first(r)
  },

  async findById(id) {
    const pool = await getPool()
    const r = await pool.request().input('id', sql.NVarChar, id).query('SELECT * FROM users WHERE id = @id')
    return first(r)
  },

  async findByResetToken(token) {
    if (!token) return null
    const pool = await getPool()
    const r = await pool.request().input('t', sql.NVarChar, token).query('SELECT * FROM users WHERE resetToken = @t')
    return first(r)
  },

  async create({ nombre, email, password, role = 'user', facultades = null }) {
    const pool = await getPool()
    const user = {
      id: randomUUID(),
      nombre,
      email,
      password,
      role,
      facultades,
      resetToken: null,
      resetExpires: null,
      createdAt: new Date().toISOString(),
    }
    await pool
      .request()
      .input('id', sql.NVarChar, user.id)
      .input('nombre', sql.NVarChar, user.nombre)
      .input('email', sql.NVarChar, user.email)
      .input('password', sql.NVarChar, user.password)
      .input('role', sql.NVarChar, user.role)
      .input('facultades', sql.NVarChar, user.facultades)
      .input('resetToken', sql.NVarChar, user.resetToken)
      .input('resetExpires', sql.BigInt, user.resetExpires)
      .input('createdAt', sql.NVarChar, user.createdAt)
      .query(`INSERT INTO users (id, nombre, email, password, role, facultades, resetToken, resetExpires, createdAt)
              VALUES (@id, @nombre, @email, @password, @role, @facultades, @resetToken, @resetExpires, @createdAt)`)
    return user
  },

  async update(id, patch) {
    const current = await this.findById(id)
    if (!current) return null
    const next = { ...current, ...patch }
    const pool = await getPool()
    await pool
      .request()
      .input('id', sql.NVarChar, id)
      .input('nombre', sql.NVarChar, next.nombre)
      .input('email', sql.NVarChar, next.email)
      .input('password', sql.NVarChar, next.password)
      .input('role', sql.NVarChar, next.role)
      .input('facultades', sql.NVarChar, next.facultades ?? null)
      .input('resetToken', sql.NVarChar, next.resetToken)
      .input('resetExpires', sql.BigInt, next.resetExpires)
      .query(`UPDATE users
              SET nombre=@nombre, email=@email, password=@password, role=@role,
                  facultades=@facultades, resetToken=@resetToken, resetExpires=@resetExpires
              WHERE id=@id`)
    return next
  },

  async all() {
    const pool = await getPool()
    const r = await pool.request().query('SELECT * FROM users ORDER BY createdAt ASC')
    return r.recordset
  },

  async remove(id) {
    const pool = await getPool()
    const r = await pool.request().input('id', sql.NVarChar, id).query('DELETE FROM users WHERE id = @id')
    return r.rowsAffected[0] > 0
  },

  async importUser(u) {
    const pool = await getPool()
    await pool
      .request()
      .input('id', sql.NVarChar, u.id)
      .input('nombre', sql.NVarChar, u.nombre)
      .input('email', sql.NVarChar, u.email)
      .input('password', sql.NVarChar, u.password)
      .input('role', sql.NVarChar, u.role || 'user')
      .input('facultades', sql.NVarChar, u.facultades ?? null)
      .input('resetToken', sql.NVarChar, u.resetToken ?? null)
      .input('resetExpires', sql.BigInt, u.resetExpires ?? null)
      .input('createdAt', sql.NVarChar, u.createdAt || new Date().toISOString())
      .query(`IF NOT EXISTS (SELECT 1 FROM users WHERE email=@email)
              INSERT INTO users (id, nombre, email, password, role, facultades, resetToken, resetExpires, createdAt)
              VALUES (@id, @nombre, @email, @password, @role, @facultades, @resetToken, @resetExpires, @createdAt)`)
  },
}
