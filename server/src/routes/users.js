// Rutas de gestión de usuarios: /api/users
import { Router } from 'express'
import multer from 'multer'
import { listUsers, updateUser, deleteUser } from '../controllers/usersController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'
import { requireUsersView, requireUsersEdit } from '../middleware/permissions.js'
import { transporter } from '../lib/mailer.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

router.get('/', authMiddleware, requireUsersView, listUsers)
router.patch('/:id', authMiddleware, requireUsersEdit, updateUser)
router.delete('/:id', authMiddleware, requireUsersEdit, deleteUser)

// POST /api/users/correo/enviar — envía un correo desde la cuenta del sistema
router.post('/correo/enviar', authMiddleware, requireUsersEdit, upload.array('attachments', 20), async (req, res) => {
  const { to, subject, body } = req.body ?? {}
  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'to, subject y body son obligatorios.' })
  }
  try {
    const attachments = (req.files ?? []).map((f) => ({
      filename: f.originalname,
      content: f.buffer,
      contentType: f.mimetype,
    }))
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      html: body,
      attachments,
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('[correo] error al enviar:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
