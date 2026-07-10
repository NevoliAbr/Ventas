// Controlador de ventas (transacciones). Valida cada línea contra su tabulador:
// cantidad >= mínimo y precio dentro de [precio_min, precio_max]. El total se
// calcula en el servidor (no se confía en el cliente) y se guarda snapshot.
import { ventasRepo } from '../lib/ventasStore.js'
import { productos, tiposVenta, unidades } from '../lib/catalogoStore.js'

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

const ANIOS_MIN = 1
const ANIOS_MAX = 6

// Encuentra el rango (tabulador) que cubre esa cantidad de unidades.
function rangoPara(rangos, cantidad) {
  return rangos.find(
    (r) => cantidad >= r.unidades_min && (r.unidades_max == null || cantidad <= r.unidades_max)
  )
}

// Construye y valida las líneas. Modelo: rangos de unidades con piso/lista.
// La cantidad (unidades) determina el rango automáticamente. El precio unitario
// debe estar entre piso y lista. mensual = precio × unidades; anual = ×12;
// subtotal (total contrato) = anual × años (1-6).
async function construirLineas(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'La cotización debe tener al menos una línea.' }
  }
  const mapaUnidades = (await unidades.all()).reduce((m, u) => ((m[u.id] = u), m), {})
  const lineas = []
  let total = 0

  for (const it of items) {
    const prod = await productos.find(it.producto_id)
    if (!prod) return { error: 'Producto no encontrado.' }

    const cantidad = Number(it.cantidad)
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      return { error: `"${prod.nombre}": la cantidad de unidades debe ser un entero mayor a 0.` }
    }

    const rangos = await tiposVenta.byProducto(prod.id)
    const rango = rangoPara(rangos, cantidad)
    if (!rango) {
      return { error: `"${prod.nombre}": no hay un rango configurado para ${cantidad} unidades.` }
    }

    const anios = Number(it.anios)
    if (!Number.isInteger(anios) || anios < ANIOS_MIN || anios > ANIOS_MAX) {
      return { error: `"${prod.nombre}": los años deben ser un entero entre ${ANIOS_MIN} y ${ANIOS_MAX}.` }
    }

    const precio = Number(it.precio_unitario)
    if (!Number.isFinite(precio)) return { error: `Precio inválido en "${prod.nombre}".` }
    if (precio < rango.precio_piso) {
      return {
        error: `"${prod.nombre} — ${rango.nombre}": el precio unitario no puede ser menor al piso (${rango.precio_piso}).`,
      }
    }

    const abreviatura = mapaUnidades[prod.unidad_id]?.abreviatura
    const esModulo = abreviatura === 'Módulo'
    const esUnicoUnidad = abreviatura === 'Único por Unidad'
    const esUnicoPiezas = abreviatura === 'Único por piezas'
    let ingreso_mensual, ingreso_anual, subtotal
    if (esModulo) {
      ingreso_anual = round2(precio)
      ingreso_mensual = round2(precio / 12)
      subtotal = round2(precio * anios)
    } else if (esUnicoUnidad || esUnicoPiezas) {
      // Pago único: no es recurrente, no se multiplica por meses ni por años.
      ingreso_mensual = null
      ingreso_anual = null
      subtotal = esUnicoUnidad ? round2(precio) : round2(precio * cantidad)
    } else {
      ingreso_mensual = round2(precio * cantidad)
      ingreso_anual = round2(ingreso_mensual * 12)
      subtotal = round2(ingreso_anual * anios)
    }
    total += subtotal

    lineas.push({
      producto_id: prod.id,
      tipo_venta_id: rango.id,
      descripcion: `${prod.nombre} — ${rango.nombre}`,
      unidad: mapaUnidades[prod.unidad_id]?.nombre || '',
      cantidad,
      anios,
      precio_unitario: precio,
      ingreso_mensual,
      ingreso_anual,
      subtotal,
    })
  }
  return { lineas, total: round2(total) }
}

// GET /api/ventas
export async function listVentas(req, res) {
  res.json({ ventas: await ventasRepo.all() })
}

// GET /api/ventas/:id
export async function getVenta(req, res) {
  const venta = await ventasRepo.find(req.params.id)
  if (!venta) return res.status(404).json({ error: 'Venta no encontrada.' })
  res.json({ venta })
}

const ORIGENES = ['universo', 'prospecto', 'oportunidad']

// POST /api/ventas  { origen_tipo, origen_id, origen_nombre, fecha, notas, items: [...] }
export async function createVenta(req, res) {
  const { origen_tipo, origen_id, origen_nombre, fecha, notas, items } = req.body ?? {}
  const { error, lineas, total } = await construirLineas(items)
  if (error) return res.status(400).json({ error })

  const venta = await ventasRepo.create({
    origen_tipo: ORIGENES.includes(origen_tipo) ? origen_tipo : null,
    origen_id: origen_id || null,
    origen_nombre: origen_nombre?.trim() || null,
    fecha: fecha || new Date().toISOString().slice(0, 10),
    notas: notas || null,
    total,
    items: lineas,
    createdBy: req.user.id,
  })
  res.status(201).json({ venta })
}

// PATCH /api/ventas/:id
export async function updateVenta(req, res) {
  const existe = await ventasRepo.find(req.params.id)
  if (!existe) return res.status(404).json({ error: 'Venta no encontrada.' })

  const { origen_tipo, origen_id, origen_nombre, fecha, notas, items } = req.body ?? {}
  const { error, lineas, total } = await construirLineas(items)
  if (error) return res.status(400).json({ error })

  const venta = await ventasRepo.update(req.params.id, {
    origen_tipo: ORIGENES.includes(origen_tipo) ? origen_tipo : null,
    origen_id: origen_id || null,
    origen_nombre: origen_nombre?.trim() || null,
    fecha: fecha || existe.fecha,
    notas: notas || null,
    total,
    items: lineas,
  })
  res.json({ venta })
}

// DELETE /api/ventas/:id
export async function deleteVenta(req, res) {
  await ventasRepo.remove(req.params.id)
  res.json({ ok: true })
}
