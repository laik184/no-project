/**
 * server/tools/coding/database/generate-migration.ts
 * Tool: coding_generate_migration
 */

import type { ToolDefinition, ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import type { MigrationInput }                       from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { toKebabCase }                                from '../../../agents/coderx/utils/code-utils.ts';

function migrationTemplate(name: string, up: string, down?: string): string {
  const stamp = new Date().toISOString().replace(/[:.TZ-]/g, '').slice(0, 14);
  const downBlock = down
    ? `\nexport async function down(db: unknown): Promise<void> {\n${down}\n}`
    : `\nexport async function down(_db: unknown): Promise<void> {\n  // Reverse of: ${up.split('\n')[0].trim()}\n}`;
  return `// Migration: ${name}
// Generated: ${new Date().toISOString()}

export const migrationName = '${stamp}_${toKebabCase(name)}';

export async function up(db: unknown): Promise<void> {
${up}
}
${downBlock}
`;
}

export const generateMigrationTool = {
  name:        'coding_generate_migration',
  category:    'coding',
  description: 'Generate a database migration file (up + down). Returns file map — does not write to disk.',
  inputSchema: {
    name:     { type: 'string', description: 'Migration description (e.g. add-users-table)',  required: true  },
    up:       { type: 'string', description: 'SQL or ORM calls for the up migration',          required: true  },
    down:     { type: 'string', description: 'SQL or ORM calls for the down rollback',         required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',                  required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: MigrationInput, ctx: ToolExecutionContext) => {
    if (!input.name?.trim()) return codingFail(invalidInputError('name', 'required').message);
    if (!input.up?.trim())   return codingFail(invalidInputError('up', 'required').message);

    const stamp    = Date.now();
    const code     = migrationTemplate(input.name, input.up, input.down);
    const filename = `migrations/${stamp}_${toKebabCase(input.name)}.ts`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated migration: ${filename}`, report.warnings));
  },
} as unknown as ToolDefinition;
