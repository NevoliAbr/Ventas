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

const guardarPendientesLS = (lista) => localStorage.setItem('lcg_pendientes_pipeline:v1', JSON.stringify(lista))

const hoy = () => new Date().toISOString().slice(0, 10)
const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const ANIOS = [1, 2, 3, 4, 5, 6]
const LINEA_VACIA = { servicio: '', productoId: '', cantidad: '', anios: '1', precio: '' }
const ETAPAS_PIPELINE = ['Prospecting', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost']
const PROBS_PIPELINE = [0, 0.25, 0.5, 0.75, 0.9, 1]
const PROB_LABELS_PIPELINE = { 0: 'Sin posibilidad', 0.25: 'Interesado', 0.5: 'En aprobación', 0.75: 'Aprobado / Finanzas', 0.9: 'Esperando contrato', 1: 'CERRADO' }
const TRIMESTRES_PIPELINE = ['Q1', 'Q2', 'Q3', 'Q4']

const rangoPara = (rangos, cantidad) =>
  rangos.find((r) => cantidad >= r.unidades_min && (r.unidades_max == null || cantidad <= r.unidades_max))

// Fuentes de cliente disponibles
const FUENTES = [
  { id: 'universo', label: 'Universo', tipo: 'universo' },
  { id: 'prospectos', label: 'Prospectos', tipo: 'prospecto' },
  { id: 'pipeline', label: 'Pipeline', tipo: 'oportunidad' },
]

// ── Hook: datos del catálogo + historial de cotizaciones + las 3 fuentes de cliente ──
function useCatalogoData(puedeVer) {
  const [productos, setProductos] = useState([])
  const [unidades, setUnidades] = useState([])
  const [cotizaciones, setCotizaciones] = useState([])
  const [listaUniverso, setListaUniverso] = useState([])
  const [listaProspectos, setListaProspectos] = useState([])
  const [listaPipeline, setListaPipeline] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!puedeVer) { setCargando(false); return }
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
  }, [puedeVer])

  return {
    productos, unidades, cotizaciones, setCotizaciones,
    listaUniverso, listaProspectos, listaPipeline,
    cargando, error, setError,
  }
}

