// Pipeline / Forecast: oportunidades de venta. Usa el catálogo (rango automático
// por unidades, precio en banda piso/lista). Calcula valor de contrato y ponderado.
import { oportunidadesRepo } from '../lib/oportunidadesStore.js'
import { productos, tiposVenta } from '../lib/catalogoStore.js'

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const ETAPAS = ['Prospecting', 'Discovery', 'Proposal', 'Negotiation', 'Won', 'Lost']
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
    },
  }
}

export async function listOportunidades(req, res) {
  res.json({ oportunidades: await oportunidadesRepo.all(), etapas: ETAPAS })
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
