/**
 * server/tools/coding/auth/generate-jwt-auth.ts
 * Tool: coding_generate_jwt_auth
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { JwtAuthInput }                         from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { jwtMiddlewareTemplate, authRoutesTemplate } from '../templates/auth-template.ts';

export const generateJwtAuthTool = {
  name:        'coding_generate_jwt_auth',
  category:    'coding',
  description: 'Generate JWT authentication: middleware/auth.ts + routes/auth.ts (register, login, logout). Returns file map — does not write to disk.',
  inputSchema: {
    userFields: { type: 'array',  description: 'User model field names (default: ["email","password"])', required: false },
    strategy:   { type: 'string', description: '"template" (default) | "llm"',                           required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: JwtAuthInput, ctx: ToolExecutionContext) => {
    const fields = Array.isArray(input.userFields) ? input.userFields.map(String) : ['email', 'password'];

    const files = {
      'middleware/auth.ts': jwtMiddlewareTemplate(fields),
      'routes/auth.ts':     authRoutesTemplate(fields),
    };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(
      files,
      'Generated JWT auth: middleware/auth.ts + routes/auth.ts',
      report.warnings,
    ));
  },
} as unknown as ToolDefinition;
