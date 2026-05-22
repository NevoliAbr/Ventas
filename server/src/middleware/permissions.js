// Middlewares de facultades para el módulo de usuarios.
// Se ejecutan DESPUÉS de authMiddleware (que ya validó el JWT y puso req.user).
// Cargan el usuario actual fresco desde el repo, así los cambios de rol surten
// efecto sin necesidad de volver a iniciar sesión.
import { usersRepo } from '../lib/usersStore.js'
import { permissionsFor } from '../lib/permissions.js'

async function cargarActual(req, res) {
  const current = await usersRepo.findById(req.user.id)
  if (!current) {
    res.status(401).json({ error: 'No autorizado.' })
    return null
  }
  req.currentUser = current
  req.perms = permissionsFor(current)
  return current
}

// Exige facultad de VISTA de usuarios.
export async function requireUsersView(req, res, next) {
  if (!(await cargarActual(req, res))) return
  if (!req.perms.canViewUsers) {
    return res.status(403).json({ error: 'Sin permiso para ver usuarios.' })
  }
  next()
}

// Exige facultad de MODIFICACIÓN de usuarios.
export async function requireUsersEdit(req, res, next) {
  if (!(await cargarActual(req, res))) return
  if (!req.perms.canEditUsers) {
    return res.status(403).json({ error: 'Sin permiso para modificar usuarios.' })
  }
  next()
}

// Exige una facultad granular concreta (ej. 'ventasVer', 'ventasModificar').
// El superusuario siempre pasa (sus facultades son todas true).
export function requireFaculty(key) {
  return async (req, res, next) => {
    if (!(await cargarActual(req, res))) return
    if (!req.perms.facultades[key]) {
      return res.status(403).json({ error: `Sin facultad: ${key}.` })
    }
    next()
  }
}
