// Cotizaciones (simulación de ventas). Modelo de rangos por unidades:
// escribes las unidades -> se elige el rango automáticamente (piso/lista) -> precio
// unitario en banda -> años (1-6). mensual = precio × unidades, anual = ×12,
// estimado por línea = anual × años. Total estimado = suma de los estimados por línea.
// Cliente viene de Universo, Prospectos o Pipeline.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { permissionsFor } from '../lib/permissions.js'
import { catalogoApi, oportunidadesApi, prospectoApi, universoApi, ventasApi } from '../services/api.js'

const hoy = () => new Date().toISOString().slice(0, 10)
const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ANIOS = [1, 2, 3, 4, 5, 6]
const LINEA_VACIA = { servicio: '', productoId: '', cantidad: '', anios: '1', precio: '' }

const rangoPara = (rangos, cantidad) =>
  rangos.find((r) => cantidad >= r.unidades_min && (r.unidades_max == null || cantidad <= r.unidades_max))

// Fuentes de cliente disponibles
const FUENTES = [
  { id: 'universo', label: 'Universo', tipo: 'universo' },
  { id: 'prospectos', label: 'Prospectos', tipo: 'prospecto' },
  { id: 'pipeline', label: 'Pipeline', tipo: 'oportunidad' },
]

export default function Cotizaciones() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const perms = permissionsFor(user)
  const canEdit = perms.facultades.ventasModificar
  const canDelete = perms.facultades.ventasEliminar

  const [productos, setProductos] = useState([])
  const [unidades, setUnidades] = useState([])
  const [cotizaciones, setCotizaciones] = useState([])
  // Datos de cada fuente
  const [listaUniverso, setListaUniverso] = useState([])
  const [listaProspectos, setListaProspectos] = useState([])
  const [listaPipeline, setListaPipeline] = useState([])

  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [verCot, setVerCot] = useState(null)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const cotDocRef = useRef(null)

  // Selección de cliente / origen
  const [fuente, setFuente] = useState('universo')
  const [origenId, setOrigenId] = useState('')
  const [origenTipo, setOrigenTipo] = useState('')
  const [origenNombre, setOrigenNombre] = useState('')
  const [origenContacto, setOrigenContacto] = useState('')

  const [fecha, setFecha] = useState(hoy())
  const [notas, setNotas] = useState('')
  const [lineas, setLineas] = useState([])
  const [editId, setEditId] = useState(null)
  const [nl, setNl] = useState(LINEA_VACIA)
  const [errLinea, setErrLinea] = useState(null)

  useEffect(() => {
    if (!perms.facultades.ventasVer) { setCargando(false); return }
    Promise.all([
      catalogoApi.listProductos(),
      catalogoApi.listUnidades(),
      ventasApi.list(),
      universoApi.list().catch(() => ({ universo: [] })),
      prospectoApi.list().catch(() => ({ prospectos: [] })),
      oportunidadesApi.list().catch(() => ({ oportunidades: [] })),
    ])
      .then(([p, un, v, u, pr, op]) => {
        setProductos(p.productos)
        setUnidades(un.unidades || [])
        setCotizaciones(v.ventas)
        setListaUniverso(u.universo || [])
        setListaProspectos(pr.prospectos || [])
        setListaPipeline(op.oportunidades || [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [perms.facultades.ventasVer])

  const ok = (m) => { setError(null); setAviso(m) }
  const fail = (e) => { setAviso(null); setError(e.message) }
  function salir() { logout(); navigate('/') }

  // Opciones del dropdown según la fuente activa
  const opcionesFuente = useMemo(() => {
    if (fuente === 'universo') return listaUniverso.map((r) => ({ id: r.id, nombre: r.empresa, contacto: r.contacto_nombre || '' }))
    if (fuente === 'prospectos') return listaProspectos.map((r) => ({ id: r.id, nombre: r.empresa, contacto: r.contacto_nombre || '' }))
    if (fuente === 'pipeline') return listaPipeline.map((r) => ({ id: r.id, nombre: r.prospecto, contacto: r.contacto_nombre || '' }))
    return []
  }, [fuente, listaUniverso, listaProspectos, listaPipeline])

  function seleccionarOrigen(id) {
    const op = opcionesFuente.find((o) => o.id === id)
    if (!op) { setOrigenId(''); setOrigenTipo(''); setOrigenNombre(''); setOrigenContacto(''); return }
    const tipo = FUENTES.find((f) => f.id === fuente)?.tipo || ''
    setOrigenId(id)
    setOrigenTipo(tipo)
    setOrigenNombre(op.nombre)
    setOrigenContacto(op.contacto)
  }

  function cambiarFuente(f) {
    setFuente(f)
    setOrigenId(''); setOrigenTipo(''); setOrigenNombre(''); setOrigenContacto('')
  }

  // Datos completos del cliente para mostrar en el documento
  const clienteDetalle = useMemo(() => {
    if (!verCot) return null
    if (verCot.origen_tipo === 'universo') return listaUniverso.find((r) => r.id === verCot.origen_id) || null
    if (verCot.origen_tipo === 'prospecto') return listaProspectos.find((r) => r.id === verCot.origen_id) || null
    if (verCot.origen_tipo === 'oportunidad') return listaPipeline.find((r) => r.id === verCot.origen_id) || null
    return null
  }, [verCot, listaUniverso, listaProspectos, listaPipeline])

  const vendibles = useMemo(() => productos.filter((p) => (p.tipos_venta || []).length > 0), [productos])
  const serviciosUnicos = useMemo(() => [...new Set(vendibles.map((p) => p.nombre))].sort(), [vendibles])
  const vendiblesPorServicio = useMemo(() => vendibles.filter((p) => p.nombre === nl.servicio), [vendibles, nl.servicio])
  const unidadObj = (id) => unidades.find((u) => u.id === id) || null
  const unidadNombre = (id) => unidadObj(id)?.nombre || null
  const lineaEsModulo = (l) => unidadObj(productos.find((p) => p.id === l.producto_id)?.unidad_id)?.abreviatura === 'Módulo'
  const labelVariante = (p) => [p.sector, unidadNombre(p.unidad_id)].filter(Boolean).join(' · ') || p.id
  const productoSel = productos.find((p) => p.id === nl.productoId)
  const rangos = productoSel?.tipos_venta || []
  const tipoUnidad = unidadObj(productoSel?.unidad_id)?.abreviatura || null
  const esModulo = tipoUnidad === 'Módulo'
  const cantNum = Number(nl.cantidad)
  const rangoSel = esModulo
    ? rangoPara(rangos, 1)
    : (Number.isInteger(cantNum) && cantNum > 0 ? rangoPara(rangos, cantNum) : null)

  const totalMensual = useMemo(() => lineas.reduce((s, l) => s + l.ingreso_mensual, 0), [lineas])
  const totalAnual = useMemo(() => lineas.reduce((s, l) => s + l.ingreso_anual, 0), [lineas])
  const totalContrato = useMemo(() => lineas.reduce((s, l) => s + l.subtotal, 0), [lineas])

  function cambiarServicio(nombre) { setNl({ ...LINEA_VACIA, servicio: nombre }); setErrLinea(null) }
  function cambiarProducto(id) {
    const prod = productos.find((p) => p.id === id)
    const tipo = unidadObj(prod?.unidad_id)?.abreviatura || null
    if (tipo === 'Módulo') {
      const rango = rangoPara(prod?.tipos_venta || [], 1)
      setNl((s) => ({ ...s, productoId: id, cantidad: '1', precio: rango ? String(rango.precio_lista) : '' }))
    } else {
      setNl((s) => ({ ...s, productoId: id, cantidad: '', precio: '' }))
    }
    setErrLinea(null)
  }
  function cambiarCantidad(v) {
    const c = Number(v)
    const r = Number.isInteger(c) && c > 0 ? rangoPara(rangos, c) : null
    setNl((s) => ({ ...s, cantidad: v, precio: r ? String(r.precio_lista) : s.precio }))
    setErrLinea(null)
  }

  function agregarLinea() {
    setErrLinea(null)
    if (!productoSel) return setErrLinea('Elige un producto.')
    const anios = Number(nl.anios)
    if (!Number.isInteger(anios) || anios < 1 || anios > 6) return setErrLinea('Los años deben estar entre 1 y 6.')
    const precio = Number(nl.precio)

    if (esModulo) {
      const rango = rangoPara(rangos, 1)
      if (!rango) return setErrLinea('No hay rango configurado para este módulo.')
      if (!Number.isFinite(precio) || precio < rango.precio_piso || precio > rango.precio_lista) {
        return setErrLinea(`El precio debe estar entre ${money(rango.precio_piso)} (piso) y ${money(rango.precio_lista)} (lista).`)
      }
      const ingreso_anual = Math.round(precio * 100) / 100
      const ingreso_mensual = Math.round(precio / 12 * 100) / 100
      const subtotal = Math.round(ingreso_anual * anios * 100) / 100
      setLineas((p) => [...p, {
        producto_id: productoSel.id, descripcion: `${productoSel.nombre} — ${rango.nombre}`,
        cantidad: 1, anios, precio_unitario: precio, ingreso_mensual, ingreso_anual, subtotal, es_modulo: true,
      }])
    } else {
      const cantidad = Number(nl.cantidad)
      if (!Number.isInteger(cantidad) || cantidad <= 0) return setErrLinea('Las unidades deben ser un entero mayor a 0.')
      const rango = rangoPara(rangos, cantidad)
      if (!rango) return setErrLinea(`No hay un rango configurado para ${cantidad} unidades.`)
      if (!Number.isFinite(precio) || precio < rango.precio_piso || precio > rango.precio_lista) {
        return setErrLinea(`El precio debe estar entre ${money(rango.precio_piso)} (piso) y ${money(rango.precio_lista)} (lista).`)
      }
      const ingreso_mensual = Math.round(precio * cantidad * 100) / 100
      const ingreso_anual = Math.round(ingreso_mensual * 12 * 100) / 100
      const subtotal = Math.round(ingreso_anual * anios * 100) / 100
      setLineas((p) => [...p, {
        producto_id: productoSel.id, descripcion: `${productoSel.nombre} — ${rango.nombre}`,
        cantidad, anios, precio_unitario: precio, ingreso_mensual, ingreso_anual, subtotal, es_modulo: false,
      }])
    }
    setNl((s) => ({ ...LINEA_VACIA, servicio: s.servicio }))
  }

  const quitarLinea = (i) => setLineas((p) => p.filter((_, idx) => idx !== i))

  function limpiarForm() {
    setOrigenId(''); setOrigenTipo(''); setOrigenNombre(''); setOrigenContacto('')
    setFuente('universo'); setFecha(hoy()); setNotas(''); setLineas([]); setNl(LINEA_VACIA); setEditId(null); setErrLinea(null)
  }

  async function guardar() {
    if (lineas.length === 0) return fail({ message: 'Agrega al menos una línea.' })
    setGuardando(true); setError(null); setAviso(null)
    const payload = {
      origen_tipo: origenTipo || null,
      origen_id: origenId || null,
      origen_nombre: origenNombre || null,
      fecha, notas,
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
      setEditId(venta.id)
      setFecha((venta.fecha || hoy()).slice(0, 10))
      setNotas(venta.notas || '')
      // Restaurar origen
      if (venta.origen_tipo) {
        setOrigenTipo(venta.origen_tipo)
        setOrigenId(venta.origen_id || '')
        setOrigenNombre(venta.origen_nombre || '')
        setOrigenContacto('')
        const fuenteMap = { universo: 'universo', prospecto: 'prospectos', oportunidad: 'pipeline' }
        setFuente(fuenteMap[venta.origen_tipo] || 'universo')
      }
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

  async function exportarPDF() {
    const el = cotDocRef.current
    if (!el) return
    setGenerandoPdf(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const { default: jsPDF } = await import('jspdf')
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const imgH = (canvas.height * pageW) / canvas.width
      let posY = 0
      while (posY < imgH) {
        if (posY > 0) pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, -posY, pageW, imgH)
        posY += pageH
      }
      pdf.save(`${verCot.folio || 'cotizacion'}.pdf`)
    } finally {
      setGenerandoPdf(false)
    }
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

        {/* Vista imprimible */}
        {verCot && (
          <>
            <div className="slds-grid slds-grid_align-end slds-m-bottom_x-small" style={{ gap: '0.5rem' }}>
              <button className="slds-button slds-button_brand" onClick={exportarPDF} disabled={generandoPdf}>
                {generandoPdf ? 'Generando PDF…' : '⬇ Guardar PDF'}
              </button>
              <button className="slds-button slds-button_neutral" onClick={() => setVerCot(null)}>Cerrar</button>
            </div>
            <div className="cot-doc slds-m-bottom_medium" ref={cotDocRef}>
              {/* Barra superior */}
              <div className="cot-header">
                <img src="/logo.png" alt="LCG" className="cot-logo" />
                <span className="cot-empresa-nombre">LCG IT &amp; CONSULTING</span>
              </div>

              <div className="cot-body">
                {/* Título */}
                <h1 className="cot-titulo-principal">Cotización de Servicios</h1>

                {/* Folio y fecha */}
                <div className="cot-folio-bloque">
                  <div className="cot-folio">{verCot.folio || ''}</div>
                  <div className="cot-fecha-doc">{(verCot.fecha || '').slice(0, 10)}</div>
                </div>

                {/* Datos del cliente */}
                <div className="cot-cliente-bloque">
                  <div className="cot-cliente-label">Datos del Cliente</div>
                  <div>{clienteDetalle?.empresa || clienteDetalle?.prospecto || verCot.cliente_nombre || '—'}</div>
                  {clienteDetalle?.contacto_nombre && <div>{clienteDetalle.contacto_nombre}</div>}
                  {clienteDetalle?.telefono && <div>{clienteDetalle.telefono}</div>}
                  {clienteDetalle?.email && <div>{clienteDetalle.email}</div>}
                </div>

                {/* Tabla de servicios */}
                <table className="cot-table">
                  <thead>
                    <tr>
                      <th>Concepto</th>
                      <th className="num">Unidades</th>
                      <th className="num">Ver total de contrato</th>
                      <th className="num">Duración de contrato</th>
                      <th className="num">Anual</th>
                      <th>Notas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(verCot.items || []).map((i) => {
                      const iMod = lineaEsModulo(i)
                      return (
                        <tr key={i.id}>
                          <td>{i.descripcion}</td>
                          <td className="num">{iMod ? '—' : Number(i.cantidad)}</td>
                          <td className="num">{money(i.precio_unitario)}</td>
                          <td className="num">{iMod ? `${Number(i.anios)} año${Number(i.anios) !== 1 ? 's' : ''}` : money(i.ingreso_mensual)}</td>
                          <td className="num">{iMod ? money(i.precio_unitario) : money(i.ingreso_anual)}</td>
                          <td></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {/* Total */}
                {(() => {
                  const docTotal = (verCot.items || []).reduce((sum, i) => {
                    const sub = lineaEsModulo(i)
                      ? Number(i.precio_unitario) * (Number(i.anios) || 1)
                      : Number(i.subtotal)
                    return sum + sub
                  }, 0)
                  return (
                <div className="cot-total-bloque">
                  <div className="cot-total-row">
                    <span>TOTAL</span>
                    <span>{money(docTotal)}</span>
                  </div>
                  <div className="cot-total-iva">*No incluye IVA</div>
                </div>
                  )
                })()}

                {/* Condiciones */}
                <div className="cot-condiciones">
                  <div className="cot-condiciones-titulo">CONDICIONES</div>
                  <div>Vigencia de la cotización: 30 días naturales</div>
                  {verCot.notas && <div style={{ marginTop: '0.4rem' }}>{verCot.notas}</div>}
                </div>

                {/* Pie */}
                <div className="cot-foot">
                  <div><img src="/ico/icono_web.ico" alt="" width={48} height={48} style={{ verticalAlign: 'middle', marginRight: 6 }} /><a href="https://lcg.mx" target="_blank" rel="noreferrer">lcg.mx</a></div>
                  <div><img src="/ico/icono_ubicacion.ico" alt="" width={48} height={48} style={{ verticalAlign: 'middle', marginRight: 6 }} />LCG IT &amp; Consulting – Euler 152, Chapultepec Morales, CMDX</div>
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

                {/* Selector de origen (cliente) */}
                <div className="slds-m-bottom_small">
                  <label className="slds-form-element__label slds-m-bottom_x-small" style={{ display: 'block' }}>
                    Cliente <span className="slds-text-color_weak" style={{ fontWeight: 400 }}>(selecciona la fuente)</span>
                  </label>
                  {/* Botones de fuente */}
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {FUENTES.map((f) => (
                      <button key={f.id} type="button"
                        className={fuente === f.id ? 'slds-button slds-button_brand' : 'slds-button slds-button_neutral'}
                        onClick={() => cambiarFuente(f.id)}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {/* Dropdown de empresas de la fuente */}
                  <div className="slds-grid slds-gutters slds-grid_vertical-align-center">
                    <div className="slds-col" style={{ maxWidth: 380 }}>
                      <div className="slds-select_container">
                        <select className="slds-select" value={origenId} onChange={(e) => seleccionarOrigen(e.target.value)}>
                          <option value="">— Seleccionar empresa —</option>
                          {opcionesFuente.map((o) => (
                            <option key={o.id} value={o.id}>{o.nombre}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {origenNombre && (
                      <div className="slds-col slds-grow-none">
                        <span style={{ fontSize: '0.85rem', color: '#374151' }}>
                          <b>{origenNombre}</b>
                          {origenContacto && <span className="slds-text-color_weak"> · {origenContacto}</span>}
                          <span className="slds-text-color_weak" style={{ marginLeft: 6, fontSize: '0.78rem', textTransform: 'capitalize' }}>({origenTipo})</span>
                        </span>
                      </div>
                    )}
                    {opcionesFuente.length === 0 && (
                      <div className="slds-col slds-grow-none">
                        <span className="slds-text-color_weak" style={{ fontSize: '0.85rem' }}>Sin registros en esta fuente.</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Fecha */}
                <div className="slds-m-bottom_small" style={{ maxWidth: 180 }}>
                  <label className="slds-form-element__label">Fecha</label>
                  <input className="slds-input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>

                {vendibles.length === 0 ? (
                  <p className="slds-text-color_weak slds-text-body_small">
                    No hay productos con rangos. Créalos en <Link to="/configuracion-ventas">Configuración de ventas</Link>.
                  </p>
                ) : (
                  <div className="slds-box" style={{ background: '#fafafc', borderRadius: 12 }}>
                    <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end">
                      <div className="slds-col slds-grow-none" style={{ minWidth: 140 }}>
                        <label className="slds-form-element__label">Servicio</label>
                        <div className="slds-select_container">
                          <select className="slds-select" value={nl.servicio} onChange={(e) => cambiarServicio(e.target.value)}>
                            <option value="">— Elegir —</option>
                            {serviciosUnicos.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="slds-col slds-grow-none" style={{ minWidth: 160 }}>
                        <label className="slds-form-element__label">Unidad</label>
                        <div className="slds-select_container">
                          <select className="slds-select" value={nl.productoId} disabled={!nl.servicio} onChange={(e) => cambiarProducto(e.target.value)}>
                            <option value="">— Elegir —</option>
                            {vendiblesPorServicio.map((p) => <option key={p.id} value={p.id}>{labelVariante(p)}</option>)}
                          </select>
                        </div>
                      </div>
                      {!esModulo && (
                        <div className="slds-col slds-grow-none" style={{ maxWidth: 120 }}>
                          <label className="slds-form-element__label">Unidades</label>
                          <input className="slds-input" type="number" min="1" step="1" value={nl.cantidad} disabled={!productoSel} onChange={(e) => cambiarCantidad(e.target.value)} />
                        </div>
                      )}
                      <div className="slds-col slds-grow-none" style={{ maxWidth: 90 }}>
                        <label className="slds-form-element__label">Años</label>
                        <div className="slds-select_container">
                          <select className="slds-select" value={nl.anios} disabled={!productoSel} onChange={(e) => setNl({ ...nl, anios: e.target.value })}>
                            {ANIOS.map((a) => <option key={a} value={a}>{a}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="slds-col slds-grow-none" style={{ maxWidth: 150 }}>
                        <label className="slds-form-element__label">{esModulo ? 'Precio/año' : 'Precio unit./mes'}</label>
                        <input className="slds-input" type="number" min="0" step="0.01" value={nl.precio} disabled={!rangoSel} onChange={(e) => setNl({ ...nl, precio: e.target.value })} />
                      </div>
                      <div className="slds-col slds-grow-none">
                        <button type="button" className="slds-button slds-button_brand" onClick={agregarLinea} disabled={!rangoSel || !nl.precio}>Agregar línea</button>
                      </div>
                    </div>
                    {!esModulo && nl.cantidad && !rangoSel && <p className="slds-text-color_error slds-text-body_small slds-m-top_x-small">⚠️ No hay rango para {nl.cantidad} unidades.</p>}
                    {rangoSel && (
                      <p className="slds-text-body_small slds-text-color_weak slds-m-top_x-small">
                        Rango: <b>{rangoSel.nombre}</b> · banda: piso {money(rangoSel.precio_piso)} – lista {money(rangoSel.precio_lista)}{esModulo ? ' · Total = precio/año × años' : ` · Mensual = precio × ${nl.cantidad}; Anual = ×12; Total = anual × años`}
                      </p>
                    )}
                    {errLinea && <p className="slds-text-color_error slds-text-body_small slds-m-top_x-small">⚠️ {errLinea}</p>}
                  </div>
                )}

                {lineas.length > 0 && (
                  <table className="slds-table slds-table_bordered slds-table_cell-buffer slds-m-top_small">
                    <thead><tr className="slds-line-height_reset"><th>Concepto</th><th>Unid.</th><th>Precio</th><th>Años</th><th>Mensual</th><th>Anual</th><th>Estimado</th><th></th></tr></thead>
                    <tbody>
                      {lineas.map((l, i) => {
                        const lMod = lineaEsModulo(l)
                        return (
                        <tr key={i}>
                          <td>{l.descripcion}</td>
                          <td>{lMod ? '—' : l.cantidad}</td>
                          <td>{lMod ? `${money(l.precio_unitario)}/año` : `${money(l.precio_unitario)}/mes`}</td>
                          <td>{l.anios}</td>
                          <td>{lMod ? '—' : money(l.ingreso_mensual)}</td>
                          <td>{money(l.ingreso_anual)}</td>
                          <td>{money(l.subtotal)}</td>
                          <td><button className="slds-button slds-button_text-destructive" onClick={() => quitarLinea(i)}>×</button></td>
                        </tr>
                      )})}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600 }}>TOTALES</td>
                        <td style={{ fontWeight: 600 }}>{lineas.every((l) => lineaEsModulo(l)) ? '—' : money(totalMensual)}</td>
                        <td style={{ fontWeight: 600 }}>{money(totalAnual)}</td>
                        <td style={{ fontWeight: 600 }}>{money(totalContrato)}</td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                )}

                <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end slds-m-top_small">
                  <div className="slds-col">
                    <label className="slds-form-element__label">Notas</label>
                    <input className="slds-input" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" />
                  </div>
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
                <div style={{ overflowX: 'auto' }}>
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
                            {canEdit && <><button className="slds-button slds-button_neutral" onClick={() => editar(v)}>Editar</button>{' '}</>}
                          {canDelete && <button className="slds-button slds-button_text-destructive" onClick={() => eliminar(v)}>Eliminar</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
