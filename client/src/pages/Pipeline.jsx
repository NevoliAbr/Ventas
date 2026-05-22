// Pipeline / Forecast: oportunidades de venta. Reusa el catálogo (rango automático
// por unidades + banda piso/lista). Calcula valor de contrato y valor ponderado
// (= valor × probabilidad de cierre). El forecast es la suma de los ponderados.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { permissionsFor } from '../lib/permissions.js'
import { catalogoApi, oportunidadesApi } from '../services/api.js'

const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
const ANIOS = [1, 2, 3, 4, 5, 6]
const TRIMESTRES = ['Q1', 'Q2', 'Q3', 'Q4']
const PROBS = [0.25, 0.4, 0.55, 0.7, 0.9]
const VACIO = { prospecto: '', sector: '', productoId: '', unidades: '', anios: '1', precio: '', prob: '0.25', etapa: 'Prospecting', trimestre: 'Q2', mes: '', notas: '' }
const rangoPara = (rangos, c) => rangos.find((r) => c >= r.unidades_min && (r.unidades_max == null || c <= r.unidades_max))

const etapaColor = (e) => ({ Prospecting: 'role-user', Discovery: 'role-viewer', Proposal: 'role-admin', Negotiation: 'role-superuser', Won: 'role-user', Lost: 'role-viewer' }[e] || 'role-viewer')

export default function Pipeline() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const perms = permissionsFor(user)
  const canEdit = perms.facultades.ventasModificar

  const [productos, setProductos] = useState([])
  const [ops, setOps] = useState([])
  const [etapas, setEtapas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [form, setForm] = useState(VACIO)
  const [editId, setEditId] = useState(null)

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

  function cambiarProducto(id) { setForm({ ...form, productoId: id, unidades: '', precio: '' }) }
  function cambiarUnidades(v) {
    const c = Number(v); const r = Number.isInteger(c) && c > 0 ? rangoPara(rangos, c) : null
    setForm((s) => ({ ...s, unidades: v, precio: r ? String(r.precio_lista) : s.precio }))
  }

  async function guardar(e) {
    e.preventDefault()
    const payload = {
      prospecto: form.prospecto, sector: form.sector, producto_id: form.productoId,
      unidades: Number(form.unidades), anios: Number(form.anios), precio_unitario: Number(form.precio),
      prob_cierre: Number(form.prob), etapa: form.etapa, trimestre: form.trimestre, mes_estimado: form.mes, notas: form.notas,
    }
    try {
      if (editId) {
        const { oportunidad } = await oportunidadesApi.update(editId, payload)
        setOps((p) => p.map((o) => (o.id === editId ? oportunidad : o))); ok('Oportunidad actualizada.')
      } else {
        const { oportunidad } = await oportunidadesApi.create(payload)
        setOps((p) => [oportunidad, ...p]); ok('Oportunidad agregada.')
      }
      setForm(VACIO); setEditId(null)
    } catch (e) { fail(e) }
  }
  function editar(o) {
    setEditId(o.id)
    setForm({ prospecto: o.prospecto, sector: o.sector || '', productoId: o.producto_id || '', unidades: String(o.unidades),
      anios: String(o.anios), precio: String(o.precio_unitario), prob: String(o.prob_cierre), etapa: o.etapa || 'Prospecting',
      trimestre: o.trimestre || 'Q2', mes: o.mes_estimado || '', notas: o.notas || '' })
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
          <button className="slds-button slds-button_neutral" onClick={salir}>Cerrar sesión</button>
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

        {canEdit && (
          <div className="slds-box slds-theme_default slds-m-bottom_medium">
            <div className="slds-grid slds-grid_align-spread slds-m-bottom_small">
              <h2 className="slds-text-heading_small">{editId ? 'Editar oportunidad' : 'Nueva oportunidad'}</h2>
              {editId && <button className="slds-button slds-button_neutral" onClick={() => { setForm(VACIO); setEditId(null) }}>Cancelar</button>}
            </div>
            {vendibles.length === 0 ? (
              <p className="slds-text-color_weak slds-text-body_small">Crea productos con rangos en <Link to="/configuracion-ventas">Configuración de ventas</Link>.</p>
            ) : (
              <form onSubmit={guardar}>
                <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end">
                  <div className="slds-col slds-size_1-of-3"><label className="slds-form-element__label">Prospecto / Empresa</label>
                    <input className="slds-input" value={form.prospecto} onChange={(e) => setForm({ ...form, prospecto: e.target.value })} required /></div>
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 160 }}><label className="slds-form-element__label">Sector (industria)</label>
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
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 110 }}><label className="slds-form-element__label">Prob. cierre</label>
                    <div className="slds-select_container"><select className="slds-select" value={form.prob} onChange={(e) => setForm({ ...form, prob: e.target.value })}>
                      {PROBS.map((p) => <option key={p} value={p}>{Math.round(p * 100)}%</option>)}</select></div></div>
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 150 }}><label className="slds-form-element__label">Etapa</label>
                    <div className="slds-select_container"><select className="slds-select" value={form.etapa} onChange={(e) => setForm({ ...form, etapa: e.target.value })}>
                      {(etapas.length ? etapas : ['Prospecting']).map((e) => <option key={e} value={e}>{e}</option>)}</select></div></div>
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 90 }}><label className="slds-form-element__label">Trimestre</label>
                    <div className="slds-select_container"><select className="slds-select" value={form.trimestre} onChange={(e) => setForm({ ...form, trimestre: e.target.value })}>
                      {TRIMESTRES.map((q) => <option key={q} value={q}>{q}</option>)}</select></div></div>
                  <div className="slds-col slds-grow-none" style={{ maxWidth: 120 }}><label className="slds-form-element__label">Mes estimado</label>
                    <input className="slds-input" value={form.mes} onChange={(e) => setForm({ ...form, mes: e.target.value })} placeholder="Mayo" /></div>
                  <div className="slds-col slds-grow-none"><button className="slds-button slds-button_brand" type="submit" disabled={!rangoSel}>{editId ? 'Guardar' : 'Agregar'}</button></div>
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

        <div className="slds-box slds-theme_default">
          <h2 className="slds-text-heading_small slds-m-bottom_small">Oportunidades</h2>
          {ops.length === 0 ? (
            <p className="slds-text-color_weak">Aún no hay oportunidades.</p>
          ) : (
            <table className="slds-table slds-table_bordered slds-table_cell-buffer">
              <thead><tr className="slds-line-height_reset">
                <th>Prospecto</th><th>Sector</th><th>Etapa</th><th>Unid.</th><th>Años</th><th>Valor contrato</th><th>Prob.</th><th>Ponderado</th><th>Trim.</th>{canEdit && <th>Acciones</th>}
              </tr></thead>
              <tbody>
                {ops.map((o) => (
                  <tr key={o.id}>
                    <td>{o.prospecto}</td>
                    <td>{o.sector || '—'}</td>
                    <td><span className={'role-badge ' + etapaColor(o.etapa)}>{o.etapa}</span></td>
                    <td>{o.unidades}</td>
                    <td>{o.anios}</td>
                    <td className="activity-amount">{money(o.valor_total)}</td>
                    <td>{Math.round(Number(o.prob_cierre) * 100)}%</td>
                    <td className="activity-amount">{money(o.valor_ponderado)}</td>
                    <td>{o.trimestre || '—'}</td>
                    {canEdit && <td>
                      <button className="slds-button slds-button_neutral" onClick={() => editar(o)}>Editar</button>{' '}
                      <button className="slds-button slds-button_text-destructive" onClick={() => eliminar(o)}>Eliminar</button>
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
