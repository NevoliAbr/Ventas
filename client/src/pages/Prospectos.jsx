// Prospectos activos: seguimiento de 1ra y 2da reunión.
// Flujo: reciben aquí los prospectos de Universo con status "Primera reunión".
// Si en 2da reunión piden cotización → marcar y pasan a Pipeline/Forecast.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { permissionsFor } from '../lib/permissions.js'
import { prospectoApi } from '../services/api.js'

const STATUS_COLOR = {
  Agendada: '#2563eb', Realizada: '#16a34a', Reprogramada: '#d97706', Cancelada: '#dc2626',
}

const VACIO = {
  empresa: '', tipo: '', contacto_nombre: '', telefono: '', responsable: '',
  fecha_1ra_reunion: '', status_1ra_reunion: '', obs_1ra_reunion: '',
  fecha_2da_reunion: '', status_2da_reunion: '', obs_2da_reunion: '',
  pide_cotizacion: false, pasa_forecast: false,
}

export default function Prospectos() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const perms = permissionsFor(user)
  const canEdit = perms.facultades.ventasModificar

  const [lista, setLista] = useState([])
  const [opts, setOpts] = useState({ statusReunion: [], tipos: [] })
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [form, setForm] = useState(VACIO)
  const [editId, setEditId] = useState(null)

  useEffect(() => {
    if (!perms.facultades.ventasVer) { setCargando(false); return }
    prospectoApi.list()
      .then((d) => { setLista(d.prospectos); setOpts({ statusReunion: d.statusReunion, tipos: d.tipos }) })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [perms.facultades.ventasVer])

  const f = (s) => setForm((p) => ({ ...p, ...s }))
  const ok = (m) => { setError(null); setAviso(m) }
  const fail = (e) => { setAviso(null); setError(e.message) }
  function salir() { logout(); navigate('/') }

  async function guardar(e) {
    e.preventDefault()
    try {
      if (editId) {
        const { prospecto } = await prospectoApi.update(editId, form)
        setLista((p) => p.map((r) => (r.id === editId ? prospecto : r)))
        ok('Prospecto actualizado.')
      } else {
        const { prospecto } = await prospectoApi.create(form)
        setLista((p) => [prospecto, ...p])
        ok('Prospecto agregado.')
      }
      setForm(VACIO); setEditId(null)
    } catch (e) { fail(e) }
  }

  function editar(r) {
    setEditId(r.id)
    setForm({
      empresa: r.empresa, tipo: r.tipo || '', contacto_nombre: r.contacto_nombre || '',
      telefono: r.telefono || '', responsable: r.responsable || '',
      fecha_1ra_reunion: r.fecha_1ra_reunion || '', status_1ra_reunion: r.status_1ra_reunion || '',
      obs_1ra_reunion: r.obs_1ra_reunion || '',
      fecha_2da_reunion: r.fecha_2da_reunion || '', status_2da_reunion: r.status_2da_reunion || '',
      obs_2da_reunion: r.obs_2da_reunion || '',
      pide_cotizacion: !!(r.pide_cotizacion || r.pide_cotizacion === 1),
      pasa_forecast: !!(r.pasa_forecast || r.pasa_forecast === 1),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function eliminar(r) {
    if (!window.confirm(`¿Eliminar a ${r.empresa}?`)) return
    try { await prospectoApi.remove(r.id); setLista((p) => p.filter((x) => x.id !== r.id)); ok('Eliminado.') } catch (e) { fail(e) }
  }

  if (!perms.facultades.ventasVer) {
    return (
      <div className="dashboard slds-scope"><div className="slds-container_large slds-container_center">
        <div className="dash-topbar"><Link to="/inicio" className="dash-back">← Inicio</Link></div>
        <div className="slds-box"><p>Sin acceso — facultad <b>ventasVer</b> requerida.</p></div>
      </div></div>
    )
  }

  const enProceso = lista.filter((r) => !r.pasa_forecast)
  const pasaron = lista.filter((r) => r.pasa_forecast)

  return (
    <div className="dashboard slds-scope">
      <div className="slds-container_large slds-container_center">

        <div className="dash-topbar">
          <div>
            <Link to="/inicio" className="dash-back">← Inicio</Link>
            <h1 className="dash-greeting">Prospectos Activos</h1>
            <p className="dash-subtitle">Seguimiento de 1ra y 2da reunión · Cuando piden cotización → marcar y pasan a Forecast</p>
          </div>
          <button className="slds-button slds-button_neutral" onClick={salir}>Cerrar sesión</button>
        </div>

        {error && <div className="slds-text-color_error slds-m-bottom_small" role="alert">⚠️ {error}</div>}
        {aviso && <div className="slds-text-color_success slds-m-bottom_small" role="status">✅ {aviso}</div>}

        {/* Métricas */}
        <div className="slds-grid slds-wrap slds-gutters slds-m-bottom_medium">
          <div className="slds-col slds-size_1-of-3 slds-p-vertical_x-small">
            <div className="metric-card"><p className="metric-label">En proceso</p><p className="metric-value">{enProceso.length}</p></div>
          </div>
          <div className="slds-col slds-size_1-of-3 slds-p-vertical_x-small">
            <div className="metric-card"><p className="metric-label">Piden cotización</p><p className="metric-value">{lista.filter((r) => r.pide_cotizacion || r.pide_cotizacion === 1).length}</p></div>
          </div>
          <div className="slds-col slds-size_1-of-3 slds-p-vertical_x-small">
            <div className="metric-card"><p className="metric-label">Pasaron a Forecast</p><p className="metric-value">{pasaron.length}</p></div>
          </div>
        </div>

        {/* Formulario */}
        {canEdit && (
          <div className="slds-box slds-theme_default slds-m-bottom_medium">
            <div className="slds-grid slds-grid_align-spread slds-m-bottom_small">
              <h2 className="slds-text-heading_small">{editId ? 'Editar prospecto' : 'Nuevo prospecto activo'}</h2>
              {editId && <button className="slds-button slds-button_neutral" onClick={() => { setForm(VACIO); setEditId(null) }}>Cancelar</button>}
            </div>
            <form onSubmit={guardar}>
              {/* Datos base */}
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
              {/* 1ra reunión */}
              <p className="slds-text-body_small slds-text-color_weak slds-m-top_small slds-m-bottom_xx-small"><strong>Primera reunión</strong></p>
              <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end">
                <div className="slds-col slds-grow-none" style={{ maxWidth: 150 }}>
                  <label className="slds-form-element__label">Fecha</label>
                  <input className="slds-input" type="date" value={form.fecha_1ra_reunion} onChange={(e) => f({ fecha_1ra_reunion: e.target.value })} />
                </div>
                <div className="slds-col slds-grow-none" style={{ maxWidth: 160 }}>
                  <label className="slds-form-element__label">Status</label>
                  <div className="slds-select_container"><select className="slds-select" value={form.status_1ra_reunion} onChange={(e) => f({ status_1ra_reunion: e.target.value })}>
                    <option value="">—</option>{(opts.statusReunion || []).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select></div>
                </div>
                <div className="slds-col slds-size_1-of-1 slds-medium-size_2-of-3">
                  <label className="slds-form-element__label">Observaciones</label>
                  <input className="slds-input" value={form.obs_1ra_reunion} onChange={(e) => f({ obs_1ra_reunion: e.target.value })} placeholder="Resultado, acuerdos…" />
                </div>
              </div>
              {/* 2da reunión */}
              <p className="slds-text-body_small slds-text-color_weak slds-m-top_small slds-m-bottom_xx-small"><strong>Segunda reunión</strong></p>
              <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end">
                <div className="slds-col slds-grow-none" style={{ maxWidth: 150 }}>
                  <label className="slds-form-element__label">Fecha</label>
                  <input className="slds-input" type="date" value={form.fecha_2da_reunion} onChange={(e) => f({ fecha_2da_reunion: e.target.value })} />
                </div>
                <div className="slds-col slds-grow-none" style={{ maxWidth: 160 }}>
                  <label className="slds-form-element__label">Status</label>
                  <div className="slds-select_container"><select className="slds-select" value={form.status_2da_reunion} onChange={(e) => f({ status_2da_reunion: e.target.value })}>
                    <option value="">—</option>{(opts.statusReunion || []).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select></div>
                </div>
                <div className="slds-col slds-size_1-of-1 slds-medium-size_2-of-3">
                  <label className="slds-form-element__label">Observaciones</label>
                  <input className="slds-input" value={form.obs_2da_reunion} onChange={(e) => f({ obs_2da_reunion: e.target.value })} placeholder="Resultado, acuerdos…" />
                </div>
              </div>
              {/* Flags */}
              <div className="slds-grid slds-gutters slds-m-top_small slds-grid_vertical-align-center">
                <label className="slds-checkbox slds-m-right_medium" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.pide_cotizacion} onChange={(e) => f({ pide_cotizacion: e.target.checked })} />
                  <span className="slds-m-left_x-small">¿Pidió cotización?</span>
                </label>
                <label className="slds-checkbox" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.pasa_forecast} onChange={(e) => f({ pasa_forecast: e.target.checked })} />
                  <span className="slds-m-left_x-small">¿Pasó a Forecast?</span>
                </label>
                <div className="slds-m-left_medium">
                  <button className="slds-button slds-button_brand" type="submit">{editId ? 'Guardar' : 'Agregar'}</button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Tabla */}
        <div className="slds-box slds-theme_default">
          <h2 className="slds-text-heading_small slds-m-bottom_small">Prospectos ({lista.length})</h2>
          {cargando ? <p className="slds-text-color_weak">Cargando…</p> : lista.length === 0 ? (
            <p className="slds-text-color_weak">Sin prospectos aún.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="slds-table slds-table_bordered slds-table_cell-buffer">
                <thead><tr className="slds-line-height_reset">
                  <th>Empresa</th><th>Tipo</th><th>Contacto</th><th>Responsable</th>
                  <th>1ra reunión</th><th>Status 1ra</th><th>Obs. 1ra</th>
                  <th>2da reunión</th><th>Status 2da</th><th>Obs. 2da</th>
                  <th>Cotización</th><th>Forecast</th>
                  {canEdit && <th>Acciones</th>}
                </tr></thead>
                <tbody>
                  {lista.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.empresa}</strong></td>
                      <td>{r.tipo || '—'}</td>
                      <td>{r.contacto_nombre || '—'}{r.telefono && <><br /><span className="slds-text-body_small">{r.telefono}</span></>}</td>
                      <td>{r.responsable || '—'}</td>
                      <td>{r.fecha_1ra_reunion || '—'}</td>
                      <td>{r.status_1ra_reunion
                        ? <span className="role-badge" style={{ background: STATUS_COLOR[r.status_1ra_reunion] || '#6b7280', color: '#fff', fontSize: '0.72rem' }}>{r.status_1ra_reunion}</span>
                        : '—'}</td>
                      <td style={{ maxWidth: 200, whiteSpace: 'normal' }}>{r.obs_1ra_reunion || '—'}</td>
                      <td>{r.fecha_2da_reunion || '—'}</td>
                      <td>{r.status_2da_reunion
                        ? <span className="role-badge" style={{ background: STATUS_COLOR[r.status_2da_reunion] || '#6b7280', color: '#fff', fontSize: '0.72rem' }}>{r.status_2da_reunion}</span>
                        : '—'}</td>
                      <td style={{ maxWidth: 200, whiteSpace: 'normal' }}>{r.obs_2da_reunion || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{(r.pide_cotizacion || r.pide_cotizacion === 1) ? '✅' : '—'}</td>
                      <td style={{ textAlign: 'center' }}>{(r.pasa_forecast || r.pasa_forecast === 1) ? '✅' : '—'}</td>
                      {canEdit && <td>
                        <button className="slds-button slds-button_neutral" onClick={() => editar(r)}>Editar</button>{' '}
                        <button className="slds-button slds-button_text-destructive" onClick={() => eliminar(r)}>Eliminar</button>
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
