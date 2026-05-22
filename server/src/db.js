// Capa de datos: SQLite usando el módulo integrado de Node (node:sqlite).
// Disponible en Node 22.5+. Cero dependencias nativas.
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// El archivo .db vive en server/ (un nivel arriba de src/).
const dbPath = join(__dirname, '..', 'ventas.db')
export const db = new DatabaseSync(dbPath)

// Esquema. Una venta simple para el ejemplo conectado.
db.exec(`
  CREATE TABLE IF NOT EXISTS ventas (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    producto  TEXT    NOT NULL,
    cantidad  INTEGER NOT NULL DEFAULT 1,
    precio    REAL    NOT NULL DEFAULT 0,
    fecha     TEXT    NOT NULL DEFAULT (datetime('now'))
  )
`)

// Siembra inicial: si la tabla está vacía, carga los datos de seed.json.
const { total } = db.prepare('SELECT COUNT(*) AS total FROM ventas').get()
if (total === 0) {
  const seedPath = join(__dirname, 'seed.json')
  const seed = JSON.parse(readFileSync(seedPath, 'utf-8'))
  const insert = db.prepare(
    'INSERT INTO ventas (producto, cantidad, precio) VALUES (?, ?, ?)'
  )
  for (const v of seed) {
    insert.run(v.producto, v.cantidad, v.precio)
  }
  console.log(`[db] Sembradas ${seed.length} ventas desde seed.json`)
}
