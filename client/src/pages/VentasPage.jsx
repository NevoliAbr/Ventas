import { useEffect, useState } from 'react'
import { ventasApi } from '../services/api.js'

const FORM_VACIO = { producto: '', cantidad: 1, precio: '' }

export default function VentasPage() {
  const [ventas, setVentas] = useState([])
  const [form, setForm] = useState(FORM_VACIO)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  // Carga inicial de ventas desde la API.
  useEffect(() => {
    ventasApi
      .listar()
      .then(setVentas)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }, [])

  function actualizarCampo(e) {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  async function enviar(e) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const nueva = await ventasApi.crear({
        producto: form.producto,
        cantidad: Number(form.cantidad),
        precio: Number(form.precio),
      })
      setVentas((prev) => [nueva, ...prev])
      setForm(FORM_VACIO)
    } catch (e) {
      setError(e.message)
    } finally {
      setEnviando(false)
    }
  }

  const total = ventas.reduce((sum, v) => sum + v.cantidad * v.precio, 0)

  return (
    <section className="ventas">
      <form className="card form" onSubmit={enviar}>
        <h2>Nueva venta</h2>
        <div className="campos">
          <label>
            Producto
            <input
              name="producto"
              value={form.producto}
              onChange={actualizarCampo}
              placeholder="Ej. Teclado mecánico"
              required
            />
          </label>
          <label>
            Cantidad
            <input
              name="cantidad"
              type="number"
              min="1"
              value={form.cantidad}
              onChange={actualizarCampo}
              required
            />
          </label>
          <label>
            Precio
            <input
              name="precio"
              type="number"
              min="0"
              step="0.01"
              value={form.precio}
              onChange={actualizarCampo}
              placeholder="0.00"
              required
            />
          </label>
        </div>
        <button type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Registrar venta'}
        </button>
      </form>

      {error && <p className="error">⚠️ {error}</p>}

      <div className="card">
        <div className="tabla-header">
          <h2>Ventas registradas</h2>
          <span className="total">Total: ${total.toFixed(2)}</span>
        </div>

        {cargando ? (
          <p className="muted">Cargando…</p>
        ) : ventas.length === 0 ? (
          <p className="muted">Aún no hay ventas. ¡Registra la primera!</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cant.</th>
                <th>Precio</th>
                <th>Subtotal</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((v) => (
                <tr key={v.id}>
                  <td>{v.producto}</td>
                  <td>{v.cantidad}</td>
                  <td>${v.precio.toFixed(2)}</td>
                  <td>${(v.cantidad * v.precio).toFixed(2)}</td>
                  <td className="muted">{v.fecha}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}
