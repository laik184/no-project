/**
 * server/tools/coding/database/generate-relation.ts
 * Tool: coding_generate_relation
 */

import type { ToolExecutionContext } from '../../registry/tool-types.ts';
import { RETRY_ONCE, TIMEOUT }                       from '../../registry/tool-metadata.ts';
import { defineCodingTool }                       from '../../registry/define-tool.ts';
import type { RelationInput }                        from '../shared/coding-types.ts';
import { codingOk, codingFail, templateResult }      from '../shared/coding-result.ts';
import { invalidInputError }                          from '../shared/coding-errors.ts';
import { validateGeneratedCode }                      from '../validation/generated-code-validator.ts';
import { toPascalCase, toCamelCase }                  from '../../shared/string-utils.ts';

type RelationType = 'one-to-many' | 'many-to-many' | 'one-to-one';

function relationTemplate(from: string, to: string, type: RelationType): string {
  const From = toPascalCase(from);
  const To   = toPascalCase(to);
  const fromCamel = toCamelCase(from);
  const toCamel   = toCamelCase(to);

  if (type === 'one-to-many') {
    return `import { relations } from 'drizzle-orm';
import { ${fromCamel}Table } from './${from}-schema.ts';
import { ${toCamel}Table }   from './${to}-schema.ts';

export const ${fromCamel}Relations = relations(${fromCamel}Table, ({ many }) => ({
  ${toCamel}s: many(${toCamel}Table),
}));

export const ${toCamel}Relations = relations(${toCamel}Table, ({ one }) => ({
  ${fromCamel}: one(${fromCamel}Table, {
    fields:     [${toCamel}Table.${fromCamel}Id],
    references: [${fromCamel}Table.id],
  }),
}));
`;
  }

  if (type === 'many-to-many') {
    const junction = `${from}_${to}`;
    return `import { relations } from 'drizzle-orm';
import { pgTable, text } from 'drizzle-orm/pg-core';
import { ${fromCamel}Table } from './${from}-schema.ts';
import { ${toCamel}Table }   from './${to}-schema.ts';

export const ${junction}Table = pgTable('${junction}', {
  ${fromCamel}Id: text('${fromCamel}_id').notNull().references(() => ${fromCamel}Table.id),
  ${toCamel}Id:   text('${toCamel}_id').notNull().references(() => ${toCamel}Table.id),
});

export const ${fromCamel}Relations = relations(${fromCamel}Table, ({ many }) => ({
  ${toCamel}s: many(${junction}Table),
}));

export const ${toCamel}Relations = relations(${toCamel}Table, ({ many }) => ({
  ${fromCamel}s: many(${junction}Table),
}));
`;
  }

  return `import { relations } from 'drizzle-orm';
import { ${fromCamel}Table } from './${from}-schema.ts';
import { ${toCamel}Table }   from './${to}-schema.ts';

export const ${fromCamel}Relations = relations(${fromCamel}Table, ({ one }) => ({
  ${toCamel}: one(${toCamel}Table, {
    fields:     [${fromCamel}Table.${toCamel}Id],
    references: [${toCamel}Table.id],
  }),
}));
`;
}

const VALID_TYPES = new Set<RelationType>(['one-to-many', 'many-to-many', 'one-to-one']);

export const generateRelationTool = defineCodingTool({
  name:        'coding_generate_relation',
  category:    'coding',
  description: 'Generate a Drizzle ORM relation definition between two tables. Returns file map — does not write to disk.',
  inputSchema: {
    from:     { type: 'string', description: 'Source table name',                                     required: true  },
    to:       { type: 'string', description: 'Target table name',                                     required: true  },
    type:     { type: 'string', description: 'one-to-many | many-to-many | one-to-one',              required: true  },
    strategy: { type: 'string', description: '"template" (default) | "llm"',                         required: false },
  },
  permissions: [],
  timeoutMs:   TIMEOUT.DEFAULT,
  retry:       RETRY_ONCE,

  handler: async (input: RelationInput, ctx: ToolExecutionContext) => {
    if (!input.from?.trim()) return codingFail(invalidInputError('from', 'required').message);
    if (!input.to?.trim())   return codingFail(invalidInputError('to', 'required').message);
    if (!VALID_TYPES.has(input.type as RelationType)) {
      return codingFail(invalidInputError('type', 'must be one-to-many | many-to-many | one-to-one').message);
    }

    const code     = relationTemplate(input.from, input.to, input.type as RelationType);
    const filename = `shared/${input.from}-${input.to}-relations.ts`;
    const files    = { [filename]: code };

    const report = validateGeneratedCode(files, ctx.sandboxRoot);
    if (!report.passed) return codingFail(`Validation failed: ${report.errors.join('; ')}`);

    return codingOk(templateResult(
      files,
      `Generated ${input.type} relation: ${input.from} → ${input.to}`,
      report.warnings,
    ));
  },
});
