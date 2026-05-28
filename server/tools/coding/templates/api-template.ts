/**
 * server/tools/coding/templates/api-template.ts
 *
 * Template-based REST API code generators.
 * All functions are pure and synchronous.
 */

import { toPascalCase, toCamelCase, pluralize } from '../../shared/string-utils.ts';

export interface ApiField {
  name:      string;
  type:      string;
  required?: boolean;
}

export function restApiRouterTemplate(resource: string, fields: ApiField[]): string {
  const Name    = toPascalCase(resource);
  const name    = toCamelCase(resource);
  const fieldDecl     = fields.map(f => `  ${f.name}: ${f.type};`).join('\n');
  const createBody    = fields.map(f => `      ${f.name}: req.body.${f.name} as ${f.type},`).join('\n');
  const updateBody    = fields
    .map(f => `    if (req.body.${f.name} !== undefined) item.${f.name} = req.body.${f.name} as ${f.type};`)
    .join('\n');

  return `import { Router, type Request, type Response, type NextFunction } from 'express';

interface ${Name} {
  id: string;
${fieldDecl}
}

const store = new Map<string, ${Name}>();
const router = Router();

router.get('/', (_req: Request, res: Response): void => {
  res.json({ ok: true, data: [...store.values()] });
});

router.get('/:id', (req: Request, res: Response): void => {
  const item = store.get(req.params.id);
  if (!item) { res.status(404).json({ ok: false, error: '${Name} not found' }); return; }
  res.json({ ok: true, data: item });
});

router.post('/', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const item: ${Name} = { id: crypto.randomUUID(),
${createBody}
    };
    store.set(item.id, item);
    res.status(201).json({ ok: true, data: item });
  } catch (err) { next(err); }
});

router.put('/:id', (req: Request, res: Response, next: NextFunction): void => {
  const item = store.get(req.params.id);
  if (!item) { res.status(404).json({ ok: false, error: '${Name} not found' }); return; }
  try {
${updateBody}
    res.json({ ok: true, data: item });
  } catch (err) { next(err); }
});

router.delete('/:id', (req: Request, res: Response): void => {
  if (!store.delete(req.params.id)) {
    res.status(404).json({ ok: false, error: '${Name} not found' }); return;
  }
  res.json({ ok: true, message: '${Name} deleted' });
});

export default router;
`;
}

export function requestSchemaTemplate(name: string, fields: ApiField[]): string {
  const Name = toPascalCase(name);
  const zodFields = fields
    .map(f => {
      const base = f.type === 'number' ? 'z.number()' : f.type === 'boolean' ? 'z.boolean()' : 'z.string()';
      return `  ${f.name}: ${f.required === false ? `${base}.optional()` : base},`;
    })
    .join('\n');
  return `import { z } from 'zod';

export const ${toCamelCase(name)}Schema = z.object({
${zodFields}
});

export type ${Name}Dto = z.infer<typeof ${toCamelCase(name)}Schema>;

export function validate${Name}(body: unknown): ${Name}Dto {
  return ${toCamelCase(name)}Schema.parse(body);
}
`;
}

export function responseSchemaTemplate(name: string, fields: ApiField[]): string {
  const Name = toPascalCase(name);
  const fieldDecl = fields.map(f => `  ${f.name}: ${f.type};`).join('\n');
  return `export interface ${Name}Response {
  ok:   true;
  data: ${Name}Data;
}

export interface ${Name}Data {
  id: string;
${fieldDecl}
}

export interface ${Name}ListResponse {
  ok:    true;
  data:  ${Name}Data[];
  total: number;
}

export interface ErrorResponse {
  ok:    false;
  error: string;
}
`;
}

export function apiClientTemplate(resource: string, baseUrl = '/api'): string {
  const Name    = toPascalCase(resource);
  const path    = `${baseUrl}/${pluralize(resource.toLowerCase())}`;
  return `const BASE = '${path}';

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  const body = await res.json() as { ok: boolean; data?: T; error?: string };
  if (!res.ok || !body.ok) throw new Error((body as { error?: string }).error ?? \`HTTP \${res.status}\`);
  return body.data as T;
}

export const ${toCamelCase(resource)}Client = {
  getAll():                   Promise<${Name}[]>  { return apiFetch(\`\${BASE}\`); },
  getById(id: string):        Promise<${Name}>    { return apiFetch(\`\${BASE}/\${id}\`); },
  create(dto: Partial<${Name}>): Promise<${Name}> {
    return apiFetch(\`\${BASE}\`, { method: 'POST', body: JSON.stringify(dto) });
  },
  update(id: string, dto: Partial<${Name}>): Promise<${Name}> {
    return apiFetch(\`\${BASE}/\${id}\`, { method: 'PUT', body: JSON.stringify(dto) });
  },
  remove(id: string): Promise<void> {
    return apiFetch(\`\${BASE}/\${id}\`, { method: 'DELETE' });
  },
};

export interface ${Name} {
  id: string;
  [key: string]: unknown;
}
`;
}
