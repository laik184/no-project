/**
 * auth-generator.ts
 * Generates authentication system file stubs.
 * Single responsibility: produce auth-related file paths + content.
 */

export interface GeneratedFile {
  relativePath: string;
  content:      string;
}

const AUTH_FILES: GeneratedFile[] = [
  {
    relativePath: 'server/auth/session.ts',
    content: [
      `import session from 'express-session';`,
      ``,
      `export const sessionMiddleware = session({`,
      `  secret:            process.env.SESSION_SECRET ?? 'changeme',`,
      `  resave:            false,`,
      `  saveUninitialized: false,`,
      `  cookie:            { secure: process.env.NODE_ENV === 'production', maxAge: 86_400_000 },`,
      `});`,
    ].join('\n'),
  },
  {
    relativePath: 'server/auth/auth-routes.ts',
    content: [
      `import { Router } from 'express';`,
      ``,
      `export const authRouter = Router();`,
      ``,
      `authRouter.post('/login',  async (req, res) => { res.json({ ok: true }); });`,
      `authRouter.post('/logout', async (req, res) => { res.json({ ok: true }); });`,
      `authRouter.get('/me',      async (req, res) => { res.json({ user: null }); });`,
    ].join('\n'),
  },
];

export const authGenerator = {
  generateAuthSystem(): GeneratedFile[] {
    return AUTH_FILES;
  },
};
