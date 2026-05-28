// Punto de arranque del servidor Express (AuthApp).
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import authRouter from './routes/auth.js'
import usersRouter from './routes/users.js'
import catalogoRouter from './routes/catalogo.js'
import ventasRouter from './routes/ventas.js'
import oportunidadesRouter from './routes/oportunidades.js'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware global.
app.use(cors())
app.use(express.json())

// Comprobación de salud: verifica también la conexión a la DB.
app.get('/api/health', async (_req, res) => {
  const driver = (process.env.DB_DRIVER || 'sqlite').toLowerCase()
  try {
    if (driver === 'mysql') {
      const { getPool } = await import('./lib/mysql.js')
      const pool = await getPool()
      await pool.query('SELECT 1')
    } else if (driver === 'mssql') {
      const { getPool } = await import('./lib/mssql.js')
      const pool = await getPool()
      await pool.request().query('SELECT 1')
    }
    res.json({ ok: true, service: 'ventas-server', db: driver })
  } catch (err) {
    res.status(503).json({ ok: false, service: 'ventas-server', db: driver, error: err.message })
  }
})

// Rutas de autenticación.
app.use('/api/auth', authRouter)

// Rutas de gestión de usuarios (módulo Configuración).
app.use('/api/users', usersRouter)

// Rutas del catálogo de ventas (Configuración de ventas).
app.use('/api/catalogo', catalogoRouter)

// Rutas de ventas (transacciones).
app.use('/api/ventas', ventasRouter)

// Rutas de Pipeline / Forecast.
app.use('/api/oportunidades', oportunidadesRouter)

// ---- Frontend de React ya compilado (producción / Plesk) ----
// El cliente usa rutas relativas /api, así que servir el build desde el MISMO
// servidor evita CORS y problemas de URL. Solo se activa si existe client/dist
// (en desarrollo se usa Vite en :5173, así que este bloque se ignora).
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const clientDist = path.resolve(__dirname, '../../client/dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  // Cualquier ruta que NO sea /api devuelve index.html (React Router en cliente).
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(clientDist, 'index.html'))
  })
  console.log(`[server] Sirviendo frontend desde ${clientDist}`)
}

// Error handler global: captura cualquier excepción que escape de las rutas
// y devuelve JSON en lugar del HTML por defecto de Express.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[server] Error no capturado:', err)
  res.status(500).json({ error: err.message || 'Error interno del servidor.' })
})

app.listen(PORT, () => {
  console.log(`[server] API escuchando en http://localhost:${PORT}`)
})
