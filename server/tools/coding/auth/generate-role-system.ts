/**
 * server/tools/coding/auth/generate-role-system.ts
 * Tool: coding_generate_role_system
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { RoleSystemInput }                      from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { roleSystemTemplate }                         from '../templates/auth-template.ts';

export const generateRoleSystemTool = {
  name:        'coding_generate_role_system',
  category:    'coding',
  description: 'Generate a typed role hierarchy + requireRole middleware. Returns file map — does not write to disk.',
  inputSchema: {
    roles:    { type: 'array',  description: 'Role name strings in ascending privilege order', required: true  },
    strategy: { type: 'string', description: '"template" (default) | "llm"',                  required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: RoleSystemInput, ctx: ToolExecutionContext) => {
    if (!Array.isArray(input.roles) || input.roles.length === 0) {
      return codingFail(invalidInputError('roles', 'must be a non-empty array').message);
    }

    const roles  = input.roles.map(String);
    const code   = roleSystemTemplate(roles);
    const files  = { 'lib/roles.ts': code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(
      files,
      `Generated role system with ${roles.length} roles: ${roles.join(', ')}`,
      report.warnings,
    ));
  },
} as unknown as ToolDefinition;
