// Ruta protegida. Panel de ventas con métricas de ejemplo.
// Solo accesible con una sesión válida (ver PrivateRoute).
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

// Datos de MUESTRA (placeholder). Aún no vienen del backend.
const METRICAS = [
  { icono: '💰', tint: '#e8f3ff', label: 'Ventas del mes', valor: '$48,250', delta: '▲ 12.4%', up: true },
  { icono: '📦', tint: '#eafaf0', label: 'Pedidos', valor: '327', delta: '▲ 8.1%', up: true },
  { icono: '👥', tint: '#fef0f0', label: 'Clientes nuevos', valor: '54', delta: '▲ 5.6%', up: true },
  { icono: '🧾', tint: '#f3f0ff', label: 'Ticket promedio', valor: '$147', delta: '▼ 2.3%', up: false },
]

const ACTIVIDAD = [
  { producto: 'Teclado mecánico', monto: '$1,700', cuando: 'hace 2 h' },
  { producto: 'Monitor 24"', monto: '$3,200', cuando: 'hace 5 h' },
  { producto: 'Mouse inalámbrico', monto: '$1,602', cuando: 'ayer' },
  { producto: 'Audífonos USB-C', monto: '$1,799', cuando: 'ayer' },
]

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function salir() {
    logout()
    navigate('/')
  }

  return (
    <div className="dashboard slds-scope">
      <div className="slds-container_large slds-container_center">
        {/* Barra superior */}
        <div className="dash-topbar">
          <div>
            <Link to="/inicio" className="dash-back">← Inicio</Link>
            <h1 className="dash-greeting">Hola, {user?.nombre} 👋</h1>
            <p className="dash-subtitle">Este es el resumen de tus ventas</p>
          </div>
          <button type="button" className="slds-button slds-button_neutral" onClick={salir}>
            Cerrar sesión
          </button>
        </div>

        {/* Métricas (grid responsivo de SLDS) */}
        <div className="slds-grid slds-wrap slds-gutters">
          {METRICAS.map((m) => (
            <div
              key={m.label}
              className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-large-size_1-of-4 slds-p-vertical_x-small"
            >
              <div className="metric-card">
                <div className="metric-icon" style={{ background: m.tint }}>
                  {m.icono}
                </div>
                <p className="metric-label">{m.label}</p>
                <p className="metric-value">{m.valor}</p>
                <p className={'metric-delta ' + (m.up ? 'metric-delta-up' : 'metric-delta-down')}>
                  {m.delta} vs. mes anterior
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Actividad reciente */}
        <div className="slds-grid slds-wrap slds-gutters slds-m-top_small">
          <div className="slds-col slds-size_1-of-1">
            <div className="slds-box slds-theme_default">
              <h2 className="slds-text-heading_small slds-m-bottom_small">Ventas recientes</h2>
              {ACTIVIDAD.map((a) => (
                <div className="activity-row" key={a.producto}>
                  <div>
                    <div className="activity-name">{a.producto}</div>
                    <div className="activity-meta">{a.cuando}</div>
                  </div>
                  <div className="activity-amount">{a.monto}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="slds-text-body_small slds-text-color_weak slds-m-top_small slds-text-align_center">
          * Datos de muestra. Conecta el backend de ventas para ver cifras reales.
        </p>
      </div>
    </div>
  )
}
