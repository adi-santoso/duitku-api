import { Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { sendError } from '../utils/response';
import { AuthRequest } from '../types';

/**
 * Middleware: Verify JWT token and attach user to request
 */
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendError(res, 'Token tidak ditemukan', 401);
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch {
    sendError(res, 'Token tidak valid atau sudah expired', 401);
  }
}

/**
 * Middleware: Only allow owners (not staff)
 */
export function ownerOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    sendError(res, 'Unauthorized', 401);
    return;
  }

  if (req.user.role !== 'owner') {
    sendError(res, 'Hanya owner yang bisa melakukan aksi ini', 403);
    return;
  }

  next();
}
