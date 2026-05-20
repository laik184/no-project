import jwt from 'jsonwebtoken';
import { ServerConfig } from '../types.js';

interface AuthResult {
  authorized: boolean;
  userId?: string;
  metadata?: Record<string, unknown>;
  error?: string;
}

export const authMiddlewareAgent = async (config: ServerConfig, token?: string): Promise<AuthResult> => {
  if (!token) {
    return config.allowAnonymous ? { authorized: true } : { authorized: false, error: 'Missing token' };
  }

  if (config.tokenValidator) {
    const auth = await config.tokenValidator(token);
    if (!auth) return { authorized: false, error: 'Invalid token' };
    return { authorized: true, userId: auth.userId, metadata: auth.metadata };
  }

  if (!config.jwtSecret) {
    return config.allowAnonymous ? { authorized: true } : { authorized: false, error: 'JWT secret not configured' };
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;
    return {
      authorized: true,
      userId: typeof decoded.sub === 'string' ? decoded.sub : undefined,
      metadata: decoded,
    };
  } catch {
    return { authorized: false, error: 'Invalid token' };
  }
};
