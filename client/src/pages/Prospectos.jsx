import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { useAuth } from '../context/AuthContext.jsx'
import { permissionsFor } from '../lib/permissions.js'
import { prospectoApi, reunionApi, universoApi } from '../services/api.js'

const COLS_EXPORT = ['Empresa / Municipio', 'Tipo', 'Contacto principal', 'Teléfono', 'Responsable LCG']
const MAP_IMPORT = {
  'empresa / municipio': 'empresa', 'tipo': 'tipo', 'contacto principal': 'contacto_nombre',
  'teléfono': 'telefono', 'responsable lcg': 'responsable',
}

function exportarExcel(lista) {
  const filas = lista.map((r) => ({
    'Empresa / Municipio': r.empresa, 'Tipo': r.tipo || '', 'Contacto principal': r.contacto_nombre || '',
    'Teléfono': r.telefono || '', 'Responsable LCG': r.responsable || '',
  }))
  const ws = XLSX.utils.json_to_sheet(filas)
  ws['!cols'] = COLS_EXPORT.map((c) => ({ wch: Math.max(c.length + 4, 18) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Prospectos')
  XLSX.writeFile(wb, `prospectos_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

const STATUS_COLOR = {
  Agendada: '#2563eb', Realizada: '#16a34a', Reprogramada: '#d97706', Cancelada: '#dc2626',
}
const STATUS_REUNION = ['Agendada', 'Realizada', 'Reprogramada', 'Cancelada']

const VACIO = { empresa: '', tipo: '', contacto_nombre: '', telefono: '', responsable: '' }
const REUNION_VACIA = { fecha: '', status: '', observaciones: '' }

export default function Prospectos() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const perms = permissionsFor(user)
  const canEdit = perms.facultades.ventasModificar
  const canDelete = perms.facultades.ventasEliminar

  const [lista, setLista] = useState([])
  const [opts, setOpts] = useState({ statusReunion: STATUS_REUNION, tipos: [] })
  const [pendientes, setPendientes] = useState([])
  const [mostrarPendientes, setMostrarPendientes] = useState(true)
  const [universoId, setUniversoId] = useState(null)
  const inputArchivoRef = useRef(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [form, setForm] = useState(VACIO)
  const [editId, setEditId] = useState(null)
  const [baseParaUniverso, setBaseParaUniverso] = useState(null)
  const [formUni, setFormUni] = useState({ rubro: '', segmento: '', email: '', sitio_web: '', linkedin: '', fecha_contacto: '', status_contacto: 'Primera reunión' })

  // Reuniones
  const [busqueda, setBusqueda] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [reuniones, setReuniones] = useState({}) // { [prospectoId]: [] }
  const [formReunion, setFormReunion] = useState(REUNION_VACIA)
  const [guardandoReunion, setGuardandoReunion] = useState(false)

  useEffect(() => {
    if (!perms.facultades.ventasVer) { setCargando(false); return }
    Promise.all([prospectoApi.list(), universoApi.pendientes()])
      .then(([d, u]) => {
        setLista(d.prospectos)
        setOpts({ statusReunion: d.statusReunion || STATUS_REUNION, tipos: d.tipos })
        setPendientes(u.pendientes)
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [perms.facultades.ventasVer])

  const f = (s) => setForm((p) => ({ ...p, ...s }))
  const ok = (m) => { setError(null); setAviso(m) }
  const fail = (e) => { setAviso(null); setError(e.message) }
  function salir() { logout(); navigate('/') }

  function seleccionarPendiente(p) {
    setUniversoId(p.id); setEditId(null)
    setForm({ ...VACIO, empresa: p.empresa, tipo: p.tipo || '', contacto_nombre: p.contacto_nombre || '', telefono: p.telefono || '', responsable: p.responsable || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function guardar(e) {
    e.preventDefault()
    try {
      if (editId) {
        const { prospecto } = await prospectoApi.update(editId, form)
        setLista((p) => p.map((r) => (r.id === editId ? { ...prospecto, num_reuniones: r.num_reuniones } : r)))
        ok('Prospecto actualizado.')
      } else {
        const { prospecto } = await prospectoApi.create({ ...form, universo_id: universoId })
        setLista((p) => [{ ...prospecto, num_reuniones: 0 }, ...p])
        if (universoId) {
          setPendientes((p) => p.filter((x) => x.id !== universoId))
          setUniversoId(null)
          ok('Prospecto agregado.')
        } else {
          setBaseParaUniverso({ empresa: form.empresa, tipo: form.tipo, contacto_nombre: form.contacto_nombre, telefono: form.telefono, responsable: form.responsable })
          setFormUni({ rubro: '', segmento: '', email: '', sitio_web: '', linkedin: '', fecha_contacto: '', status_contacto: 'Primera reunión' })
          ok('Prospecto agregado. Completa los datos de Universo o pasa de largo.')
        }
      }
      setForm(VACIO); setEditId(null)
    } catch (e) { fail(e) }
  }

  async function guardarEnUniverso(e) {
    e.preventDefault()
    try {
      await universoApi.crearOculto({ ...baseParaUniverso, ...formUni, etapa_pipeline: 'Prospecto' })
      setBaseParaUniverso(null); ok('Datos guardados en Universo.')
    } catch (err) { fail(err) }
  }

  function editar(r) {
    setEditId(r.id)
    setForm({ empresa: r.empresa, tipo: r.tipo || '', contacto_nombre: r.contacto_nombre || '', telefono: r.telefono || '', responsable: r.responsable || '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function eliminar(r) {
    if (!window.confirm(`¿Eliminar a ${r.empresa}?`)) return
    try { await prospectoApi.remove(r.id); setLista((p) => p.filter((x) => x.id !== r.id)); ok('Eliminado.') } catch (e) { fail(e) }
  }

  // ── Reuniones ──────────────────────────────────────────────────────────────

  async function toggleReuniones(prospectoId) {
    if (expandedId === prospectoId) { setExpandedId(null); return }
    setExpandedId(prospectoId)
    setFormReunion(REUNION_VACIA)
    if (!reuniones[prospectoId]) {
      try {
        const { reuniones: rows } = await reunionApi.list(prospectoId)
        setReuniones((p) => ({ ...p, [prospectoId]: rows }))
      } catch (e) { fail(e) }
    }
  }

  async function guardarReunion(prospectoId) {
    if (!formReunion.fecha) return
    setGuardandoReunion(true)
    try {
      const { reunion } = await reunionApi.add(prospectoId, formReunion)
      setReuniones((p) => ({ ...p, [prospectoId]: [...(p[prospectoId] || []), reunion] }))
      setLista((p) => p.map((r) => r.id === prospectoId ? { ...r, num_reuniones: Number(r.num_reuniones || 0) + 1 } : r))
      setFormReunion(REUNION_VACIA)
    } catch (e) { fail(e) } finally { setGuardandoReunion(false) }
  }

  async function eliminarReunion(prospectoId, reunionId) {
    try {
      await reunionApi.remove(prospectoId, reunionId)
      setReuniones((p) => ({ ...p, [prospectoId]: p[prospectoId].filter((r) => r.id !== reunionId) }))
      setLista((p) => p.map((r) => r.id === prospectoId ? { ...r, num_reuniones: Math.max(0, Number(r.num_reuniones || 0) - 1) } : r))
    } catch (e) { fail(e) }
  }

  async function importarExcel(e) {
    const archivo = e.target.files[0]
    if (inputArchivoRef.current) inputArchivoRef.current.value = ''
    if (!archivo) return
    try {
      const buffer = await archivo.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      if (filas.length === 0) return fail(new Error('El archivo no tiene datos.'))
      const registros = filas.map((fila) => {
        const reg = {}
        for (const [col, val] of Object.entries(fila)) {
          const campo = MAP_IMPORT[col.trim().toLowerCase()]
          if (!campo) continue
          reg[campo] = val instanceof Date ? val.toISOString().slice(0, 10) : String(val ?? '').trim()
        }
        return reg
      }).filter((r) => r.empresa)
      if (registros.length === 0) return fail(new Error('No se encontraron filas con empresa válida.'))
      const { importados } = await prospectoApi.importar(registros)
      const { prospectos } = await prospectoApi.list()
      setLista(prospectos); ok(`${importados} prospectos importados correctamente.`)
    } catch (err) { fail(err) }
  }

  if (!perms.facultades.ventasVer) {
    return (
      <div className="dashboard slds-scope"><div className="slds-container_large slds-container_center">
        <div className="dash-topbar"><Link to="/inicio" className="dash-back">← Inicio</Link></div>
        <div className="slds-box"><p>Sin acceso — facultad <b>ventasVer</b> requerida.</p></div>
      </div></div>
    )
  }

  const colSpanTotal = (canEdit || canDelete) ? 6 : 5

  return (
    <div className="dashboard slds-scope">
      <div className="slds-container_large slds-container_center">

        <div className="dash-topbar">
          <div>
            <Link to="/inicio" className="dash-back">← Inicio</Link>
            <h1 className="dash-greeting">Prospectos Activos</h1>
            <p className="dash-subtitle">Seguimiento de reuniones · Cuando piden cotización → marcar y pasan a Forecast</p>
          </div>
          <div className="slds-grid slds-grid_vertical-align-center" style={{ gap: 8 }}>
            {lista.length > 0 && <button className="slds-button slds-button_neutral" onClick={() => exportarExcel(lista)}>⬇ Exportar</button>}
            {canEdit && (<>
              <button className="slds-button slds-button_neutral" onClick={() => inputArchivoRef.current?.click()}>⬆ Importar</button>
              <input ref={inputArchivoRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={importarExcel} />
            </>)}
            <button className="slds-button slds-button_neutral" onClick={salir}>Cerrar sesión</button>
          </div>
        </div>

        {error && <div className="slds-text-color_error slds-m-bottom_small" role="alert">⚠️ {error}</div>}
        {aviso && <div className="slds-text-color_success slds-m-bottom_small" role="status">✅ {aviso}</div>}

        {/* Datos faltantes para Universo */}
        {baseParaUniverso && canEdit && (
          <div className="slds-box slds-m-bottom_medium" style={{ borderLeft: '4px solid #2563eb', background: '#eff6ff' }}>
            <div className="slds-grid slds-grid_align-spread slds-m-bottom_small">
              <div>
                <h3 className="slds-text-heading_small">Completar datos de Universo para <strong>{baseParaUniverso.empresa}</strong></h3>
                <p className="slds-text-body_small slds-text-color_weak">Todos opcionales.</p>
              </div>
              <button className="slds-button slds-button_neutral" onClick={() => setBaseParaUniverso(null)}>Omitir</button>
            </div>
            <form onSubmit={guardarEnUniverso}>
              <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end">
                <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4">
                  <label className="slds-form-element__label">Rubro / Sector</label>
                  <input className="slds-input" value={formUni.rubro} onChange={(e) => setFormUni((p) => ({ ...p, rubro: e.target.value }))} />
                </div>
                <div className="slds-col slds-grow-none" style={{ maxWidth: 130 }}>
                  <label className="slds-form-element__label">Segmento</label>
                  <div className="slds-select_container"><select className="slds-select" value={formUni.segmento} onChange={(e) => setFormUni((p) => ({ ...p, segmento: e.target.value }))}>
                    <option value="">—</option><option>Privado</option><option>Gob.</option>
                  </select></div>
                </div>
                <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4">
                  <label className="slds-form-element__label">Email</label>
                  <input className="slds-input" type="email" value={formUni.email} onChange={(e) => setFormUni((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4">
                  <label className="slds-form-element__label">Sitio Web</label>
                  <input className="slds-input" value={formUni.sitio_web} onChange={(e) => setFormUni((p) => ({ ...p, sitio_web: e.target.value }))} placeholder="empresa.com" />
                </div>
                <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4">
                  <label className="slds-form-element__label">LinkedIn</label>
                  <input className="slds-input" value={formUni.linkedin} onChange={(e) => setFormUni((p) => ({ ...p, linkedin: e.target.value }))} />
                </div>
                <div className="slds-col slds-grow-none" style={{ maxWidth: 160 }}>
                  <label className="slds-form-element__label">Fecha 1er contacto</label>
                  <input className="slds-input" type="date" value={formUni.fecha_contacto} onChange={(e) => setFormUni((p) => ({ ...p, fecha_contacto: e.target.value }))} />
                </div>
                <div className="slds-col slds-grow-none" style={{ maxWidth: 190 }}>
                  <label className="slds-form-element__label">Status contacto</label>
                  <div className="slds-select_container"><select className="slds-select" value={formUni.status_contacto} onChange={(e) => setFormUni((p) => ({ ...p, status_contacto: e.target.value }))}>
                    {['Sin contacto','Contactado','Siguientes pasos','Primera reunión','Ganado','Perdido'].map((s) => <option key={s}>{s}</option>)}
                  </select></div>
                </div>
                <div className="slds-col slds-grow-none">
                  <button className="slds-button slds-button_brand" type="submit">Guardar en Universo</button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Métricas */}
        <div className="slds-grid slds-wrap slds-gutters slds-m-bottom_medium">
          <div className="slds-col slds-size_1-of-3 slds-p-vertical_x-small">
            <div className="metric-card"><p className="metric-label">En proceso</p><p className="metric-value">{lista.length}</p></div>
          </div>
        </div>

        {/* Globo: pendientes de Universo */}
        {pendientes.length > 0 && (
          <div className="slds-box slds-m-bottom_medium" style={{ borderLeft: '4px solid #7c3aed', background: '#f5f0ff' }}>
            <div className="slds-grid slds-grid_align-spread slds-grid_vertical-align-center">
              <div className="slds-grid slds-grid_vertical-align-center" style={{ gap: 10 }}>
                <span style={{ background: '#7c3aed', color: '#fff', borderRadius: 999, padding: '2px 11px', fontWeight: 700, fontSize: '0.85rem' }}>{pendientes.length}</span>
                <strong>Nuevos prospectos de Universo</strong>
                <span className="slds-text-color_weak slds-text-body_small">— Selecciona uno para completar sus datos</span>
              </div>
              <button className="slds-button slds-button_neutral" onClick={() => setMostrarPendientes((v) => !v)}>{mostrarPendientes ? 'Ocultar ▲' : 'Ver ▼'}</button>
            </div>
            {mostrarPendientes && (
              <div className="slds-m-top_small" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {pendientes.map((p) => (
                  <button key={p.id} className="slds-button slds-button_neutral"
                    style={{ textAlign: 'left', borderColor: universoId === p.id ? '#7c3aed' : undefined, fontWeight: universoId === p.id ? 700 : undefined }}
                    onClick={() => seleccionarPendiente(p)}>
                    <strong>{p.empresa}</strong>{p.contacto_nombre && <> · {p.contacto_nombre}</>}{p.responsable && <> · {p.responsable}</>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Formulario */}
        {canEdit && (
          <div className="slds-box slds-theme_default slds-m-bottom_medium">
            <div className="slds-grid slds-grid_align-spread slds-m-bottom_small">
              <div>
                <h2 className="slds-text-heading_small">{editId ? 'Editar prospecto' : universoId ? 'Completar prospecto de Universo' : 'Nuevo prospecto activo'}</h2>
                {universoId && <p className="slds-text-body_small slds-text-color_weak slds-m-top_xx-small">Datos básicos precargados · da Agregar y luego agrega las reuniones desde la tabla</p>}
              </div>
              {(editId || universoId) && <button className="slds-button slds-button_neutral" onClick={() => { setForm(VACIO); setEditId(null); setUniversoId(null) }}>Cancelar</button>}
            </div>
            <form onSubmit={guardar}>
              <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end">
                <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-3">
                  <label className="slds-form-element__label">Empresa / Municipio *</label>
                  <input className="slds-input" value={form.empresa} onChange={(e) => f({ empresa: e.target.value })} required />
                </div>
                <div className="slds-col slds-grow-none" style={{ maxWidth: 130 }}>
                  <label className="slds-form-element__label">Tipo</label>
                  <div className="slds-select_container"><select className="slds-select" value={form.tipo} onChange={(e) => f({ tipo: e.target.value })}>
                    <option value="">—</option>{(opts.tipos || []).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select></div>
                </div>
                <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4">
                  <label className="slds-form-element__label">Contacto principal</label>
                  <input className="slds-input" value={form.contacto_nombre} onChange={(e) => f({ contacto_nombre: e.target.value })} />
                </div>
                <div className="slds-col slds-grow-none" style={{ maxWidth: 150 }}>
                  <label className="slds-form-element__label">Teléfono</label>
                  <input className="slds-input" value={form.telefono} onChange={(e) => f({ telefono: e.target.value })} />
                </div>
                <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4">
                  <label className="slds-form-element__label">Responsable LCG</label>
                  <input className="slds-input" value={form.responsable} onChange={(e) => f({ responsable: e.target.value })} />
                </div>
              </div>
              <div className="slds-grid slds-gutters slds-m-top_small slds-grid_vertical-align-center">
                <div>
                  <button className="slds-button slds-button_brand" type="submit">{editId ? 'Guardar' : 'Agregar'}</button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Buscador */}
        <div className="slds-m-bottom_small" style={{ maxWidth: 340 }}>
          <label className="slds-form-element__label">Buscar</label>
          <input className="slds-input" placeholder="Empresa, contacto, responsable…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>

        {/* Tabla */}
        <div className="slds-box slds-theme_default">
          {(() => {
            const q = busqueda.toLowerCase()
            const listaMostrada = busqueda
              ? lista.filter((r) => [r.empresa, r.tipo, r.contacto_nombre, r.telefono, r.responsable]
                  .some((v) => (v || '').toLowerCase().includes(q)))
              : lista
            return (
          <>
          <h2 className="slds-text-heading_small slds-m-bottom_small">Prospectos ({listaMostrada.length}{busqueda ? ` de ${lista.length}` : ''})</h2>
          {cargando ? <p className="slds-text-color_weak">Cargando…</p> : listaMostrada.length === 0 ? (
            <p className="slds-text-color_weak">{busqueda ? 'Sin resultados para esa búsqueda.' : 'Sin prospectos aún.'}</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="slds-table slds-table_bordered slds-table_cell-buffer">
                <thead>
                  <tr className="slds-line-height_reset">
                    <th>Empresa</th><th>Tipo</th><th>Contacto</th><th>Responsable</th>
                    <th>Reuniones</th>
                    {(canEdit || canDelete) && <th>Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {listaMostrada.map((r) => (
                    <>
                      <tr key={r.id}>
                        <td><strong>{r.empresa}</strong></td>
                        <td>{r.tipo || '—'}</td>
                        <td>{r.contacto_nombre || '—'}{r.telefono && <><br /><span className="slds-text-body_small">{r.telefono}</span></>}</td>
                        <td>{r.responsable || '—'}</td>
                        <td>
                          <button
                            className="slds-button slds-button_neutral"
                            style={{ fontSize: '0.8rem', padding: '3px 10px' }}
                            onClick={() => toggleReuniones(r.id)}>
                            {Number(r.num_reuniones || 0)} {Number(r.num_reuniones || 0) === 1 ? 'reunión' : 'reuniones'} {expandedId === r.id ? '▲' : '▼'}
                          </button>
                        </td>
                        {(canEdit || canDelete) && (
                          <td>
                            {canEdit && <><button className="slds-button slds-button_neutral" onClick={() => editar(r)}>Editar</button>{' '}</>}
                            {canDelete && <button className="slds-button slds-button_text-destructive" onClick={() => eliminar(r)}>Eliminar</button>}
                          </td>
                        )}
                      </tr>

                      {/* Sub-fila de reuniones */}
                      {expandedId === r.id && (
                        <tr key={`${r.id}-reuniones`}>
                          <td colSpan={colSpanTotal} style={{ background: '#f8fafc', padding: '14px 20px', borderTop: '1px solid #e5e7eb' }}>

                            {/* Lista de reuniones existentes */}
                            {!reuniones[r.id]
                              ? <p className="slds-text-color_weak slds-text-body_small">Cargando…</p>
                              : reuniones[r.id].length === 0
                                ? <p className="slds-text-color_weak slds-text-body_small slds-m-bottom_small">Sin reuniones registradas aún.</p>
                                : (
                                  <div style={{ marginBottom: 14 }}>
                                    {reuniones[r.id].map((re) => (
                                      <div key={re.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #e5e7eb', flexWrap: 'wrap' }}>
                                        <span style={{ minWidth: 90, fontWeight: 600, fontSize: '0.85rem', color: '#374151' }}>Reunión {re.numero}</span>
                                        <span style={{ fontSize: '0.85rem' }}>{re.fecha}</span>
                                        {re.status && (
                                          <span className="role-badge" style={{ background: STATUS_COLOR[re.status] || '#6b7280', color: '#fff', fontSize: '0.72rem' }}>{re.status}</span>
                                        )}
                                        <span style={{ flex: 1, color: '#4b5563', fontSize: '0.85rem' }}>{re.observaciones || ''}</span>
                                        {canDelete && (
                                          <button className="slds-button slds-button_text-destructive" style={{ fontSize: '0.78rem', padding: '2px 8px' }} onClick={() => eliminarReunion(r.id, re.id)}>Eliminar</button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}

                            {/* Form agregar reunión */}
                            {canEdit && (
                              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap', paddingTop: 8 }}>
                                <div>
                                  <label style={{ fontSize: '0.78rem', display: 'block', marginBottom: 2, color: '#374151' }}>Fecha *</label>
                                  <input type="date" className="slds-input" style={{ maxWidth: 150 }}
                                    value={formReunion.fecha} onChange={(e) => setFormReunion((p) => ({ ...p, fecha: e.target.value }))} />
                                </div>
                                <div>
                                  <label style={{ fontSize: '0.78rem', display: 'block', marginBottom: 2, color: '#374151' }}>Status</label>
                                  <div className="slds-select_container" style={{ maxWidth: 150 }}>
                                    <select className="slds-select" value={formReunion.status} onChange={(e) => setFormReunion((p) => ({ ...p, status: e.target.value }))}>
                                      <option value="">—</option>
                                      {STATUS_REUNION.map((s) => <option key={s}>{s}</option>)}
                                    </select>
                                  </div>
                                </div>
                                <div style={{ flex: 1, minWidth: 180 }}>
                                  <label style={{ fontSize: '0.78rem', display: 'block', marginBottom: 2, color: '#374151' }}>Observaciones</label>
                                  <input className="slds-input" value={formReunion.observaciones}
                                    onChange={(e) => setFormReunion((p) => ({ ...p, observaciones: e.target.value }))}
                                    placeholder="Resultado, acuerdos…" />
                                </div>
                                <button className="slds-button slds-button_brand" style={{ whiteSpace: 'nowrap' }}
                                  onClick={() => guardarReunion(r.id)}
                                  disabled={!formReunion.fecha || guardandoReunion}>
                                  + Agregar reunión
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </>
            )
          })()}
        </div>
      </div>
    </div>
  )
}
