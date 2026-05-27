/**
 * server/tools/coding/templates/auth-template.ts
 *
 * Template-based authentication code generators.
 * All functions are pure and synchronous.
 */

import { toPascalCase } from '../../../agents/coderx/utils/code-utils.ts';

export function jwtMiddlewareTemplate(userFields: string[] = ['email', 'password']): string {
  return `import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

export interface AuthPayload {
  userId: string;
  email:  string;
  iat?:   number;
  exp?:   number;
}

export function signToken(payload: Omit<AuthPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, SECRET) as AuthPayload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) { res.status(401).json({ ok: false, error: 'Missing token' }); return; }
  try {
    (req as Request & { user?: AuthPayload }).user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ ok: false, error: 'Invalid or expired token' });
  }
}
`;
}

export function authRoutesTemplate(userFields: string[] = ['email', 'password']): string {
  const extras      = userFields.filter(f => f !== 'email' && f !== 'password');
  const fieldDecl   = ['email', 'password', ...extras].map(f => `  ${f}: string;`).join('\n');
  const createBody  = ['email', 'password', ...extras].map(f => `      ${f}: req.body.${f} as string,`).join('\n');
  return `import { Router, type Request, type Response } from 'express';
import { signToken } from '../middleware/auth.ts';

interface User {
  id: string;
${fieldDecl}
}

const users = new Map<string, User>();
const router = Router();

router.post('/register', (req: Request, res: Response): void => {
  const { email } = req.body as { email?: string };
  if (!email) { res.status(400).json({ ok: false, error: 'email is required' }); return; }
  if ([...users.values()].some(u => u.email === email)) {
    res.status(409).json({ ok: false, error: 'Email already registered' }); return;
  }
  const id = crypto.randomUUID();
  const user: User = { id,
${createBody}
  };
  users.set(id, user);
  res.status(201).json({ ok: true, token: signToken({ userId: id, email }) });
});

router.post('/login', (req: Request, res: Response): void => {
  const { email, password } = req.body as { email?: string; password?: string };
  const user = [...users.values()].find(u => u.email === email && u.password === password);
  if (!user) { res.status(401).json({ ok: false, error: 'Invalid credentials' }); return; }
  res.json({ ok: true, token: signToken({ userId: user.id, email: user.email }) });
});

router.post('/logout', (_req: Request, res: Response): void => {
  res.json({ ok: true, message: 'Logged out' });
});

export default router;
`;
}

export function passwordHashTemplate(): string {
  return `import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

const SALT_BYTES = 16;
const KEY_LEN    = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt   = randomBytes(SALT_BYTES).toString('hex');
  const buffer = await scryptAsync(password, salt, KEY_LEN) as Buffer;
  return \`\${salt}:\${buffer.toString('hex')}\`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, stored] = hash.split(':');
  if (!salt || !stored) return false;
  const buffer  = await scryptAsync(password, salt, KEY_LEN) as Buffer;
  const storedBuf = Buffer.from(stored, 'hex');
  if (buffer.length !== storedBuf.length) return false;
  return timingSafeEqual(buffer, storedBuf);
}
`;
}

export function roleSystemTemplate(roles: string[]): string {
  const roleUnion = roles.map(r => `'${r}'`).join(' | ');
  return `export type Role = ${roleUnion};

const ROLE_HIERARCHY: Record<Role, number> = {
${roles.map((r, i) => `  ${r}: ${i + 1},`).join('\n')}
};

export function hasRole(userRole: Role, required: Role): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[required] ?? 0);
}

export function requireRole(required: Role) {
  return (
    req: import('express').Request,
    res: import('express').Response,
    next: import('express').NextFunction,
  ): void => {
    const user = (req as typeof req & { user?: { role: Role } }).user;
    if (!user || !hasRole(user.role, required)) {
      res.status(403).json({ ok: false, error: 'Insufficient permissions' }); return;
    }
    next();
  };
}
`;
}
