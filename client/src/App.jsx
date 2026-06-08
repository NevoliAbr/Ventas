// Definición de rutas de la aplicación (React Router).
import { Routes, Route, Navigate } from 'react-router-dom'
import AuthPage from './pages/AuthPage.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Inicio from './pages/Inicio.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Configuracion from './pages/Configuracion.jsx'
import ConfiguracionVentas from './pages/ConfiguracionVentas.jsx'
import Cotizaciones from './pages/Cotizaciones.jsx'
import Pipeline from './pages/Pipeline.jsx'
import Universo from './pages/Universo.jsx'
import Prospectos from './pages/Prospectos.jsx'
import PrivateRoute from './components/PrivateRoute.jsx'

export default function App() {
  return (
    <Routes>
      {/* Página principal: login + registro (tabs) */}
      <Route path="/" element={<AuthPage />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      {/* Rutas protegidas */}
      <Route
        path="/inicio"
        element={
          <PrivateRoute>
            <Inicio />
          </PrivateRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/configuracion"
        element={
          <PrivateRoute>
            <Configuracion />
          </PrivateRoute>
        }
      />
      <Route
        path="/configuracion-ventas"
        element={
          <PrivateRoute>
            <ConfiguracionVentas />
          </PrivateRoute>
        }
      />
      <Route
        path="/cotizaciones"
        element={
          <PrivateRoute>
            <Cotizaciones />
          </PrivateRoute>
        }
      />
      <Route
        path="/pipeline"
        element={
          <PrivateRoute>
            <Pipeline />
          </PrivateRoute>
        }
      />
      <Route
        path="/universo"
        element={
          <PrivateRoute>
            <Universo />
          </PrivateRoute>
        }
      />
      <Route
        path="/prospectos"
        element={
          <PrivateRoute>
            <Prospectos />
          </PrivateRoute>
        }
      />

      {/* Cualquier otra ruta vuelve al inicio */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
