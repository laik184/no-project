import { toPascalCase, toKebabCase, fileHeader } from '../../coderx/utils/code-utils.ts';

export interface GeneratedFile {
  relativePath: string;
  content:      string;
}

export const databaseGenerator = {
  generateSchema(entityName: string): GeneratedFile {
    const pascal = toPascalCase(entityName);
    const table  = entityName.toLowerCase().replace(/[^a-z0-9]/g, '_') + 's';

    const content = fileHeader(`schema/${toKebabCase(entityName)}.ts`, `${pascal} schema`) + `
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const ${table} = pgTable('${table}', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const insert${pascal}Schema = createInsertSchema(${table}).omit({ id: true, createdAt: true, updatedAt: true });
export type Insert${pascal} = z.infer<typeof insert${pascal}Schema>;
export type ${pascal} = typeof ${table}.$inferSelect;
`;

    return {
      relativePath: `shared/schema/${toKebabCase(entityName)}.ts`,
      content,
    };
  },
};
