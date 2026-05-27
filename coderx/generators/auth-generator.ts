import { runToolLoop, type LoopOptions, type LoopResult } from '../llm-loop/tool-loop.ts';
import { expressMiddlewareTemplate } from '../templates/express-template.ts';

export interface AuthGeneratorOptions {
  strategy: 'jwt' | 'session';
  userFields?: string[];
  basePath: string;
  useAI?: boolean;
}

export interface GeneratorResult {
  success: boolean;
  files: Record<string, string>;
  summary?: string;
  error?: string;
}

const JWT_MIDDLEWARE = `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

export interface AuthPayload {
  userId: string;
  email: string;
  iat?: number;
  exp?: number;
}

export function signToken(payload: Omit<AuthPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, SECRET) as AuthPayload;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) { res.status(401).json({ ok: false, error: 'Missing token' }); return; }
  try {
    (req as Request & { user?: AuthPayload }).user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ ok: false, error: 'Invalid or expired token' });
  }
}
`;

const AUTH_ROUTES = (fields: string[]): string => {
  const extras = fields.filter(f => f !== 'email' && f !== 'password');
  const createFields = ['email', 'password', ...extras].map(f => `    ${f}: req.body.${f},`).join('\n');

  return `import { Router, Request, Response } from 'express';
import { signToken } from '../middleware/auth.ts';

interface User {
  id: string;
  email: string;
  password: string;
${extras.map(f => `  ${f}: string;`).join('\n')}
}

const users = new Map<string, User>();
const router = Router();

router.post('/register', (req: Request, res: Response): void => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ ok: false, error: 'email is required' }); return; }
  if ([...users.values()].some(u => u.email === email)) {
    res.status(409).json({ ok: false, error: 'Email already registered' }); return;
  }
  const id = crypto.randomUUID();
  const user: User = { id,
${createFields}
  };
  users.set(id, user);
  const token = signToken({ userId: id, email });
  res.status(201).json({ ok: true, token });
});

router.post('/login', (req: Request, res: Response): void => {
  const { email, password } = req.body;
  const user = [...users.values()].find(u => u.email === email && u.password === password);
  if (!user) { res.status(401).json({ ok: false, error: 'Invalid credentials' }); return; }
  const token = signToken({ userId: user.id, email: user.email });
  res.json({ ok: true, token });
});

router.post('/logout', (_req: Request, res: Response): void => {
  res.json({ ok: true, message: 'Logged out' });
});

export default router;
`;
};

function templateGenerate(opts: AuthGeneratorOptions): GeneratorResult {
  const fields = opts.userFields ?? ['email', 'password'];
  return {
    success: true,
    files: {
      'middleware/auth.ts': JWT_MIDDLEWARE,
      'routes/auth.ts': AUTH_ROUTES(fields),
    },
    summary: 'Generated JWT auth middleware and auth routes (register, login, logout)',
  };
}

async function aiGenerate(opts: AuthGeneratorOptions): Promise<GeneratorResult> {
  const fields = (opts.userFields ?? ['email', 'password']).join(', ');
  const task = [
    `Generate a complete JWT authentication system in TypeScript.`,
    `User fields: ${fields}`,
    `Write these files using write_file:`,
    `  1. middleware/auth.ts — signToken, verifyToken, requireAuth middleware`,
    `  2. routes/auth.ts — POST /register, POST /login, POST /logout`,
    `Use in-memory Map for user storage. No bcrypt needed — keep it simple.`,
  ].join('\n');

  const loopOpts: LoopOptions = {
    task,
    basePath: opts.basePath,
    extraInstructions: 'Write exactly 2 files. Call done after both are written.',
    maxIterations: 10,
  };

  const result: LoopResult = await runToolLoop(loopOpts);
  return { success: result.success, files: {}, summary: result.summary, error: result.error };
}

export async function generateAuth(opts: AuthGeneratorOptions): Promise<GeneratorResult> {
  if (opts.useAI) return aiGenerate(opts);
  return templateGenerate(opts);
}
