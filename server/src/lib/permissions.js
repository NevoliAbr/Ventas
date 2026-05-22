// Modelo de roles y facultades. Fuente de verdad del backend.
//
// Roles:
//   superuser -> ve y modifica TODO (siempre nevoli.gonzalez@lcg.mx)
//   admin     -> ve y modifica usuarios
//   viewer    -> solo ve usuarios
//   user      -> sin acceso a configuración (usuario normal)

export const SUPERUSER_EMAIL = 'nevoli.gonzalez@lcg.mx'

// Roles que se pueden asignar vía API (superuser es exclusivo por email).
export const ASSIGNABLE_ROLES = ['admin', 'viewer', 'user']

// Devuelve el rol efectivo: el email superusuario manda sobre lo guardado.
export function effectiveRole(user) {
  if (!user) return 'user'
  if (user.email === SUPERUSER_EMAIL) return 'superuser'
  return user.role || 'user'
}

// Facultades granulares y ASIGNABLES por usuario (el superusuario las tiene todas).
// Extensible: agrega más claves aquí a futuro.
export const FACULTADES = ['ventasVer', 'ventasModificar']

// Devuelve las facultades efectivas de un usuario.
export function facultadesDe(user) {
  if (effectiveRole(user) === 'superuser') {
    // El superusuario siempre tiene todas las facultades.
    return Object.fromEntries(FACULTADES.map((f) => [f, true]))
  }
  let stored = {}
  try {
    stored = user?.facultades
      ? typeof user.facultades === 'string'
        ? JSON.parse(user.facultades)
        : user.facultades
      : {}
  } catch {
    stored = {}
  }
  return Object.fromEntries(FACULTADES.map((f) => [f, !!stored[f]]))
}

// Calcula las facultades (vista / modificación) de un usuario.
export function permissionsFor(user) {
  const role = effectiveRole(user)
  return {
    role,
    isSuperuser: role === 'superuser',
    canViewUsers: ['superuser', 'admin', 'viewer'].includes(role),
    canEditUsers: ['superuser', 'admin'].includes(role),
    facultades: facultadesDe(user),
  }
}
