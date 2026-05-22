// Estado global de autenticación. Guarda el usuario y el token (en localStorage),
// valida la sesión al cargar y expone login / register / logout.
import { createContext, useContext, useEffect, useState } from 'react'
import { authApi } from '../services/api.js'

const AuthContext = createContext(null)

// Hook de conveniencia para consumir el contexto.
export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(true)

  // Al montar (o cuando cambia el token), validamos la sesión contra el backend.
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }
    authApi
      .verifyToken(token)
      .then(({ user }) => setUser(user))
      .catch(() => {
        // Token inválido/expirado: limpiamos.
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [token])

  async function login(email, password) {
    const { user, token } = await authApi.login({ email, password })
    localStorage.setItem('token', token)
    setUser(user)
    setToken(token)
  }

  async function register(nombre, email, password) {
    const { user, token } = await authApi.register({ nombre, email, password })
    localStorage.setItem('token', token)
    setUser(user)
    setToken(token)
  }

  function logout() {
    localStorage.removeItem('token')
    setUser(null)
    setToken(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
