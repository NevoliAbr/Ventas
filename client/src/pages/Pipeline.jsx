// Pipeline / Forecast: oportunidades de venta. Reusa el catálogo (rango automático
// por unidades + banda piso/lista). Calcula valor de contrato y valor ponderado
// (= valor × probabilidad de cierre). El forecast es la suma de los ponderados.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { useAuth } from '../context/AuthContext.jsx'
import { permissionsFor } from '../lib/permissions.js'
import { catalogoApi, oportunidadesApi } from '../services/api.js'

const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const MAP_IMPORT = {
  'prospecto': 'prospecto', 'tipo': 'tipo', 'sector': 'sector', 'responsable': 'responsable',
  'contacto': 'contacto', 'teléfono': 'telefono', 'producto': 'producto',
  'unidades': 'unidades', 'años': 'anios', 'precio unit./mes': 'precio_unitario',
  'prob. cierre %': 'prob_cierre_pct', 'etapa': 'etapa', 'trimestre': 'trimestre',
  'mes estimado': 'mes_estimado', 'fecha cotización': 'fecha_cotizacion',
  'próximo paso': 'proximo_paso', 'fecha próx. paso': 'fecha_sig_paso', 'notas': 'notas',
}

function exportarExcel(ops, productos) {
  const filas = ops.map((o) => {
    const prod = productos.find((p) => p.id === o.producto_id)
    return {
      'Prospecto': o.prospecto,
      'Tipo': o.tipo || '',
      'Sector': o.sector || '',
      'Responsable': o.responsable || '',
      'Contacto': o.contacto_nombre || '',
      'Teléfono': o.contacto_telefono || '',
      'Producto': prod?.nombre || '',
      'Unidades': Number(o.unidades),
      'Años': Number(o.anios),
      'Precio unit./mes': Number(o.precio_unitario),
      'Prob. cierre %': Math.round(Number(o.prob_cierre) * 100),
      'Etapa': o.etapa || '',
      'Trimestre': o.trimestre || '',
      'Mes estimado': o.mes_estimado || '',
      'Fecha cotización': o.fecha_cotizacion || '',
      'Próximo paso': o.proximo_paso || '',
      'Fecha próx. paso': o.fecha_sig_paso || '',
      'Notas': o.notas || '',
      'Valor contrato': Number(o.valor_total || 0),
      'Ponderado': Number(o.valor_ponderado || 0),
    }
  })
  const ws = XLSX.utils.json_to_sheet(filas)
  ws['!cols'] = Object.keys(filas[0] || {}).map(() => ({ wch: 20 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Pipeline')
  XLSX.writeFile(wb, `pipeline_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
const ANIOS = [1, 2, 3, 4, 5, 6]
const TRIMESTRES = ['Q1', 'Q2', 'Q3', 'Q4']
const PROBS = [0, 0.25, 0.5, 0.75, 0.9, 1]
const PROB_LABELS = {
  0: 'Sin posibilidad', 0.25: 'Interesado', 0.5: 'En aprobación',
  0.75: 'Aprobado / Finanzas', 0.9: 'Esperando contrato', 1: 'CERRADO',
}
const TIPOS = ['Empresa', 'Municipio']
const VACIO = {
  prospecto: '', sector: '', tipo: '', productoId: '', unidades: '', anios: '1', precio: '',
  prob: '0.25', etapa: 'Prospecting', trimestre: 'Q2', mes: '', notas: '',
  responsable: '', contacto_nombre: '', contacto_telefono: '', fecha_cotizacion: '',
  proximo_paso: '', fecha_sig_paso: '',
}
const rangoPara = (rangos, c) => rangos.find((r) => c >= r.unidades_min && (r.unidades_max == null || c <= r.unidades_max))

const etapaColor = (e) => ({ Prospecting: 'role-user', Discovery: 'role-viewer', Proposal: 'role-admin', Negotiation: 'role-superuser', Won: 'role-user', Lost: 'role-viewer' }[e] || 'role-viewer')

export default function Pipeline() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const perms = permissionsFor(user)
  const canEdit = perms.facultades.ventasModificar
  const canDelete = perms.facultades.ventasEliminar

  const [productos, setProductos] = useState([])
  const [ops, setOps] = useState([])
  const [etapas, setEtapas] = useState([])
  const [tipos] = useState(TIPOS)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [form, setForm] = useState(VACIO)
  const [editId, setEditId] = useState(null)
  const inputArchivoRef = useRef(null)
  const [busqueda, setBusqueda] = useState('')
  const [pendientesCot, setPendientesCot] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lcg_pendientes_pipeline') || '[]') } catch { return [] }
  })
  const [mostrarPendientesCot, setMostrarPendientesCot] = useState(true)
  const [pendienteFolioActivo, setPendienteFolioActivo] = useState(null)

  useEffect(() => {
    if (!perms.facultades.ventasVer) { setCargando(false); return }
    Promise.all([catalogoApi.listProductos(), oportunidadesApi.list()])
      .then(([p, o]) => { setProductos(p.productos); setOps(o.oportunidades); setEtapas(o.etapas) })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [perms.facultades.ventasVer])

  const ok = (m) => { setError(null); setAviso(m) }
  const fail = (e) => { setAviso(null); setError(e.message) }
  function salir() { logout(); navigate('/') }

  async function importarExcel(e) {
    const archivo = e.target.files[0]
    if (inputArchivoRef.current) inputArchivoRef.current.value = ''
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
          const campo = MAP_IMPORT[col.trim().toLowerCase()]
          if (campo) reg[campo] = val instanceof Date
            ? val.toISOString().slice(0, 10)
            : String(val ?? '').trim()
        }
        return reg
      }).filter((r) => r.prospecto)
      if (registros.length === 0) return fail(new Error('No se encontraron filas con prospecto válido.'))
      const { importados, errores } = await oportunidadesApi.importar(registros)
      const { oportunidades } = await oportunidadesApi.list()
      setOps(oportunidades)
      const msg = `${importados} oportunidades importadas.` + (errores?.length ? ` (${errores.length} omitidas)` : '')
      ok(msg)
    } catch (err) { fail(err) }
  }

  const vendibles = useMemo(() => productos.filter((p) => (p.tipos_venta || []).length > 0), [productos])
  const prodSel = productos.find((p) => p.id === form.productoId)
  const rangos = prodSel?.tipos_venta || []
  const u = Number(form.unidades)
  const rangoSel = Number.isInteger(u) && u > 0 ? rangoPara(rangos, u) : null

  // Previsualización de importes
  const prev = useMemo(() => {
    const precio = Number(form.precio), anios = Number(form.anios), prob = Number(form.prob)
    if (!rangoSel || !Number.isFinite(precio)) return null
    const mensual = precio * u, anual = mensual * 12, valor = anual * anios, pond = valor * prob
    return { mensual, anual, valor, pond }
  }, [form, rangoSel, u])

  const totalPipeline = useMemo(() => ops.reduce((s, o) => s + Number(o.valor_total || 0), 0), [ops])
  const totalForecast = useMemo(() => ops.reduce((s, o) => s + Number(o.valor_ponderado || 0), 0), [ops])

  function seleccionarPendienteCot(item) {
    setEditId(null)
    setForm({
      prospecto: item.prospecto, sector: item.sector, tipo: item.tipo,
      productoId: item.productoId, unidades: item.unidades, anios: item.anios,
      precio: item.precio, prob: item.prob, etapa: item.etapa,
      trimestre: item.trimestre, mes: item.mes, notas: item.notas,
      responsable: item.responsable, contacto_nombre: item.contacto_nombre,
      contacto_telefono: item.contacto_telefono, fecha_cotizacion: item.fecha_cotizacion,
      proximo_paso: item.proximo_paso, fecha_sig_paso: item.fecha_sig_paso,
    })
    setPendienteFolioActivo(item._folio)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cambiarProducto(id) { setForm({ ...form, productoId: id, unidades: '', precio: '' }) }
  function cambiarUnidades(v) {
    const c = Number(v); const r = Number.isInteger(c) && c > 0 ? rangoPara(rangos, c) : null
    setForm((s) => ({ ...s, unidades: v, precio: r ? String(r.precio_lista) : s.precio }))
  }

  async function guardar(e) {
    e.preventDefault()
    const payload = {
      prospecto: form.prospecto, sector: form.sector, tipo: form.tipo, producto_id: form.productoId,
      unidades: Number(form.unidades), anios: Number(form.anios), precio_unitario: Number(form.precio),
      prob_cierre: Number(form.prob), etapa: form.etapa, trimestre: form.trimestre, mes_estimado: form.mes,
      notas: form.notas, responsable: form.responsable,
      contacto_nombre: form.contacto_nombre, contacto_telefono: form.contacto_telefono,
      fecha_cotizacion: form.fecha_cotizacion, proximo_paso: form.proximo_paso, fecha_sig_paso: form.fecha_sig_paso,
    }
    try {
      if (editId) {
        const { oportunidad } = await oportunidadesApi.update(editId, payload)
        setOps((p) => p.map((o) => (o.id === editId ? oportunidad : o))); ok('Oportunidad actualizada.')
      } else {
        const { oportunidad } = await oportunidadesApi.create(payload)
        setOps((p) => [oportunidad, ...p])
        if (pendienteFolioActivo) {
          setPendientesCot((prev) => {
            const next = prev.filter((x) => x._folio !== pendienteFolioActivo)
            localStorage.setItem('lcg_pendientes_pipeline', JSON.stringify(next))
            return next
          })
          setPendienteFolioActivo(null)
          ok(`Cotización ${pendienteFolioActivo} · oportunidad agregada a Pipeline.`)
        } else {
          ok('Oportunidad agregada.')
        }
      }
      setForm(VACIO); setEditId(null)
    } catch (e) { fail(e) }
  }
  function editar(o) {
    setEditId(o.id)
    setForm({
      prospecto: o.prospecto, sector: o.sector || '', tipo: o.tipo || '', productoId: o.producto_id || '',
      unidades: String(o.unidades), anios: String(o.anios), precio: String(o.precio_unitario),
      prob: String(o.prob_cierre), etapa: o.etapa || 'Prospecting', trimestre: o.trimestre || 'Q2',
      mes: o.mes_estimado || '', notas: o.notas || '', responsable: o.responsable || '',
      contacto_nombre: o.contacto_nombre || '', contacto_telefono: o.contacto_telefono || '',
      fecha_cotizacion: o.fecha_cotizacion || '', proximo_paso: o.proximo_paso || '', fecha_sig_paso: o.fecha_sig_paso || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  async function eliminar(o) {
    if (!window.confirm(`¿Eliminar la oportunidad de ${o.prospecto}?`)) return
    try { await oportunidadesApi.remove(o.id); setOps((p) => p.filter((x) => x.id !== o.id)); ok('Oportunidad eliminada.') } catch (e) { fail(e) }
  }

  if (!perms.facultades.ventasVer) {
    return (
      <div className="dashboard slds-scope"><div className="slds-container_large slds-container_center">
        <div className="dash-topbar"><div><Link to="/inicio" className="dash-back">← Inicio</Link><h1 className="dash-greeting">Pipeline</h1></div>
          <button className="slds-button slds-button_neutral" onClick={salir}>Cerrar sesión</button></div>
        <div className="slds-box slds-theme_default"><h2 className="slds-text-heading_small slds-m-bottom_x-small">Sin acceso</h2>
          <p className="slds-text-color_weak">No tienes la facultad <b>ventasVer</b>.</p>
          <p className="slds-m-top_small"><Link to="/inicio">← Volver al inicio</Link></p></div>
      </div></div>
    )
  }

  return (
    <div className="dashboard slds-scope">
      <div className="slds-container_large slds-container_center">
        <div className="dash-topbar">
          <div>
            <Link to="/inicio" className="dash-back">← Inicio</Link>
            <h1 className="dash-greeting">Pipeline y Forecast</h1>
            <p className="dash-subtitle">Oportunidades · valor ponderado = valor × probabilidad de cierre</p>
          </div>
          <div className="slds-grid slds-grid_vertical-align-center" style={{ gap: 8 }}>
            {ops.length > 0 && <button className="slds-button slds-button_neutral" onClick={() => exportarExcel(ops, productos)}>⬇ Exportar</button>}
            {canEdit && (<>
              <button className="slds-button slds-button_neutral" onClick={() => inputArchivoRef.current?.click()}>⬆ Importar</button>
              <input ref={inputArchivoRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={importarExcel} />
            </>)}
            <button className="slds-button slds-button_neutral" onClick={salir}>Cerrar sesión</button>
          </div>
        </div>

        {error && <div className="slds-text-color_error slds-m-bottom_small" role="alert">⚠️ {error}</div>}
        {aviso && <div className="slds-text-color_success slds-m-bottom_small" role="status">✅ {aviso}</div>}

        {/* Resumen forecast */}
        <div className="slds-grid slds-wrap slds-gutters slds-m-bottom_medium">
          <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-3 slds-p-vertical_x-small">
            <div className="metric-card"><p className="metric-label">Oportunidades</p><p className="metric-value">{ops.length}</p></div></div>
          <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-3 slds-p-vertical_x-small">
            <div className="metric-card"><p className="metric-label">Valor total pipeline</p><p className="metric-value">{money(totalPipeline)}</p></div></div>
          <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-3 slds-p-vertical_x-small">
            <div className="metric-card"><p className="metric-label">Forecast (ponderado)</p><p className="metric-value">{money(totalForecast)}</p></div></div>
        </div>

        {pendientesCot.length > 0 && (
          <div className="slds-box slds-m-bottom_medium" style={{ borderLeft: '4px solid #0070d2', background: '#f0f4ff' }}>
            <div className="slds-grid slds-grid_align-spread slds-grid_vertical-align-center">
              <div className="slds-grid slds-grid_vertical-align-center" style={{ gap: 10 }}>
                <span style={{ background: '#0070d2', color: '#fff', borderRadius: 999, padding: '2px 11px', fontWeight: 700, fontSize: '0.85rem' }}>{pendientesCot.length}</span>
                <strong>Pendientes de Pipeline</strong>
                <span className="slds-text-color_weak slds-text-body_small">— Selecciona uno para completar sus datos</span>
              </div>
              <button className="slds-button slds-button_neutral" onClick={() => setMostrarPendientesCot((v) => !v)}>
                {mostrarPendientesCot ? 'Ocultar ▲' : 'Ver ▼'}
              </button>
            </div>
            {mostrarPendientesCot && (
              <div className="slds-m-top_small" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {pendientesCot.map((item) => (
                  <button key={item._folio} className="slds-button slds-button_neutral"
                    style={{ textAlign: 'left', borderColor: pendienteFolioActivo === item._folio ? '#0070d2' : undefined, fontWeight: pendienteFolioActivo === item._folio ? 700 : undefined }}
                    onClick={() => seleccionarPendienteCot(item)}>
                    <strong>{item.prospecto}</strong> · {item._folio}{item.responsable && <> · {item.responsable}</>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {canEdit && (
          <div className="slds-box slds-theme_default slds-m-bottom_medium">
            <div className="slds-grid slds-grid_align-spread slds-m-bottom_small">
              <h2 className="slds-text-heading_small">{editId ? 'Editar oportunidad' : pendienteFolioActivo ? `Agregar cotización ${pendienteFolioActivo} a Pipeline` : 'Nueva oportunidad'}</h2>
              {(editId || pendienteFolioActivo) && <button className="slds-button slds-button_neutral" onClick={() => { setForm(VACIO); setEditId(null); setPendienteFolioActivo(null) }}>Cancelar</button>}
            </div>
            {vendibles.length === 0 ? (
              <p className="slds-text-color_weak slds-text-body_small">Crea productos con rangos en <Link to="/configuracion-ventas">Configuración de ventas</Link>.</p>
            ) : (
              <form onSubmit={guardar}>
                <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end">
                  <div className="slds-col slds-size_1-of-3"><label className="slds-form-element__label">Empresa / Municipio</label>
                    <input className="slds-input" value={form.prospecto} onChange={(e) => setForm({ ...form, prospecto: e.target.value })} required /></div>
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 130 }}><label className="slds-form-element__label">Tipo</label>
                    <div className="slds-select_container"><select className="slds-select" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                      <option value="">—</option>{tipos.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select></div></div>
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 160 }}><label className="slds-form-element__label">Sector</label>
                    <input className="slds-input" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })} placeholder="Logística…" /></div>
                  <div className="slds-col slds-size_1-of-3"><label className="slds-form-element__label">Producto</label>
                    <div className="slds-select_container"><select className="slds-select" value={form.productoId} onChange={(e) => cambiarProducto(e.target.value)} required>
                      <option value="">— Elegir —</option>{vendibles.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.sector ? ` (${p.sector})` : ''}</option>)}
                    </select></div></div>
                </div>
                <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end slds-m-top_x-small">
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 110 }}><label className="slds-form-element__label">Unidades</label>
                    <input className="slds-input" type="number" min="1" value={form.unidades} disabled={!prodSel} onChange={(e) => cambiarUnidades(e.target.value)} required /></div>
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 80 }}><label className="slds-form-element__label">Años</label>
                    <div className="slds-select_container"><select className="slds-select" value={form.anios} onChange={(e) => setForm({ ...form, anios: e.target.value })}>
                      {ANIOS.map((a) => <option key={a} value={a}>{a}</option>)}</select></div></div>
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 140 }}><label className="slds-form-element__label">Precio unit./mes</label>
                    <input className="slds-input" type="number" min="0" step="0.01" value={form.precio} disabled={!rangoSel} onChange={(e) => setForm({ ...form, precio: e.target.value })} required /></div>
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 200 }}><label className="slds-form-element__label">Prob. cierre</label>
                    <div className="slds-select_container"><select className="slds-select" value={form.prob} onChange={(e) => setForm({ ...form, prob: e.target.value })}>
                      {PROBS.map((p) => <option key={p} value={p}>{Math.round(p * 100)}% — {PROB_LABELS[p]}</option>)}</select></div></div>
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 150 }}><label className="slds-form-element__label">Etapa</label>
                    <div className="slds-select_container"><select className="slds-select" value={form.etapa} onChange={(e) => setForm({ ...form, etapa: e.target.value })}>
                      {(etapas.length ? etapas : ['Prospecting']).map((e) => <option key={e} value={e}>{e}</option>)}</select></div></div>
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 90 }}><label className="slds-form-element__label">Trimestre</label>
                    <div className="slds-select_container"><select className="slds-select" value={form.trimestre} onChange={(e) => setForm({ ...form, trimestre: e.target.value })}>
                      {TRIMESTRES.map((q) => <option key={q} value={q}>{q}</option>)}</select></div></div>
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 120 }}><label className="slds-form-element__label">Mes estimado</label>
                    <input className="slds-input" value={form.mes} onChange={(e) => setForm({ ...form, mes: e.target.value })} placeholder="Mayo" /></div>
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 180 }}><label className="slds-form-element__label">Responsable venta</label>
                    <input className="slds-input" value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} placeholder="Nombre…" /></div>
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 180 }}><label className="slds-form-element__label">Contacto principal</label>
                    <input className="slds-input" value={form.contacto_nombre} onChange={(e) => setForm({ ...form, contacto_nombre: e.target.value })} /></div>
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 150 }}><label className="slds-form-element__label">Tel. contacto</label>
                    <input className="slds-input" value={form.contacto_telefono} onChange={(e) => setForm({ ...form, contacto_telefono: e.target.value })} /></div>
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 150 }}><label className="slds-form-element__label">Fecha cotización</label>
                    <input className="slds-input" type="date" value={form.fecha_cotizacion} onChange={(e) => setForm({ ...form, fecha_cotizacion: e.target.value })} /></div>
                  <div className="slds-col slds-size_1-of-2"><label className="slds-form-element__label">Próximo paso</label>
                    <input className="slds-input" value={form.proximo_paso} onChange={(e) => setForm({ ...form, proximo_paso: e.target.value })} placeholder="Enviar propuesta…" /></div>
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 150 }}><label className="slds-form-element__label">Fecha próximo paso</label>
                    <input className="slds-input" type="date" value={form.fecha_sig_paso} onChange={(e) => setForm({ ...form, fecha_sig_paso: e.target.value })} /></div>
                  <div className="slds-col slds-size_1-of-1 slds-m-top_x-small"><label className="slds-form-element__label">Notas / Observaciones</label>
                    <input className="slds-input" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} placeholder="Observaciones, evolución…" /></div>
                  <div className="slds-col slds-grow-none slds-m-top_x-small"><button className="slds-button slds-button_brand" type="submit" disabled={!rangoSel}>{editId ? 'Guardar' : 'Agregar'}</button></div>
                </div>
                {form.unidades && !rangoSel && <p className="slds-text-color_error slds-text-body_small slds-m-top_x-small">⚠️ No hay rango para {form.unidades} unidades.</p>}
                {prev && rangoSel && (
                  <p className="slds-text-body_small slds-text-color_weak slds-m-top_x-small">
                    Banda {money(rangoSel.precio_piso)}–{money(rangoSel.precio_lista)} · Anual {money(prev.anual)} · Valor contrato {money(prev.valor)} · <b>Ponderado {money(prev.pond)}</b>
                  </p>
                )}
              </form>
            )}
          </div>
        )}

        {/* Buscador */}
        <div className="slds-m-bottom_small" style={{ maxWidth: 340 }}>
          <label className="slds-form-element__label">Buscar</label>
          <input className="slds-input" placeholder="Empresa, sector, responsable…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>

        <div className="slds-box slds-theme_default">
          {(() => {
            const q = busqueda.toLowerCase()
            const opsMostradas = busqueda
              ? ops.filter((o) => [o.prospecto, o.tipo, o.sector, o.responsable, o.contacto_nombre, o.etapa]
                  .some((v) => (v || '').toLowerCase().includes(q)))
              : ops
            return (
          <>
          <div className="slds-grid slds-grid_align-spread slds-m-bottom_small">
            <h2 className="slds-text-heading_small">Oportunidades ({opsMostradas.length}{busqueda ? ` de ${ops.length}` : ''})</h2>
          </div>
          {cargando ? <p className="slds-text-color_weak">Cargando…</p> : opsMostradas.length === 0 ? (
            <p className="slds-text-color_weak">{busqueda ? 'Sin resultados para esa búsqueda.' : 'Aún no hay oportunidades.'}</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
            <table className="slds-table slds-table_bordered slds-table_cell-buffer">
              <thead><tr className="slds-line-height_reset">
                <th>Empresa</th><th>Tipo</th><th>Sector</th><th>Responsable</th><th>Contacto</th>
                <th>Etapa</th><th>Unid.</th><th>Años</th><th>Valor contrato</th>
                <th>Prob.</th><th>Estado</th><th>Ponderado</th><th>Trim.</th><th>F. cotiz.</th><th>Próx. paso</th>
                {(canEdit || canDelete) && <th>Acciones</th>}
              </tr></thead>
              <tbody>
                {opsMostradas.map((o) => (
                  <tr key={o.id}>
                    <td><strong>{o.prospecto}</strong></td>
                    <td>{o.tipo || '—'}</td>
                    <td>{o.sector || '—'}</td>
                    <td>{o.responsable || '—'}</td>
                    <td>{o.contacto_nombre || '—'}{o.contacto_telefono && <><br /><span className="slds-text-body_small">{o.contacto_telefono}</span></>}</td>
                    <td><span className={'role-badge ' + etapaColor(o.etapa)}>{o.etapa}</span></td>
                    <td>{o.unidades}</td>
                    <td>{o.anios}</td>
                    <td className="activity-amount">{money(o.valor_total)}</td>
                    <td>{Math.round(Number(o.prob_cierre) * 100)}%</td>
                    <td style={{ fontSize: '0.75rem', color: '#555' }}>{PROB_LABELS[Number(o.prob_cierre)] || '—'}</td>
                    <td className="activity-amount">{money(o.valor_ponderado)}</td>
                    <td>{o.trimestre || '—'}</td>
                    <td>{o.fecha_cotizacion || '—'}</td>
                    <td style={{ maxWidth: 160, whiteSpace: 'normal' }}>
                      {o.proximo_paso || '—'}
                      {o.fecha_sig_paso && <><br /><span className="slds-text-body_small">{o.fecha_sig_paso}</span></>}
                    </td>
                    {(canEdit || canDelete) && <td>
                      {canEdit && <><button className="slds-button slds-button_neutral" onClick={() => editar(o)}>Editar</button>{' '}</>}
                      {canDelete && <button className="slds-button slds-button_text-destructive" onClick={() => eliminar(o)}>Eliminar</button>}
                    </td>}
                  </tr>
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
