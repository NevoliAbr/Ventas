// Middleware para proteger rutas. Exige un JWT válido en el header:
//   Authorization: Bearer <token>
// Si es válido, deja el payload decodificado en req.user y continúa.
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-cambia-esto-en-produccion'

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || ''
  const [scheme, token] = header.split(' ')

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'No autorizado: falta el token.' })
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'No autorizado: token inválido o expirado.' })
  }
}