// ── Hook: selección de cliente (fuente + empresa) ──
function useOrigenSelector(listaUniverso, listaProspectos, listaPipeline) {
  const [fuente, setFuente] = useState('universo')
  const [origenId, setOrigenId] = useState('')
  const [origenTipo, setOrigenTipo] = useState('')
  const [origenNombre, setOrigenNombre] = useState('')
  const [origenContacto, setOrigenContacto] = useState('')

  const opcionesFuente = useMemo(() => {
    if (fuente === 'universo') return listaUniverso.map((r) => ({ id: r.id, nombre: r.empresa, contacto: r.contacto_nombre || '' }))
    if (fuente === 'prospectos') return listaProspectos.map((r) => ({ id: r.id, nombre: r.empresa, contacto: r.contacto_nombre || '' }))
    if (fuente === 'pipeline') return listaPipeline.map((r) => ({ id: r.id, nombre: r.prospecto, contacto: r.contacto_nombre || '' }))
    return []
  }, [fuente, listaUniverso, listaProspectos, listaPipeline])

  function seleccionar(id) {
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

  function reset() {
    setOrigenId(''); setOrigenTipo(''); setOrigenNombre(''); setOrigenContacto('')
    setFuente('universo')
  }

  // Restaura el origen al cargar una cotización existente para editar.
  function restaurar(venta) {
    setOrigenTipo(venta.origen_tipo)
    setOrigenId(venta.origen_id || '')
    setOrigenNombre(venta.origen_nombre || '')
    setOrigenContacto('')
    const fuenteMap = { universo: 'universo', prospecto: 'prospectos', oportunidad: 'pipeline' }
    setFuente(fuenteMap[venta.origen_tipo] || 'universo')
  }

  return { fuente, origenId, origenTipo, origenNombre, origenContacto, opcionesFuente, seleccionar, cambiarFuente, reset, restaurar }
}

// ── Hook: construcción de líneas de la cotización (servicio → producto → rango → precio) ──
function useLineaBuilder(productos, unidades) {
  const [nl, setNl] = useState(LINEA_VACIA)
  const [errLinea, setErrLinea] = useState(null)
  const [lineas, setLineas] = useState([])

  const vendibles = useMemo(() => productos.filter((p) => (p.tipos_venta || []).length > 0), [productos])
  const serviciosUnicos = useMemo(() => [...new Set(vendibles.map((p) => p.nombre))].sort(), [vendibles])
  const vendiblesPorServicio = useMemo(() => vendibles.filter((p) => p.nombre === nl.servicio), [vendibles, nl.servicio])
  const unidadObj = (id) => unidades.find((u) => u.id === id) || null
  const unidadNombre = (id) => unidadObj(id)?.nombre || null
  const lineaTipoAbrev = (l) => unidadObj(productos.find((p) => p.id === l.producto_id)?.unidad_id)?.abreviatura || null
  const lineaEsModulo = (l) => lineaTipoAbrev(l) === 'Módulo'
  const lineaEsUnicoUnidad = (l) => lineaTipoAbrev(l) === 'Único por Unidad'
  const lineaEsUnico = (l) => lineaEsUnicoUnidad(l) || lineaTipoAbrev(l) === 'Único por piezas'
  const labelVariante = (p) => [p.sector, unidadNombre(p.unidad_id)].filter(Boolean).join(' · ') || p.id
  const productoSel = productos.find((p) => p.id === nl.productoId)
  const rangos = productoSel?.tipos_venta || []
  const tipoUnidad = unidadObj(productoSel?.unidad_id)?.abreviatura || null
  const esModulo = tipoUnidad === 'Módulo'
  const esUnicoUnidad = tipoUnidad === 'Único por Unidad'
  const esUnicoPiezas = tipoUnidad === 'Único por piezas'
  const esUnico = esUnicoUnidad || esUnicoPiezas
  const sinCantidad = esModulo || esUnicoUnidad
  const cantNum = Number(nl.cantidad)
  const rangoSel = sinCantidad
    ? rangoPara(rangos, 1)
    : (Number.isInteger(cantNum) && cantNum > 0 ? rangoPara(rangos, cantNum) : null)

  const totalMensual = useMemo(() => lineas.reduce((s, l) => s + (Number(l.ingreso_mensual) || 0), 0), [lineas])
  const totalAnual = useMemo(() => lineas.reduce((s, l) => s + (Number(l.ingreso_anual) || 0), 0), [lineas])
  const totalContrato = useMemo(() => lineas.reduce((s, l) => s + l.subtotal, 0), [lineas])

  function cambiarServicio(nombre) { setNl({ ...LINEA_VACIA, servicio: nombre }); setErrLinea(null) }
  function cambiarProducto(id) {
    const prod = productos.find((p) => p.id === id)
    const tipo = unidadObj(prod?.unidad_id)?.abreviatura || null
    if (tipo === 'Módulo' || tipo === 'Único por Unidad') {
      const rango = rangoPara(prod?.tipos_venta || [], 1)
      setNl((s) => ({ ...s, productoId: id, cantidad: '1', precio: rango ? String(rango.precio_lista) : '' }))
    } else {
      const rangosProd = prod?.tipos_venta || []
      const minCant = rangosProd.length > 0 ? Math.min(...rangosProd.map((r) => r.unidades_min)) : 1
      const rango = rangoPara(rangosProd, minCant)
      setNl((s) => ({ ...s, productoId: id, cantidad: String(minCant), precio: rango ? String(rango.precio_lista) : '' }))
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
    const precio = Number(nl.precio)

    if (esModulo) {
      const anios = Number(nl.anios)
      if (!Number.isInteger(anios) || anios < 1 || anios > 6) return setErrLinea('Los años deben estar entre 1 y 6.')
      const rango = rangoPara(rangos, 1)
      if (!rango) return setErrLinea('No hay rango configurado para este módulo.')
      if (!Number.isFinite(precio) || precio < rango.precio_piso) {
        return setErrLinea(`El precio no puede ser menor al piso (${money(rango.precio_piso)}).`)
      }
      const ingreso_anual = Math.round(precio * 100) / 100
      const ingreso_mensual = Math.round(precio / 12 * 100) / 100
      const subtotal = Math.round(ingreso_anual * anios * 100) / 100
      setLineas((p) => [...p, {
        _key: crypto.randomUUID(), producto_id: productoSel.id, descripcion: `${productoSel.nombre} — ${rango.nombre}`,
        cantidad: 1, anios, precio_unitario: precio, ingreso_mensual, ingreso_anual, subtotal, es_modulo: true,
      }])
    } else if (esUnico) {
      const cantidad = esUnicoUnidad ? 1 : Number(nl.cantidad)
      if (!esUnicoUnidad && (!Number.isInteger(cantidad) || cantidad <= 0)) return setErrLinea('Las piezas deben ser un entero mayor a 0.')
      const rango = rangoPara(rangos, cantidad)
      if (!rango) return setErrLinea(`No hay un rango configurado para ${cantidad} ${esUnicoUnidad ? 'unidad' : 'piezas'}.`)
      if (!Number.isFinite(precio) || precio < rango.precio_piso) {
        return setErrLinea(`El precio no puede ser menor al piso (${money(rango.precio_piso)}).`)
      }
      const subtotal = Math.round(precio * cantidad * 100) / 100
      setLineas((p) => [...p, {
        _key: crypto.randomUUID(), producto_id: productoSel.id, descripcion: `${productoSel.nombre} — ${rango.nombre}`,
        cantidad, anios: 1, precio_unitario: precio, ingreso_mensual: null, ingreso_anual: null, subtotal, es_modulo: false,
      }])
    } else {
      const anios = Number(nl.anios)
      if (!Number.isInteger(anios) || anios < 1 || anios > 6) return setErrLinea('Los años deben estar entre 1 y 6.')
      const cantidad = Number(nl.cantidad)
      if (!Number.isInteger(cantidad) || cantidad <= 0) return setErrLinea('Las unidades deben ser un entero mayor a 0.')
      const rango = rangoPara(rangos, cantidad)
      if (!rango) return setErrLinea(`No hay un rango configurado para ${cantidad} unidades.`)
      if (!Number.isFinite(precio) || precio < rango.precio_piso) {
        return setErrLinea(`El precio no puede ser menor al piso (${money(rango.precio_piso)}).`)
      }
      const ingreso_mensual = Math.round(precio * cantidad * 100) / 100
      const ingreso_anual = Math.round(ingreso_mensual * 12 * 100) / 100
      const subtotal = Math.round(ingreso_anual * anios * 100) / 100
      setLineas((p) => [...p, {
        _key: crypto.randomUUID(), producto_id: productoSel.id, descripcion: `${productoSel.nombre} — ${rango.nombre}`,
        cantidad, anios, precio_unitario: precio, ingreso_mensual, ingreso_anual, subtotal, es_modulo: false,
      }])
    }
    setNl((s) => ({ ...LINEA_VACIA, servicio: s.servicio }))
  }

  const quitarLinea = (i) => setLineas((p) => p.filter((_, idx) => idx !== i))

  function reset() {
    setLineas([]); setNl(LINEA_VACIA); setErrLinea(null)
  }

  return {
    nl, setNl, errLinea, lineas, setLineas,
    vendibles, serviciosUnicos, vendiblesPorServicio,
    productoSel, rangoSel, esModulo, esUnico, esUnicoUnidad, esUnicoPiezas, sinCantidad,
    lineaEsModulo, lineaEsUnico, lineaEsUnicoUnidad, labelVariante,
    cambiarServicio, cambiarProducto, cambiarCantidad, agregarLinea, quitarLinea,
    totalMensual, totalAnual, totalContrato, reset,
  }
}

// ── Hook: chips de cotizaciones pendientes de pasar a Pipeline ──
function usePipelinePendientes() {
  const [pendientesPipeline, setPendientesPipeline] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lcg_pendientes_pipeline:v1') || '[]') } catch { return [] }
  })
  const [mostrarPendientesPipeline, setMostrarPendientesPipeline] = useState(true)
  const [pipelineSeleccionado, setPipelineSeleccionado] = useState(null)
  const [pipelineGuardando, setPipelineGuardando] = useState(false)
  const [errPipeline, setErrPipeline] = useState(null)

  const pm = (patch) => setPipelineSeleccionado((p) => ({ ...p, ...patch }))

  function agregarPendiente(nuevoPendiente) {
    setPendientesPipeline((prev) => {
      const next = [...prev, nuevoPendiente]
      guardarPendientesLS(next)
      return next
    })
    setMostrarPendientesPipeline(true)
  }

  function seleccionar(item) {
    setPipelineSeleccionado(item)
    setErrPipeline(null)
  }

  function cerrar() {
    setPipelineSeleccionado(null)
    setErrPipeline(null)
  }

  async function guardarPipeline(e) {
    e.preventDefault()
    const f = pipelineSeleccionado
    setPipelineGuardando(true); setErrPipeline(null)
    try {
      await oportunidadesApi.create({
        prospecto: f.prospecto, sector: f.sector, tipo: f.tipo,
        producto_id: f.productoId, unidades: Number(f.unidades), anios: Number(f.anios),
        precio_unitario: Number(f.precio), prob_cierre: Number(f.prob),
        etapa: f.etapa, trimestre: f.trimestre, mes_estimado: f.mes,
        notas: f.notas, responsable: f.responsable,
        contacto_nombre: f.contacto_nombre, contacto_telefono: f.contacto_telefono,
        fecha_cotizacion: f.fecha_cotizacion, proximo_paso: f.proximo_paso, fecha_sig_paso: f.fecha_sig_paso,
      })
      const folio = f._folio
      setPendientesPipeline((prev) => {
        const next = prev.filter((x) => x._folio !== folio)
        guardarPendientesLS(next)
        return next
      })
      setPipelineSeleccionado(null)
      return folio
    } finally {
      setPipelineGuardando(false)
    }
  }

  return {
    pendientesPipeline, mostrarPendientesPipeline, setMostrarPendientesPipeline,
    pipelineSeleccionado, pipelineGuardando, errPipeline, setErrPipeline,
    pm, agregarPendiente, seleccionar, cerrar, guardarPipeline,
  }
}

