// Universo de prospectos: lista de todas las empresas/municipios potenciales.
// Flujo: Sin contactar → Contactado → Siguientes pasos → Primera reunión → (pasa a Prospectos)
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { useAuth } from '../context/AuthContext.jsx'
import { permissionsFor } from '../lib/permissions.js'
import { catalogoApi, universoApi } from '../services/api.js'

const COLUMNAS_PLANTILLA = [
  'Empresa / Municipio', 'Rubro / Sector', 'Segmento', 'Tipo',
  'Nombre Contacto', 'Email', 'Teléfono 1', 'Teléfono 2', 'Sitio Web', 'LinkedIn',
  'Responsable LCG', 'Fecha 1er Contacto', 'Status', 'Etapa Pipeline', 'Observaciones',
]
const MAP_COLUMNAS = {
  'empresa / municipio': 'empresa', 'rubro / sector': 'rubro', 'segmento': 'segmento',
  'tipo': 'tipo', 'nombre contacto': 'contacto_nombre', 'email': 'email',
  'teléfono 1': 'telefono', 'teléfono': 'telefono', 'teléfono 2': 'telefono2',
  'sitio web': 'sitio_web', 'linkedin': 'linkedin',
  'responsable lcg': 'responsable', 'fecha 1er contacto': 'fecha_contacto',
  'status': 'status_contacto', 'status contacto': 'status_contacto', 'etapa pipeline': 'etapa_pipeline',
  'observaciones': 'observaciones',
}

