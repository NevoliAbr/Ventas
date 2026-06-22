// Universo de prospectos: lista de todas las empresas/municipios potenciales.
// Flujo: Sin contacto → Contactado → Siguientes pasos → Primera reunión → (pasa a Prospectos)
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { useAuth } from '../context/AuthContext.jsx'
import { permissionsFor } from '../lib/permissions.js'
import { universoApi } from '../services/api.js'

const COLUMNAS_PLANTILLA = [
  'Empresa / Municipio', 'Rubro / Sector', 'Segmento', 'Tipo',
  'Nombre Contacto', 'Email', 'Teléfono', 'Sitio Web', 'LinkedIn',
  'Responsable LCG', 'Fecha 1er Contacto', 'Status Contacto', 'Etapa Pipeline',
]
const MAP_COLUMNAS = {
  'empresa / municipio': 'empresa', 'rubro / sector': 'rubro', 'segmento': 'segmento',
  'tipo': 'tipo', 'nombre contacto': 'contacto_nombre', 'email': 'email',
  'teléfono': 'telefono', 'sitio web': 'sitio_web', 'linkedin': 'linkedin',
  'responsable lcg': 'responsable', 'fecha 1er contacto': 'fecha_contacto',
  'status contacto': 'status_contacto', 'etapa pipeline': 'etapa_pipeline',
}

