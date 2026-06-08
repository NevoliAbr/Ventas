import { prospectoRepo } from '../lib/prospectoStore.js'

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
    fecha_1ra_reunion: body.fecha_1ra_reunion?.trim() || null,
    status_1ra_reunion: STATUS_REUNION.includes(body.status_1ra_reunion) ? body.status_1ra_reunion : null,
    obs_1ra_reunion: body.obs_1ra_reunion?.trim() || null,
    fecha_2da_reunion: body.fecha_2da_reunion?.trim() || null,
    status_2da_reunion: STATUS_REUNION.includes(body.status_2da_reunion) ? body.status_2da_reunion : null,
    obs_2da_reunion: body.obs_2da_reunion?.trim() || null,
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
