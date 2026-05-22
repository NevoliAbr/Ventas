import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await register(nombre, email, password)
      navigate('/inicio') // auto-login tras registrarse
    } catch (err) {
      setError(err.message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="slds-form-element slds-m-bottom_small">
        <label className="slds-form-element__label" htmlFor="register-nombre">
          Nombre
        </label>
        <div className="slds-form-element__control">
          <input
            id="register-nombre"
            className="slds-input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Tu nombre"
            required
          />
        </div>
      </div>

      <div className="slds-form-element slds-m-bottom_small">
        <label className="slds-form-element__label" htmlFor="register-email">
          Email
        </label>
        <div className="slds-form-element__control">
          <input
            id="register-email"
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
        <label className="slds-form-element__label" htmlFor="register-password">
          Contraseña
        </label>
        <div className="slds-form-element__control">
          <input
            id="register-password"
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
        {enviando ? 'Creando…' : 'Crear cuenta'}
      </button>
    </form>
  )
}
