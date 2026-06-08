import { universoRepo } from '../lib/universoStore.js'

const STATUS_CONTACTO = ['Sin contacto', 'Contactado', 'Siguientes pasos', 'Primera reunión', 'Ganado', 'Perdido']
const ETAPAS_PIPELINE = ['Universo', 'En contacto', 'Reunión agendada', 'Cotización']
const TIPOS = ['Empresa', 'Municipio']
const SEGMENTOS = ['Privado', 'Gob.']

function validar(body) {
  const { empresa } = body ?? {}
  if (!empresa?.trim()) return 'La empresa es obligatoria.'
  return null
}

function mapear(body) {
  return {
    empresa: body.empresa?.trim(),
    rubro: body.rubro?.trim() || null,
    segmento: SEGMENTOS.includes(body.segmento) ? body.segmento : null,
    contacto_nombre: body.contacto_nombre?.trim() || null,
    email: body.email?.trim() || null,
    telefono: body.telefono?.trim() || null,
    sitio_web: body.sitio_web?.trim() || null,
    linkedin: body.linkedin?.trim() || null,
    tipo: TIPOS.includes(body.tipo) ? body.tipo : null,
    responsable: body.responsable?.trim() || null,
    fecha_contacto: body.fecha_contacto?.trim() || null,
    status_contacto: STATUS_CONTACTO.includes(body.status_contacto) ? body.status_contacto : 'Sin contacto',
    etapa_pipeline: ETAPAS_PIPELINE.includes(body.etapa_pipeline) ? body.etapa_pipeline : 'Universo',
  }
}

export async function listUniverso(req, res) {
  try {
    const rows = await universoRepo.all()
    res.json({ universo: rows, statusOptions: STATUS_CONTACTO, etapasOptions: ETAPAS_PIPELINE, tipos: TIPOS, segmentos: SEGMENTOS })
  } catch (err) {
    console.error('[universo] list error:', err)
    res.status(500).json({ error: err.message })
  }
}

export async function createUniverso(req, res) {
  const err = validar(req.body)
  if (err) return res.status(400).json({ error: err })
  try {
    const row = await universoRepo.create(mapear(req.body))
    res.status(201).json({ prospecto: row })
  } catch (err) {
    console.error('[universo] create error:', err)
    res.status(500).json({ error: err.message })
  }
}

export async function updateUniverso(req, res) {
  const existe = await universoRepo.find(req.params.id)
  if (!existe) return res.status(404).json({ error: 'Prospecto no encontrado.' })
  const err = validar(req.body)
  if (err) return res.status(400).json({ error: err })
  try {
    const row = await universoRepo.update(req.params.id, mapear(req.body))
    res.json({ prospecto: row })
  } catch (err) {
    console.error('[universo] update error:', err)
    res.status(500).json({ error: err.message })
  }
}

export async function deleteUniverso(req, res) {
  try {
    await universoRepo.remove(req.params.id)
    res.json({ ok: true })
  } catch (err) {
    console.error('[universo] delete error:', err)
    res.status(500).json({ error: err.message })
  }
}
