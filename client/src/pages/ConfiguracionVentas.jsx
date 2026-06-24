// Configuración de ventas: catálogo (unidades, clientes, productos) y los
// "tipos de venta" (tabuladores) por producto, con rango de precio mín/máx.
// Requiere facultad ventasVer para entrar; ventasModificar para editar.
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { permissionsFor } from '../lib/permissions.js'
import { catalogoApi } from '../services/api.js'

export default function ConfiguracionVentas() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const perms = permissionsFor(user)
  const canEdit = perms.facultades.ventasModificar

  const [tab, setTab] = useState('productos')
  const [unidades, setUnidades] = useState([])
  const [clientes, setClientes] = useState([])
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    if (!perms.facultades.ventasVer) {
      setCargando(false)
      return
    }
    Promise.all([catalogoApi.listUnidades(), catalogoApi.listClientes(), catalogoApi.listProductos()])
      .then(([u, c, p]) => {
        setUnidades(u.unidades)
        setClientes(c.clientes)
        setProductos(p.productos)
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [perms.facultades.ventasVer])

  const ok = (msg) => { setError(null); setAviso(msg) }
  const fail = (e) => { setAviso(null); setError(e.message) }

  function salir() { logout(); navigate('/') }

  if (!perms.facultades.ventasVer) {
    return (
      <div className="dashboard slds-scope">
        <div className="slds-container_large slds-container_center">
          <div className="dash-topbar">
            <div>
              <Link to="/inicio" className="dash-back">← Inicio</Link>
              <h1 className="dash-greeting">Configuración de ventas</h1>
            </div>
            <button className="slds-button slds-button_neutral" onClick={salir}>Cerrar sesión</button>
          </div>
          <div className="slds-box slds-theme_default">
            <h2 className="slds-text-heading_small slds-m-bottom_x-small">Sin acceso</h2>
            <p className="slds-text-color_weak">No tienes la facultad <b>ventasVer</b>. Pide a un administrador que te la asigne.</p>
            <p className="slds-m-top_small"><Link to="/inicio">← Volver al inicio</Link></p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="dashboard slds-scope">
      <div className="slds-container_large slds-container_center">
        <div className="dash-topbar">
          <div>
            <Link to="/inicio" className="dash-back">← Inicio</Link>
            <h1 className="dash-greeting">Configuración de ventas</h1>
            <p className="dash-subtitle">
              Catálogo y tabuladores · Tu facultad: {canEdit ? 'vista y modificación' : 'solo vista'}
            </p>
          </div>
          <button className="slds-button slds-button_neutral" onClick={salir}>Cerrar sesión</button>
        </div>

        {error && <div className="slds-text-color_error slds-m-bottom_small" role="alert">⚠️ {error}</div>}
        {aviso && <div className="slds-text-color_success slds-m-bottom_small" role="status">✅ {aviso}</div>}

        <div className="slds-tabs_default slds-m-bottom_small">
          <ul className="slds-tabs_default__nav" role="tablist">
            {['productos', 'clientes', 'unidades'].map((t) => (
              <li key={t} className={'slds-tabs_default__item' + (tab === t ? ' slds-is-active' : '')} role="presentation">
                <a className="slds-tabs_default__link" href={'#' + t} role="tab"
                   onClick={(e) => { e.preventDefault(); setTab(t) }}>
                  {t === 'productos' ? 'Productos / Servicios' : t === 'clientes' ? 'Clientes' : 'Unidades'}
                </a>
              </li>
            ))}
          </ul>
        </div>

        {cargando ? (
          <p className="slds-text-color_weak">Cargando catálogo…</p>
        ) : tab === 'unidades' ? (
          <UnidadesTab {...{ unidades, setUnidades, canEdit, ok, fail }} />
        ) : tab === 'clientes' ? (
          <ClientesTab {...{ clientes, setClientes, canEdit, ok, fail }} />
        ) : (
          <ProductosTab {...{ productos, setProductos, unidades, canEdit, ok, fail }} />
        )}
      </div>
    </div>
  )
}

/* ------------------------------ Unidades ------------------------------ */
function UnidadesTab({ unidades, setUnidades, canEdit, ok, fail }) {
  const [form, setForm] = useState({ nombre: '', abreviatura: '', servicio: CATALOGO_SERVICIOS[0] })
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})

  async function crear(e) {
    e.preventDefault()
    try {
      const { unidad } = await catalogoApi.createUnidad(form)
      setUnidades((p) => [...p, unidad].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setForm({ nombre: '', abreviatura: '', servicio: CATALOGO_SERVICIOS[0] }); ok('Unidad creada.')
    } catch (e) { fail(e) }
  }
  async function guardar(id) {
    try {
      const { unidad } = await catalogoApi.updateUnidad(id, editForm)
      setUnidades((p) => p.map((u) => (u.id === id ? unidad : u))); setEditId(null); ok('Unidad actualizada.')
    } catch (e) { fail(e) }
  }
  async function eliminar(u) {
    if (!window.confirm(`¿Eliminar la unidad "${u.nombre}"?`)) return
    try { await catalogoApi.deleteUnidad(u.id); setUnidades((p) => p.filter((x) => x.id !== u.id)); ok('Unidad eliminada.') } catch (e) { fail(e) }
  }

  return (
    <div className="slds-box slds-theme_default">
      {canEdit && (
        <form className="slds-grid slds-gutters slds-grid_vertical-align-end slds-m-bottom_medium" onSubmit={crear}>
          <div className="slds-col slds-grow-none"><label className="slds-form-element__label">Servicio</label>
            <div className="slds-select_container"><select className="slds-select" value={form.servicio} onChange={(e) => setForm({ ...form, servicio: e.target.value })}>
              {CATALOGO_SERVICIOS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></div></div>
          <div className="slds-col"><label className="slds-form-element__label">Nombre</label>
            <input className="slds-input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Pieza" required /></div>
          <div className="slds-col slds-grow-none"><label className="slds-form-element__label">Tipo</label>
            <div className="slds-select_container"><select className="slds-select" value={form.abreviatura} onChange={(e) => setForm({ ...form, abreviatura: e.target.value })}>
              <option value="">— Elegir —</option>
              <option value="Módulo">Módulo</option>
              <option value="Unidades">Unidades</option>
            </select></div></div>
          <div className="slds-col slds-grow-none"><button className="slds-button slds-button_brand" type="submit">Agregar</button></div>
        </form>
      )}
      <table className="slds-table slds-table_bordered slds-table_cell-buffer">
        <thead><tr className="slds-line-height_reset"><th>Servicio</th><th>Nombre</th><th>Tipo</th>{canEdit && <th>Acciones</th>}</tr></thead>
        <tbody>
          {unidades.length === 0 && <tr><td colSpan={4} className="slds-text-color_weak">Sin unidades aún.</td></tr>}
          {unidades.map((u) => (
            <tr key={u.id}>
              {editId === u.id ? (
                <>
                  <td><div className="slds-select_container"><select className="slds-select" value={editForm.servicio || ''} onChange={(e) => setEditForm({ ...editForm, servicio: e.target.value })}>
                    <option value="">—</option>
                    {CATALOGO_SERVICIOS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select></div></td>
                  <td><input className="slds-input" value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} /></td>
                  <td><div className="slds-select_container"><select className="slds-select" value={editForm.abreviatura || ''} onChange={(e) => setEditForm({ ...editForm, abreviatura: e.target.value })}>
                    <option value="">— Elegir —</option>
                    <option value="Módulo">Módulo</option>
                    <option value="Unidades">Unidades</option>
                  </select></div></td>
                  <td><button className="slds-button slds-button_brand" onClick={() => guardar(u.id)}>Guardar</button>{' '}
                      <button className="slds-button slds-button_neutral" onClick={() => setEditId(null)}>Cancelar</button></td>
                </>
              ) : (
                <>
                  <td>{u.servicio ? <span className="role-badge role-admin">{u.servicio}</span> : '—'}</td>
                  <td>{u.nombre}</td><td>{u.abreviatura || '—'}</td>
                  {canEdit && <td>
                    <button className="slds-button slds-button_neutral" onClick={() => { setEditId(u.id); setEditForm(u) }}>Editar</button>{' '}
                    <button className="slds-button slds-button_text-destructive" onClick={() => eliminar(u)}>Eliminar</button>
                  </td>}
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ------------------------------ Clientes ------------------------------ */
function ClientesTab({ clientes, setClientes, canEdit, ok, fail }) {
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '' })
  const [editId, setEditId] = useState(null)
  const [editForm, setEditForm] = useState({})

  async function crear(e) {
    e.preventDefault()
    try {
      const { cliente } = await catalogoApi.createCliente(form)
      setClientes((p) => [...p, cliente].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setForm({ nombre: '', email: '', telefono: '' }); ok('Cliente creado.')
    } catch (e) { fail(e) }
  }
  async function guardar(id) {
    try {
      const { cliente } = await catalogoApi.updateCliente(id, editForm)
      setClientes((p) => p.map((c) => (c.id === id ? cliente : c))); setEditId(null); ok('Cliente actualizado.')
    } catch (e) { fail(e) }
  }
  async function eliminar(c) {
    if (!window.confirm(`¿Eliminar al cliente "${c.nombre}"?`)) return
    try { await catalogoApi.deleteCliente(c.id); setClientes((p) => p.filter((x) => x.id !== c.id)); ok('Cliente eliminado.') } catch (e) { fail(e) }
  }

  return (
    <div className="slds-box slds-theme_default">
      {canEdit && (
        <form className="slds-grid slds-gutters slds-grid_vertical-align-end slds-m-bottom_medium" onSubmit={crear}>
          <div className="slds-col"><label className="slds-form-element__label">Nombre</label>
            <input className="slds-input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></div>
          <div className="slds-col"><label className="slds-form-element__label">Email</label>
            <input className="slds-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div className="slds-col"><label className="slds-form-element__label">Teléfono</label>
            <input className="slds-input" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} /></div>
          <div className="slds-col slds-grow-none"><button className="slds-button slds-button_brand" type="submit">Agregar</button></div>
        </form>
      )}
      <table className="slds-table slds-table_bordered slds-table_cell-buffer">
        <thead><tr className="slds-line-height_reset"><th>Nombre</th><th>Email</th><th>Teléfono</th>{canEdit && <th>Acciones</th>}</tr></thead>
        <tbody>
          {clientes.length === 0 && <tr><td colSpan={4} className="slds-text-color_weak">Sin clientes aún.</td></tr>}
          {clientes.map((c) => (
            <tr key={c.id}>
              {editId === c.id ? (
                <>
                  <td><input className="slds-input" value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} /></td>
                  <td><input className="slds-input" value={editForm.email || ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></td>
                  <td><input className="slds-input" value={editForm.telefono || ''} onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })} /></td>
                  <td><button className="slds-button slds-button_brand" onClick={() => guardar(c.id)}>Guardar</button>{' '}
                      <button className="slds-button slds-button_neutral" onClick={() => setEditId(null)}>Cancelar</button></td>
                </>
              ) : (
                <>
                  <td>{c.nombre}</td><td>{c.email || '—'}</td><td>{c.telefono || '—'}</td>
                  {canEdit && <td>
                    <button className="slds-button slds-button_neutral" onClick={() => { setEditId(c.id); setEditForm(c) }}>Editar</button>{' '}
                    <button className="slds-button slds-button_text-destructive" onClick={() => eliminar(c)}>Eliminar</button>
                  </td>}
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* --------------------------- Productos + tipos --------------------------- */
const CATALOGO_SERVICIOS = ['SIAG', 'SITEM', 'SIBOP', 'SITAG']

function ProductosTab({ productos, setProductos, unidades, canEdit, ok, fail }) {
  const VACIO = { nombre: CATALOGO_SERVICIOS[0], tipo: 'producto', sector: '', unidad_id: '' }
  const [form, setForm] = useState(VACIO)
  const [filtros, setFiltros] = useState([])
  const unidadNombre = (id) => unidades.find((u) => u.id === id)?.nombre || '—'

  function toggleFiltro(s) {
    setFiltros((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s])
  }

  async function crear(e) {
    e.preventDefault()
    try {
      const { producto } = await catalogoApi.createProducto(form)
      setProductos((p) => [...p, { ...producto, tipos_venta: [] }])
      setForm(VACIO); ok('Producto creado.')
    } catch (e) { fail(e) }
  }
  async function eliminar(p) {
    if (!window.confirm(`¿Eliminar "${p.nombre}" y sus tipos de venta?`)) return
    try { await catalogoApi.deleteProducto(p.id); setProductos((prev) => prev.filter((x) => x.id !== p.id)); ok('Producto eliminado.') } catch (e) { fail(e) }
  }
  const setTipos = (prodId, fn) =>
    setProductos((prev) => prev.map((p) => (p.id === prodId ? { ...p, tipos_venta: fn(p.tipos_venta || []) } : p)))

  const productosFiltrados = filtros.length === 0
    ? productos
    : productos.filter((p) => filtros.includes(p.nombre))

  return (
    <>
      {canEdit && (
        <div className="slds-box slds-theme_default slds-m-bottom_medium">
          <h2 className="slds-text-heading_small slds-m-bottom_small">Nuevo producto / servicio</h2>
          <form className="slds-grid slds-gutters slds-grid_vertical-align-end" onSubmit={crear}>
            <div className="slds-col slds-grow-none"><label className="slds-form-element__label">Servicio</label>
              <div className="slds-select_container"><select className="slds-select" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value, unidad_id: '' })}>
                {CATALOGO_SERVICIOS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></div></div>
            <div className="slds-col slds-grow-none"><label className="slds-form-element__label">Sector</label>
              <div className="slds-select_container"><select className="slds-select" value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}>
                <option value="">— Elegir —</option>
                <option value="Público">Público</option>
                <option value="Privado">Privado</option>
              </select></div></div>
            <div className="slds-col slds-grow-none"><label className="slds-form-element__label">Unidad</label>
              <div className="slds-select_container"><select className="slds-select" value={form.unidad_id} onChange={(e) => setForm({ ...form, unidad_id: e.target.value })}>
                <option value="">—</option>{unidades.filter((u) => u.servicio === form.nombre).map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select></div></div>
            <div className="slds-col slds-grow-none"><button className="slds-button slds-button_brand" type="submit">Agregar Servicio</button></div>
          </form>
        </div>
      )}

      <div className="slds-grid slds-gutters slds-grid_vertical-align-center slds-m-bottom_small">
        <span className="slds-col slds-grow-none slds-text-body_small slds-text-color_weak" style={{ color: '#fff' }}>Filtrar:</span>
        {CATALOGO_SERVICIOS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => toggleFiltro(s)}
            className={'slds-button ' + (filtros.includes(s) ? 'slds-button_brand' : 'slds-button_neutral')}
            style={{ marginRight: 4 }}
          >{s}</button>
        ))}
        {filtros.length > 0 && (
          <button type="button" className="slds-button slds-button_neutral" style={{ marginLeft: 8, fontSize: 12 }} onClick={() => setFiltros([])}>Mostrar todos</button>
        )}
      </div>

      {productosFiltrados.length === 0 && <p className="slds-text-color_weak" style={{ color: '#fff' }}>{filtros.length > 0 ? 'Sin productos para los servicios seleccionados.' : 'Sin productos aún.'}</p>}
      {productosFiltrados.map((p) => (
        <div key={p.id} className="slds-box slds-theme_default slds-m-bottom_small">
          <div className="slds-grid slds-grid_align-spread slds-grid_vertical-align-center slds-m-bottom_x-small">
            <div>
              <span className="slds-text-heading_small">{p.nombre}</span>{' '}
              <span className={'role-badge role-' + (p.tipo === 'servicio' ? 'admin' : 'user')}>{p.tipo}</span>{' '}
              {p.sector && <span className="role-badge role-superuser">{p.sector}</span>}{' '}
              <span className="slds-text-color_weak slds-text-body_small">unidad: {unidadNombre(p.unidad_id)}</span>
            </div>
            {canEdit && <button className="slds-button slds-button_text-destructive" onClick={() => eliminar(p)}>Eliminar producto</button>}
          </div>
          <TiposVenta producto={p} canEdit={canEdit} unidades={unidades} setTipos={setTipos} ok={ok} fail={fail} />
        </div>
      ))}
    </>
  )
}

const TIPO_FORM_VACIO = { nombre: '', unidades_min: '', unidades_max: '', precio_piso: '', precio_lista: '' }

const rangoLabel = (t) => `${t.unidades_min} – ${t.unidades_max ?? '∞'} unid.`

// Rangos de precio de un producto: [unidades_min, unidades_max] con precio_piso
// (mínimo) y precio_lista (referencia), por unidad/mes. El rango se elige solo al
// cotizar según las unidades; los años (1-6) y el precio (en banda) también al cotizar.
function TiposVenta({ producto, canEdit, unidades, setTipos, ok, fail }) {
  const esModulo = unidades.find((u) => u.id === producto.unidad_id)?.abreviatura === 'Módulo'
  const [form, setForm] = useState(TIPO_FORM_VACIO)
  const [editId, setEditId] = useState(null)

  async function enviar(e) {
    e.preventDefault()
    const payload = {
      nombre: form.nombre,
      unidades_min: esModulo ? 1 : Number(form.unidades_min),
      unidades_max: esModulo ? null : (form.unidades_max === '' ? null : Number(form.unidades_max)),
      precio_piso: Number(form.precio_piso),
      precio_lista: Number(form.precio_lista),
    }
    try {
      if (editId) {
        const { tipo } = await catalogoApi.updateTipo(editId, payload)
        setTipos(producto.id, (l) => l.map((t) => (t.id === editId ? tipo : t))); ok('Rango actualizado.')
      } else {
        const { tipo } = await catalogoApi.createTipo(producto.id, payload)
        setTipos(producto.id, (l) => [...l, tipo]); ok('Rango agregado.')
      }
      setForm(TIPO_FORM_VACIO); setEditId(null)
    } catch (e) { fail(e) }
  }
  async function eliminar(t) {
    if (!window.confirm(`¿Eliminar el rango "${t.nombre}"?`)) return
    try { await catalogoApi.deleteTipo(t.id); setTipos(producto.id, (l) => l.filter((x) => x.id !== t.id)); ok('Rango eliminado.') } catch (e) { fail(e) }
  }
  function editar(t) {
    setEditId(t.id)
    setForm({ nombre: t.nombre, unidades_min: t.unidades_min, unidades_max: t.unidades_max ?? '', precio_piso: t.precio_piso, precio_lista: t.precio_lista })
  }

  const tipos = [...(producto.tipos_venta || [])].sort((a, b) => a.unidades_min - b.unidades_min)

  return (
    <div className="slds-box slds-theme_shade slds-m-top_x-small" style={{ background: '#fafafc', borderRadius: 12 }}>
      <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_x-small">{esModulo ? 'Precio anual del módulo (piso y lista)' : 'Rangos de precio (por unidad/mes; el rango se elige solo al cotizar según las unidades)'}</p>
      {tipos.length === 0 && <p className="slds-text-body_small slds-text-color_weak">Sin rangos. Agrega al menos uno.</p>}
      {tipos.map((t) => (
        <div key={t.id} className="activity-row">
          <div>
            <span className="activity-name">{t.nombre}</span>{' '}
            {!esModulo && <span className="role-badge role-viewer">{rangoLabel(t)}</span>}{' '}
          </div>
          <div>
            <span className="activity-amount">piso ${Number(t.precio_piso).toLocaleString()} · lista ${Number(t.precio_lista).toLocaleString()}</span>
            {canEdit && <>{' '}<button className="slds-button slds-button_neutral" onClick={() => editar(t)}>Editar</button>{' '}
              <button className="slds-button slds-button_text-destructive" onClick={() => eliminar(t)}>×</button></>}
          </div>
        </div>
      ))}

      {canEdit && (
        <form className="slds-grid slds-gutters slds-wrap slds-grid_vertical-align-end slds-m-top_small" onSubmit={enviar}>
          <div className="slds-col slds-size_1-of-4"><label className="slds-form-element__label">Nombre</label>
            <input className="slds-input" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder={esModulo ? 'Ej. Módulo base' : 'Ej. 10-20 unidades'} required /></div>
          {!esModulo && <>
            <div className="slds-col slds-grow-none" style={{ maxWidth: 100 }}><label className="slds-form-element__label">Unid. mín</label>
              <input className="slds-input" type="number" min="1" step="1" value={form.unidades_min} onChange={(e) => setForm({ ...form, unidades_min: e.target.value })} required /></div>
            <div className="slds-col slds-grow-none" style={{ maxWidth: 110 }}><label className="slds-form-element__label">Unid. máx</label>
              <input className="slds-input" type="number" min="1" step="1" value={form.unidades_max} onChange={(e) => setForm({ ...form, unidades_max: e.target.value })} placeholder="sin tope" /></div>
          </>}
          <div className="slds-col slds-grow-none" style={{ maxWidth: 130 }}><label className="slds-form-element__label">Precio piso</label>
            <input className="slds-input" type="number" min="0" step="0.01" value={form.precio_piso} onChange={(e) => setForm({ ...form, precio_piso: e.target.value })} required /></div>
          <div className="slds-col slds-grow-none" style={{ maxWidth: 130 }}><label className="slds-form-element__label">Precio lista</label>
            <input className="slds-input" type="number" min="0" step="0.01" value={form.precio_lista} onChange={(e) => setForm({ ...form, precio_lista: e.target.value })} required /></div>
          <div className="slds-col slds-grow-none">
            <button className="slds-button slds-button_brand" type="submit">{editId ? 'Guardar' : 'Agregar'}</button>
            {editId && <button type="button" className="slds-button slds-button_neutral" onClick={() => { setForm(TIPO_FORM_VACIO); setEditId(null) }}>Cancelar</button>}
          </div>
        </form>
      )}
    </div>
  )
}
