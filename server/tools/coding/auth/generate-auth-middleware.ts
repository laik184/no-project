/**
 * server/tools/coding/auth/generate-auth-middleware.ts
 * Tool: coding_generate_auth_middleware
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { AuthMiddlewareInput }                  from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { jwtMiddlewareTemplate }                      from '../templates/auth-template.ts';

export const generateAuthMiddlewareTool = {
  name:        'coding_generate_auth_middleware',
  category:    'coding',
  description: 'Generate an auth middleware (JWT or session guard). Returns file map — does not write to disk.',
  inputSchema: {
    strategy_auth: { type: 'string', description: '"jwt" (default) | "session"', required: false },
    strategy:      { type: 'string', description: '"template" (default) | "llm"', required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: AuthMiddlewareInput, ctx: ToolExecutionContext) => {
    const authStrategy = input.strategy_auth === 'session' ? 'session' : 'jwt';

    const jwtCode = jwtMiddlewareTemplate();
    const sessionGuard = `import { type Request, type Response, type NextFunction } from 'express';

export function requireSession(req: Request, res: Response, next: NextFunction): void {
  if (!(req.session as Record<string, unknown>)?.user) {
    res.status(401).json({ ok: false, error: 'Not authenticated' }); return;
  }
  next();
}
`;

    const files: Record<string, string> = authStrategy === 'jwt'
      ? { 'middleware/auth.ts': jwtCode }
      : { 'middleware/session-guard.ts': sessionGuard };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(
      files,
      `Generated ${authStrategy} auth middleware`,
      report.warnings,
    ));
  },
} as unknown as ToolDefinition;