export default function Cotizaciones() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const perms = permissionsFor(user)
  const canEdit = perms.facultades.ventasModificar
  const canDelete = perms.facultades.ventasEliminar

  const catalogo = useCatalogoData(perms.facultades.ventasVer)
  const origen = useOrigenSelector(catalogo.listaUniverso, catalogo.listaProspectos, catalogo.listaPipeline)
  const linea = useLineaBuilder(catalogo.productos, catalogo.unidades)
  const pipeline = usePipelinePendientes()

  const [aviso, setAviso] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [verCot, setVerCot] = useState(null)
  const [generandoPdf, setGenerandoPdf] = useState(false)
  const cotDocRef = useRef(null)

  const [fecha, setFecha] = useState(() => hoy())
  const [notas, setNotas] = useState('')
  const [editId, setEditId] = useState(null)

  const ok = (m) => { catalogo.setError(null); setAviso(m) }
  const fail = (e) => { setAviso(null); catalogo.setError(e.message) }
  function salir() { logout(); navigate('/') }

  // Datos completos del cliente para mostrar en el documento
  const clienteDetalle = useMemo(() => {
    if (!verCot) return null
    if (verCot.origen_tipo === 'universo') return catalogo.listaUniverso.find((r) => r.id === verCot.origen_id) || null
    if (verCot.origen_tipo === 'prospecto') return catalogo.listaProspectos.find((r) => r.id === verCot.origen_id) || null
    if (verCot.origen_tipo === 'oportunidad') return catalogo.listaPipeline.find((r) => r.id === verCot.origen_id) || null
    return null
  }, [verCot, catalogo.listaUniverso, catalogo.listaProspectos, catalogo.listaPipeline])

  function limpiarForm() {
    origen.reset()
    setFecha(hoy()); setNotas('')
    linea.reset()
    setEditId(null)
  }

  async function guardar() {
    if (linea.lineas.length === 0) return fail({ message: 'Agrega al menos una línea.' })
    setGuardando(true); catalogo.setError(null); setAviso(null)
    const payload = {
      origen_tipo: origen.origenTipo || null,
      origen_id: origen.origenId || null,
      origen_nombre: origen.origenNombre || null,
      fecha, notas,
      items: linea.lineas.map((l) => ({ producto_id: l.producto_id, cantidad: l.cantidad, anios: l.anios, precio_unitario: l.precio_unitario })),
    }
    try {
      if (editId) {
        const { venta } = await ventasApi.update(editId, payload)
        catalogo.setCotizaciones((p) => p.map((v) => (v.id === editId ? { ...venta, num_items: venta.items.length } : v)))
        ok(`Cotización ${venta.folio || ''} actualizada.`)
        limpiarForm()
      } else {
        const { venta } = await ventasApi.create(payload)
        catalogo.setCotizaciones((p) => [{ ...venta, num_items: venta.items.length }, ...p])
        limpiarForm()
        if (origen.origenTipo === 'universo' || origen.origenTipo === 'prospecto') {
          const clienteRec =
            origen.origenTipo === 'universo'
              ? catalogo.listaUniverso.find((r) => r.id === origen.origenId)
              : catalogo.listaProspectos.find((r) => r.id === origen.origenId)
          const pl = venta.items?.[0]
          pipeline.agregarPendiente({
            _folio: venta.folio || '',
            prospecto: origen.origenNombre || '',
            sector: clienteRec?.rubro || '',
            tipo: clienteRec?.tipo || '',
            productoId: pl?.producto_id || '',
            unidades: String(pl?.cantidad ?? ''),
            anios: String(pl?.anios ?? '1'),
            precio: String(pl?.precio_unitario ?? ''),
            prob: '0.25',
            etapa: 'Prospecting',
            trimestre: 'Q2',
            mes: '',
            notas: '',
            responsable: clienteRec?.responsable || '',
            contacto_nombre: clienteRec?.contacto_nombre || '',
            contacto_telefono: clienteRec?.telefono || '',
            fecha_cotizacion: (venta.fecha || '').slice(0, 10),
            proximo_paso: '',
            fecha_sig_paso: '',
          })
        } else {
          ok(`Cotización ${venta.folio || ''} generada.`)
        }
      }
    } catch (e) { fail(e) } finally { setGuardando(false) }
  }

  async function guardarPipelineForm(e) {
    try {
      const folio = await pipeline.guardarPipeline(e)
      ok(`Cotización ${folio} · oportunidad agregada a Pipeline.`)
    } catch (err) {
      pipeline.setErrPipeline(err.message)
    }
  }

  async function editar(v) {
    try {
      const { venta } = await ventasApi.get(v.id)
      setEditId(venta.id)
      setFecha((venta.fecha || hoy()).slice(0, 10))
      setNotas(venta.notas || '')
      if (venta.origen_tipo) origen.restaurar(venta)
      linea.setLineas(venta.items.map((i) => ({
        _key: i.id || crypto.randomUUID(), producto_id: i.producto_id, descripcion: i.descripcion, cantidad: Number(i.cantidad), anios: Number(i.anios),
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
    try { await ventasApi.remove(v.id); catalogo.setCotizaciones((p) => p.filter((x) => x.id !== v.id)); ok('Cotización eliminada.') } catch (e) { fail(e) }
  }

  async function exportarPDF() {
    const el = cotDocRef.current
    if (!el) return
    setGenerandoPdf(true)
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
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
            <button type="button" className="slds-button slds-button_neutral" onClick={salir}>Cerrar sesión</button>
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
          <button type="button" className="slds-button slds-button_neutral" onClick={salir}>Cerrar sesión</button>
        </div>

        {catalogo.error && <div className="slds-text-color_error slds-m-bottom_small no-print" role="alert">⚠️ {catalogo.error}</div>}
        {aviso && <div className="slds-text-color_success slds-m-bottom_small no-print" role="status">✅ {aviso}</div>}

        {verCot && (
          <CotizacionDocumento
            verCot={verCot} clienteDetalle={clienteDetalle} lineaEsModulo={linea.lineaEsModulo}
            lineaEsUnico={linea.lineaEsUnico} lineaEsUnicoUnidad={linea.lineaEsUnicoUnidad}
            generandoPdf={generandoPdf} onExportarPDF={exportarPDF} onCerrar={() => setVerCot(null)}
            cotDocRef={cotDocRef}
          />
        )}

        {catalogo.cargando ? (
          <p className="slds-text-color_weak">Cargando…</p>
        ) : (
          <>
            {canEdit && (
              <NuevaCotizacionFormulario
                editId={editId} onCancelarEdicion={limpiarForm}
                origen={origen} fecha={fecha} setFecha={setFecha}
                linea={linea} notas={notas} setNotas={setNotas}
                guardando={guardando} onGuardar={guardar}
              />
            )}

            {pipeline.pendientesPipeline.length > 0 && (
              <PendientesPipelineBanner
                pendientes={pipeline.pendientesPipeline} mostrar={pipeline.mostrarPendientesPipeline}
                onToggleMostrar={() => pipeline.setMostrarPendientesPipeline((v) => !v)}
                seleccionado={pipeline.pipelineSeleccionado} onSeleccionar={pipeline.seleccionar}
              />
            )}

            {pipeline.pipelineSeleccionado && (
              <PipelineFormulario
                sel={pipeline.pipelineSeleccionado} pm={pipeline.pm}
                vendibles={linea.vendibles} guardando={pipeline.pipelineGuardando} error={pipeline.errPipeline}
                onSubmit={guardarPipelineForm} onCerrar={pipeline.cerrar}
              />
            )}

            <CotizacionesTabla
              cotizaciones={catalogo.cotizaciones} canEdit={canEdit} canDelete={canDelete}
              onVer={ver} onEditar={editar} onEliminar={eliminar}
            />
          </>
        )}
      </div>
    </div>
  )
}

function CotizacionDocumento({ verCot, clienteDetalle, lineaEsModulo, lineaEsUnico, lineaEsUnicoUnidad, generandoPdf, onExportarPDF, onCerrar, cotDocRef }) {
  const docItems = verCot.items || []
  const ocultarUnidades = docItems.length > 0 && docItems.every((i) => lineaEsModulo(i) || lineaEsUnicoUnidad(i))
  const docTotal = docItems.reduce((sum, i) => {
    const sub = lineaEsModulo(i)
      ? Number(i.precio_unitario) * (Number(i.anios) || 1)
      : Number(i.subtotal)
    return sum + sub
  }, 0)

  return (
    <>
      <div className="slds-grid slds-grid_align-end slds-m-bottom_x-small" style={{ gap: '0.5rem' }}>
        <button type="button" className="slds-button slds-button_brand" onClick={onExportarPDF} disabled={generandoPdf}>
          {generandoPdf ? 'Generando PDF…' : '⬇ Guardar PDF'}
        </button>
        <button type="button" className="slds-button slds-button_neutral" onClick={onCerrar}>Cerrar</button>
      </div>
      <div className="cot-doc slds-m-bottom_medium" ref={cotDocRef}>
        {/* Barra superior */}
        <div className="cot-header">
          <img src="/logo.png" alt="LCG" className="cot-logo" />
          <span className="cot-empresa-nombre">LCG IT &amp; CONSULTING</span>
        </div>

        <div className="cot-body">
          <h1 className="cot-titulo-principal">Cotización de Servicios</h1>

          <div className="cot-folio-bloque">
            <div className="cot-folio">{verCot.folio || ''}</div>
            <div className="cot-fecha-doc">{(verCot.fecha || '').slice(0, 10)}</div>
          </div>

          <div className="cot-cliente-bloque">
            <div className="cot-cliente-label">Datos del Cliente</div>
            <div>{clienteDetalle?.empresa || clienteDetalle?.prospecto || verCot.cliente_nombre || '—'}</div>
            {clienteDetalle?.contacto_nombre && <div>{clienteDetalle.contacto_nombre}</div>}
            {clienteDetalle?.telefono && <div>{clienteDetalle.telefono}</div>}
            {clienteDetalle?.email && <div>{clienteDetalle.email}</div>}
          </div>

          <table className="cot-table">
            <thead>
              <tr>
                <th>Concepto</th>
                {!ocultarUnidades && <th className="num">Unidades</th>}
                <th className="num">Precio unitario</th>
                <th className="num">Duración de contrato</th>
                <th className="num">Precio anual</th>
                <th>Notas</th>
              </tr>
            </thead>
            <tbody>
              {docItems.map((i) => {
                const iMod = lineaEsModulo(i)
                const iUnico = lineaEsUnico(i)
                const iUnicoUnidad = lineaEsUnicoUnidad(i)
                return (
                  <tr key={i.id}>
                    <td>{i.descripcion}{iUnico && <><br /><span style={{ fontSize: '0.75rem', color: '#7c3aed', fontWeight: 600 }}>Pago único</span></>}</td>
                    {!ocultarUnidades && <td className="num">{iMod || iUnicoUnidad ? '—' : Number(i.cantidad)}</td>}
                    <td className="num">{money(i.precio_unitario)}</td>
                    <td className="num">{iMod ? `${Number(i.anios)} año${Number(i.anios) !== 1 ? 's' : ''}` : iUnico ? 'Pago único' : `${Number(i.anios) * 12} meses`}</td>
                    <td className="num">{iMod ? money(i.precio_unitario) : iUnico ? money(i.subtotal) : money(i.ingreso_anual)}</td>
                    <td></td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <div className="cot-total-bloque">
            <div className="cot-total-row">
              <span>TOTAL</span>
              <span>{money(docTotal)}</span>
            </div>
            <div className="cot-total-iva">*No incluye IVA</div>
          </div>

          <div className="cot-condiciones">
            <div className="cot-condiciones-titulo">CONDICIONES</div>
            <div>Vigencia de la cotización: 30 días naturales</div>
            <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#9ca3af' }}>* La presente cotización constituye una propuesta comercial y no representa una obligación contractual para ninguna de las partes hasta la firma del contrato o la aceptación formal de la propuesta.</div>
            {verCot.notas && <div style={{ marginTop: '0.4rem' }}>{verCot.notas}</div>}
            <div style={{ marginTop: '0.6rem' }}><strong>Representante:</strong> Dirección de Desarrollo de Negocios</div>
          </div>

          <div className="cot-foot">
            <div><img src="/ico/icono_web.ico" alt="" width={48} height={48} style={{ verticalAlign: 'middle', marginRight: 6 }} /><a href="https://lcg.mx" target="_blank" rel="noreferrer">lcg.mx</a></div>
            <div><img src="/ico/icono_ubicacion.ico" alt="" width={48} height={48} style={{ verticalAlign: 'middle', marginRight: 6 }} />LCG IT &amp; Consulting – Euler 152, Chapultepec Morales, CMDX</div>
          </div>

          <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#6b7280', textAlign: 'center', borderTop: '1px solid #e5e7eb', paddingTop: '0.6rem' }}>
            Los datos personales contenidos en esta cotización serán tratados conforme al Aviso de Privacidad de LCG IT &amp; Consulting.
          </div>
        </div>
      </div>
    </>
  )
}

function NuevaCotizacionFormulario({ editId, onCancelarEdicion, origen, fecha, setFecha, linea, notas, setNotas, guardando, onGuardar }) {
  return (
    <div className="slds-box slds-theme_default slds-m-bottom_medium no-print">
      <div className="slds-grid slds-grid_align-spread slds-m-bottom_small">
        <h2 className="slds-text-heading_small">{editId ? 'Editar cotización' : 'Nueva cotización'}</h2>
        {editId && <button type="button" className="slds-button slds-button_neutral" onClick={onCancelarEdicion}>Cancelar edición</button>}
      </div>

      {/* Selector de origen (cliente) */}
      <div className="slds-m-bottom_small">
        <label className="slds-form-element__label slds-m-bottom_x-small" style={{ display: 'block' }} htmlFor="cot-origen-empresa">
          Cliente <span className="slds-text-color_weak" style={{ fontWeight: 400 }}>(selecciona la fuente)</span>
        </label>
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {FUENTES.map((f) => (
            <button key={f.id} type="button"
              className={origen.fuente === f.id ? 'slds-button slds-button_brand' : 'slds-button slds-button_neutral'}
              onClick={() => origen.cambiarFuente(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="slds-grid slds-gutters slds-grid_vertical-align-center">
          <div className="slds-col" style={{ maxWidth: 380 }}>
            <div className="slds-select_container">
              <select id="cot-origen-empresa" className="slds-select" value={origen.origenId} onChange={(e) => origen.seleccionar(e.target.value)}>
                <option value="">— Seleccionar empresa —</option>
                {origen.opcionesFuente.map((o) => (
                  <option key={o.id} value={o.id}>{o.nombre}</option>
                ))}
              </select>
            </div>
          </div>
          {origen.origenNombre && (
            <div className="slds-col slds-grow-none">
              <span style={{ fontSize: '0.85rem', color: '#374151' }}>
                <b>{origen.origenNombre}</b>
                {origen.origenContacto && <span className="slds-text-color_weak"> · {origen.origenContacto}</span>}
                <span className="slds-text-color_weak" style={{ marginLeft: 6, fontSize: '0.78rem', textTransform: 'capitalize' }}>({origen.origenTipo})</span>
              </span>
            </div>
          )}
          {origen.opcionesFuente.length === 0 && (
            <div className="slds-col slds-grow-none">
              <span className="slds-text-color_weak" style={{ fontSize: '0.85rem' }}>Sin registros en esta fuente.</span>
            </div>
          )}
        </div>
      </div>

      <div className="slds-m-bottom_small" style={{ maxWidth: 180 }}>
        <label className="slds-form-element__label" htmlFor="cot-fecha">Fecha</label>
        <input id="cot-fecha" className="slds-input" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      </div>

      <LineaFormulario linea={linea} />

      {linea.lineas.length > 0 && <LineasTabla linea={linea} />}

      <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end slds-m-top_small">
        <div className="slds-col">
          <label className="slds-form-element__label" htmlFor="cot-notas">Notas</label>
          <input id="cot-notas" className="slds-input" value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="slds-col slds-grow-none" style={{ textAlign: 'right' }}>
          <div className="slds-text-body_small slds-text-color_weak">Total estimado</div>
          <div className="metric-value" style={{ fontSize: '1.6rem' }}>{money(linea.totalContrato)}</div>
        </div>
        <div className="slds-col slds-grow-none">
          <button type="button" className="slds-button slds-button_brand" onClick={onGuardar} disabled={guardando || linea.lineas.length === 0}>
            {guardando ? 'Guardando…' : editId ? 'Guardar cambios' : 'Generar cotización'}
          </button>
        </div>
      </div>
    </div>
  )
}

function LineaFormulario({ linea }) {
  const { nl, setNl, productoSel, rangoSel, esModulo, esUnico, esUnicoUnidad, esUnicoPiezas, sinCantidad, vendibles, serviciosUnicos, vendiblesPorServicio, labelVariante, cambiarServicio, cambiarProducto, cambiarCantidad, agregarLinea, errLinea } = linea

  if (vendibles.length === 0) {
    return (
      <p className="slds-text-color_weak slds-text-body_small">
        No hay productos con rangos. Créalos en <Link to="/configuracion-ventas">Configuración de ventas</Link>.
      </p>
    )
  }

  return (
    <div className="slds-box" style={{ background: '#fafafc', borderRadius: 12 }}>
      <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end">
        <div className="slds-col slds-grow-none" style={{ minWidth: 140 }}>
          <label className="slds-form-element__label" htmlFor="cot-servicio">Servicio</label>
          <div className="slds-select_container">
            <select id="cot-servicio" className="slds-select" value={nl.servicio} onChange={(e) => cambiarServicio(e.target.value)}>
              <option value="">— Elegir —</option>
              {serviciosUnicos.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="slds-col slds-grow-none" style={{ minWidth: 160 }}>
          <label className="slds-form-element__label" htmlFor="cot-tipo">Tipo</label>
          <div className="slds-select_container">
            <select id="cot-tipo" className="slds-select" value={nl.productoId} disabled={!nl.servicio} onChange={(e) => cambiarProducto(e.target.value)}>
              <option value="">— Elegir —</option>
              {vendiblesPorServicio.map((p) => <option key={p.id} value={p.id}>{labelVariante(p)}</option>)}
            </select>
          </div>
        </div>
        {!sinCantidad && (
          <div className="slds-col slds-grow-none" style={{ maxWidth: 120 }}>
            <label className="slds-form-element__label" htmlFor="cot-cantidad">{esUnicoPiezas ? 'Piezas' : 'Cantidad'}</label>
            <input id="cot-cantidad" className="slds-input" type="number" min="1" step="1" value={nl.cantidad} disabled={!productoSel} onChange={(e) => cambiarCantidad(e.target.value)} />
          </div>
        )}
        {!esUnico && (
          <div className="slds-col slds-grow-none" style={{ maxWidth: 90 }}>
            <label className="slds-form-element__label" htmlFor="cot-anios">Años</label>
            <div className="slds-select_container">
              <select id="cot-anios" className="slds-select" value={nl.anios} disabled={!productoSel} onChange={(e) => setNl({ ...nl, anios: e.target.value })}>
                {ANIOS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>
        )}
        <div className="slds-col slds-grow-none" style={{ maxWidth: 150 }}>
          <label className="slds-form-element__label" htmlFor="cot-precio">{esModulo ? 'Precio/año' : esUnico ? 'Precio único' : 'Precio unit./mes'}</label>
          <input id="cot-precio" className="slds-input" type="number" min="0" step="0.01" value={nl.precio} disabled={!rangoSel} onChange={(e) => setNl({ ...nl, precio: e.target.value })} />
        </div>
        <div className="slds-col slds-grow-none">
          <button type="button" className="slds-button slds-button_brand" onClick={agregarLinea} disabled={!rangoSel || !nl.precio}>Agregar línea</button>
        </div>
      </div>
      {!sinCantidad && nl.cantidad && !rangoSel && <p className="slds-text-color_error slds-text-body_small slds-m-top_x-small">⚠️ No hay rango para {nl.cantidad} {esUnicoPiezas ? 'piezas' : 'unidades'}.</p>}
      {rangoSel && (
        <p className="slds-text-body_small slds-text-color_weak slds-m-top_x-small">
          Rango: <b>{rangoSel.nombre}</b> · precio mínimo: {money(rangoSel.precio_piso)} · referencia: {money(rangoSel.precio_lista)}
          {esModulo
            ? ' · Total = precio/año × años'
            : esUnicoUnidad
              ? ' · Pago único: precio fijo, no se multiplica'
              : esUnicoPiezas
                ? ` · Pago único = precio × ${nl.cantidad || 0} piezas`
                : ` · Mensual = precio × ${nl.cantidad}; Anual = ×12; Total = anual × años`}
        </p>
      )}
      {errLinea && <p className="slds-text-color_error slds-text-body_small slds-m-top_x-small">⚠️ {errLinea}</p>}
    </div>
  )
}

function LineasTabla({ linea }) {
  const { lineas, lineaEsModulo, lineaEsUnico, lineaEsUnicoUnidad, quitarLinea, totalMensual, totalAnual, totalContrato } = linea
  return (
    <table className="slds-table slds-table_bordered slds-table_cell-buffer slds-m-top_small">
      <thead><tr className="slds-line-height_reset"><th>Concepto</th><th>Unid.</th><th>Precio</th><th>Años</th><th>Mensual</th><th>Anual</th><th>Estimado</th><th></th></tr></thead>
      <tbody>
        {lineas.map((l, i) => {
          const lMod = lineaEsModulo(l)
          const lUnico = lineaEsUnico(l)
          const lUnicoUnidad = lineaEsUnicoUnidad(l)
          return (
          <tr key={l._key}>
            <td>
              {l.descripcion}
              {lUnico && <><br /><span className="role-badge" style={{ background: '#7c3aed', color: '#fff', fontSize: '0.7rem' }}>Pago único</span></>}
            </td>
            <td>{lMod || lUnicoUnidad ? '—' : l.cantidad}</td>
            <td>{lMod ? `${money(l.precio_unitario)}/año` : lUnico ? money(l.precio_unitario) : `${money(l.precio_unitario)}/mes`}</td>
            <td>{lUnico ? '—' : l.anios}</td>
            <td>{lMod || lUnico ? '—' : money(l.ingreso_mensual)}</td>
            <td>{lUnico ? '—' : money(l.ingreso_anual)}</td>
            <td>{money(l.subtotal)}</td>
            <td><button type="button" className="slds-button slds-button_text-destructive" onClick={() => quitarLinea(i)}>×</button></td>
          </tr>
        )})}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={4} style={{ textAlign: 'right', fontWeight: 600 }}>TOTALES</td>
          <td style={{ fontWeight: 600 }}>{lineas.every((l) => lineaEsModulo(l) || lineaEsUnico(l)) ? '—' : money(totalMensual)}</td>
          <td style={{ fontWeight: 600 }}>{money(totalAnual)}</td>
          <td style={{ fontWeight: 600 }}>{money(totalContrato)}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  )
}

function PendientesPipelineBanner({ pendientes, mostrar, onToggleMostrar, seleccionado, onSeleccionar }) {
  return (
    <div className="slds-box slds-m-bottom_medium no-print" style={{ borderLeft: '4px solid #0070d2', background: '#f0f4ff' }}>
      <div className="slds-grid slds-grid_align-spread slds-grid_vertical-align-center">
        <div className="slds-grid slds-grid_vertical-align-center" style={{ gap: 10 }}>
          <span style={{ background: '#0070d2', color: '#fff', borderRadius: 999, padding: '2px 11px', fontWeight: 700, fontSize: '0.85rem' }}>{pendientes.length}</span>
          <strong>Pendientes de Pipeline</strong>
          <span className="slds-text-color_weak slds-text-body_small">— Selecciona uno para completar sus datos</span>
        </div>
        <button type="button" className="slds-button slds-button_neutral" onClick={onToggleMostrar}>
          {mostrar ? 'Ocultar ▲' : 'Ver ▼'}
        </button>
      </div>
      {mostrar && (
        <div className="slds-m-top_small" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {pendientes.map((item) => (
            <button key={item._folio} type="button" className="slds-button slds-button_neutral"
              style={{ textAlign: 'left', borderColor: seleccionado?._folio === item._folio ? '#0070d2' : undefined, fontWeight: seleccionado?._folio === item._folio ? 700 : undefined }}
              onClick={() => onSeleccionar(item)}>
              <strong>{item.prospecto}</strong> · {item._folio}{item.responsable && <> · {item.responsable}</>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function PipelineFormulario({ sel, pm, vendibles, guardando, error, onSubmit, onCerrar }) {
  return (
    <div className="slds-box slds-theme_default slds-m-bottom_medium no-print" style={{ borderLeft: '4px solid #0070d2' }}>
      <div className="slds-grid slds-grid_align-spread slds-m-bottom_small">
        <h2 className="slds-text-heading_small">Agregar a Pipeline · {sel._folio}</h2>
        <button type="button" className="slds-button slds-button_neutral" onClick={onCerrar}>Cerrar</button>
      </div>
      <form onSubmit={onSubmit}>
        <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end slds-m-bottom_x-small">
          <div className="slds-col slds-size_1-of-2">
            <label className="slds-form-element__label" htmlFor="pl-prospecto">Empresa / Municipio *</label>
            <input id="pl-prospecto" className="slds-input" value={sel.prospecto} onChange={(e) => pm({ prospecto: e.target.value })} required />
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 130 }}>
            <label className="slds-form-element__label" htmlFor="pl-tipo">Tipo</label>
            <div className="slds-select_container"><select id="pl-tipo" className="slds-select" value={sel.tipo} onChange={(e) => pm({ tipo: e.target.value })}>
              <option value="">—</option><option value="Empresa">Empresa</option><option value="Municipio">Municipio</option>
            </select></div>
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 180 }}>
            <label className="slds-form-element__label" htmlFor="pl-sector">Sector</label>
            <input id="pl-sector" className="slds-input" value={sel.sector} onChange={(e) => pm({ sector: e.target.value })} placeholder="Logística…" />
          </div>
        </div>
        <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end slds-m-bottom_x-small">
          <div className="slds-col slds-size_1-of-3">
            <label className="slds-form-element__label" htmlFor="pl-producto">Producto *</label>
            <div className="slds-select_container"><select id="pl-producto" className="slds-select" value={sel.productoId} onChange={(e) => pm({ productoId: e.target.value })} required>
              <option value="">— Elegir —</option>
              {vendibles.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.sector ? ` (${p.sector})` : ''}</option>)}
            </select></div>
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 110 }}>
            <label className="slds-form-element__label" htmlFor="pl-unidades">Unidades *</label>
            <input id="pl-unidades" className="slds-input" type="number" min="1" value={sel.unidades} onChange={(e) => pm({ unidades: e.target.value })} required />
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 80 }}>
            <label className="slds-form-element__label" htmlFor="pl-anios">Años</label>
            <div className="slds-select_container"><select id="pl-anios" className="slds-select" value={sel.anios} onChange={(e) => pm({ anios: e.target.value })}>
              {ANIOS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select></div>
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 155 }}>
            <label className="slds-form-element__label" htmlFor="pl-precio">Precio unit./mes *</label>
            <input id="pl-precio" className="slds-input" type="number" min="0" step="0.01" value={sel.precio} onChange={(e) => pm({ precio: e.target.value })} required />
          </div>
        </div>
        <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end slds-m-bottom_x-small">
          <div className="slds-col slds-grow-none" style={{ maxWidth: 230 }}>
            <label className="slds-form-element__label" htmlFor="pl-prob">Prob. cierre</label>
            <div className="slds-select_container"><select id="pl-prob" className="slds-select" value={sel.prob} onChange={(e) => pm({ prob: e.target.value })}>
              {PROBS_PIPELINE.map((p) => <option key={p} value={p}>{Math.round(p * 100)}% — {PROB_LABELS_PIPELINE[p]}</option>)}
            </select></div>
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 155 }}>
            <label className="slds-form-element__label" htmlFor="pl-etapa">Etapa</label>
            <div className="slds-select_container"><select id="pl-etapa" className="slds-select" value={sel.etapa} onChange={(e) => pm({ etapa: e.target.value })}>
              {ETAPAS_PIPELINE.map((et) => <option key={et} value={et}>{et}</option>)}
            </select></div>
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 90 }}>
            <label className="slds-form-element__label" htmlFor="pl-trimestre">Trimestre</label>
            <div className="slds-select_container"><select id="pl-trimestre" className="slds-select" value={sel.trimestre} onChange={(e) => pm({ trimestre: e.target.value })}>
              {TRIMESTRES_PIPELINE.map((q) => <option key={q} value={q}>{q}</option>)}
            </select></div>
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 130 }}>
            <label className="slds-form-element__label" htmlFor="pl-mes">Mes estimado</label>
            <input id="pl-mes" className="slds-input" value={sel.mes} onChange={(e) => pm({ mes: e.target.value })} placeholder="Julio…" />
          </div>
        </div>
        <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end slds-m-bottom_x-small">
          <div className="slds-col slds-grow-none" style={{ maxWidth: 185 }}>
            <label className="slds-form-element__label" htmlFor="pl-responsable">Responsable venta</label>
            <input id="pl-responsable" className="slds-input" value={sel.responsable} onChange={(e) => pm({ responsable: e.target.value })} />
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 185 }}>
            <label className="slds-form-element__label" htmlFor="pl-contacto-nombre">Contacto principal</label>
            <input id="pl-contacto-nombre" className="slds-input" value={sel.contacto_nombre} onChange={(e) => pm({ contacto_nombre: e.target.value })} />
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 150 }}>
            <label className="slds-form-element__label" htmlFor="pl-contacto-telefono">Tel. contacto</label>
            <input id="pl-contacto-telefono" className="slds-input" value={sel.contacto_telefono} onChange={(e) => pm({ contacto_telefono: e.target.value })} />
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 160 }}>
            <label className="slds-form-element__label" htmlFor="pl-fecha-cotizacion">Fecha cotización</label>
            <input id="pl-fecha-cotizacion" className="slds-input" type="date" value={sel.fecha_cotizacion} onChange={(e) => pm({ fecha_cotizacion: e.target.value })} />
          </div>
        </div>
        <div className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end slds-m-bottom_x-small">
          <div className="slds-col">
            <label className="slds-form-element__label" htmlFor="pl-proximo-paso">Próximo paso</label>
            <input id="pl-proximo-paso" className="slds-input" value={sel.proximo_paso} onChange={(e) => pm({ proximo_paso: e.target.value })} placeholder="Enviar propuesta…" />
          </div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 160 }}>
            <label className="slds-form-element__label" htmlFor="pl-fecha-sig-paso">Fecha próximo paso</label>
            <input id="pl-fecha-sig-paso" className="slds-input" type="date" value={sel.fecha_sig_paso} onChange={(e) => pm({ fecha_sig_paso: e.target.value })} />
          </div>
        </div>
        <div className="slds-m-bottom_small">
          <label className="slds-form-element__label" htmlFor="pl-notas">Notas</label>
          <input id="pl-notas" className="slds-input" value={sel.notas} onChange={(e) => pm({ notas: e.target.value })} placeholder="Observaciones…" />
        </div>
        {error && <p className="slds-text-color_error slds-text-body_small slds-m-bottom_x-small">⚠️ {error}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: '0.75rem' }}>
          <button type="submit" className="slds-button slds-button_brand" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Agregar a Pipeline'}
          </button>
        </div>
      </form>
    </div>
  )
}

function CotizacionesTabla({ cotizaciones, canEdit, canDelete, onVer, onEditar, onEliminar }) {
  return (
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
                    <button type="button" className="slds-button slds-button_neutral" onClick={() => onVer(v)}>Ver</button>{' '}
                    {canEdit && <><button type="button" className="slds-button slds-button_neutral" onClick={() => onEditar(v)}>Editar</button>{' '}</>}
                  {canDelete && <button type="button" className="slds-button slds-button_text-destructive" onClick={() => onEliminar(v)}>Eliminar</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
