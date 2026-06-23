// Página de Configuración: gestión de usuarios con facultades de vista/modificación.
// - Cualquiera con canViewUsers ve la tabla.
// - Solo canEditUsers puede cambiar roles / eliminar.
// - El superusuario es intocable. Las reglas reales las impone el backend.
import { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { usersApi, adminApi } from '../services/api.js'
import {
  permissionsFor,
  effectiveRole,
  ROLE_LABELS,
  SUPERUSER_EMAIL,
} from '../lib/permissions.js'

const CORREO_EMPTY = { to: '', subject: '' }

export default function Configuracion() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const perms = permissionsFor(user)

  const [tab, setTab] = useState('usuarios')

  // --- tab Usuarios ---
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [ocupadoId, setOcupadoId] = useState(null)

  // --- tab Correo ---
  const [correo, setCorreo] = useState(CORREO_EMPTY)
  const [enviando, setEnviando] = useState(false)
  const [correoAviso, setCorreoAviso] = useState(null)
  const [correoError, setCorreoError] = useState(null)
  const editorRef   = useRef(null)
  const colorRef    = useRef(null)
  const savedSelRef = useRef(null)
  const [currentColor, setCurrentColor] = useState('#111111')
  const [showLinkBox, setShowLinkBox] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [adjuntos, setAdjuntos] = useState([])
  const fileRef = useRef(null)

  async function enviarCorreo(e) {
    e.preventDefault()
    setCorreoAviso(null)
    setCorreoError(null)
    if (!editorRef.current.textContent.trim()) {
      setCorreoError('El mensaje no puede estar vacío.')
      return
    }
    setEnviando(true)
    try {
      const logoDataUrl = await fetch('/logo.png')
        .then((r) => r.blob())
        .then((blob) => new Promise((res) => {
          const fr = new FileReader()
          fr.onload = () => res(fr.result)
          fr.readAsDataURL(blob)
        }))
      const firma = `<div style="margin-top:24px;padding-top:14px;border-top:2px solid #1e3a5f;font-family:Arial,sans-serif"><div style="background:#1e3a5f;padding:10px 14px;display:inline-block;border-radius:6px;margin-bottom:10px"><img src="${logoDataUrl}" alt="LCG" style="height:50px;display:block"></div><p style="margin:0 0 4px;font-weight:700;color:#1e3a5f;font-size:14px">Servicios LCG</p><p style="margin:0;color:#666;font-size:12px">services@lcg.mx</p></div>`
      const body = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#333">${editorRef.current.innerHTML}</div>${firma}`
      await adminApi.enviarCorreo({ to: correo.to, subject: correo.subject, body }, adjuntos)
      setCorreoAviso(`Correo enviado a ${correo.to}.`)
      setCorreo(CORREO_EMPTY)
      editorRef.current.innerHTML = ''
      setAdjuntos([])
    } catch (err) {
      setCorreoError(err.message)
    } finally {
      setEnviando(false)
    }
  }

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

  function execCmd(cmd, value = null) {
    editorRef.current?.focus()
    document.execCommand(cmd, false, value)
  }

  function saveSelection() {
    const sel = window.getSelection()
    if (sel?.rangeCount > 0) savedSelRef.current = sel.getRangeAt(0).cloneRange()
  }

  function applyColor(color) {
    setCurrentColor(color)
    const sel = window.getSelection()
    if (sel && savedSelRef.current) {
      sel.removeAllRanges()
      sel.addRange(savedSelRef.current)
    }
    document.execCommand('foreColor', false, color)
  }

  function insertLink() {
    if (!linkUrl.trim()) return
    const url = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`
    const sel = window.getSelection()
    if (sel && savedSelRef.current) {
      sel.removeAllRanges()
      sel.addRange(savedSelRef.current)
    }
    document.execCommand('createLink', false, url)
    setShowLinkBox(false)
    setLinkUrl('')
    editorRef.current?.focus()
  }

  function removeAdjunto(i) {
    setAdjuntos((prev) => prev.filter((_, idx) => idx !== i))
  }

  const tbBtn = {
    minWidth: '28px', height: '28px', padding: '0 5px',
    border: '1px solid #c9c7c5', background: '#fff', borderRadius: '3px',
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', fontSize: '13px', lineHeight: '1',
  }
  const tbSep = {
    width: '1px', height: '20px', background: '#c9c7c5',
    margin: '0 4px', display: 'inline-block', verticalAlign: 'middle',
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
            {/* Tabs */}
            <div className="slds-tabs_default slds-m-bottom_small">
              <ul className="slds-tabs_default__nav" role="tablist">
                <li
                  className={'slds-tabs_default__item' + (tab === 'usuarios' ? ' slds-is-active' : '')}
                  role="presentation"
                >
                  <a className="slds-tabs_default__link" href="#usuarios" role="tab"
                    onClick={(e) => { e.preventDefault(); setTab('usuarios') }}>
                    Usuarios
                  </a>
                </li>
                {perms.canEditUsers && (
                  <li
                    className={'slds-tabs_default__item' + (tab === 'correo' ? ' slds-is-active' : '')}
                    role="presentation"
                  >
                    <a className="slds-tabs_default__link" href="#correo" role="tab"
                      onClick={(e) => { e.preventDefault(); setTab('correo') }}>
                      Correo
                    </a>
                  </li>
                )}
              </ul>
            </div>

            {/* ── Tab: Usuarios ── */}
            {tab === 'usuarios' && (
              <>
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
                                  <label>
                                    <input
                                      type="checkbox"
                                      checked={!!u.facultades?.ventasEliminar}
                                      disabled={!editable || ocupadoId === u.id}
                                      onChange={(e) => cambiarFacultad(u, 'ventasEliminar', e.target.checked)}
                                    />{' '}Eliminar
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
              </>
            )}

            {/* ── Tab: Correo ── */}
            {tab === 'correo' && perms.canEditUsers && (
              <div style={{ maxWidth: '680px' }}>
                <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_medium">
                  Envía un correo desde la cuenta del sistema.
                </p>

                {correoAviso && (
                  <div className="slds-text-color_success slds-text-body_small slds-m-bottom_small" role="status">
                    ✅ {correoAviso}
                  </div>
                )}
                {correoError && (
                  <div className="slds-text-color_error slds-text-body_small slds-m-bottom_small" role="alert">
                    ⚠️ {correoError}
                  </div>
                )}

                <form onSubmit={enviarCorreo}>
                  {/* Para */}
                  <div className="slds-form-element slds-m-bottom_small">
                    <label className="slds-form-element__label" htmlFor="correo-to">
                      <abbr className="slds-required" title="required">*</abbr> Para
                    </label>
                    <div className="slds-form-element__control">
                      <input
                        id="correo-to"
                        type="email"
                        className="slds-input"
                        placeholder="destinatario@ejemplo.com"
                        value={correo.to}
                        onChange={(e) => setCorreo((p) => ({ ...p, to: e.target.value }))}
                        required
                        disabled={enviando}
                      />
                    </div>
                  </div>

                  {/* Asunto */}
                  <div className="slds-form-element slds-m-bottom_small">
                    <label className="slds-form-element__label" htmlFor="correo-subject">
                      <abbr className="slds-required" title="required">*</abbr> Asunto
                    </label>
                    <div className="slds-form-element__control">
                      <input
                        id="correo-subject"
                        type="text"
                        className="slds-input"
                        placeholder="Asunto del correo"
                        value={correo.subject}
                        onChange={(e) => setCorreo((p) => ({ ...p, subject: e.target.value }))}
                        required
                        disabled={enviando}
                      />
                    </div>
                  </div>

                  {/* Mensaje */}
                  <div className="slds-form-element slds-m-bottom_medium">
                    <label className="slds-form-element__label">
                      <abbr className="slds-required" title="required">*</abbr> Mensaje
                    </label>

                    {/* Toolbar */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '2px', flexWrap: 'wrap',
                      padding: '5px 8px', background: '#f4f6f9',
                      border: '1px solid #dddbda', borderBottom: 'none',
                      borderRadius: '4px 4px 0 0',
                    }}>
                      {/* Negrita / Cursiva / Subrayado */}
                      <button type="button" title="Negrita (Ctrl+B)"
                        onMouseDown={(e) => { e.preventDefault(); execCmd('bold') }}
                        style={tbBtn}
                      ><strong>N</strong></button>

                      <button type="button" title="Cursiva (Ctrl+I)"
                        onMouseDown={(e) => { e.preventDefault(); execCmd('italic') }}
                        style={tbBtn}
                      ><em>K</em></button>

                      <button type="button" title="Subrayado (Ctrl+U)"
                        onMouseDown={(e) => { e.preventDefault(); execCmd('underline') }}
                        style={tbBtn}
                      ><span style={{ textDecoration: 'underline' }}>S</span></button>

                      <span style={tbSep} />

                      {/* Color de texto */}
                      <label title="Color de texto" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                        <span
                          style={{ ...tbBtn, flexDirection: 'column', gap: '1px' }}
                          onMouseDown={saveSelection}
                        >
                          <span style={{ lineHeight: 1 }}>A</span>
                          <span style={{ width: '14px', height: '3px', background: currentColor, borderRadius: '1px' }} />
                        </span>
                        <input
                          ref={colorRef}
                          type="color"
                          value={currentColor}
                          style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}
                          onChange={(e) => applyColor(e.target.value)}
                        />
                      </label>

                      <span style={tbSep} />

                      {/* Tamaño de fuente */}
                      <select
                        title="Tamaño de fuente"
                        defaultValue=""
                        onChange={(e) => { if (e.target.value) execCmd('fontSize', e.target.value) }}
                        style={{
                          height: '28px', border: '1px solid #c9c7c5', borderRadius: '3px',
                          fontSize: '12px', background: '#fff', padding: '0 4px', cursor: 'pointer',
                        }}
                      >
                        <option value="" disabled>Tamaño</option>
                        <option value="1">Pequeño</option>
                        <option value="3">Normal</option>
                        <option value="5">Grande</option>
                        <option value="7">Enorme</option>
                      </select>

                      <span style={tbSep} />

                      {/* Alineación */}
                      <button type="button" title="Alinear izquierda"
                        onMouseDown={(e) => { e.preventDefault(); execCmd('justifyLeft') }}
                        style={tbBtn}
                      >
                        <svg width="14" height="12" viewBox="0 0 14 12">
                          <rect x="0" y="0" width="14" height="2" fill="currentColor"/>
                          <rect x="0" y="5" width="9"  height="2" fill="currentColor"/>
                          <rect x="0" y="10" width="12" height="2" fill="currentColor"/>
                        </svg>
                      </button>

                      <button type="button" title="Centrar"
                        onMouseDown={(e) => { e.preventDefault(); execCmd('justifyCenter') }}
                        style={tbBtn}
                      >
                        <svg width="14" height="12" viewBox="0 0 14 12">
                          <rect x="0"   y="0" width="14" height="2" fill="currentColor"/>
                          <rect x="2.5" y="5" width="9"  height="2" fill="currentColor"/>
                          <rect x="1"   y="10" width="12" height="2" fill="currentColor"/>
                        </svg>
                      </button>

                      <button type="button" title="Alinear derecha"
                        onMouseDown={(e) => { e.preventDefault(); execCmd('justifyRight') }}
                        style={tbBtn}
                      >
                        <svg width="14" height="12" viewBox="0 0 14 12">
                          <rect x="0" y="0" width="14" height="2" fill="currentColor"/>
                          <rect x="5" y="5" width="9"  height="2" fill="currentColor"/>
                          <rect x="2" y="10" width="12" height="2" fill="currentColor"/>
                        </svg>
                      </button>

                      <span style={tbSep} />

                      {/* Listas */}
                      <button type="button" title="Lista con viñetas"
                        onMouseDown={(e) => { e.preventDefault(); execCmd('insertUnorderedList') }}
                        style={tbBtn}
                      >
                        <svg width="14" height="12" viewBox="0 0 14 12">
                          <circle cx="1.5" cy="2"  r="1.5" fill="currentColor"/>
                          <rect x="4" y="1"  width="10" height="2" fill="currentColor"/>
                          <circle cx="1.5" cy="6"  r="1.5" fill="currentColor"/>
                          <rect x="4" y="5"  width="10" height="2" fill="currentColor"/>
                          <circle cx="1.5" cy="10" r="1.5" fill="currentColor"/>
                          <rect x="4" y="9"  width="10" height="2" fill="currentColor"/>
                        </svg>
                      </button>

                      <button type="button" title="Lista numerada"
                        onMouseDown={(e) => { e.preventDefault(); execCmd('insertOrderedList') }}
                        style={tbBtn}
                      >
                        <svg width="14" height="12" viewBox="0 0 14 12">
                          <text x="0" y="4"  fontSize="4.5" fill="currentColor">1.</text>
                          <rect x="5" y="1"  width="9" height="2" fill="currentColor"/>
                          <text x="0" y="8"  fontSize="4.5" fill="currentColor">2.</text>
                          <rect x="5" y="5"  width="9" height="2" fill="currentColor"/>
                          <text x="0" y="12" fontSize="4.5" fill="currentColor">3.</text>
                          <rect x="5" y="9"  width="9" height="2" fill="currentColor"/>
                        </svg>
                      </button>

                      <span style={tbSep} />

                      {/* Hipervínculo */}
                      <button type="button" title="Insertar enlace"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          if (showLinkBox) { setShowLinkBox(false); return }
                          saveSelection()
                          setShowLinkBox(true)
                        }}
                        style={{ ...tbBtn, background: showLinkBox ? '#e8f0fe' : '#fff', borderColor: showLinkBox ? '#1a73e8' : '#c9c7c5' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14">
                          <path d="M5.5 8.5a3.5 3.5 0 0 0 4.95 0l1.5-1.5a3.5 3.5 0 0 0-4.95-4.95L6 3.55" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                          <path d="M8.5 5.5a3.5 3.5 0 0 0-4.95 0l-1.5 1.5a3.5 3.5 0 0 0 4.95 4.95L8 10.45" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round"/>
                        </svg>
                      </button>

                      <span style={tbSep} />

                      {/* Adjuntar archivo */}
                      <button type="button" title="Adjuntar archivo"
                        onMouseDown={(e) => { e.preventDefault(); fileRef.current.click() }}
                        style={tbBtn}
                      >
                        <svg width="14" height="14" viewBox="0 0 14 14">
                          <path d="M12 6.5L6 12.5a3.5 3.5 0 0 1-4.95-4.95l5.66-5.65a2 2 0 0 1 2.83 2.82L4 10.3a.5.5 0 0 1-.7-.7L8.5 4.4" stroke="currentColor" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          setAdjuntos((prev) => [...prev, ...Array.from(e.target.files)])
                          e.target.value = ''
                        }}
                      />
                    </div>

                    {/* Caja de enlace */}
                    {showLinkBox && (
                      <div style={{
                        display: 'flex', gap: '6px', padding: '6px 8px',
                        background: '#f0f4ff', border: '1px solid #dddbda', borderTop: 'none',
                      }}>
                        <input
                          autoFocus
                          type="url"
                          placeholder="https://..."
                          value={linkUrl}
                          onChange={(e) => setLinkUrl(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') { e.preventDefault(); insertLink() }
                            if (e.key === 'Escape') setShowLinkBox(false)
                          }}
                          style={{ flex: 1, height: '26px', padding: '0 8px', border: '1px solid #c9c7c5', borderRadius: '3px', fontSize: '12px' }}
                        />
                        <button type="button" onClick={insertLink}
                          style={{ height: '26px', padding: '0 10px', background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '12px', cursor: 'pointer' }}
                        >Insertar</button>
                        <button type="button" onClick={() => setShowLinkBox(false)}
                          style={{ height: '26px', padding: '0 8px', background: 'transparent', border: '1px solid #c9c7c5', borderRadius: '3px', fontSize: '12px', cursor: 'pointer' }}
                        >✕</button>
                      </div>
                    )}

                    {/* Área de edición */}
                    <div
                      ref={editorRef}
                      contentEditable={!enviando}
                      suppressContentEditableWarning
                      onBlur={saveSelection}
                      style={{
                        minHeight: '200px', padding: '12px', outline: 'none',
                        border: '1px solid #dddbda', borderTop: 'none',
                        fontFamily: 'Arial, sans-serif', fontSize: '14px',
                        lineHeight: '1.6', color: '#333', background: '#fff',
                      }}
                    />

                    {/* Vista previa de la firma */}
                    <div style={{
                      padding: '12px 14px', background: '#fafafa',
                      border: '1px solid #dddbda', borderTop: '1px solid #e8e6e6',
                      borderRadius: '0 0 4px 4px',
                    }}>
                      <div style={{ borderTop: '2px solid #1e3a5f', paddingTop: '12px' }}>
                        <div style={{ background: '#1e3a5f', padding: '8px 12px', display: 'inline-block', borderRadius: '6px', marginBottom: '8px' }}>
                          <img src="/logo.png" alt="LCG" style={{ height: '40px', display: 'block' }} />
                        </div>
                        <p style={{ margin: '0 0 3px', fontWeight: 700, color: '#1e3a5f', fontSize: '13px', letterSpacing: '.3px' }}>
                          Servicios LCG
                        </p>
                        <p style={{ margin: 0, color: '#666', fontSize: '12px' }}>services@lcg.mx</p>
                      </div>
                    </div>

                    {/* Archivos adjuntos */}
                    {adjuntos.length > 0 && (
                      <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {adjuntos.map((f, i) => (
                          <span key={i} style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '3px 8px', background: '#f4f6f9',
                            border: '1px solid #dddbda', borderRadius: '12px', fontSize: '12px',
                          }}>
                            📎 {f.name}
                            <span style={{ color: '#888' }}>({(f.size / 1024).toFixed(0)} KB)</span>
                            <button type="button" onClick={() => removeAdjunto(i)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '13px', padding: '0 0 0 2px', lineHeight: 1 }}
                            >✕</button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="slds-button slds-button_brand"
                    disabled={enviando}
                  >
                    {enviando ? 'Enviando…' : 'Enviar correo'}
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
