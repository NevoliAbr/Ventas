// Punto de arranque del servidor Express (AuthApp).
import express from 'express'
import cors from 'cors'
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

app.listen(PORT, () => {
  console.log(`[server] API escuchando en http://localhost:${PORT}`)
})
