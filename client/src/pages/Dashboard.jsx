import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Bar, BarChart, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useAuth } from '../context/AuthContext.jsx'
import { oportunidadesApi, prospectoApi, universoApi } from '../services/api.js'

// ── Paleta ──────────────────────────────────────────────────────────────────
const COLORES = ['#2563eb', '#16a34a', '#d97706', '#7c3aed', '#dc2626', '#0891b2', '#6b7280', '#f59e0b']
const money = (n) => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

// ── Constantes estáticas de las tabs ────────────────────────────────────────
const STATUS_R = ['Agendada', 'Realizada', 'Reprogramada', 'Cancelada']
const ETAPAS = ['Prospecting', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost']
const TRIMESTRES = ['Q1', 'Q2', 'Q3', 'Q4']
const PROBS = [0, 0.25, 0.5, 0.75, 0.9, 1]
const PROB_LABELS = { 0: 'Sin posib.', 0.25: 'Interesado', 0.5: 'En aprob.', 0.75: 'Aprobado', 0.9: 'Esperando', 1: 'Cerrado' }

// ── Helpers de exportar ─────────────────────────────────────────────────────
async function exportarInforme(refSeccion, titulo) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const canvas = await html2canvas(refSeccion, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pW = pdf.internal.pageSize.getWidth()
  const pH = pdf.internal.pageSize.getHeight()
  pdf.setFontSize(16); pdf.setTextColor(30, 30, 30)
  pdf.text(titulo, 14, 14)
  pdf.setFontSize(9); pdf.setTextColor(120, 120, 120)
  pdf.text(`Generado: ${new Date().toLocaleString('es-MX')}`, 14, 20)
  const ratio = canvas.height / canvas.width
  const imgW = pW - 28
  const imgH = Math.min(imgW * ratio, pH - 32)
  pdf.addImage(imgData, 'PNG', 14, 26, imgW, imgH)
  pdf.save(`informe_${titulo.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`)
}

// ── Componente KPI ───────────────────────────────────────────────────────────
function KPI({ label, valor, color = '#2563eb', sub }) {
  return (
    <div className="metric-card" style={{ borderTop: `3px solid ${color}` }}>
      <p className="metric-label">{label}</p>
      <p className="metric-value" style={{ color }}>{valor}</p>
      {sub && <p className="slds-text-body_small slds-text-color_weak">{sub}</p>}
    </div>
  )
}

// ── Tooltip personalizado ────────────────────────────────────────────────────
function TooltipCustom({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '6px 12px', fontSize: '0.82rem' }}>
      <p style={{ fontWeight: 600, marginBottom: 2 }}>{label}</p>
      {payload.map((p) => <p key={p.name} style={{ color: p.color }}>{p.name}: <b>{p.value}</b></p>)}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB UNIVERSO
// ════════════════════════════════════════════════════════════════════════════
function TabUniverso({ datos, refExport }) {
  if (!datos) return <p className="slds-text-color_weak slds-m-top_medium">Cargando…</p>
  const { universo, pendientes } = datos
  const total = universo.length
  const porStatus = ['Sin contactar', 'Contactado', 'Siguientes pasos', 'Primera reunión', 'Ganado', 'Perdido']
    .map((s) => ({ name: s, value: universo.filter((r) => r.status_contacto === s).length })).filter((d) => d.value > 0)
  const porSegmento = ['Público', 'Privado'].map((s) => ({ name: s, value: universo.filter((r) => r.segmento === s).length })).filter((d) => d.value > 0)
  const porTipo = ['Empresa', 'Municipal', 'Estatal', 'Federal'].map((t) => ({ name: t, value: universo.filter((r) => r.tipo === t).length })).filter((d) => d.value > 0)
  const porEtapa = ['Universo', 'En contacto', 'Reunión agendada', 'Cotización']
    .map((e) => ({ name: e, value: universo.filter((r) => r.etapa_pipeline === e).length })).filter((d) => d.value > 0)
  const conContacto = universo.filter((r) => r.contacto_nombre).length
  const conEmail = universo.filter((r) => r.email).length

  return (
    <div ref={refExport}>
      {/* KPIs */}
      <div className="slds-grid slds-wrap slds-gutters slds-m-bottom_medium">
        <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4 slds-p-vertical_x-small">
          <KPI label="Total en Universo" valor={total} color="#2563eb" />
        </div>
        <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4 slds-p-vertical_x-small">
          <KPI label="Pendientes → Prospectos" valor={pendientes.length} color="#7c3aed" sub="Etapa Prospecto sin confirmar" />
        </div>
        <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4 slds-p-vertical_x-small">
          <KPI label="Con Teléfono Registrado" valor={conContacto} color="#16a34a" sub={`${total ? Math.round(conContacto / total * 100) : 0}% del total`} />
        </div>
        <div className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4 slds-p-vertical_x-small">
          <KPI label="Con email" valor={conEmail} color="#0891b2" sub={`${total ? Math.round(conEmail / total * 100) : 0}% del total`} />
        </div>
      </div>

      {/* Gráficas fila 1 */}
      <div className="slds-grid slds-wrap slds-gutters slds-m-bottom_medium">
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-p-vertical_x-small">
          <div className="slds-box slds-theme_default">
            <h3 className="slds-text-heading_small slds-m-bottom_small">Por Status de contacto</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porStatus} margin={{ top: 4, right: 8, left: -10, bottom: 40 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<TooltipCustom />} />
                <Bar dataKey="value" name="Contactos" radius={[4, 4, 0, 0]}>
                  {porStatus.map((d, i) => <Cell key={d.name} fill={COLORES[i % COLORES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-p-vertical_x-small">
          <div className="slds-box slds-theme_default">
            <h3 className="slds-text-heading_small slds-m-bottom_small">Por Etapa Pipeline</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porEtapa} margin={{ top: 4, right: 8, left: -10, bottom: 40 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<TooltipCustom />} />
                <Bar dataKey="value" name="Registros" radius={[4, 4, 0, 0]}>
                  {porEtapa.map((d, i) => <Cell key={d.name} fill={COLORES[i % COLORES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Gráficas fila 2 */}
      <div className="slds-grid slds-wrap slds-gutters">
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-p-vertical_x-small">
          <div className="slds-box slds-theme_default">
            <h3 className="slds-text-heading_small slds-m-bottom_small">Segmento</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={porSegmento} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
                  {porSegmento.map((d, i) => <Cell key={d.name} fill={COLORES[i % COLORES.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-p-vertical_x-small">
          <div className="slds-box slds-theme_default">
            <h3 className="slds-text-heading_small slds-m-bottom_small">Tipo</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={porTipo} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
                  {porTipo.map((d, i) => <Cell key={d.name} fill={COLORES[i + 2 % COLORES.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB PROSPECTOS
// ════════════════════════════════════════════════════════════════════════════
function TabProspectos({ datos, refExport }) {
  if (!datos) return <p className="slds-text-color_weak slds-m-top_medium">Cargando…</p>
  const { prospectos } = datos
  const total = prospectos.length
  const enProceso = prospectos.filter((r) => !r.pasa_forecast).length
  const forecast = prospectos.filter((r) => r.pasa_forecast || r.pasa_forecast === 1).length
  const cotizacion = prospectos.filter((r) => r.pide_cotizacion || r.pide_cotizacion === 1).length

  const por1ra = STATUS_R.reduce((acc, s) => {
    const value = prospectos.filter((r) => r.status_1ra_reunion === s).length
    if (value > 0) acc.push({ name: s, value })
    return acc
  }, [])
  const por2da = STATUS_R.reduce((acc, s) => {
    const value = prospectos.filter((r) => r.status_2da_reunion === s).length
    if (value > 0) acc.push({ name: s, value })
    return acc
  }, [])
  const pieEstado = [
    { name: 'En proceso', value: enProceso },
    { name: 'Pasaron a Forecast', value: forecast },
  ].filter((d) => d.value > 0)

  return (
    <div ref={refExport}>
      {/* KPIs */}
      <div className="slds-grid slds-wrap slds-gutters slds-m-bottom_medium">
        {[
          { label: 'Total prospectos', valor: total, color: '#2563eb' },
          { label: 'En proceso', valor: enProceso, color: '#d97706' },
          { label: 'Piden cotización', valor: cotizacion, color: '#7c3aed' },
          { label: 'Pasaron a Forecast', valor: forecast, color: '#16a34a' },
        ].map((k) => (
          <div key={k.label} className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4 slds-p-vertical_x-small">
            <KPI label={k.label} valor={k.valor} color={k.color} />
          </div>
        ))}
      </div>

      <div className="slds-grid slds-wrap slds-gutters">
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-3 slds-p-vertical_x-small">
          <div className="slds-box slds-theme_default">
            <h3 className="slds-text-heading_small slds-m-bottom_small">Estado general</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieEstado} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${Math.round(percent * 100)}%`}>
                  {pieEstado.map((d, i) => <Cell key={d.name} fill={COLORES[i % COLORES.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-3 slds-p-vertical_x-small">
          <div className="slds-box slds-theme_default">
            <h3 className="slds-text-heading_small slds-m-bottom_small">Status 1ra Reunión</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={por1ra} margin={{ top: 4, right: 8, left: -10, bottom: 30 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<TooltipCustom />} />
                <Bar dataKey="value" name="Prospectos" radius={[4, 4, 0, 0]}>
                  {por1ra.map((d, i) => <Cell key={d.name} fill={COLORES[i % COLORES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-3 slds-p-vertical_x-small">
          <div className="slds-box slds-theme_default">
            <h3 className="slds-text-heading_small slds-m-bottom_small">Status 2da Reunión</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={por2da} margin={{ top: 4, right: 8, left: -10, bottom: 30 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<TooltipCustom />} />
                <Bar dataKey="value" name="Prospectos" radius={[4, 4, 0, 0]}>
                  {por2da.map((d, i) => <Cell key={d.name} fill={COLORES[i + 1 % COLORES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TAB PIPELINE / FORECAST
// ════════════════════════════════════════════════════════════════════════════
function TabPipeline({ datos, refExport }) {
  if (!datos) return <p className="slds-text-color_weak slds-m-top_medium">Cargando…</p>
  const { oportunidades } = datos
  const totalValor = oportunidades.reduce((s, o) => s + Number(o.valor_total || 0), 0)
  const totalPond = oportunidades.reduce((s, o) => s + Number(o.valor_ponderado || 0), 0)
  const cerradas = oportunidades.filter((o) => Number(o.prob_cierre) === 1).length

  const porEtapa = ETAPAS.reduce((acc, e) => {
    const deEtapa = oportunidades.filter((o) => o.etapa === e)
    if (deEtapa.length > 0) {
      acc.push({
        name: e,
        cantidad: deEtapa.length,
        valor: deEtapa.reduce((s, o) => s + Number(o.valor_total || 0), 0),
      })
    }
    return acc
  }, [])

  const porTrimestre = TRIMESTRES.reduce((acc, q) => {
    const delTrimestre = oportunidades.filter((o) => o.trimestre === q)
    const valor = delTrimestre.reduce((s, o) => s + Number(o.valor_total || 0), 0)
    if (valor > 0) {
      acc.push({
        name: q,
        valor,
        ponderado: delTrimestre.reduce((s, o) => s + Number(o.valor_ponderado || 0), 0),
      })
    }
    return acc
  }, [])

  const porProb = PROBS.reduce((acc, p) => {
    const value = oportunidades.filter((o) => Number(o.prob_cierre) === p).length
    if (value > 0) acc.push({ name: PROB_LABELS[p], value })
    return acc
  }, [])

  return (
    <div ref={refExport}>
      {/* KPIs */}
      <div className="slds-grid slds-wrap slds-gutters slds-m-bottom_medium">
        {[
          { label: 'Oportunidades', valor: oportunidades.length, color: '#2563eb' },
          { label: 'Valor total pipeline', valor: money(totalValor), color: '#d97706' },
          { label: 'Forecast ponderado', valor: money(totalPond), color: '#16a34a' },
          { label: 'Cerradas / Won', valor: cerradas, color: '#7c3aed' },
        ].map((k) => (
          <div key={k.label} className="slds-col slds-size_1-of-2 slds-medium-size_1-of-4 slds-p-vertical_x-small">
            <KPI label={k.label} valor={k.valor} color={k.color} />
          </div>
        ))}
      </div>

      <div className="slds-grid slds-wrap slds-gutters slds-m-bottom_medium">
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-p-vertical_x-small">
          <div className="slds-box slds-theme_default">
            <h3 className="slds-text-heading_small slds-m-bottom_small">Oportunidades por Etapa</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porEtapa} margin={{ top: 4, right: 8, left: -10, bottom: 30 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" />
                <YAxis yAxisId="left" orientation="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<TooltipCustom />} />
                <Bar yAxisId="left" dataKey="cantidad" name="Cantidad" radius={[4, 4, 0, 0]}>
                  {porEtapa.map((d, i) => <Cell key={d.name} fill={COLORES[i % COLORES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-p-vertical_x-small">
          <div className="slds-box slds-theme_default">
            <h3 className="slds-text-heading_small slds-m-bottom_small">Valor por Trimestre</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porTrimestre} margin={{ top: 4, right: 8, left: 10, bottom: 10 }}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => '$' + (v / 1000).toFixed(0) + 'k'} />
                <Tooltip formatter={(v) => money(v)} content={<TooltipCustom />} />
                <Legend />
                <Bar dataKey="valor" name="Valor contrato" fill="#2563eb" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ponderado" name="Forecast" fill="#16a34a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="slds-grid slds-wrap slds-gutters">
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-p-vertical_x-small">
          <div className="slds-box slds-theme_default">
            <h3 className="slds-text-heading_small slds-m-bottom_small">Distribución por Probabilidad</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={porProb} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
                  {porProb.map((d, i) => <Cell key={d.name} fill={COLORES[i % COLORES.length]} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [v, n]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-p-vertical_x-small">
          <div className="slds-box slds-theme_default">
            <h3 className="slds-text-heading_small slds-m-bottom_small">Valor por Etapa</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={porEtapa} layout="vertical" margin={{ top: 4, right: 40, left: 60, bottom: 4 }}>
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => '$' + (v / 1000).toFixed(0) + 'k'} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                <Tooltip formatter={(v) => money(v)} />
                <Bar dataKey="valor" name="Valor" radius={[0, 4, 4, 0]}>
                  {porEtapa.map((d, i) => <Cell key={d.name} fill={COLORES[i % COLORES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// DASHBOARD PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: 'universo', label: 'Universo' },
  { id: 'prospectos', label: 'Prospectos' },
  { id: 'pipeline', label: 'Pipeline / Forecast' },
  // Agregar más tabs aquí
]

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('universo')
  const [datosUniverso, setDatosUniverso] = useState(null)
  const [datosProspectos, setDatosProspectos] = useState(null)
  const [datosPipeline, setDatosPipeline] = useState(null)
  const [exportando, setExportando] = useState(false)
  const refExportUniverso = useRef(null)
  const refExportProspectos = useRef(null)
  const refExportPipeline = useRef(null)

  useEffect(() => {
    Promise.all([
      universoApi.list().catch(() => ({ universo: [] })),
      universoApi.pendientes().catch(() => ({ pendientes: [] })),
      prospectoApi.list().catch(() => ({ prospectos: [] })),
      oportunidadesApi.list().catch(() => ({ oportunidades: [] })),
    ]).then(([u, p, pr, op]) => {
      setDatosUniverso({ universo: u.universo, pendientes: p.pendientes })
      setDatosProspectos({ prospectos: pr.prospectos })
      setDatosPipeline({ oportunidades: op.oportunidades })
    })
  }, [])

  function salir() { logout(); navigate('/') }

  async function handleExportar() {
    const refs = { universo: refExportUniverso, prospectos: refExportProspectos, pipeline: refExportPipeline }
    const titulos = { universo: 'Universo de Prospectos', prospectos: 'Prospectos Activos', pipeline: 'Pipeline y Forecast' }
    const ref = refs[tab]?.current
    if (!ref) return
    setExportando(true)
    try { await exportarInforme(ref, titulos[tab]) } catch (e) { console.error(e) }
    setExportando(false)
  }

  return (
    <div className="dashboard slds-scope">
      <div className="slds-container_large slds-container_center">

        {/* Topbar */}
        <div className="dash-topbar">
          <div>
            <Link to="/inicio" className="dash-back">← Inicio</Link>
            <h1 className="dash-greeting">Dashboard</h1>
            <p className="dash-subtitle">Resumen ejecutivo · {user?.nombre}</p>
          </div>
          <div className="slds-grid slds-grid_vertical-align-center" style={{ gap: 8 }}>
            <button type="button" className="slds-button slds-button_neutral" onClick={handleExportar} disabled={exportando}>
              {exportando ? 'Generando…' : '⬇ Exportar informe'}
            </button>
            <button type="button" className="slds-button slds-button_neutral" onClick={salir}>Cerrar sesión</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="dash-tabs">
          {TABS.map((t) => (
            <button type="button" key={t.id} onClick={() => setTab(t.id)}
              className="dash-tab-btn"
              style={{
                fontWeight: tab === t.id ? 700 : 400,
                color: tab === t.id ? '#2563eb' : '#6b7280',
                borderBottom: tab === t.id ? '2px solid #2563eb' : '2px solid transparent',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido de tabs */}
        {tab === 'universo' && <TabUniverso datos={datosUniverso} refExport={refExportUniverso} />}
        {tab === 'prospectos' && <TabProspectos datos={datosProspectos} refExport={refExportProspectos} />}
        {tab === 'pipeline' && <TabPipeline datos={datosPipeline} refExport={refExportPipeline} />}

      </div>
    </div>
  )
}
