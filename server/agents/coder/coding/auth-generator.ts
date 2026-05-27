import { expressMiddlewareTemplate } from '../../coderx/templates/express-template.ts';
import { fileHeader } from '../../coderx/utils/code-utils.ts';

export interface GeneratedFile {
  relativePath: string;
  content:      string;
}

const JWT_MIDDLEWARE = `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET ?? 'change-me-in-production';

export interface AuthPayload {
  userId: string;
  email:  string;
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const token   = header.slice(7);
    const decoded = jwt.verify(token, SECRET) as AuthPayload;
    (req as Request & { user?: AuthPayload }).user = decoded;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
`;

export const authGenerator = {
  generateAuthSystem(): GeneratedFile[] {
    return [
      {
        relativePath: 'server/middleware/auth.ts',
        content:      fileHeader('middleware/auth.ts', 'JWT auth middleware') + JWT_MIDDLEWARE,
      },
      {
        relativePath: 'server/routes/auth.ts',
        content:      fileHeader('routes/auth.ts', 'Auth routes') + `import { Router } from 'express';
import { signToken } from '../middleware/auth.ts';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });
  const token = signToken({ userId: 'demo', email });
  res.json({ token });
});

export default router;
`,
      },
    ];
  },
};