function exportarExcel(lista) {
  const filas = lista.map((r) => ({
    'Empresa / Municipio': r.empresa,
    'Rubro / Sector': r.rubro || '',
    'Segmento': r.segmento || '',
    'Tipo': r.tipo || '',
    'Nombre Contacto': r.contacto_nombre || '',
    'Email': r.email || '',
    'Teléfono': r.telefono || '',
    'Sitio Web': r.sitio_web || '',
    'LinkedIn': r.linkedin || '',
    'Responsable LCG': r.responsable || '',
    'Fecha 1er Contacto': r.fecha_contacto || '',
    'Status Contacto': r.status_contacto || '',
    'Etapa Pipeline': r.etapa_pipeline || '',
  }))
  const ws = XLSX.utils.json_to_sheet(filas)
  ws['!cols'] = COLUMNAS_PLANTILLA.map((c) => ({ wch: Math.max(c.length + 4, 18) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Universo')
  XLSX.writeFile(wb, `universo_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

const waLink = (tel) => {
  const digits = tel.replace(/\D/g, '')
  const num = digits.length === 10 ? `52${digits}` : digits
  return `https://wa.me/${num}`
}

const STATUS_COLORS = {
  'Sin contacto': '#6b7280',
  'Contactado': '#2563eb',
  'Siguientes pasos': '#d97706',
  'Primera reunión': '#7c3aed',
  'Ganado': '#16a34a',
  'Perdido': '#dc2626',
}

const VACIO = {
  empresa: '', rubro: '', segmento: '', contacto_nombre: '', email: '', telefono: '',
  sitio_web: '', linkedin: '', tipo: '', responsable: '', fecha_contacto: '',
  status_contacto: 'Sin contacto', etapa_pipeline: 'Universo',
}

export default function Universo() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const perms = permissionsFor(user)
  const canEdit = perms.facultades.ventasModificar
  const canDelete = perms.facultades.ventasEliminar

  const [lista, setLista] = useState([])
  const [opts, setOpts] = useState({ statusOptions: [], etapasOptions: [], tipos: [], segmentos: [] })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [form, setForm] = useState(VACIO)
  const [editId, setEditId] = useState(null)
  const [filtroStatus, setFiltroStatus] = useState('')
  const [filtroEtapa, setFiltroEtapa] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const inputArchivoRef = useRef(null)

  useEffect(() => {
    if (!perms.facultades.ventasVer) { setCargando(false); return }
    universoApi.list()
      .then((d) => { setLista(d.universo); setOpts({ statusOptions: d.statusOptions, etapasOptions: d.etapasOptions, tipos: d.tipos, segmentos: d.segmentos }) })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [perms.facultades.ventasVer])

  const f = (s) => setForm((p) => ({ ...p, ...s }))
  const ok = (m) => { setError(null); setAviso(m) }
  const fail = (e) => { setAviso(null); setError(e.message) }
  function salir() { logout(); navigate('/') }

  const listaMostrada = lista.filter((r) => {
    if (filtroStatus && r.status_contacto !== filtroStatus) return false
    if (filtroEtapa && r.etapa_pipeline !== filtroEtapa) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return [r.empresa, r.rubro, r.segmento, r.contacto_nombre, r.email, r.telefono, r.responsable]
        .some((v) => (v || '').toLowerCase().includes(q))
    }
    return true
  })

  async function guardar(e) {
    e.preventDefault()
    try {
      if (editId) {
        const { prospecto } = await universoApi.update(editId, form)
        if (form.etapa_pipeline === 'Prospecto') {
          setLista((p) => p.filter((r) => r.id !== editId))
          ok(`${form.empresa} quedó pendiente en Prospectos — ábrelo para completar los datos.`)
        } else {
          setLista((p) => p.map((r) => (r.id === editId ? prospecto : r)))
          ok('Prospecto actualizado.')
        }
      } else {
        const { prospecto } = await universoApi.create(form)
        setLista((p) => [prospecto, ...p])
        ok('Prospecto agregado.')
      }
      setForm(VACIO); setEditId(null)
    } catch (e) { fail(e) }
  }

  function editar(r) {
    setEditId(r.id)
    setForm({
      empresa: r.empresa, rubro: r.rubro || '', segmento: r.segmento || '',
      contacto_nombre: r.contacto_nombre || '', email: r.email || '', telefono: r.telefono || '',
      sitio_web: r.sitio_web || '', linkedin: r.linkedin || '', tipo: r.tipo || '',
      responsable: r.responsable || '', fecha_contacto: r.fecha_contacto || '',
      status_contacto: r.status_contacto || 'Sin contacto', etapa_pipeline: r.etapa_pipeline || 'Universo',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function importarExcel(e) {
    const archivo = e.target.files[0]
    if (!inputArchivoRef.current) return
    inputArchivoRef.current.value = ''
    if (!archivo) return
    try {
      const buffer = await archivo.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const filas = XLSX.utils.sheet_to_json(ws, { defval: '' })
      if (filas.length === 0) return fail(new Error('El archivo no tiene datos.'))
      const registros = filas.map((fila) => {
        const reg = {}
        for (const [col, val] of Object.entries(fila)) {
          const campo = MAP_COLUMNAS[col.trim().toLowerCase()]
          if (campo) reg[campo] = val instanceof Date
            ? val.toISOString().slice(0, 10)
            : String(val ?? '').trim()
        }
        return reg
      }).filter((r) => r.empresa)
      if (registros.length === 0) return fail(new Error('No se encontraron filas con empresa válida.'))
      const { importados } = await universoApi.importar(registros)
      const nuevos = await universoApi.list()
      setLista(nuevos.universo)
      ok(`${importados} registros importados correctamente.`)
    } catch (err) { fail(err) }
  }

  async function eliminar(r) {
    if (!window.confirm(`¿Eliminar a ${r.empresa}?`)) return
    try { await universoApi.remove(r.id); setLista((p) => p.filter((x) => x.id !== r.id)); ok('Eliminado.') } catch (e) { fail(e) }
  }

  if (!perms.facultades.ventasVer) {
    return (
      <div className="dashboard slds-scope"><div className="slds-container_large slds-container_center">
        <div className="dash-topbar"><Link to="/inicio" className="dash-back">← Inicio</Link></div>
        <div className="slds-box"><p>Sin acceso — facultad <b>ventasVer</b> requerida.</p></div>
      </div></div>
    )
  }

  return (
    <div className="dashboard slds-scope">
      <div className="slds-container_large slds-container_center">

        <div className="dash-topbar">
          <div>
            <Link to="/inicio" className="dash-back">← Inicio</Link>
            <h1 className="dash-greeting">Universo de Prospectos</h1>
            <p className="dash-subtitle">Registra todas las empresas y municipios potenciales · Avanza su status hasta Primera reunión → pasa a Prospectos</p>
          </div>
          <div className="slds-grid slds-grid_vertical-align-center" style={{ gap: 8 }}>
            {lista.length > 0 && (
              <button className="slds-button slds-button_neutral" onClick={() => exportarExcel(listaMostrada)}>⬇ Exportar</button>
            )}
            {canEdit && (<>
              <button className="slds-button slds-button_neutral" onClick={() => inputArchivoRef.current?.click()}>⬆ Importar</button>
              <input ref={inputArchivoRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={importarExcel} />
            </>)}
            <button className="slds-button slds-button_neutral" onClick={salir}>Cerrar sesión</button>
          </div>
        </div>

        {error && <div className="slds-text-color_error slds-m-bottom_small" role="alert">⚠️ {error}</div>}
        {aviso && <div className="slds-text-color_success slds-m-bottom_small" role="status">✅ {aviso}</div>}

        {/* Métricas rápidas */}
        <div className="slds-grid slds-wrap slds-gutters slds-m-bottom_medium">
          {(opts.statusOptions || []).map((s) => (
            <div key={s} className="slds-col slds-size_1-of-3 slds-medium-size_1-of-6 slds-p-vertical_x-small">
              <div className="metric-card" style={{ borderTop: `3px solid ${STATUS_COLORS[s] || '#ccc'}` }}>
                <p className="metric-label" style={{ fontSize: '0.72rem' }}>{s}</p>
                <p className="metric-value">{lista.filter((r) => r.status_contacto === s).length}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Formulario */}
        {canEdit && (
          <div className="slds-box slds-theme_default slds-m-bottom_medium">
            <div className="slds-grid slds-grid_align-spread slds-m-bottom_small">
              <h2 className="slds-text-heading_small">{editId ? 'Editar prospecto' : 'Agregar al universo'}</h2>
              {editId && <button className="slds-button slds-button_neutral" onClick={() => { setForm(VACIO); setEditId(null) }}>Cancelar</button>}
            </div>
            <form onSubmit={guardar}>
              <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end">
                <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-3">
                  <label className="slds-form-element__label">Empresa / Municipio *</label>
                  <input className="slds-input" value={form.empresa} onChange={(e) => f({ empresa: e.target.value })} required />
                </div>
                <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4">
                  <label className="slds-form-element__label">Rubro / Sector</label>
                  <input className="slds-input" value={form.rubro} onChange={(e) => f({ rubro: e.target.value })} placeholder="Logística…" />
                </div>
                <div className="slds-col slds-grow-none" style={{ maxWidth: 130 }}>
                  <label className="slds-form-element__label">Segmento</label>
                  <div className="slds-select_container"><select className="slds-select" value={form.segmento} onChange={(e) => f({ segmento: e.target.value })}>
                    <option value="">—</option>{(opts.segmentos || []).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select></div>
                </div>
                <div className="slds-col slds-grow-none" style={{ maxWidth: 130 }}>
                  <label className="slds-form-element__label">Tipo</label>
                  <div className="slds-select_container"><select className="slds-select" value={form.tipo} onChange={(e) => f({ tipo: e.target.value })}>
                    <option value="">—</option>{(opts.tipos || []).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select></div>
                </div>
              </div>
              <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end slds-m-top_x-small">
                <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4">
                  <label className="slds-form-element__label">Nombre contacto</label>
                  <input className="slds-input" value={form.contacto_nombre} onChange={(e) => f({ contacto_nombre: e.target.value })} />
                </div>
                <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4">
                  <label className="slds-form-element__label">Email</label>
                  <input className="slds-input" type="email" value={form.email} onChange={(e) => f({ email: e.target.value })} />
                </div>
                <div className="slds-col slds-grow-none" style={{ maxWidth: 150 }}>
                  <label className="slds-form-element__label">Teléfono</label>
                  <input className="slds-input" value={form.telefono} onChange={(e) => f({ telefono: e.target.value })} />
                </div>
                <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4">
                  <label className="slds-form-element__label">Sitio web</label>
                  <input className="slds-input" value={form.sitio_web} onChange={(e) => f({ sitio_web: e.target.value })} placeholder="empresa.com" />
                </div>
                <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4">
                  <label className="slds-form-element__label">Responsable LCG</label>
                  <input className="slds-input" value={form.responsable} onChange={(e) => f({ responsable: e.target.value })} />
                </div>
                <div className="slds-col slds-grow-none" style={{ maxWidth: 150 }}>
                  <label className="slds-form-element__label">Fecha 1er contacto</label>
                  <input className="slds-input" type="date" value={form.fecha_contacto} onChange={(e) => f({ fecha_contacto: e.target.value })} />
                </div>
                <div className="slds-col slds-grow-none" style={{ maxWidth: 170 }}>
                  <label className="slds-form-element__label">Status</label>
                  <div className="slds-select_container"><select className="slds-select" value={form.status_contacto} onChange={(e) => f({ status_contacto: e.target.value })}>
                    {(opts.statusOptions || []).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select></div>
                </div>
                <div className="slds-col slds-grow-none" style={{ maxWidth: 180 }}>
                  <label className="slds-form-element__label">Etapa Pipeline</label>
                  <div className="slds-select_container"><select className="slds-select" value={form.etapa_pipeline} onChange={(e) => f({ etapa_pipeline: e.target.value })}>
                    {(opts.etapasOptions || []).map((e) => <option key={e} value={e}>{e}</option>)}
                  </select></div>
                </div>
                <div className="slds-col slds-grow-none">
                  <button className="slds-button slds-button_brand" type="submit">{editId ? 'Guardar' : 'Agregar'}</button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Filtros */}
        <div className="slds-grid slds-gutters slds-m-bottom_small" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="slds-col" style={{ minWidth: 220, maxWidth: 320 }}>
            <label className="slds-form-element__label">Buscar</label>
            <input className="slds-input" placeholder="Empresa, contacto, email…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 180 }}>
            <label className="slds-form-element__label">Status</label>
            <div className="slds-select_container"><select className="slds-select" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos</option>{(opts.statusOptions || []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select></div>
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 180 }}>
            <label className="slds-form-element__label">Etapa</label>
            <div className="slds-select_container"><select className="slds-select" value={filtroEtapa} onChange={(e) => setFiltroEtapa(e.target.value)}>
              <option value="">Todas</option>{(opts.etapasOptions || []).map((e) => <option key={e} value={e}>{e}</option>)}
            </select></div>
          </div>
          <div className="slds-col slds-grid slds-grid_vertical-align-end">
            <span className="slds-text-color_weak slds-text-body_small">{listaMostrada.length} de {lista.length} prospectos</span>
          </div>
        </div>

        {/* Tabla */}
        <div className="slds-box slds-theme_default">
          {cargando ? <p className="slds-text-color_weak">Cargando…</p> : listaMostrada.length === 0 ? (
            <p className="slds-text-color_weak">Sin prospectos {filtroStatus || filtroEtapa ? 'con ese filtro' : 'aún'}.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="slds-table slds-table_bordered slds-table_cell-buffer">
                <thead><tr className="slds-line-height_reset">
                  <th>Empresa</th><th>Rubro</th><th>Seg.</th><th>Contacto</th><th>Teléfono</th>
                  <th>Responsable</th><th>1er contacto</th><th>Status</th><th>Etapa</th>
                  {(canEdit || canDelete) && <th>Acciones</th>}
                </tr></thead>
                <tbody>
                  {listaMostrada.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.empresa}</strong>
                        {r.sitio_web && <><br /><a href={r.sitio_web.startsWith('http') ? r.sitio_web : `https://${r.sitio_web}`} target="_blank" rel="noreferrer" className="slds-text-body_small">{r.sitio_web}</a></>}
                      </td>
                      <td>{r.rubro || '—'}</td>
                      <td>{r.segmento || '—'}</td>
                      <td>
                        {r.contacto_nombre || '—'}
                        {r.email && <><br /><a href={`mailto:${r.email}`} className="slds-text-body_small">{r.email}</a></>}
                      </td>
                      <td>
                        {r.telefono
                          ? <a href={waLink(r.telefono)} target="_blank" rel="noreferrer">{r.telefono}</a>
                          : '—'}
                      </td>
                      <td>{r.responsable || '—'}</td>
                      <td>{r.fecha_contacto || '—'}</td>
                      <td><span className="role-badge" style={{ background: STATUS_COLORS[r.status_contacto] || '#6b7280', color: '#fff', fontSize: '0.72rem' }}>{r.status_contacto}</span></td>
                      <td>{r.etapa_pipeline || '—'}</td>
                      {(canEdit || canDelete) && <td>
                        {canEdit && <><button className="slds-button slds-button_neutral" onClick={() => editar(r)}>Editar</button>{' '}</>}
                        {canDelete && <button className="slds-button slds-button_text-destructive" onClick={() => eliminar(r)}>Eliminar</button>}
                      </td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
