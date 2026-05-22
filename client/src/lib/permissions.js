// Espejo (para la UI) del modelo de permisos del backend.
// OJO: esto solo decide qué se MUESTRA. La seguridad real la impone el backend.
export const SUPERUSER_EMAIL = 'nevoli.gonzalez@lcg.mx'

export function effectiveRole(user) {
  if (!user) return 'user'
  if (user.email === SUPERUSER_EMAIL) return 'superuser'
  return user.role || 'user'
}

// Facultades granulares (asignables). El superusuario las tiene todas.
export const FACULTADES = ['ventasVer', 'ventasModificar']

export function facultadesDe(user) {
  if (effectiveRole(user) === 'superuser') {
    return { ventasVer: true, ventasModificar: true }
  }
  const f = user?.facultades || {}
  return { ventasVer: !!f.ventasVer, ventasModificar: !!f.ventasModificar }
}

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

export const ROLE_LABELS = {
  superuser: 'Superusuario',
  admin: 'Administrador',
  viewer: 'Solo lectura',
  user: 'Usuario',
}
