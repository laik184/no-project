/**
 * server/tools/coding/templates/crud-template.ts
 *
 * Template-based full CRUD module generators.
 * All functions are pure and synchronous.
 */

import { toPascalCase, toCamelCase, toKebabCase, pluralize } from '../../shared/string-utils.ts';

export function crudApiTemplate(resource: string, fields: string[]): string {
  const Name      = toPascalCase(resource);
  const fieldDecl = fields.map(f => `  ${f}: string;`).join('\n');
  const createBody = fields.map(f => `      ${f}: req.body.${f} as string,`).join('\n');
  return `import { Router, type Request, type Response, type NextFunction } from 'express';

interface ${Name} {
  id: string;
${fieldDecl}
  createdAt: string;
}

const store = new Map<string, ${Name}>();
const router = Router();

router.get('/',     (_req, res) => res.json({ ok: true, data: [...store.values()] }));
router.get('/:id',  (req, res) => {
  const item = store.get(req.params.id);
  if (!item) { res.status(404).json({ ok: false, error: '${Name} not found' }); return; }
  res.json({ ok: true, data: item });
});
router.post('/', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const item: ${Name} = { id: crypto.randomUUID(),
${createBody}
      createdAt: new Date().toISOString(),
    };
    store.set(item.id, item);
    res.status(201).json({ ok: true, data: item });
  } catch (err) { next(err); }
});
router.delete('/:id', (req, res) => {
  store.delete(req.params.id);
  res.json({ ok: true });
});

export default router;
`;
}

export function crudUiTemplate(resource: string, fields: string[]): string {
  const Name     = toPascalCase(resource);
  const kebab    = toKebabCase(resource);
  const plural   = pluralize(toCamelCase(resource));
  const fieldInputs = fields
    .map(f => `        <input name="${f}" placeholder="${toPascalCase(f)}" className="input" />`)
    .join('\n');
  return `import { useState, useEffect, type FC, type FormEvent } from 'react';

interface ${Name} {
  id:   string;
${fields.map(f => `  ${f}: string;`).join('\n')}
}

const ${Name}Crud: FC = () => {
  const [items, setItems] = useState<${Name}[]>([]);

  useEffect(() => {
    fetch('/api/${plural}')
      .then(r => r.json())
      .then(b => setItems((b as { data: ${Name}[] }).data))
      .catch(console.error);
  }, []);

  async function handleCreate(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = Object.fromEntries(form.entries());
    const res  = await fetch('/api/${plural}', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const data = await res.json() as { data: ${Name} };
    setItems(prev => [...prev, data.data]);
    e.currentTarget.reset();
  }

  async function handleDelete(id: string): Promise<void> {
    await fetch(\`/api/${plural}/\${id}\`, { method: 'DELETE' });
    setItems(prev => prev.filter(i => i.id !== id));
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">${Name} Manager</h2>
      <form onSubmit={handleCreate} className="flex gap-2 mb-6 flex-wrap">
${fieldInputs}
        <button type="submit" className="btn-primary">Add ${Name}</button>
      </form>
      <ul className="space-y-2">
        {items.map(item => (
          <li key={item.id} className="flex justify-between items-center border rounded p-3">
            <span>{${fields[0] ? `item.${fields[0]}` : 'item.id'}}</span>
            <button onClick={() => handleDelete(item.id)} className="text-red-500">Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ${Name}Crud;
`;
}

export function crudSchemaTemplate(
  resource: string,
  fields: Array<{ name: string; type: string }>,
): string {
  const Name       = toPascalCase(resource);
  const tableName  = pluralize(resource.toLowerCase());
  const drizzleCols = fields
    .map(f => {
      const col = f.type === 'number'  ? `integer('${f.name}')`
                : f.type === 'boolean' ? `boolean('${f.name}')`
                : `text('${f.name}')`;
      return `  ${f.name}: ${col}.notNull(),`;
    })
    .join('\n');
  return `import { pgTable, text, serial } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

export const ${toCamelCase(resource)}Table = pgTable('${tableName}', {
  id:        serial('id').primaryKey(),
${drizzleCols}
  createdAt: text('created_at').notNull().default('now()'),
});

export const insert${Name}Schema = createInsertSchema(${toCamelCase(resource)}Table).omit({ id: true });
export type  Insert${Name}       = z.infer<typeof insert${Name}Schema>;
export type  ${Name}             = typeof ${toCamelCase(resource)}Table.\$inferSelect;
`;
}

export function crudTestsTemplate(resource: string, fields: string[]): string {
  const Name   = toPascalCase(resource);
  const plural = pluralize(resource.toLowerCase());
  const body   = `{ ${fields.map(f => `${f}: 'test_${f}'`).join(', ')} }`;
  return `import { describe, it, expect } from 'vitest';

describe('${Name} CRUD API', () => {
  const BASE = '/api/${plural}';

  it('creates a ${resource}', async () => {
    const res  = await fetch(BASE, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(${body}),
    });
    expect(res.status).toBe(201);
    const json = await res.json() as { ok: boolean; data: { id: string } };
    expect(json.ok).toBe(true);
    expect(json.data.id).toBeDefined();
  });

  it('lists all ${plural}', async () => {
    const res  = await fetch(BASE);
    expect(res.status).toBe(200);
    const json = await res.json() as { ok: boolean; data: unknown[] };
    expect(json.ok).toBe(true);
    expect(Array.isArray(json.data)).toBe(true);
  });

  it('returns 404 for unknown id', async () => {
    const res = await fetch(\`\${BASE}/non-existent-id\`);
    expect(res.status).toBe(404);
  });
});
`;
}
