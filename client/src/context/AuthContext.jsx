// Estado global de autenticación. Guarda el usuario y el token (en localStorage),
// valida la sesión al cargar y expone login / register / logout.
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react'
import { authApi } from '../services/api.js'

const AuthContext = createContext(null)

// Hook de conveniencia para consumir el contexto.
export function useAuth() {
  return use(AuthContext)
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  // Solo "cargamos" si había un token guardado que hay que validar contra el backend.
  const [loading, setLoading] = useState(() => !!localStorage.getItem('token'))

  // Solo al montar: si había una sesión guardada (token en localStorage), la
  // validamos contra el backend. login/register ya traen el usuario y fijan
  // el estado directamente, sin depender de este efecto.
  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (!storedToken) return
    authApi
      .verifyToken(storedToken)
      .then(({ user }) => setUser(user))
      .catch(() => {
        // Token inválido/expirado: limpiamos.
        localStorage.removeItem('token')
        setToken(null)
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const { user, token } = await authApi.login({ email, password })
    localStorage.setItem('token', token)
    setUser(user)
    setToken(token)
  }, [])

  const register = useCallback(async (nombre, email, password) => {
    const { user, token } = await authApi.register({ nombre, email, password })
    localStorage.setItem('token', token)
    setUser(user)
    setToken(token)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setUser(null)
    setToken(null)
  }, [])

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
    [user, token, loading, login, register, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
