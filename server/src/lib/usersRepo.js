// Manejador del "store" de usuarios sobre un archivo JSON (db.json) usando fs.
// Es el equivalente manual a JSON Server. Persiste entre reinicios.
//
// Para migrar a SQL más adelante: cambia el import en authController.js de
//   '../lib/usersRepo.js'  ->  '../lib/usersRepo.sql.js'
// Ambos exponen la MISMA interfaz (findByEmail, findById, findByResetToken,
// create, update).
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', '..', 'data') // server/data
const DB_PATH = join(DATA_DIR, 'db.json')

// Crea la carpeta y el archivo si no existen, con la forma { users: [] }.
function ensure() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
  if (!existsSync(DB_PATH)) {
    writeFileSync(DB_PATH, JSON.stringify({ users: [] }, null, 2))
  }
}

function read() {
  ensure()
  return JSON.parse(readFileSync(DB_PATH, 'utf-8'))
}

function write(db) {
  ensure()
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}

export const usersRepo = {
  findByEmail(email) {
    return read().users.find((u) => u.email === email) ?? null
  },

  findById(id) {
    return read().users.find((u) => u.id === id) ?? null
  },

  findByResetToken(token) {
    return read().users.find((u) => u.resetToken === token) ?? null
  },

  // Crea un usuario. `password` ya debe venir hasheada.
  create({ nombre, email, password, role = 'user' }) {
    const db = read()
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
    db.users.push(user)
    write(db)
    return user
  },

  // Aplica un parche parcial sobre un usuario existente.
  update(id, patch) {
    const db = read()
    const i = db.users.findIndex((u) => u.id === id)
    if (i === -1) return null
    db.users[i] = { ...db.users[i], ...patch }
    write(db)
    return db.users[i]
  },

  // Devuelve todos los usuarios (array).
  all() {
    return read().users
  },

  // Elimina un usuario por id. Devuelve true si se eliminó.
  remove(id) {
    const db = read()
    const antes = db.users.length
    db.users = db.users.filter((u) => u.id !== id)
    if (db.users.length === antes) return false
    write(db)
    return true
  },
}
