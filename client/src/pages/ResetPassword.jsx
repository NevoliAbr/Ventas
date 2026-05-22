import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { authApi } from '../services/api.js'

export default function ResetPassword() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mensaje, setMensaje] = useState(null)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setMensaje(null)

    if (password !== confirm) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setEnviando(true)
    try {
      const res = await authApi.resetPassword(token, password)
      setMensaje(res.message)
      // Tras un par de segundos, llevamos al usuario al login.
      setTimeout(() => navigate('/'), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="auth-shell slds-scope">
      <div className="auth-card slds-box slds-theme_default">
        <h1 className="slds-text-heading_medium slds-text-align_center slds-m-bottom_medium">
          Nueva contraseña
        </h1>

        <form onSubmit={onSubmit}>
          <div className="slds-form-element slds-m-bottom_small">
            <label className="slds-form-element__label" htmlFor="reset-password">
              Nueva contraseña
            </label>
            <div className="slds-form-element__control">
              <input
                id="reset-password"
                type="password"
                className="slds-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                required
              />
            </div>
          </div>

          <div className="slds-form-element slds-m-bottom_small">
            <label className="slds-form-element__label" htmlFor="reset-confirm">
              Confirmar contraseña
            </label>
            <div className="slds-form-element__control">
              <input
                id="reset-confirm"
                type="password"
                className="slds-input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={6}
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

          <button
            type="submit"
            className="slds-button slds-button_brand slds-button_stretch"
            disabled={enviando}
          >
            {enviando ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </form>

        <p className="slds-text-align_center slds-m-top_small">
          <Link to="/">← Volver al inicio</Link>
        </p>
      </div>
    </div>
  )
}
