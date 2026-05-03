import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { JwtPayload } from '../types';

/**
 * Generate JWT token for authenticated user
 */
export function generateToken(payload: JwtPayload): string {
  return jwt.sign(
    payload as object,
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn } as jwt.SignOptions
  );
}

/**
 * Verify and decode JWT token
 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret) as JwtPayload;
}
