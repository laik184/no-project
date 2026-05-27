import { fileHeader } from '../utils/code-utils.ts';

export function generateAuthRoutes(): string {
  return `${fileHeader('Auth routes — login, register, logout')}import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const authRouter = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

authRouter.post('/register', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  const hash = await bcrypt.hash(password, 10);
  // TODO: persist user — replace with DB call
  const user = { id: '1', email, hash };
  const token = jwt.sign({ sub: user.id, email }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token });
});

authRouter.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }
  // TODO: fetch user from DB
  res.status(401).json({ error: 'Invalid credentials' });
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  res.json({ ok: true });
});

export default authRouter;
`;
}

export function generateJwtMiddleware(): string {
  return `${fileHeader('JWT authentication middleware')}import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

export interface AuthRequest extends Request {
  userId?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
`;
}

export function generateAuthSchema(): string {
  return `${fileHeader('Auth database schema (Drizzle ORM)')}import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const users = pgTable('users', {
  id:           text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email:        text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role:         text('role').notNull().default('user'),
  createdAt:    timestamp('created_at').notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User       = typeof users.$inferSelect;
`;
}
