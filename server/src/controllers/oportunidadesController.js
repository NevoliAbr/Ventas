// Pipeline / Forecast: oportunidades de venta. Usa el catálogo (rango automático
// por unidades, precio en banda piso/lista). Calcula valor de contrato y ponderado.
import { oportunidadesRepo } from '../lib/oportunidadesStore.js'
import { productos, tiposVenta } from '../lib/catalogoStore.js'

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const ETAPAS = ['Prospecting', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost']
const TIPOS = ['Empresa', 'Municipio']
const PROB_LABELS = {
  0: 'Sin posibilidad · Se descarta',
  0.25: 'Interesado · Hay presupuesto disponible',
  0.5: 'En área de aprobación interna',
  0.75: 'Aprobado · En espera de finanzas',
  0.9: 'En espera de contrato firmado',
  1: 'CERRADO — Contrato firmado',
}
const rangoPara = (rangos, c) => rangos.find((r) => c >= r.unidades_min && (r.unidades_max == null || c <= r.unidades_max))

// Valida y calcula los importes a partir del catálogo.
async function calcular(body) {
  const { prospecto, producto_id, unidades, anios, precio_unitario, prob_cierre } = body ?? {}
  if (!prospecto?.trim()) return { error: 'El prospecto es obligatorio.' }
  const prod = await productos.find(producto_id)
  if (!prod) return { error: 'Producto no encontrado.' }

  const u = Number(unidades)
  if (!Number.isInteger(u) || u <= 0) return { error: 'Las unidades deben ser un entero mayor a 0.' }
  const rangos = await tiposVenta.byProducto(prod.id)
  const rango = rangoPara(rangos, u)
  if (!rango) return { error: `No hay un rango configurado para ${u} unidades.` }

  const a = Number(anios)
  if (!Number.isInteger(a) || a < 1 || a > 6) return { error: 'Los años deben estar entre 1 y 6.' }

  const precio = Number(precio_unitario)
  if (!Number.isFinite(precio) || precio < rango.precio_piso || precio > rango.precio_lista) {
    return { error: `El precio debe estar entre ${rango.precio_piso} (piso) y ${rango.precio_lista} (lista).` }
  }

  const prob = Number(prob_cierre)
  if (!Number.isFinite(prob) || prob < 0 || prob > 1) return { error: 'La probabilidad de cierre debe estar entre 0 y 1.' }

  const etapa = body.etapa && ETAPAS.includes(body.etapa) ? body.etapa : 'Prospecting'
  const ingreso_mensual = round2(precio * u)
  const ingreso_anual = round2(ingreso_mensual * 12)
  const valor_total = round2(ingreso_anual * a)
  const valor_ponderado = round2(valor_total * prob)

  return {
    datos: {
      prospecto: prospecto.trim(),
      sector: body.sector?.trim() || null,
      producto_id: prod.id,
      tipo_venta_id: rango.id,
      descripcion: `${prod.nombre} — ${rango.nombre}`,
      unidades: u,
      anios: a,
      precio_unitario: precio,
      ingreso_mensual,
      ingreso_anual,
      valor_total,
      prob_cierre: prob,
      valor_ponderado,
      etapa,
      trimestre: body.trimestre?.trim() || null,
      mes_estimado: body.mes_estimado?.trim() || null,
      notas: body.notas?.trim() || null,
      responsable: body.responsable?.trim() || null,
      tipo: TIPOS.includes(body.tipo) ? body.tipo : null,
      contacto_nombre: body.contacto_nombre?.trim() || null,
      contacto_telefono: body.contacto_telefono?.trim() || null,
      fecha_cotizacion: body.fecha_cotizacion?.trim() || null,
      proximo_paso: body.proximo_paso?.trim() || null,
      fecha_sig_paso: body.fecha_sig_paso?.trim() || null,
    },
  }
}

export async function listOportunidades(req, res) {
  try {
    res.json({ oportunidades: await oportunidadesRepo.all(), etapas: ETAPAS, tipos: TIPOS, probLabels: PROB_LABELS })
  } catch (err) {
    console.error('[oportunidades] list error:', err)
    res.status(500).json({ error: err.message })
  }
}
export async function createOportunidad(req, res) {
  const { error, datos } = await calcular(req.body)
  if (error) return res.status(400).json({ error })
  res.status(201).json({ oportunidad: await oportunidadesRepo.create({ ...datos, createdBy: req.user.id }) })
}
export async function updateOportunidad(req, res) {
  const existe = await oportunidadesRepo.find(req.params.id)
  if (!existe) return res.status(404).json({ error: 'Oportunidad no encontrada.' })
  const { error, datos } = await calcular(req.body)
  if (error) return res.status(400).json({ error })
  res.json({ oportunidad: await oportunidadesRepo.update(req.params.id, datos) })
}
export async function deleteOportunidad(req, res) {
  await oportunidadesRepo.remove(req.params.id)
  res.json({ ok: true })
}

export async function importarOportunidades(req, res) {
  const { registros } = req.body ?? {}
  if (!Array.isArray(registros) || registros.length === 0)
    return res.status(400).json({ error: 'No se recibieron registros.' })
  if (registros.length > 500)
    return res.status(400).json({ error: 'Máximo 500 registros por importación.' })

  const todosProductos = await productos.all()
  const creados = []
  const errores = []

  for (let i = 0; i < registros.length; i++) {
    const r = registros[i]
    const fila = i + 2
    const nombreProd = String(r.producto || '').trim().toLowerCase()
    const prod = todosProductos.find((p) => p.nombre.trim().toLowerCase() === nombreProd)
    if (!prod) { errores.push(`Fila ${fila}: producto "${r.producto}" no encontrado.`); continue }

    const probPct = Number(r.prob_cierre_pct)
    const body = {
      prospecto: r.prospecto,
      tipo: r.tipo,
      sector: r.sector,
      responsable: r.responsable,
      contacto_nombre: r.contacto,
      contacto_telefono: r.telefono,
      producto_id: prod.id,
      unidades: Number(r.unidades),
      anios: Number(r.anios) || 1,
      precio_unitario: Number(r.precio_unitario),
      prob_cierre: Number.isFinite(probPct) ? probPct / 100 : 0.25,
      etapa: r.etapa || 'Prospecting',
      trimestre: r.trimestre,
      mes_estimado: r.mes_estimado,
      notas: r.notas,
      fecha_cotizacion: r.fecha_cotizacion,
      proximo_paso: r.proximo_paso,
      fecha_sig_paso: r.fecha_sig_paso,
    }
    const { error, datos } = await calcular(body)
    if (error) { errores.push(`Fila ${fila}: ${error}`); continue }
    creados.push(await oportunidadesRepo.create({ ...datos, createdBy: req.user?.id }))
  }

  if (creados.length === 0 && errores.length > 0)
    return res.status(400).json({ error: errores.join(' | ') })
  res.status(201).json({ importados: creados.length, errores })
}
