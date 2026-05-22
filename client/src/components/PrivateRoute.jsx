// Protege rutas: si no hay sesión válida, redirige a la página de login ("/").
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function PrivateRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="auth-shell slds-scope">
        <div className="slds-is-relative" style={{ width: '2.5rem', height: '2.5rem' }}>
          <div role="status" className="slds-spinner slds-spinner_medium">
            <span className="slds-assistive-text">Verificando sesión…</span>
            <div className="slds-spinner__dot-a"></div>
            <div className="slds-spinner__dot-b"></div>
          </div>
        </div>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/" replace />
  }
  return children
}
