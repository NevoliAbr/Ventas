// Repositorio de usuarios sobre MySQL / MariaDB. Misma interfaz async que
// usersRepo.mssql.js; usa el pool/esquema compartido (mysql.js).
import { getPool } from './mysql.js'
import { randomUUID } from 'node:crypto'

const first = (rows) => rows[0] ?? null

export const usersRepo = {
  async findByEmail(email) {
    const pool = await getPool()
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email])
    return first(rows)
  },

  async findById(id) {
    const pool = await getPool()
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id])
    return first(rows)
  },

  async findByResetToken(token) {
    if (!token) return null
    const pool = await getPool()
    const [rows] = await pool.query('SELECT * FROM users WHERE resetToken = ?', [token])
    return first(rows)
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
    await pool.query(
      `INSERT INTO users (id, nombre, email, password, role, facultades, resetToken, resetExpires, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user.id, user.nombre, user.email, user.password, user.role, user.facultades, user.resetToken, user.resetExpires, user.createdAt],
    )
    return user
  },

  async update(id, patch) {
    const current = await this.findById(id)
    if (!current) return null
    const next = { ...current, ...patch }
    const pool = await getPool()
    await pool.query(
      `UPDATE users SET nombre=?, email=?, password=?, role=?, facultades=?, resetToken=?, resetExpires=? WHERE id=?`,
      [next.nombre, next.email, next.password, next.role, next.facultades ?? null, next.resetToken, next.resetExpires, id],
    )
    return next
  },

  async all() {
    const pool = await getPool()
    const [rows] = await pool.query('SELECT * FROM users ORDER BY createdAt ASC')
    return rows
  },

  async remove(id) {
    const pool = await getPool()
    const [r] = await pool.query('DELETE FROM users WHERE id = ?', [id])
    return r.affectedRows > 0
  },

  async importUser(u) {
    const pool = await getPool()
    const [exists] = await pool.query('SELECT 1 FROM users WHERE email = ? LIMIT 1', [u.email])
    if (exists.length) return
    await pool.query(
      `INSERT INTO users (id, nombre, email, password, role, facultades, resetToken, resetExpires, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [u.id, u.nombre, u.email, u.password, u.role || 'user', u.facultades ?? null, u.resetToken ?? null, u.resetExpires ?? null, u.createdAt || new Date().toISOString()],
    )
  },
}
