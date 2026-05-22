// Cotizaciones (simulación de ventas). Modelo de rangos por unidades:
// escribes las unidades -> se elige el rango automáticamente (piso/lista) -> precio
// unitario en banda -> años (1-6). mensual = precio × unidades, anual = ×12,
// estimado por línea = anual × años. Total estimado = suma de los estimados por línea.
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { permissionsFor } from '../lib/permissions.js'
import { catalogoApi, ventasApi } from '../services/api.js'

const hoy = () => new Date().toISOString().slice(0, 10)
const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ANIOS = [1, 2, 3, 4, 5, 6]
const LINEA_VACIA = { productoId: '', cantidad: '', anios: '1', precio: '' }

// Encuentra el rango que cubre esa cantidad de unidades.
const rangoPara = (rangos, cantidad) =>
  rangos.find((r) => cantidad >= r.unidades_min && (r.unidades_max == null || cantidad <= r.unidades_max))

export default function Cotizaciones() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const perms = permissionsFor(user)
  const canEdit = perms.facultades.ventasModificar

  const [productos, setProductos] = useState([])
  const [clientes, setClientes] = useState([])
  const [cotizaciones, setCotizaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [verCot, setVerCot] = useState(null)

  const [clienteId, setClienteId] = useState('')
  const [fecha, setFecha] = useState(hoy())
  const [notas, setNotas] = useState('')
  const [lineas, setLineas] = useState([])
  const [editId, setEditId] = useState(null)
  const [nl, setNl] = useState(LINEA_VACIA)
  const [errLinea, setErrLinea] = useState(null)

  useEffect(() => {
    if (!perms.facultades.ventasVer) { setCargando(false); return }
    Promise.all([catalogoApi.listProductos(), catalogoApi.listClientes(), ventasApi.list()])
      .then(([p, c, v]) => { setProductos(p.productos); setClientes(c.clientes); setCotizaciones(v.ventas) })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [perms.facultades.ventasVer])

  const ok = (m) => { setError(null); setAviso(m) }
  const fail = (e) => { setAviso(null); setError(e.message) }
  function salir() { logout(); navigate('/') }

  const vendibles = useMemo(() => productos.filter((p) => (p.tipos_venta || []).length > 0), [productos])
  const productoSel = productos.find((p) => p.id === nl.productoId)
  const rangos = productoSel?.tipos_venta || []
  const cantNum = Number(nl.cantidad)
  const rangoSel = Number.isInteger(cantNum) && cantNum > 0 ? rangoPara(rangos, cantNum) : null

  const totalMensual = useMemo(() => lineas.reduce((s, l) => s + l.ingreso_mensual, 0), [lineas])
  const totalAnual = useMemo(() => lineas.reduce((s, l) => s + l.ingreso_anual, 0), [lineas])
  const totalContrato = useMemo(() => lineas.reduce((s, l) => s + l.subtotal, 0), [lineas])

  // Al cambiar producto: limpia la línea. Al cambiar cantidad: sugiere precio = lista del rango.
  function cambiarProducto(id) { setNl({ ...LINEA_VACIA, productoId: id }); setErrLinea(null) }
  function cambiarCantidad(v) {
    const c = Number(v)
    const r = Number.isInteger(c) && c > 0 ? rangoPara(rangos, c) : null
    setNl((s) => ({ ...s, cantidad: v, precio: r ? String(r.precio_lista) : s.precio }))
    setErrLinea(null)
  }

  function agregarLinea() {
    setErrLinea(null)
    if (!productoSel) return setErrLinea('Elige un producto.')
    const cantidad = Number(nl.cantidad)
    if (!Number.isInteger(cantidad) || cantidad <= 0) return setErrLinea('Las unidades deben ser un entero mayor a 0.')
    const rango = rangoPara(rangos, cantidad)
    if (!rango) return setErrLinea(`No hay un rango configurado para ${cantidad} unidades.`)
    const anios = Number(nl.anios)
    if (!Number.isInteger(anios) || anios < 1 || anios > 6) return setErrLinea('Los años deben estar entre 1 y 6.')
    const precio = Number(nl.precio)
    if (!Number.isFinite(precio) || precio < rango.precio_piso || precio > rango.precio_lista) {
      return setErrLinea(`El precio debe estar entre ${money(rango.precio_piso)} (piso) y ${money(rango.precio_lista)} (lista).`)
    }
    const ingreso_mensual = Math.round(precio * cantidad * 100) / 100
    const ingreso_anual = Math.round(ingreso_mensual * 12 * 100) / 100
    const subtotal = Math.round(ingreso_anual * anios * 100) / 100
    setLineas((p) => [...p, {
      producto_id: productoSel.id, descripcion: `${productoSel.nombre} — ${rango.nombre}`,
      cantidad, anios, precio_unitario: precio, ingreso_mensual, ingreso_anual, subtotal,
    }])
    setNl(LINEA_VACIA)
  }

  const quitarLinea = (i) => setLineas((p) => p.filter((_, idx) => idx !== i))
  function limpiarForm() { setClienteId(''); setFecha(hoy()); setNotas(''); setLineas([]); setNl(LINEA_VACIA); setEditId(null); setErrLinea(null) }

  async function guardar() {
    if (lineas.length === 0) return fail({ message: 'Agrega al menos una línea.' })
    setGuardando(true); setError(null); setAviso(null)
    const payload = {
      cliente_id: clienteId || null, fecha, notas,
      items: lineas.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad, anios: l.anios, precio_unitario: l.precio_unitario })),
    }
    try {
      if (editId) {
        const { venta } = await ventasApi.update(editId, payload)
        setCotizaciones((p) => p.map((v) => (v.id === editId ? { ...venta, num_items: venta.items.length } : v)))
        ok(`Cotización ${venta.folio || ''} actualizada.`)
      } else {
        const { venta } = await ventasApi.create(payload)
        setCotizaciones((p) => [{ ...venta, num_items: venta.items.length }, ...p])
        ok(`Cotización ${venta.folio || ''} generada.`)
      }
      limpiarForm()
    } catch (e) { fail(e) } finally { setGuardando(false) }
  }

  async function editar(v) {
    try {
      const { venta } = await ventasApi.get(v.id)
      setEditId(venta.id); setClienteId(venta.cliente_id || ''); setFecha((venta.fecha || hoy()).slice(0, 10)); setNotas(venta.notas || '')
      setLineas(venta.items.map((i) => ({
        producto_id: i.producto_id, descripcion: i.descripcion, cantidad: Number(i.cantidad), anios: Number(i.anios),
        precio_unitario: Number(i.precio_unitario), ingreso_mensual: Number(i.ingreso_mensual), ingreso_anual: Number(i.ingreso_anual), subtotal: Number(i.subtotal),
      })))
      ok('Cotización cargada para edición.'); window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) { fail(e) }
  }
  async function ver(v) {
    try { const { venta } = await ventasApi.get(v.id); setVerCot(venta); window.scrollTo({ top: 0, behavior: 'smooth' }) } catch (e) { fail(e) }
  }
  async function eliminar(v) {
    if (!window.confirm(`¿Eliminar la cotización ${v.folio || ''}?`)) return
    try { await ventasApi.remove(v.id); setCotizaciones((p) => p.filter((x) => x.id !== v.id)); ok('Cotización eliminada.') } catch (e) { fail(e) }
  }

  if (!perms.facultades.ventasVer) {
    return (
      <div className="dashboard slds-scope">
        <div className="slds-container_large slds-container_center">
          <div className="dash-topbar">
            <div><Link to="/inicio" className="dash-back">← Inicio</Link><h1 className="dash-greeting">Cotizaciones</h1></div>
            <button className="slds-button slds-button_neutral" onClick={salir}>Cerrar sesión</button>
          </div>
          <div className="slds-box slds-theme_default">
            <h2 className="slds-text-heading_small slds-m-bottom_x-small">Sin acceso</h2>
            <p className="slds-text-color_weak">No tienes la facultad <b>ventasVer</b>.</p>
            <p className="slds-m-top_small"><Link to="/inicio">← Volver al inicio</Link></p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard slds-scope">
      <div className="slds-container_large slds-container_center">
        <div className="dash-topbar no-print">
          <div>
            <Link to="/inicio" className="dash-back">← Inicio</Link>
            <h1 className="dash-greeting">Cotizaciones</h1>
            <p className="dash-subtitle">Simulación de ventas por rangos de unidades · estimación a 1-6 años</p>
          </div>
          <button className="slds-button slds-button_neutral" onClick={salir}>Cerrar sesión</button>
        </div>

        {error && <div className="slds-text-color_error slds-m-bottom_small no-print" role="alert">⚠️ {error}</div>}
        {aviso && <div className="slds-text-color_success slds-m-bottom_small no-print" role="status">✅ {aviso}</div>}

        {/* Vista imprimible: documento de cotización con estilo */}
        {verCot && (
          <>
            <div className="no-print slds-grid slds-grid_align-end slds-m-bottom_x-small" style={{ gap: '0.5rem' }}>
              <button className="slds-button slds-button_brand" onClick={() => window.print()}>🖨 Imprimir</button>
              <button className="slds-button slds-button_neutral" onClick={() => setVerCot(null)}>Cerrar</button>
            </div>
            <div className="cotizacion-print cot-doc slds-m-bottom_medium">
              {/* Encabezado con logo y banda azul */}
              <div className="cot-header">
                <img src="/logo.png" alt="LCG" className="cot-logo" />
                <div className="cot-meta">
                  <div className="cot-title">COTIZACIÓN</div>
                  <div className="cot-folio">{verCot.folio || ''}</div>
                  <div className="cot-fecha">{(verCot.fecha || '').slice(0, 10)}</div>
                </div>
              </div>

              <div className="cot-body">
                {/* Datos del cliente */}
                <div className="cot-parties">
                  <div>
                    <div className="cot-field-label">Cliente</div>
                    <div className="cot-field-value">{verCot.cliente_nombre || '—'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="cot-field-label">Vigencia</div>
                    <div className="cot-field-value">30 días</div>
                  </div>
                </div>

                {/* Tabla de conceptos */}
                <table className="cot-table">
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th className="num">Unidades</th>
                      <th className="num">$/mes</th>
                      <th className="num">Años</th>
                      <th className="num">Mensual</th>
                      <th className="num">Anual</th>
                      <th className="num">Estimado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(verCot.items || []).map((i) => (
                      <tr key={i.id}>
                        <td>{i.descripcion}</td>
                        <td className="num">{Number(i.cantidad)}</td>
                        <td className="num">{money(i.precio_unitario)}</td>
                        <td className="num">{i.anios}</td>
                        <td className="num">{money(i.ingreso_mensual)}</td>
                        <td className="num">{money(i.ingreso_anual)}</td>
                        <td className="num">{money(i.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Caja de totales */}
                <div className="cot-totals">
                  <div className="cot-totals-box">
                    <div className="cot-totals-row"><span>Total mensual</span><span>{money((verCot.items || []).reduce((s, i) => s + Number(i.ingreso_mensual || 0), 0))}</span></div>
                    <div className="cot-totals-row"><span>Total anual</span><span>{money((verCot.items || []).reduce((s, i) => s + Number(i.ingreso_anual || 0), 0))}</span></div>
                    <div className="cot-totals-grand"><span>Total estimado</span><span>{money(verCot.total)}</span></div>
                  </div>
                </div>

                {verCot.notas && (
                  <div className="cot-notes"><b>Notas:</b> {verCot.notas}</div>
                )}

                <div className="cot-foot">
                  Cotización (simulación) · Precios en MXN, sujetos a cambio sin previo aviso.<br />
                  LCG · Gracias por su preferencia.
                </div>
              </div>
            </div>
          </>
        )}

        {cargando ? (
          <p className="slds-text-color_weak">Cargando…</p>
        ) : (
          <>
            {canEdit && (
              <div className="slds-box slds-theme_default slds-m-bottom_medium no-print">
                <div className="slds-grid slds-grid_align-spread slds-m-bottom_small">
                  <h2 className="slds-text-heading_small">{editId ? 'Editar cotización' : 'Nueva cotización'}</h2>
                  {editId && <button className="slds-button slds-button_neutral" onClick={limpiarForm}>Cancelar edición</button>}
                </div>

                <div className="slds-grid slds-gutters slds-wrap slds-m-bottom_small">
                  <div className="slds-col slds-size_1-of-2"><label className="slds-form-element__label">Cliente</label>
                    <div className="slds-select_container"><select className="slds-select" value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
                      <option value="">— Sin cliente —</option>
                      {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select></div></div>
                  <div className="slds-col slds-grow-none"><label className="slds-form-element__label">Fecha</label>
                    <input className="slds-input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></div>
                </div>

                {vendibles.length === 0 ? (
                  <p className="slds-text-color_weak slds-text-body_small">
                    No hay productos con rangos. Créalos en <Link to="/configuracion-ventas">Configuración de ventas</Link>.
                  </p>
                ) : (
                  <div className="slds-box" style={{ background: '#fafafc', borderRadius: 12 }}>
                    <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end">
                      <div className="slds-col slds-size_1-of-3"><label className="slds-form-element__label">Producto (con servicio)</label>
                        <div className="slds-select_container"><select className="slds-select" value={nl.productoId} onChange={(e) => cambiarProducto(e.target.value)}>
                          <option value="">— Elegir —</option>
                          {vendibles.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select></div></div>
                      <div className="slds-col slds-grow-none" style={{ maxWidth: 120 }}><label className="slds-form-element__label">Unidades</label>
                        <input className="slds-input" type="number" min="1" step="1" value={nl.cantidad} disabled={!productoSel} onChange={(e) => cambiarCantidad(e.target.value)} /></div>
                      <div className="slds-col slds-grow-none" style={{ maxWidth: 90 }}><label className="slds-form-element__label">Años</label>
                        <div className="slds-select_container"><select className="slds-select" value={nl.anios} disabled={!productoSel} onChange={(e) => setNl({ ...nl, anios: e.target.value })}>
                          {ANIOS.map((a) => <option key={a} value={a}>{a}</option>)}
                        </select></div></div>
                      <div className="slds-col slds-grow-none" style={{ maxWidth: 150 }}><label className="slds-form-element__label">Precio unit./mes</label>
                        <input className="slds-input" type="number" min="0" step="0.01" value={nl.precio} disabled={!rangoSel} onChange={(e) => setNl({ ...nl, precio: e.target.value })} /></div>
                      <div className="slds-col slds-grow-none"><button type="button" className="slds-button slds-button_brand" onClick={agregarLinea} disabled={!rangoSel}>Agregar línea</button></div>
                    </div>
                    {nl.cantidad && !rangoSel && <p className="slds-text-color_error slds-text-body_small slds-m-top_x-small">⚠️ No hay rango para {nl.cantidad} unidades.</p>}
                    {rangoSel && (
                      <p className="slds-text-body_small slds-text-color_weak slds-m-top_x-small">
                        Rango: <b>{rangoSel.nombre}</b> · banda: piso {money(rangoSel.precio_piso)} – lista {money(rangoSel.precio_lista)} · Mensual = precio × {nl.cantidad}; Anual = ×12; Total = anual × años
                      </p>
                    )}
                    {errLinea && <p className="slds-text-color_error slds-text-body_small slds-m-top_x-small">⚠️ {errLinea}</p>}
                  </div>
                )}

                {lineas.length > 0 && (
                  <table className="slds-table slds-table_bordered slds-table_cell-buffer slds-m-top_small">
                    <thead><tr className="slds-line-height_reset"><th>Concepto</th><th>Unid.</th><th>$/mes</th><th>Años</th><th>Mensual</th><th>Anual</th><th>Estimado</th><th></th></tr></thead>
                    <tbody>
                      {lineas.map((l, i) => (
                        <tr key={i}>
                          <td>{l.descripcion}</td><td>{l.cantidad}</td><td>{money(l.precio_unitario)}</td><td>{l.anios}</td>
                          <td>{money(l.ingreso_mensual)}</td><td>{money(l.ingreso_anual)}</td><td>{money(l.subtotal)}</td>
                          <td><button className="slds-button slds-button_text-destructive" onClick={() => quitarLinea(i)}>×</button></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600 }}>TOTALES</td>
                        <td style={{ fontWeight: 600 }}>{money(totalMensual)}</td>
                        <td style={{ fontWeight: 600 }}>{money(totalAnual)}</td>
                        <td style={{ fontWeight: 600 }}>{money(totalContrato)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                )}

                <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end slds-m-top_small">
                  <div className="slds-col"><label className="slds-form-element__label">Notas</label>
                    <input className="slds-input" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" /></div>
                  <div className="slds-col slds-grow-none" style={{ textAlign: 'right' }}>
                    <div className="slds-text-body_small slds-text-color_weak">Total estimado</div>
                    <div className="metric-value" style={{ fontSize: '1.6rem' }}>{money(totalContrato)}</div>
                  </div>
                  <div className="slds-col slds-grow-none">
                    <button className="slds-button slds-button_brand" onClick={guardar} disabled={guardando || lineas.length === 0}>
                      {guardando ? 'Guardando…' : editId ? 'Guardar cambios' : 'Generar cotización'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="slds-box slds-theme_default no-print">
              <h2 className="slds-text-heading_small slds-m-bottom_small">Cotizaciones</h2>
              {cotizaciones.length === 0 ? (
                <p className="slds-text-color_weak">Aún no hay cotizaciones.</p>
              ) : (
                <table className="slds-table slds-table_bordered slds-table_cell-buffer">
                  <thead><tr className="slds-line-height_reset"><th>Folio</th><th>Fecha</th><th>Cliente</th><th>Líneas</th><th>Total estimado</th><th>Acciones</th></tr></thead>
                  <tbody>
                    {cotizaciones.map((v) => (
                      <tr key={v.id}>
                        <td>{v.folio || '—'}</td>
                        <td>{(v.fecha || '').slice(0, 10)}</td>
                        <td>{v.cliente_nombre || '—'}</td>
                        <td>{v.num_items}</td>
                        <td className="activity-amount">{money(v.total)}</td>
                        <td>
                          <button className="slds-button slds-button_neutral" onClick={() => ver(v)}>Ver</button>{' '}
                          {canEdit && <>
                            <button className="slds-button slds-button_neutral" onClick={() => editar(v)}>Editar</button>{' '}
                            <button className="slds-button slds-button_text-destructive" onClick={() => eliminar(v)}>Eliminar</button>
                          </>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
