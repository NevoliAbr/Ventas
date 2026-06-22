import { prospectoRepo } from '../lib/prospectoStore.js'
import { universoRepo } from '../lib/universoStore.js'
import { reunionesRepo } from '../lib/reunionesStore.js'

const STATUS_REUNION = ['Agendada', 'Realizada', 'Reprogramada', 'Cancelada']
const TIPOS = ['Empresa', 'Municipio']

function validar(body) {
  if (!body?.empresa?.trim()) return 'La empresa es obligatoria.'
  return null
}

function mapear(body) {
  return {
    empresa: body.empresa?.trim(),
    tipo: TIPOS.includes(body.tipo) ? body.tipo : null,
    contacto_nombre: body.contacto_nombre?.trim() || null,
    telefono: body.telefono?.trim() || null,
    responsable: body.responsable?.trim() || null,
    pide_cotizacion: !!body.pide_cotizacion,
    pasa_forecast: !!body.pasa_forecast,
  }
}

export async function listProspectos(req, res) {
  try {
    const rows = await prospectoRepo.all()
    res.json({ prospectos: rows, statusReunion: STATUS_REUNION, tipos: TIPOS })
  } catch (err) {
    console.error('[prospectos] list error:', err)
    res.status(500).json({ error: err.message })
  }
}

export async function createProspecto(req, res) {
  const err = validar(req.body)
  if (err) return res.status(400).json({ error: err })
  try {
    const row = await prospectoRepo.create(mapear(req.body))
    if (req.body.universo_id) {
      await universoRepo.convertir(req.body.universo_id).catch(() => {})
    }
    res.status(201).json({ prospecto: row })
  } catch (err) {
    console.error('[prospectos] create error:', err)
    res.status(500).json({ error: err.message })
  }
}

export async function updateProspecto(req, res) {
  const existe = await prospectoRepo.find(req.params.id)
  if (!existe) return res.status(404).json({ error: 'Prospecto no encontrado.' })
  const err = validar(req.body)
  if (err) return res.status(400).json({ error: err })
  try {
    const row = await prospectoRepo.update(req.params.id, mapear(req.body))
    res.json({ prospecto: row })
  } catch (err) {
    console.error('[prospectos] update error:', err)
    res.status(500).json({ error: err.message })
  }
}

export async function deleteProspecto(req, res) {
  try {
    await prospectoRepo.remove(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    console.error('[prospectos] delete error:', err)
    res.status(500).json({ error: err.message })
  }
}

export async function importarProspectos(req, res) {
  const { registros } = req.body ?? {}
  if (!Array.isArray(registros) || registros.length === 0)
    return res.status(400).json({ error: 'No se recibieron registros.' })
  if (registros.length > 1000)
    return res.status(400).json({ error: 'Máximo 1000 registros por importación.' })

  const validos = []
  const errores = []
  registros.forEach((r, i) => {
    if (!r?.empresa?.trim()) { errores.push(`Fila ${i + 2}: empresa vacía.`); return }
    validos.push(mapear(r))
  })
  if (validos.length === 0) return res.status(400).json({ error: errores.join(' | ') })

  try {
    const creados = await prospectoRepo.createMany(validos)
    res.status(201).json({ importados: creados.length, errores })
  } catch (err) {
    console.error('[prospectos] importar error:', err)
    res.status(500).json({ error: err.message })
  }
}

// ── Reuniones ────────────────────────────────────────────────────────────────

export async function listReuniones(req, res) {
  try {
    const rows = await reunionesRepo.byProspecto(req.params.id)
    res.json({ reuniones: rows })
  } catch (err) {
    console.error('[reuniones] list error:', err)
    res.status(500).json({ error: err.message })
  }
}

export async function addReunion(req, res) {
  const { fecha, status, observaciones } = req.body ?? {}
  if (!fecha?.trim()) return res.status(400).json({ error: 'La fecha es obligatoria.' })
  try {
    const row = await reunionesRepo.add({
      prospecto_id: req.params.id,
      fecha: fecha.trim(),
      status: STATUS_REUNION.includes(status) ? status : null,
      observaciones: observaciones?.trim() || null,
    })
    res.status(201).json({ reunion: row })
  } catch (err) {
    console.error('[reuniones] add error:', err)
    res.status(500).json({ error: err.message })
  }
}

export async function deleteReunion(req, res) {
  try {
    await reunionesRepo.remove(req.params.rid)
    res.json({ ok: true })
  } catch (err) {
    console.error('[reuniones] delete error:', err)
    res.status(500).json({ error: err.message })
  }
}