function exportarExcel(lista) {
  const filas = lista.map((r) => ({
    'Empresa / Municipio': r.empresa,
    'Rubro / Sector': r.rubro || '',
    'Segmento': r.segmento || '',
    'Tipo': r.tipo || '',
    'Nombre Contacto': r.contacto_nombre || '',
    'Email': r.email || '',
    'Teléfono 1': r.telefono || '',
    'Teléfono 2': r.telefono2 || '',
    'Sitio Web': r.sitio_web || '',
    'LinkedIn': r.linkedin || '',
    'Responsable LCG': r.responsable || '',
    'Fecha 1er Contacto': r.fecha_contacto || '',
    'Status': r.status_contacto || '',
    'Etapa Pipeline': r.etapa_pipeline || '',
    'Observaciones': r.observaciones || '',
  }))
  const ws = XLSX.utils.json_to_sheet(filas)
  ws['!cols'] = COLUMNAS_PLANTILLA.map((c) => ({ wch: Math.max(c.length + 4, 18) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Universo')
  XLSX.writeFile(wb, `universo_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function descargarPlantilla() {
  const ws = XLSX.utils.aoa_to_sheet([COLUMNAS_PLANTILLA])
  ws['!cols'] = COLUMNAS_PLANTILLA.map((c) => ({ wch: Math.max(c.length + 4, 18) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Universo')
  XLSX.writeFile(wb, 'plantilla_universo.xlsx')
}

const waLink = (tel) => {
  const digits = tel.replace(/\D/g, '')
  const num = digits.length === 10 ? `52${digits}` : digits
  return `https://wa.me/${num}`
}

const STATUS_COLORS = {
  'Sin contactar': '#6b7280',
  'Contactado': '#2563eb',
  'Siguientes pasos': '#d97706',
  'Primera reunión': '#7c3aed',
  'Ganado': '#16a34a',
  'Perdido': '#dc2626',
}

const VACIO = {
  empresa: '', rubro: '', segmento: '', contacto_nombre: '', email: '', telefono: '', telefono2: '',
  sitio_web: '', linkedin: '', tipo: '', responsable: '', fecha_contacto: '',
  status_contacto: 'Sin contactar', etapa_pipeline: 'Universo', observaciones: '',
}

export default function Universo() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const perms = permissionsFor(user)
  const canEdit = perms.facultades.ventasModificar
  const canDelete = perms.facultades.ventasEliminar

  const [lista, setLista] = useState([])
  const [opts, setOpts] = useState({ statusOptions: [], etapasOptions: [], tipos: [], segmentos: [], responsables: [], rubros: [] })
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
    Promise.all([universoApi.list(), catalogoApi.listRubros()])
      .then(([d, r]) => {
        setLista(d.universo)
        setOpts({ statusOptions: d.statusOptions, etapasOptions: d.etapasOptions, tipos: d.tipos, segmentos: d.segmentos, responsables: d.responsables, rubros: r.rubros })
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [perms.facultades.ventasVer])

  const f = (s) => setForm((p) => ({ ...p, ...s }))
  const ok = (m) => { setError(null); setAviso(m) }
  const fail = (e) => { setAviso(null); setError(e.message) }
  function salir() { logout(); navigate('/') }

  async function agregarRubro(nombre) {
    const { rubro } = await catalogoApi.crearRubro(nombre)
    setOpts((p) => ({
      ...p,
      rubros: [...p.rubros.filter((r) => r.id !== rubro.id), rubro].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    }))
    return rubro
  }

  async function renombrarRubro(id, nombre) {
    const { rubro } = await catalogoApi.actualizarRubro(id, nombre)
    setOpts((p) => ({
      ...p,
      rubros: p.rubros.map((r) => (r.id === id ? rubro : r)).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    }))
    return rubro
  }

  async function eliminarRubro(id) {
    await catalogoApi.eliminarRubro(id)
    setOpts((p) => ({ ...p, rubros: p.rubros.filter((r) => r.id !== id) }))
  }

  const listaMostrada = lista.filter((r) => {
    if (filtroStatus && r.status_contacto !== filtroStatus) return false
    if (filtroEtapa && r.etapa_pipeline !== filtroEtapa) return false
    if (busqueda) {
      const q = busqueda.toLowerCase()
      return [r.empresa, r.rubro, r.segmento, r.contacto_nombre, r.email, r.telefono, r.telefono2, r.responsable]
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
      contacto_nombre: r.contacto_nombre || '', email: r.email || '', telefono: r.telefono || '', telefono2: r.telefono2 || '',
      sitio_web: r.sitio_web || '', linkedin: r.linkedin || '', tipo: r.tipo || '',
      responsable: r.responsable || '', fecha_contacto: r.fecha_contacto || '',
      status_contacto: r.status_contacto || 'Sin contactar', etapa_pipeline: r.etapa_pipeline || 'Universo',
      observaciones: r.observaciones || '',
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
      const registros = filas.reduce((acc, fila) => {
        const reg = {}
        for (const [col, val] of Object.entries(fila)) {
          const campo = MAP_COLUMNAS[col.trim().toLowerCase()]
          if (campo) reg[campo] = val instanceof Date
            ? val.toISOString().slice(0, 10)
            : String(val ?? '').trim()
        }
        if (reg.empresa) acc.push(reg)
        return acc
      }, [])
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
              <button type="button" className="slds-button slds-button_neutral" onClick={() => exportarExcel(listaMostrada)}>⬇ Exportar</button>
            )}
            {canEdit && (<>
              <button type="button" className="slds-button slds-button_neutral" onClick={descargarPlantilla}>📄 Plantilla</button>
              <button type="button" className="slds-button slds-button_neutral" onClick={() => inputArchivoRef.current?.click()}>⬆ Importar</button>
              <input ref={inputArchivoRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={importarExcel} />
            </>)}
            <button type="button" className="slds-button slds-button_neutral" onClick={salir}>Cerrar sesión</button>
          </div>
        </div>

        {error && <div className="slds-text-color_error slds-m-bottom_small" role="alert">⚠️ {error}</div>}
        {aviso && <div className="slds-text-color_success slds-m-bottom_small" role="status">✅ {aviso}</div>}

        <UniversoMetricas lista={lista} opts={opts} />

        {canEdit && (
          <UniversoFormulario
            form={form} f={f} opts={opts} editId={editId}
            onSubmit={guardar} onAgregarRubro={agregarRubro}
            onRenombrarRubro={renombrarRubro} onEliminarRubro={eliminarRubro}
            onCancelar={() => { setForm(VACIO); setEditId(null) }}
          />
        )}

        <UniversoFiltros
          busqueda={busqueda} setBusqueda={setBusqueda}
          filtroStatus={filtroStatus} setFiltroStatus={setFiltroStatus}
          filtroEtapa={filtroEtapa} setFiltroEtapa={setFiltroEtapa}
          opts={opts} total={lista.length} mostrados={listaMostrada.length}
        />

        <UniversoTabla
          listaMostrada={listaMostrada} cargando={cargando}
          filtroStatus={filtroStatus} filtroEtapa={filtroEtapa}
          canEdit={canEdit} canDelete={canDelete}
          onEditar={editar} onEliminar={eliminar}
        />
      </div>
    </div>
  )
}

function UniversoMetricas({ lista, opts }) {
  return (
    <div className="slds-grid slds-wrap slds-gutters slds-m-bottom_medium" style={{ alignItems: 'stretch' }}>
      {(opts.statusOptions || []).map((s) => (
        <div key={s} className="slds-col slds-size_1-of-3 slds-medium-size_1-of-6 slds-p-vertical_x-small">
          <div className="metric-card" style={{ borderTop: `3px solid ${STATUS_COLORS[s] || '#ccc'}` }}>
            <p className="metric-label" style={{ fontSize: '0.875rem' }}>{s}</p>
            <p className="metric-value">{lista.filter((r) => r.status_contacto === s).length}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function RubroCombo({ id, value, onChange, opciones, onAgregar, onRenombrar, onEliminar }) {
  const [modoNuevo, setModoNuevo] = useState(false)
  const [nuevo, setNuevo] = useState('')
  const [modoAdmin, setModoAdmin] = useState(false)

  async function confirmar() {
    const v = nuevo.trim()
    if (!v) return
    const rubro = await onAgregar(v)
    onChange(rubro.nombre)
    setModoNuevo(false); setNuevo('')
  }

  if (modoNuevo) {
    return (
      <div className="slds-grid slds-grid_vertical-align-center" style={{ gap: 4 }}>
        <input
          id={id} className="slds-input" value={nuevo} autoFocus placeholder="Nuevo rubro/sector"
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmar() } }}
        />
        <button type="button" className="slds-button slds-button_brand" onClick={confirmar}>Agregar</button>
        <button type="button" className="slds-button slds-button_neutral" onClick={() => { setModoNuevo(false); setNuevo('') }}>×</button>
      </div>
    )
  }

  const opcionesMostradas = value && !opciones.some((r) => r.nombre === value)
    ? [{ id: '__actual__', nombre: value }, ...opciones]
    : opciones

  return (
    <div>
      <div className="slds-select_container">
        <select
          id={id} className="slds-select" value={value}
          onChange={(e) => { if (e.target.value === '__nuevo__') setModoNuevo(true); else onChange(e.target.value) }}
        >
          <option value="">—</option>
          {opcionesMostradas.map((r) => <option key={r.id} value={r.nombre}>{r.nombre}</option>)}
          <option value="__nuevo__">+ Agregar nuevo…</option>
        </select>
      </div>
      <button
        type="button" className="slds-button slds-button_neutral"
        style={{ fontSize: '0.75rem', padding: '2px 0', marginTop: 2 }}
        onClick={() => setModoAdmin((v) => !v)}
      >
        {modoAdmin ? 'Ocultar lista ▲' : 'Editar / eliminar rubros ▼'}
      </button>
      {modoAdmin && (
        <div className="slds-box slds-m-top_x-small" style={{ padding: 8 }}>
          {opciones.length === 0 && <p className="slds-text-color_weak slds-text-body_small">Sin rubros guardados.</p>}
          {opciones.map((r) => (
            <RubroAdminFila
              key={r.id} rubro={r}
              onRenombrar={async (nuevoNombre) => {
                const actualizado = await onRenombrar(r.id, nuevoNombre)
                if (r.nombre === value) onChange(actualizado.nombre)
              }}
              onEliminar={async () => {
                if (!window.confirm(`¿Eliminar el rubro "${r.nombre}"?`)) return
                await onEliminar(r.id)
                if (r.nombre === value) onChange('')
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RubroAdminFila({ rubro, onRenombrar, onEliminar }) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState(rubro.nombre)

  async function guardar() {
    const v = texto.trim()
    if (!v) return
    await onRenombrar(v)
    setEditando(false)
  }

  return (
    <div className="slds-grid slds-grid_vertical-align-center" style={{ gap: 6, padding: '3px 0' }}>
      {editando ? (
        <>
          <input
            className="slds-input" style={{ flex: 1 }} value={texto} autoFocus
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); guardar() } }}
          />
          <button type="button" className="slds-button slds-button_brand" onClick={guardar}>Guardar</button>
          <button type="button" className="slds-button slds-button_neutral" onClick={() => { setEditando(false); setTexto(rubro.nombre) }}>Cancelar</button>
        </>
      ) : (
        <>
          <span style={{ flex: 1 }}>{rubro.nombre}</span>
          <button type="button" className="slds-button slds-button_neutral" onClick={() => setEditando(true)}>Editar</button>
          <button type="button" className="slds-button slds-button_text-destructive" onClick={onEliminar}>Eliminar</button>
        </>
      )}
    </div>
  )
}

function UniversoFormulario({ form, f, opts, editId, onSubmit, onAgregarRubro, onRenombrarRubro, onEliminarRubro, onCancelar }) {
  return (
    <div className="slds-box slds-theme_default slds-m-bottom_medium">
      <div className="slds-grid slds-grid_align-spread slds-m-bottom_small">
        <h2 className="slds-text-heading_small">{editId ? 'Editar prospecto' : 'Agregar al universo'}</h2>
        {editId && <button type="button" className="slds-button slds-button_neutral" onClick={onCancelar}>Cancelar</button>}
      </div>
      <form onSubmit={onSubmit}>
        <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end">
          <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-3">
            <label className="slds-form-element__label" htmlFor="universo-empresa">Empresa / Municipio *</label>
            <input id="universo-empresa" className="slds-input" value={form.empresa} onChange={(e) => f({ empresa: e.target.value })} required />
          </div>
          <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4">
            <label className="slds-form-element__label" htmlFor="universo-rubro">Rubro / Sector</label>
            <RubroCombo
              id="universo-rubro" value={form.rubro} onChange={(v) => f({ rubro: v })} opciones={opts.rubros || []}
              onAgregar={onAgregarRubro} onRenombrar={onRenombrarRubro} onEliminar={onEliminarRubro}
            />
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 130 }}>
            <label className="slds-form-element__label" htmlFor="universo-segmento">Segmento</label>
            <div className="slds-select_container"><select id="universo-segmento" className="slds-select" value={form.segmento} onChange={(e) => f({ segmento: e.target.value })}>
              <option value="">—</option>{(opts.segmentos || []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select></div>
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 130 }}>
            <label className="slds-form-element__label" htmlFor="universo-tipo">Tipo</label>
            <div className="slds-select_container"><select id="universo-tipo" className="slds-select" value={form.tipo} onChange={(e) => f({ tipo: e.target.value })}>
              <option value="">—</option>{(opts.tipos || []).map((t) => <option key={t} value={t}>{t}</option>)}
            </select></div>
          </div>
        </div>
        <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end slds-m-top_x-small">
          <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4">
            <label className="slds-form-element__label" htmlFor="universo-contacto-nombre">Nombre contacto</label>
            <input id="universo-contacto-nombre" className="slds-input" value={form.contacto_nombre} onChange={(e) => f({ contacto_nombre: e.target.value })} />
          </div>
          <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4">
            <label className="slds-form-element__label" htmlFor="universo-email">Email</label>
            <input id="universo-email" className="slds-input" type="email" value={form.email} onChange={(e) => f({ email: e.target.value })} />
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 150 }}>
            <label className="slds-form-element__label" htmlFor="universo-telefono">Teléfono 1</label>
            <input id="universo-telefono" className="slds-input" value={form.telefono} onChange={(e) => f({ telefono: e.target.value })} />
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 150 }}>
            <label className="slds-form-element__label" htmlFor="universo-telefono2">Teléfono 2</label>
            <input id="universo-telefono2" className="slds-input" value={form.telefono2} onChange={(e) => f({ telefono2: e.target.value })} />
          </div>
          <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4">
            <label className="slds-form-element__label" htmlFor="universo-sitio-web">Sitio web</label>
            <input id="universo-sitio-web" className="slds-input" value={form.sitio_web} onChange={(e) => f({ sitio_web: e.target.value })} placeholder="empresa.com" />
          </div>
          <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4">
            <label className="slds-form-element__label" htmlFor="universo-responsable">Responsable LCG</label>
            <div className="slds-select_container"><select id="universo-responsable" className="slds-select" value={form.responsable} onChange={(e) => f({ responsable: e.target.value })}>
              <option value="">—</option>{(opts.responsables || []).map((r) => <option key={r} value={r}>{r}</option>)}
            </select></div>
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 150 }}>
            <label className="slds-form-element__label" htmlFor="universo-fecha-contacto">Fecha 1er contacto</label>
            <input id="universo-fecha-contacto" className="slds-input" type="date" value={form.fecha_contacto} onChange={(e) => f({ fecha_contacto: e.target.value })} />
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 170 }}>
            <label className="slds-form-element__label" htmlFor="universo-status-contacto">Status</label>
            <div className="slds-select_container"><select id="universo-status-contacto" className="slds-select" value={form.status_contacto} onChange={(e) => f({ status_contacto: e.target.value })}>
              {(opts.statusOptions || []).map((s) => <option key={s} value={s}>{s}</option>)}
            </select></div>
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 180 }}>
            <label className="slds-form-element__label" htmlFor="universo-etapa-pipeline">Etapa Pipeline</label>
            <div className="slds-select_container"><select id="universo-etapa-pipeline" className="slds-select" value={form.etapa_pipeline} onChange={(e) => f({ etapa_pipeline: e.target.value })}>
              {(opts.etapasOptions || []).map((e) => <option key={e} value={e}>{e}</option>)}
            </select></div>
          </div>
        </div>
        <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end slds-m-top_x-small">
          <div className="slds-col">
            <label className="slds-form-element__label" htmlFor="universo-observaciones">Observaciones</label>
            <textarea id="universo-observaciones" className="slds-input" rows={2} value={form.observaciones} onChange={(e) => f({ observaciones: e.target.value })} />
          </div>
          <div className="slds-col slds-grow-none">
            <button className="slds-button slds-button_brand" type="submit">{editId ? 'Guardar' : 'Agregar'}</button>
          </div>
        </div>
      </form>
    </div>
  )
}

