import { fileHeader, toCamelCase, toPascalCase, toKebabCase } from '../utils/code-utils.ts';

export function generateCrudSchema(resourceName: string): string {
  const pascal = toPascalCase(resourceName);
  const table  = toKebabCase(resourceName).replace(/-/g, '_');

  return `${fileHeader(`${pascal} schema (Drizzle ORM)`)}import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const ${toCamelCase(resourceName)}s = pgTable('${table}s', {
  id:        text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:      text('name').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const insert${pascal}Schema = createInsertSchema(${toCamelCase(resourceName)}s).omit({ id: true, createdAt: true, updatedAt: true });
export type Insert${pascal} = z.infer<typeof insert${pascal}Schema>;
export type ${pascal}       = typeof ${toCamelCase(resourceName)}s.$inferSelect;
`;
}

export function generateCrudRoutes(resourceName: string): string {
  const pascal  = toPascalCase(resourceName);
  const camel   = toCamelCase(resourceName);
  const kebab   = toKebabCase(resourceName);

  return `${fileHeader(`${pascal} CRUD routes`)}import { Router } from 'express';
import type { Request, Response } from 'express';

export const ${camel}Router = Router();

${camel}Router.get('/', async (_req: Request, res: Response) => {
  res.json({ data: [] });
});

${camel}Router.get('/:id', async (req: Request, res: Response) => {
  res.json({ data: { id: req.params.id } });
});

${camel}Router.post('/', async (req: Request, res: Response) => {
  res.status(201).json({ data: req.body });
});

${camel}Router.put('/:id', async (req: Request, res: Response) => {
  res.json({ data: { id: req.params.id, ...req.body } });
});

${camel}Router.delete('/:id', async (req: Request, res: Response) => {
  res.json({ data: { id: req.params.id, deleted: true } });
});

// Mount: app.use('/api/${kebab}s', ${camel}Router);
`;
}

export function generateCrudComponent(resourceName: string): string {
  const pascal = toPascalCase(resourceName);
  const camel  = toCamelCase(resourceName);
  const kebab  = toKebabCase(resourceName);

  return `${fileHeader(`${pascal} list component`)}import { useQuery } from '@tanstack/react-query';

export function ${pascal}List() {
  const { data, isLoading } = useQuery<unknown[]>({
    queryKey: ['/api/${kebab}s'],
  });

  if (isLoading) return <p>Loading…</p>;

  return (
    <div>
      <h2 className="text-xl font-semibold mb-3">${pascal}s</h2>
      <ul className="space-y-2">
        {(data ?? []).map((item: unknown) => (
          <li key={(item as { id: string }).id}>{JSON.stringify(item)}</li>
        ))}
      </ul>
    </div>
  );
}
`;
}
