// Página de inicio (protegida). Es la primera pantalla tras iniciar sesión.
// Por ahora es un placeholder: tarjetas de secciones, casi todas "Próximamente".
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { permissionsFor } from '../lib/permissions.js'

export default function Inicio() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const perms = permissionsFor(user)

  // Secciones del inicio. Las que tienen destino real enlazan; el resto son
  // placeholders ("Próximamente").
  const SECCIONES = [
    { icono: '/ico/Dashboard-1.ico', tint: '#e8f3ff', titulo: 'Dashboard', desc: 'Métricas y resumen de ventas', to: '/dashboard' },
    {
      icono: '/ico/Cotización-1.ico',
      tint: '#eafaf0',
      titulo: 'Cotización',
      desc: 'Simula una venta / genera una cotización',
      to: perms.facultades.ventasVer ? '/cotizaciones' : null,
      badge: perms.facultades.ventasVer ? null : 'Sin acceso',
    },
    ...(perms.facultades.configVentasVer ? [{
      icono: '/ico/Configuración-de-Venta-2.ico',
      tint: '#e8f3ff',
      titulo: 'Configuración de ventas',
      desc: 'Productos, rangos, clientes y unidades',
      to: '/configuracion-ventas',
    }] : []),
    {
      icono: '/ico/Universo.ico',
      tint: '#f0f4ff',
      titulo: 'Universo',
      desc: 'Lista de prospectos y primer contacto',
      to: perms.facultades.ventasVer ? '/universo' : null,
      badge: perms.facultades.ventasVer ? null : 'Sin acceso',
    },
    {
      icono: '/ico/Prospectos.ico',
      tint: '#f0fff4',
      titulo: 'Prospectos',
      desc: 'Seguimiento de reuniones activas',
      to: perms.facultades.ventasVer ? '/prospectos' : null,
      badge: perms.facultades.ventasVer ? null : 'Sin acceso',
    },
    {
      icono: '/ico/Pipeline-_-forecast.ico',
      tint: '#fff6e6',
      titulo: 'Pipeline / Forecast',
      desc: 'Oportunidades y pronóstico ponderado',
      to: perms.facultades.ventasVer ? '/pipeline' : null,
      badge: perms.facultades.ventasVer ? null : 'Sin acceso',
    },
    { icono: '/ico/Clientes.ico', tint: '#fef0f0', titulo: 'Clientes', desc: 'Gestiona tu cartera de clientes', to: null },
    {
      icono: '/ico/Configuración.ico',
      tint: '#eef0f2',
      titulo: 'Configuración',
      desc: 'Usuarios y permisos',
      to: perms.canViewUsers ? '/configuracion' : null,
      badge: perms.canViewUsers ? null : 'Sin acceso',
    },
  ]

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
            <h1 className="dash-greeting">
              Hola, {user?.nombre} <img src="/ico/icono_mano.ico" alt="" width={80} height={80} style={{ verticalAlign: 'middle', position: 'relative', top: '-8px' }} />
            </h1>
            <p className="dash-subtitle">Bienvenido a Business Development. ¿Qué quieres hacer hoy?</p>
          </div>
          <button type="button" className="slds-button slds-button_neutral" onClick={salir}>
            Cerrar sesión
          </button>
        </div>

        {/* Secciones (grid responsivo de SLDS) */}
        <div className="slds-grid slds-wrap slds-gutters">
          {SECCIONES.map((s) => {
            const contenido = (
              <>
                <div className="home-tile-icon">
                  <img src={s.icono} alt={s.titulo} width={72} height={72} style={{ objectFit: 'contain' }} />
                </div>
                <h2 className="home-tile-title">
                  {s.titulo}
                  {!s.to && <span className="home-badge">{s.badge || 'Próximamente'}</span>}
                </h2>
                <p className="home-tile-desc">{s.desc}</p>
              </>
            )

            return (
              <div
                key={s.titulo}
                className="slds-col slds-size_1-of-1 slds-medium-size_1-of-2 slds-large-size_1-of-3 slds-p-vertical_x-small"
              >
                {s.to ? (
                  <Link to={s.to} className="home-tile">
                    {contenido}
                  </Link>
                ) : (
                  <div className="home-tile is-disabled" aria-disabled="true">
                    {contenido}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
