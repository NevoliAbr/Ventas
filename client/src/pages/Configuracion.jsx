// Página de Configuración: gestión de usuarios con facultades de vista/modificación.
// - Cualquiera con canViewUsers ve la tabla.
// - Solo canEditUsers puede cambiar roles / eliminar.
// - El superusuario es intocable. Las reglas reales las impone el backend.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { usersApi } from '../services/api.js'
import {
  permissionsFor,
  effectiveRole,
  ROLE_LABELS,
  SUPERUSER_EMAIL,
} from '../lib/permissions.js'

export default function Configuracion() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const perms = permissionsFor(user)

  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [ocupadoId, setOcupadoId] = useState(null)

  useEffect(() => {
    if (!perms.canViewUsers) {
      setCargando(false)
      return
    }
    usersApi
      .list()
      .then((res) => setUsuarios(res.users))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [perms.canViewUsers])

  function salir() {
    logout()
    navigate('/')
  }

  // Roles que YO puedo asignar (solo el superusuario puede crear admins).
  const opcionesRol = perms.isSuperuser ? ['admin', 'viewer', 'user'] : ['viewer', 'user']

  async function cambiarRol(u, nuevoRol) {
    setError(null)
    setAviso(null)
    setOcupadoId(u.id)
    try {
      const res = await usersApi.update(u.id, { role: nuevoRol })
      setUsuarios((prev) => prev.map((x) => (x.id === u.id ? res.user : x)))
      setAviso(`Rol de ${res.user.nombre} actualizado a "${ROLE_LABELS[res.user.role]}".`)
    } catch (e) {
      setError(e.message)
    } finally {
      setOcupadoId(null)
    }
  }

  async function eliminar(u) {
    if (!window.confirm(`¿Eliminar a ${u.nombre} (${u.email})?`)) return
    setError(null)
    setAviso(null)
    setOcupadoId(u.id)
    try {
      await usersApi.remove(u.id)
      setUsuarios((prev) => prev.filter((x) => x.id !== u.id))
      setAviso('Usuario eliminado.')
    } catch (e) {
      setError(e.message)
    } finally {
      setOcupadoId(null)
    }
  }

  // Asigna/quita una facultad granular (ej. ventasVer, ventasModificar).
  async function cambiarFacultad(u, key, value) {
    setError(null)
    setAviso(null)
    setOcupadoId(u.id)
    try {
      const facultades = { ...u.facultades, [key]: value }
      const res = await usersApi.update(u.id, { facultades })
      setUsuarios((prev) => prev.map((x) => (x.id === u.id ? res.user : x)))
      setAviso(`Facultades de ${res.user.nombre} actualizadas.`)
    } catch (e) {
      setError(e.message)
    } finally {
      setOcupadoId(null)
    }
  }

  // ¿Puedo editar/eliminar esta fila?
  function puedeEditarFila(u) {
    if (!perms.canEditUsers) return false
    if (u.email === SUPERUSER_EMAIL) return false // superusuario intocable
    if (effectiveRole(u) === 'admin' && !perms.isSuperuser) return false // solo super toca admins
    return true
  }

  return (
    <div className="dashboard slds-scope">
      <div className="slds-container_large slds-container_center">
        {/* Barra superior */}
        <div className="dash-topbar">
          <div>
            <Link to="/inicio" className="dash-back">← Inicio</Link>
            <h1 className="dash-greeting">Configuración</h1>
            <p className="dash-subtitle">Gestión de usuarios y permisos</p>
          </div>
          <button type="button" className="slds-button slds-button_neutral" onClick={salir}>
            Cerrar sesión
          </button>
        </div>

        {/* Sin facultad de vista */}
        {!perms.canViewUsers ? (
          <div className="slds-box slds-theme_default">
            <h2 className="slds-text-heading_small slds-m-bottom_x-small">Sin acceso</h2>
            <p className="slds-text-color_weak">
              No tienes permiso para ver esta sección. Pide a un administrador que te
              otorgue la facultad correspondiente.
            </p>
            <p className="slds-m-top_small">
              <Link to="/inicio">← Volver al inicio</Link>
            </p>
          </div>
        ) : (
          <div className="slds-box slds-theme_default">
            <div className="slds-grid slds-grid_align-spread slds-m-bottom_small">
              <h2 className="slds-text-heading_small">Usuarios</h2>
              <span className="slds-text-body_small slds-text-color_weak">
                Tu facultad: {perms.canEditUsers ? 'vista y modificación' : 'solo vista'}
              </span>
            </div>

            {error && (
              <div className="slds-text-color_error slds-text-body_small slds-m-bottom_small" role="alert">
                ⚠️ {error}
              </div>
            )}
            {aviso && (
              <div className="slds-text-color_success slds-text-body_small slds-m-bottom_small" role="status">
                ✅ {aviso}
              </div>
            )}

            {cargando ? (
              <p className="slds-text-color_weak">Cargando usuarios…</p>
            ) : (
              <table className="slds-table slds-table_bordered slds-table_cell-buffer">
                <thead>
                  <tr className="slds-line-height_reset">
                    <th scope="col"><div className="slds-truncate">Nombre</div></th>
                    <th scope="col"><div className="slds-truncate">Email</div></th>
                    <th scope="col"><div className="slds-truncate">Rol</div></th>
                    {perms.canEditUsers && (
                      <th scope="col"><div className="slds-truncate">Facultades (ventas)</div></th>
                    )}
                    {perms.canEditUsers && (
                      <th scope="col"><div className="slds-truncate">Acciones</div></th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((u) => {
                    const editable = puedeEditarFila(u)
                    const esYo = u.id === user.id
                    return (
                      <tr key={u.id} className="slds-hint-parent">
                        <td>
                          <div className="slds-truncate">
                            {u.nombre} {esYo && <span className="slds-text-color_weak">(tú)</span>}
                          </div>
                        </td>
                        <td><div className="slds-truncate">{u.email}</div></td>
                        <td>
                          {editable ? (
                            <div className="slds-select_container" style={{ maxWidth: '11rem' }}>
                              <select
                                className="slds-select"
                                value={u.role}
                                disabled={ocupadoId === u.id}
                                onChange={(e) => cambiarRol(u, e.target.value)}
                              >
                                {opcionesRol.map((r) => (
                                  <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <span className={'role-badge role-' + u.role}>
                              {ROLE_LABELS[u.role] || u.role}
                            </span>
                          )}
                        </td>
                        {perms.canEditUsers && (
                          <td>
                            <div className="facultades-cell">
                              <label>
                                <input
                                  type="checkbox"
                                  checked={!!u.facultades?.ventasVer}
                                  disabled={!editable || ocupadoId === u.id}
                                  onChange={(e) => cambiarFacultad(u, 'ventasVer', e.target.checked)}
                                />{' '}Ver
                              </label>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={!!u.facultades?.ventasModificar}
                                  disabled={!editable || ocupadoId === u.id}
                                  onChange={(e) => cambiarFacultad(u, 'ventasModificar', e.target.checked)}
                                />{' '}Modificar
                              </label>
                            </div>
                          </td>
                        )}
                        {perms.canEditUsers && (
                          <td>
                            {editable && !esYo ? (
                              <button
                                type="button"
                                className="slds-button slds-button_text-destructive"
                                disabled={ocupadoId === u.id}
                                onClick={() => eliminar(u)}
                              >
                                Eliminar
                              </button>
                            ) : (
                              <span className="slds-text-color_weak slds-text-body_small">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
