import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await login(email, password)
      navigate('/inicio')
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="slds-form-element slds-m-bottom_small">
        <label className="slds-form-element__label" htmlFor="login-email">
          Email
        </label>
        <div className="slds-form-element__control">
          <input
            id="login-email"
            type="email"
            className="slds-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tucorreo@ejemplo.com"
            required
          />
        </div>
      </div>

      <div className="slds-form-element slds-m-bottom_small">
        <label className="slds-form-element__label" htmlFor="login-password">
          Contraseña
        </label>
        <div className="slds-form-element__control">
          <input
            id="login-password"
            type="password"
            className="slds-input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
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

      <button
        type="submit"
        className="slds-button slds-button_brand slds-button_stretch"
        disabled={enviando}
      >
        {enviando ? 'Entrando…' : 'Iniciar sesión'}
      </button>

      <p className="slds-text-align_center slds-m-top_small">
        <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
      </p>
    </form>
  )
}