function UniversoFiltros({ busqueda, setBusqueda, filtroStatus, setFiltroStatus, filtroEtapa, setFiltroEtapa, opts, total, mostrados }) {
  return (
    <div className="slds-grid slds-gutters slds-m-bottom_small" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div className="slds-col" style={{ minWidth: 220, maxWidth: 320 }}>
        <label className="slds-form-element__label" htmlFor="universo-busqueda">Buscar</label>
        <input id="universo-busqueda" className="slds-input" placeholder="Empresa, contacto, email…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>
      <div className="slds-col slds-grow-none" style={{ maxWidth: 180 }}>
        <label className="slds-form-element__label" htmlFor="universo-filtro-status">Status</label>
        <div className="slds-select_container"><select id="universo-filtro-status" className="slds-select" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
          <option value="">Todos</option>{(opts.statusOptions || []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select></div>
      </div>
      <div className="slds-col slds-grow-none" style={{ maxWidth: 180 }}>
        <label className="slds-form-element__label" htmlFor="universo-filtro-etapa">Etapa</label>
        <div className="slds-select_container"><select id="universo-filtro-etapa" className="slds-select" value={filtroEtapa} onChange={(e) => setFiltroEtapa(e.target.value)}>
          <option value="">Todas</option>{(opts.etapasOptions || []).map((e) => <option key={e} value={e}>{e}</option>)}
        </select></div>
      </div>
      <div className="slds-col slds-grid slds-grid_vertical-align-end">
        <span className="slds-text-color_weak slds-text-body_small">{mostrados} de {total} prospectos</span>
      </div>
    </div>
  )
}

function UniversoTabla({ listaMostrada, cargando, filtroStatus, filtroEtapa, canEdit, canDelete, onEditar, onEliminar }) {
  return (
    <div className="slds-box slds-theme_default">
      {cargando ? <p className="slds-text-color_weak">Cargando…</p> : listaMostrada.length === 0 ? (
        <p className="slds-text-color_weak">Sin prospectos {filtroStatus || filtroEtapa ? 'con ese filtro' : 'aún'}.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="slds-table slds-table_bordered slds-table_cell-buffer">
            <thead><tr className="slds-line-height_reset">
              <th>Empresa</th><th>Rubro</th><th>Seg.</th><th>Contacto</th><th>Tel. 1</th><th>Tel. 2</th>
              <th>Responsable</th><th>1er contacto</th><th>Status</th><th>Etapa</th><th>Observaciones</th>
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
                  <td>
                    {r.telefono2
                      ? <a href={waLink(r.telefono2)} target="_blank" rel="noreferrer">{r.telefono2}</a>
                      : '—'}
                  </td>
                  <td>{r.responsable || '—'}</td>
                  <td>{r.fecha_contacto || '—'}</td>
                  <td><span className="role-badge" style={{ background: STATUS_COLORS[r.status_contacto] || '#6b7280', color: '#fff', fontSize: '0.875rem' }}>{r.status_contacto}</span></td>
                  <td>{r.etapa_pipeline || '—'}</td>
                  <td style={{ maxWidth: 220, whiteSpace: 'pre-wrap' }} title={r.observaciones || ''}>{r.observaciones || '—'}</td>
                  {(canEdit || canDelete) && <td>
                    {canEdit && <><button type="button" className="slds-button slds-button_neutral" onClick={() => onEditar(r)}>Editar</button>{' '}</>}
                    {canDelete && <button type="button" className="slds-button slds-button_text-destructive" onClick={() => onEliminar(r)}>Eliminar</button>}
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
