import { Router, Response } from 'express';
import { registerOwner, login } from '../services/auth.service';
import { validateBody } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import { registerSchema, loginSchema } from '../utils/validation';
import { sendSuccess, sendError } from '../utils/response';
import { AuthRequest } from '../types';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new owner account
 */
router.post('/register', validateBody(registerSchema), async (req, res: Response) => {
  try {
    const result = await registerOwner(req.body);
    sendSuccess(res, result, 'Akun berhasil dibuat', 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal membuat akun';
    sendError(res, message);
  }
});

/**
 * POST /api/auth/login
 * Login (owner or staff)
 */
router.post('/login', validateBody(loginSchema), async (req, res: Response) => {
  try {
    const result = await login(req.body);
    sendSuccess(res, result, 'Login berhasil');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login gagal';
    sendError(res, message, 401);
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, (req: AuthRequest, res: Response) => {
  sendSuccess(res, req.user);
});

export default router;
