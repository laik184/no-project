/**
 * server/tools/coding/database/generate-seed.ts
 * Tool: coding_generate_seed
 */

import type { ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { defineCodingTool }                       from '../../registry/define-tool.ts';
import type { SeedInput }                            from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { toPascalCase, toCamelCase }                  from '../../shared/string-utils.ts';

function seedTemplate(table: string, count: number, fields: string[]): string {
  const Name = toPascalCase(table);
  const rows = Array.from({ length: count }, (_, i) => {
    const fieldValues = fields.map(f => `      ${f}: '${f}_${i + 1}',`).join('\n');
    return `  {\n${fieldValues}\n  },`;
  }).join('\n');

  return `import db from '../lib/db.ts';
import { ${toCamelCase(table)}Table } from '../shared/${table}-schema.ts';

const seeds: Omit<typeof ${toCamelCase(table)}Table.\$inferInsert, 'id'>[] = [
${rows}
];

export async function seed${Name}(): Promise<void> {
  console.log('[seed] Inserting ${count} ${table} record(s)…');
  for (const row of seeds) {
    await db.insert(${toCamelCase(table)}Table).values(row).onConflictDoNothing();
  }
  console.log('[seed] ${Name} seeding complete.');
}

if (import.meta.url === new URL(process.argv[1], 'file://').href) {
  seed${Name}().then(() => process.exit(0)).catch(console.error);
}
`;
}

export const generateSeedTool = defineCodingTool({
  name:        'coding_generate_seed',
  category:    'coding',
  description: 'Generate a database seed script for a table. Returns file map — does not write to disk.',
  inputSchema: {
    table:    { type: 'string', description: 'Table name to seed',                        required: true  },
    count:    { type: 'number', description: 'Number of seed records (default: 5)',        required: false },
    fields:   { type: 'array',  description: 'Field names to populate with sample data',  required: false },
    strategy: { type: 'string', description: '"template" (default) | "llm"',             required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: SeedInput, ctx: ToolExecutionContext) => {
    if (!input.table?.trim()) return codingFail(invalidInputError('table', 'required').message);

    const count    = typeof input.count === 'number' && input.count > 0 ? input.count : 5;
    const fields   = Array.isArray(input.fields) ? input.fields.map(String) : ['name'];
    const code     = seedTemplate(input.table, count, fields);
    const filename = `seeds/${input.table}-seed.ts`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(files, `Generated seed: ${filename} (${count} records)`, report.warnings));
  },
});
