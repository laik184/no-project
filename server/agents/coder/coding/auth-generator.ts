import { toKebabCase } from '../utils/code-utils.ts';
import {
  generateAuthRoutes,
  generateJwtMiddleware,
  generateAuthSchema,
} from '../templates/auth-template.ts';

export interface GeneratedFile {
  relativePath: string;
  content:      string;
}

export const authGenerator = {
  generateAuthSystem(): GeneratedFile[] {
    return [
      authGenerator.generateRoutes(),
      authGenerator.generateMiddleware(),
      authGenerator.generateSchema(),
    ];
  },

  generateRoutes(): GeneratedFile {
    return {
      relativePath: 'server/routes/auth.routes.ts',
      content:      generateAuthRoutes(),
    };
  },

  generateMiddleware(): GeneratedFile {
    return {
      relativePath: 'server/middleware/auth.middleware.ts',
      content:      generateJwtMiddleware(),
    };
  },

  generateSchema(): GeneratedFile {
    return {
      relativePath: 'shared/auth.schema.ts',
      content:      generateAuthSchema(),
    };
  },

  generateRoleMiddleware(roles: string[]): GeneratedFile {
    const rolesLiteral = roles.map((r) => `'${r}'`).join(' | ');
    return {
      relativePath: 'server/middleware/roles.middleware.ts',
      content:      `import type { Request, Response, NextFunction } from 'express';\nimport type { AuthRequest } from './auth.middleware.ts';\n\nexport type Role = ${rolesLiteral || "'user' | 'admin'"};\n\nexport function requireRole(role: Role) {\n  return (req: AuthRequest, res: Response, next: NextFunction): void => {\n    const userRole = (req as AuthRequest & { role?: string }).role;\n    if (!userRole || userRole !== role) {\n      res.status(403).json({ error: 'Forbidden' });\n      return;\n    }\n    next();\n  };\n}\n`,
    };
  },
};
