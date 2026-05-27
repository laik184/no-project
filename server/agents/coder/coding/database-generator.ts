/**
 * database-generator.ts
 * Generates Drizzle ORM schema file stubs.
 * Single responsibility: produce schema file path + content.
 */

export interface GeneratedFile {
  relativePath: string;
  content:      string;
}

function schemaTemplate(name: string): string {
  const lower = name.toLowerCase();
  return [
    `import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';`,
    ``,
    `export const ${lower} = pgTable('${lower}', {`,
    `  id:        serial('id').primaryKey(),`,
    `  name:      text('name').notNull(),`,
    `  createdAt: timestamp('created_at').defaultNow().notNull(),`,
    `});`,
    ``,
    `export type ${name} = typeof ${lower}.$inferSelect;`,
    `export type New${name} = typeof ${lower}.$inferInsert;`,
  ].join('\n');
}

export const databaseGenerator = {
  generateSchema(name: string): GeneratedFile {
    const safe = name.replace(/[^a-zA-Z0-9]/g, '');
    return {
      relativePath: `shared/schemas/${safe.toLowerCase()}.ts`,
      content:      schemaTemplate(safe),
    };
  },
};
