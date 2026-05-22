import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../services/api.js'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [mensaje, setMensaje] = useState(null)
  const [devUrl, setDevUrl] = useState(null)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setMensaje(null)
    setDevUrl(null)
    setEnviando(true)
    try {
      const res = await authApi.forgotPassword(email)
      setMensaje(res.message)
      // En desarrollo el backend devuelve el enlace para probar sin correo.
      if (res.devResetUrl) setDevUrl(res.devResetUrl)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="auth-shell slds-scope">
      <div className="auth-card slds-box slds-theme_default">
        <h1 className="slds-text-heading_medium slds-text-align_center slds-m-bottom_x-small">
          Recuperar contraseña
        </h1>
        <p className="slds-text-body_small slds-text-color_weak slds-text-align_center slds-m-bottom_medium">
          Ingresa tu email y te generaremos un enlace para restablecerla.
        </p>

        <form onSubmit={onSubmit}>
          <div className="slds-form-element slds-m-bottom_small">
            <label className="slds-form-element__label" htmlFor="forgot-email">
              Email
            </label>
            <div className="slds-form-element__control">
              <input
                id="forgot-email"
                type="email"
                className="slds-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                required
              />
            </div>
          </div>

          {error && (
            <div
              className="slds-text-color_error slds-text-body_small slds-m-bottom_small"
              role="alert"
            >
              ⚠️ {error}
            </div>
          )}
          {mensaje && (
            <div
              className="slds-text-color_success slds-text-body_small slds-m-bottom_small"
              role="status"
            >
              ✅ {mensaje}
            </div>
          )}

          {devUrl && (
            <p className="slds-text-body_small slds-m-bottom_small">
              Enlace de desarrollo:{' '}
              {/* Es una ruta interna; usamos el path para no recargar la app */}
              <Link to={new URL(devUrl).pathname}>Restablecer ahora</Link>
            </p>
          )}

          <button
            type="submit"
            className="slds-button slds-button_brand slds-button_stretch"
            disabled={enviando}
          >
            {enviando ? 'Enviando…' : 'Enviar enlace'}
          </button>
        </form>

        <p className="slds-text-align_center slds-m-top_small">
          <Link to="/">← Volver al inicio</Link>
        </p>
      </div>
    </div>
  )
}
