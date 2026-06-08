// Cliente de la API. Centraliza las llamadas al backend.
// Gracias al proxy de Vite, en desarrollo basta con rutas relativas (/api).
const BASE = '/api'

async function handle(res) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `Error ${res.status}`)
  }
  return res.json()
}

function post(path, body) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(handle)
}

// Cabecera de autorización con el JWT guardado.
function authHeaders() {
  const token = localStorage.getItem('token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// --- Autenticación ---
export const authApi = {
  register(data) {
    return post('/auth/register', data) // { nombre, email, password }
  },
  login(data) {
    return post('/auth/login', data) // { email, password }
  },
  forgotPassword(email) {
    return post('/auth/forgot-password', { email })
  },
  resetPassword(token, password) {
    return post(`/auth/reset-password/${token}`, { password })
  },
  verifyToken(token) {
    return fetch(`${BASE}/auth/verify-token`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(handle)
  },
}

// --- Gestión de usuarios (módulo Configuración) ---
export const usersApi = {
  list() {
    return fetch(`${BASE}/users`, { headers: authHeaders() }).then(handle)
  },
  update(id, patch) {
    return fetch(`${BASE}/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(patch),
    }).then(handle)
  },
  remove(id) {
    return fetch(`${BASE}/users/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }).then(handle)
  },
}

// --- Catálogo de ventas (Configuración de ventas) ---
function authPost(path, body) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  }).then(handle)
}
function authPatch(path, body) {
  return fetch(`${BASE}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  }).then(handle)
}
function authDelete(path) {
  return fetch(`${BASE}${path}`, { method: 'DELETE', headers: authHeaders() }).then(handle)
}

export const catalogoApi = {
  // Unidades
  listUnidades: () => fetch(`${BASE}/catalogo/unidades`, { headers: authHeaders() }).then(handle),
  createUnidad: (d) => authPost('/catalogo/unidades', d),
  updateUnidad: (id, d) => authPatch(`/catalogo/unidades/${id}`, d),
  deleteUnidad: (id) => authDelete(`/catalogo/unidades/${id}`),
  // Clientes
  listClientes: () => fetch(`${BASE}/catalogo/clientes`, { headers: authHeaders() }).then(handle),
  createCliente: (d) => authPost('/catalogo/clientes', d),
  updateCliente: (id, d) => authPatch(`/catalogo/clientes/${id}`, d),
  deleteCliente: (id) => authDelete(`/catalogo/clientes/${id}`),
  // Productos (traen sus tipos_venta anidados)
  listProductos: () => fetch(`${BASE}/catalogo/productos`, { headers: authHeaders() }).then(handle),
  createProducto: (d) => authPost('/catalogo/productos', d),
  updateProducto: (id, d) => authPatch(`/catalogo/productos/${id}`, d),
  deleteProducto: (id) => authDelete(`/catalogo/productos/${id}`),
  // Tipos de venta (tabuladores)
  createTipo: (productoId, d) => authPost(`/catalogo/productos/${productoId}/tipos`, d),
  updateTipo: (id, d) => authPatch(`/catalogo/tipos/${id}`, d),
  deleteTipo: (id) => authDelete(`/catalogo/tipos/${id}`),
}

// --- Ventas (transacciones) ---
export const ventasApi = {
  list: () => fetch(`${BASE}/ventas`, { headers: authHeaders() }).then(handle),
  get: (id) => fetch(`${BASE}/ventas/${id}`, { headers: authHeaders() }).then(handle),
  create: (d) => authPost('/ventas', d),
  update: (id, d) => authPatch(`/ventas/${id}`, d),
  remove: (id) => authDelete(`/ventas/${id}`),
}

// --- Pipeline / Forecast (oportunidades) ---
export const oportunidadesApi = {
  list: () => fetch(`${BASE}/oportunidades`, { headers: authHeaders() }).then(handle),
  create: (d) => authPost('/oportunidades', d),
  update: (id, d) => authPatch(`/oportunidades/${id}`, d),
  remove: (id) => authDelete(`/oportunidades/${id}`),
}

// --- Universo de prospectos ---
export const universoApi = {
  list: () => fetch(`${BASE}/universo`, { headers: authHeaders() }).then(handle),
  create: (d) => authPost('/universo', d),
  update: (id, d) => authPatch(`/universo/${id}`, d),
  remove: (id) => authDelete(`/universo/${id}`),
}

// --- Prospectos activos (reuniones) ---
export const prospectoApi = {
  list: () => fetch(`${BASE}/prospectos`, { headers: authHeaders() }).then(handle),
  create: (d) => authPost('/prospectos', d),
  update: (id, d) => authPatch(`/prospectos/${id}`, d),
  remove: (id) => authDelete(`/prospectos/${id}`),
}
