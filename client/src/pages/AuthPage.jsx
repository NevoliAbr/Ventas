// Página principal "/" con tabs para alternar entre Iniciar sesión y Crear cuenta.
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import Login from './Login.jsx'
import Register from './Register.jsx'

export default function AuthPage() {
  const { user, loading } = useAuth()
  const [tab, setTab] = useState('login') // 'login' | 'register'

  // Si ya hay sesión, no mostramos el login: vamos al dashboard.
  if (loading) {
    return (
      <div className="auth-shell slds-scope">
        <div className="slds-is-relative" style={{ width: '2.5rem', height: '2.5rem' }}>
          <div role="status" className="slds-spinner slds-spinner_medium">
            <span className="slds-assistive-text">Cargando</span>
            <div className="slds-spinner__dot-a"></div>
            <div className="slds-spinner__dot-b"></div>
          </div>
        </div>
      </div>
    )
  }
  if (user) return <Navigate to="/inicio" replace />

  return (
    <div className="auth-shell slds-scope">
      <div className="auth-card slds-box slds-theme_default">
        <h1 className="slds-text-heading_large slds-text-align_center slds-m-bottom_xx-small">
          Ventas
        </h1>
        <p className="slds-text-body_small slds-text-color_weak slds-text-align_center slds-m-bottom_medium">
          Accede a tu panel de ventas
        </p>

        <div className="slds-tabs_default">
          <ul className="slds-tabs_default__nav" role="tablist">
            <li
              className={
                'slds-tabs_default__item' + (tab === 'login' ? ' slds-is-active' : '')
              }
              role="presentation"
            >
              <a
                className="slds-tabs_default__link"
                href="#login"
                role="tab"
                aria-selected={tab === 'login'}
                tabIndex={tab === 'login' ? 0 : -1}
                onClick={(e) => {
                  e.preventDefault()
                  setTab('login')
                }}
              >
                Iniciar sesión
              </a>
            </li>
            <li
              className={
                'slds-tabs_default__item' + (tab === 'register' ? ' slds-is-active' : '')
              }
              role="presentation"
            >
              <a
                className="slds-tabs_default__link"
                href="#register"
                role="tab"
                aria-selected={tab === 'register'}
                tabIndex={tab === 'register' ? 0 : -1}
                onClick={(e) => {
                  e.preventDefault()
                  setTab('register')
                }}
              >
                Crear cuenta
              </a>
            </li>
          </ul>

          <div
            className="slds-tabs_default__content slds-show slds-p-top_medium"
            role="tabpanel"
          >
            {tab === 'login' ? <Login /> : <Register />}
          </div>
        </div>
      </div>
    </div>
  )
}
