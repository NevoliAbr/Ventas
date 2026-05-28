// Lógica de autenticación: registro, login, recuperación y reset de contraseña.
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomBytes } from 'node:crypto'
import { usersRepo } from '../lib/usersStore.js' // motor según DB_DRIVER (sqlite por defecto)
import { effectiveRole, facultadesDe } from '../lib/permissions.js'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambia-esto-en-produccion'
const JWT_EXPIRES = process.env.JWT_EXPIRES || '1h'
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'
const RESET_TTL_MS = 1000 * 60 * 60 // el token de reset dura 1 hora

// Quita campos sensibles y expone el rol y las facultades EFECTIVAS.
function sanitize(user) {
  const { password, resetToken, resetExpires, ...safe } = user
  return { ...safe, role: effectiveRole(user), facultades: facultadesDe(user) }
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, nombre: user.nombre },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  )
}

// POST /api/auth/register  { nombre, email, password }
export async function register(req, res) {
  const { nombre, email, password } = req.body ?? {}
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'nombre, email y password son obligatorios.' })
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' })
  }

  const emailNorm = String(email).trim().toLowerCase()

  try {
    // No permitir emails duplicados.
    if (await usersRepo.findByEmail(emailNorm)) {
      return res.status(409).json({ error: 'Ese email ya está registrado.' })
    }

    const hash = await bcrypt.hash(String(password), 10)
    const user = await usersRepo.create({
      nombre: String(nombre).trim(),
      email: emailNorm,
      password: hash,
    })

    const token = signToken(user)
    // Auto-login tras registrarse: devolvemos también el token.
    res.status(201).json({ user: sanitize(user), token })
  } catch (err) {
    console.error('[auth] register error:', err)
    res.status(500).json({ error: `Error interno: ${err.message}` })
  }
}

// POST /api/auth/login  { email, password }
export async function login(req, res) {
  const { email, password } = req.body ?? {}
  if (!email || !password) {
    return res.status(400).json({ error: 'email y password son obligatorios.' })
  }

  try {
    const user = await usersRepo.findByEmail(String(email).trim().toLowerCase())
    // Mensaje genérico: no revelamos si el fallo fue por email o por contraseña.
    if (!user || !(await bcrypt.compare(String(password), user.password))) {
      return res.status(401).json({ error: 'Credenciales inválidas.' })
    }

    const token = signToken(user)
    res.json({ user: sanitize(user), token })
  } catch (err) {
    console.error('[auth] login error:', err)
    res.status(500).json({ error: `Error interno: ${err.message}` })
  }
}

// POST /api/auth/forgot-password  { email }
export async function forgotPassword(req, res) {
  const { email } = req.body ?? {}
  if (!email) {
    return res.status(400).json({ error: 'email es obligatorio.' })
  }

  const emailNorm = String(email).trim().toLowerCase()

  // Respuesta genérica para no revelar qué emails existen (anti-enumeración).
  const genericMsg = 'Si el email existe, se ha generado un enlace de recuperación.'

  try {
    const user = await usersRepo.findByEmail(emailNorm)

    if (!user) {
      console.log(`[forgot-password] Email no registrado: ${emailNorm} (sin token)`)
      return res.json({ message: genericMsg })
    }

    const token = randomBytes(32).toString('hex')
    await usersRepo.update(user.id, {
      resetToken: token,
      resetExpires: Date.now() + RESET_TTL_MS,
    })

    const resetUrl = `${CLIENT_URL}/reset-password/${token}`

    // SIMULACIÓN de envío de correo: el enlace se imprime en consola.
    console.log('\n========== RECUPERACIÓN DE CONTRASEÑA (DEV) ==========')
    console.log(`Para: ${user.email}`)
    console.log(`Enlace (válido 1h):`)
    console.log(resetUrl)
    console.log('=====================================================\n')

    const body = { message: genericMsg }
    // Comodidad para desarrollo: devolvemos también el enlace en la respuesta.
    if (process.env.NODE_ENV !== 'production') body.devResetUrl = resetUrl
    res.json(body)
  } catch (err) {
    console.error('[auth] forgotPassword error:', err)
    res.status(500).json({ error: `Error interno: ${err.message}` })
  }
}

// POST /api/auth/reset-password/:token  { password }
export async function resetPassword(req, res) {
  const { token } = req.params
  const { password } = req.body ?? {}

  if (!password || String(password).length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' })
  }

  try {
    const user = await usersRepo.findByResetToken(token)
    if (!user || !user.resetExpires || Number(user.resetExpires) < Date.now()) {
      return res.status(400).json({ error: 'Token inválido o expirado.' })
    }

    const hash = await bcrypt.hash(String(password), 10)
    await usersRepo.update(user.id, {
      password: hash,
      resetToken: null,
      resetExpires: null,
    })

    res.json({ message: 'Contraseña actualizada. Ya puedes iniciar sesión.' })
  } catch (err) {
    console.error('[auth] resetPassword error:', err)
    res.status(500).json({ error: `Error interno: ${err.message}` })
  }
}

// GET /api/auth/verify-token  (protegida por authMiddleware)
// Devuelve el usuario actual; el frontend la usa para validar la sesión.
export async function verifyToken(req, res) {
  try {
    const user = await usersRepo.findById(req.user.id)
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' })
    res.json({ valid: true, user: sanitize(user) })
  } catch (err) {
    console.error('[auth] verifyToken error:', err)
    res.status(500).json({ error: `Error interno: ${err.message}` })
  }
}
