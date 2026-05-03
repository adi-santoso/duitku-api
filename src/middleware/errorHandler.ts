import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[Error]', err.message);

  if (!env.isProduction) {
    console.error(err.stack);
  }

  res.status(500).json({
    success: false,
    error: env.isProduction ? 'Internal server error' : err.message,
  });
}

/**
 * 404 handler
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: 'Endpoint tidak ditemukan',
  });
}
