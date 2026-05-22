// Rutas de autenticación: /api/auth/*
import { Router } from 'express'
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  verifyToken,
} from '../controllers/authController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'

const router = Router()

router.post('/register', register)
router.post('/login', login)
router.post('/forgot-password', forgotPassword)
router.post('/reset-password/:token', resetPassword)

// Protegida: requiere JWT válido.
router.get('/verify-token', authMiddleware, verifyToken)

export default router
