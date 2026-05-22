// Gestión de usuarios (módulo de Configuración).
// Las facultades ya se validaron en el middleware (req.perms / req.currentUser).
import { usersRepo } from '../lib/usersStore.js'
import {
  effectiveRole,
  facultadesDe,
  ASSIGNABLE_ROLES,
  FACULTADES,
  SUPERUSER_EMAIL,
} from '../lib/permissions.js'

function sanitize(user) {
  const { password, resetToken, resetExpires, ...safe } = user
  return { ...safe, role: effectiveRole(user), facultades: facultadesDe(user) }
}

// GET /api/users — lista todos los usuarios (requiere facultad de vista).
export async function listUsers(req, res) {
  const users = (await usersRepo.all()).map(sanitize)
  res.json({ users, perms: req.perms })
}

// PATCH /api/users/:id — modifica nombre y/o rol (requiere facultad de edición).
export async function updateUser(req, res) {
  const { id } = req.params
  const target = await usersRepo.findById(id)
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' })

  // El superusuario es intocable (rol fijo por email).
  if (target.email === SUPERUSER_EMAIL) {
    return res.status(403).json({ error: 'No se puede modificar al superusuario.' })
  }
  // Solo el superusuario puede tocar a un administrador.
  if (effectiveRole(target) === 'admin' && !req.perms.isSuperuser) {
    return res.status(403).json({ error: 'Solo el superusuario puede modificar a un administrador.' })
  }

  const { nombre, role } = req.body ?? {}
  const patch = {}

  if (typeof nombre === 'string' && nombre.trim()) {
    patch.nombre = nombre.trim()
  }

  if (role !== undefined) {
    if (!ASSIGNABLE_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Rol inválido.' })
    }
    // Solo el superusuario puede otorgar el rol de administrador.
    if (role === 'admin' && !req.perms.isSuperuser) {
      return res.status(403).json({ error: 'Solo el superusuario puede asignar administradores.' })
    }
    patch.role = role
  }

  // Asignación de facultades granulares (ej. ventasVer / ventasModificar).
  if (req.body && req.body.facultades !== undefined) {
    const entrada = req.body.facultades || {}
    const limpio = {}
    for (const key of FACULTADES) limpio[key] = !!entrada[key]
    patch.facultades = JSON.stringify(limpio)
  }

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'Nada que actualizar.' })
  }

  const updated = await usersRepo.update(id, patch)
  res.json({ user: sanitize(updated) })
}

// DELETE /api/users/:id — elimina un usuario (requiere facultad de edición).
export async function deleteUser(req, res) {
  const { id } = req.params
  const target = await usersRepo.findById(id)
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' })

  if (target.email === SUPERUSER_EMAIL) {
    return res.status(403).json({ error: 'No se puede eliminar al superusuario.' })
  }
  if (effectiveRole(target) === 'admin' && !req.perms.isSuperuser) {
    return res.status(403).json({ error: 'Solo el superusuario puede eliminar a un administrador.' })
  }
  if (target.id === req.currentUser.id) {
    return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' })
  }

  await usersRepo.remove(id)
  res.json({ ok: true })
}
