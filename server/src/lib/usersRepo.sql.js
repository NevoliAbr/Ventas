// VERSIÓN SQL OPCIONAL del store de usuarios (lista para migrar).
// Usa SQLite a través del módulo integrado de Node (node:sqlite, Node 22.5+),
// sin dependencias nativas. Expone la MISMA interfaz que usersRepo.js (JSON),
// así que migrar es solo cambiar el import en authController.js:
//   import { usersRepo } from '../lib/usersRepo.sql.js'
//
// Para una base SQL "de verdad" (MySQL/PostgreSQL) basta reimplementar estos
// mismos métodos con tu driver (mysql2 / pg) o un ORM (Prisma, Sequelize).
import { DatabaseSync } from 'node:sqlite'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const db = new DatabaseSync(join(__dirname, '..', '..', 'auth.db'))

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    nombre       TEXT    NOT NULL,
    email        TEXT    NOT NULL UNIQUE,
    password     TEXT    NOT NULL,
    role         TEXT    NOT NULL DEFAULT 'user',
    resetToken   TEXT,
    resetExpires INTEGER,
    createdAt    TEXT    NOT NULL
  )
`)

export const usersRepo = {
  findByEmail(email) {
    return db.prepare('SELECT * FROM users WHERE email = ?').get(email) ?? null
  },

  findById(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) ?? null
  },

  findByResetToken(token) {
    if (!token) return null
    return db.prepare('SELECT * FROM users WHERE resetToken = ?').get(token) ?? null
  },

  create({ nombre, email, password, role = 'user' }) {
    const user = {
      id: randomUUID(),
      nombre,
      email,
      password,
      role,
      resetToken: null,
      resetExpires: null,
      createdAt: new Date().toISOString(),
    }
    db.prepare(
      `INSERT INTO users (id, nombre, email, password, role, resetToken, resetExpires, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      user.id, user.nombre, user.email, user.password, user.role,
      user.resetToken, user.resetExpires, user.createdAt
    )
    return user
  },

  update(id, patch) {
    const current = this.findById(id)
    if (!current) return null
    const next = { ...current, ...patch }
    db.prepare(
      `UPDATE users
       SET nombre = ?, email = ?, password = ?, role = ?, resetToken = ?, resetExpires = ?
       WHERE id = ?`
    ).run(
      next.nombre, next.email, next.password, next.role,
      next.resetToken, next.resetExpires, id
    )
    return next
  },

  all() {
    return db.prepare('SELECT * FROM users ORDER BY createdAt ASC').all()
  },

  remove(id) {
    const { changes } = db.prepare('DELETE FROM users WHERE id = ?').run(id)
    return changes > 0
  },

  // Inserta un usuario COMPLETO tal cual (para migraciones desde JSON).
  // No genera id ni defaults: preserva todos los campos. Ignora duplicados de email.
  importUser(u) {
    db.prepare(
      `INSERT OR IGNORE INTO users (id, nombre, email, password, role, resetToken, resetExpires, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      u.id,
      u.nombre,
      u.email,
      u.password,
      u.role || 'user',
      u.resetToken ?? null,
      u.resetExpires ?? null,
      u.createdAt || new Date().toISOString()
    )
  },
}
