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
app.use(cors())            // permite peticiones desde el frontend (Vite)
app.use(express.json())    // parsea cuerpos JSON

// Comprobación de salud.
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'authapp-server' })
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

app.listen(PORT, () => {
  console.log(`[server] API escuchando en http://localhost:${PORT}`)
})
