/**
 * server/tools/coding/auth/generate-session-auth.ts
 * Tool: coding_generate_session_auth
 */

import type { ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { defineCodingTool }                       from '../../registry/define-tool.ts';
import type { SessionAuthInput }                     from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';

function sessionAuthTemplate(fields: string[]): string {
  const fieldDecl  = fields.map(f => `  ${f}: string;`).join('\n');
  const createBody = fields.map(f => `      ${f}: req.body.${f} as string,`).join('\n');
  return `import { type Request, type Response, type NextFunction } from 'express';
import session from 'express-session';

export const sessionMiddleware = session({
  secret:            process.env.SESSION_SECRET ?? 'change-me',
  resave:            false,
  saveUninitialized: false,
  cookie:            { secure: process.env.NODE_ENV === 'production', httpOnly: true, maxAge: 86_400_000 },
});

interface SessionUser {
${fieldDecl}
  id: string;
}

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}

const users = new Map<string, SessionUser>();

export function requireSession(req: Request, res: Response, next: NextFunction): void {
  if (!req.session.user) { res.status(401).json({ ok: false, error: 'Not authenticated' }); return; }
  next();
}

import { Router } from 'express';
const router = Router();

router.post('/register', (req: Request, res: Response): void => {
  const { email } = req.body as { email?: string };
  if (!email) { res.status(400).json({ ok: false, error: 'email is required' }); return; }
  const id = crypto.randomUUID();
  const user: SessionUser = { id,
${createBody}
  };
  users.set(id, user);
  req.session.user = user;
  res.status(201).json({ ok: true, user: { id, email: user.email } });
});

router.post('/login', (req: Request, res: Response): void => {
  const { email, password } = req.body as { email?: string; password?: string };
  const user = [...users.values()].find(u => u.email === email && u.password === password);
  if (!user) { res.status(401).json({ ok: false, error: 'Invalid credentials' }); return; }
  req.session.user = user;
  res.json({ ok: true, user: { id: user.id, email: user.email } });
});

router.post('/logout', (req: Request, res: Response): void => {
  req.session.destroy(() => res.json({ ok: true }));
});

export default router;
`;
}

export const generateSessionAuthTool = defineCodingTool({
  name:        'coding_generate_session_auth',
  category:    'coding',
  description: 'Generate session-based auth with express-session. Returns file map — does not write to disk.',
  inputSchema: {
    userFields: { type: 'array',  description: 'User model field names',          required: false },
    strategy:   { type: 'string', description: '"template" (default) | "llm"',    required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: SessionAuthInput, ctx: ToolExecutionContext) => {
    const fields = Array.isArray(input.userFields) ? input.userFields.map(String) : ['email', 'password'];
    const files  = { 'routes/auth.ts': sessionAuthTemplate(fields) };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, 'Generated session auth: routes/auth.ts', report.warnings));
  },
});
