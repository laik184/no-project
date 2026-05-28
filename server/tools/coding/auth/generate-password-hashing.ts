/**
 * server/tools/coding/auth/generate-password-hashing.ts
 * Tool: coding_generate_password_hashing
 */

import type { ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { defineCodingTool }                       from '../../registry/define-tool.ts';
import type { PasswordHashingInput }                 from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { passwordHashTemplate }                       from '../templates/auth-template.ts';

export const generatePasswordHashingTool = defineCodingTool({
  name:        'coding_generate_password_hashing',
  category:    'coding',
  description: 'Generate a secure password hashing utility using Node.js built-in scrypt. Returns file map — does not write to disk.',
  inputSchema: {
    algorithm: { type: 'string', description: '"scrypt" (default, built-in) | "bcrypt" | "argon2"', required: false },
    strategy:  { type: 'string', description: '"template" (default) | "llm"',                       required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: PasswordHashingInput, ctx: ToolExecutionContext) => {
    const code  = passwordHashTemplate();
    const files = { 'lib/password.ts': code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(
      files,
      `Generated password hashing utility (scrypt/node:crypto): lib/password.ts`,
      report.warnings,
    ));
  },
});
