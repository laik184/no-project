import { toPascalCase, toCamelCase, pluralize } from '../utils.ts';

export interface ApiTemplateOptions {
  resource: string;
  fields:   string[];
}

export function apiRouterTemplate(opts: ApiTemplateOptions): string {
  const { resource, fields } = opts;
  const Name       = toPascalCase(resource);
  const name       = toCamelCase(resource);
  const collection = pluralize(name);

  const fieldList  = fields.map(f => `  ${f}: string;`).join('\n');
  const createBody = fields.map(f => `    ${f}: req.body.${f},`).join('\n');
  const updateBody = fields.map(f => `    if (req.body.${f} !== undefined) item.${f} = req.body.${f};`).join('\n');

  return `import { Router, Request, Response, NextFunction } from 'express';

interface ${Name} {
  id: string;
${fieldList}
  createdAt: string;
}

const router = Router();
const store = new Map<string, ${Name}>();

router.get('/', (_req: Request, res: Response): void => {
  res.json({ ok: true, data: Array.from(store.values()) });
});

router.get('/:id', (req: Request, res: Response, next: NextFunction): void => {
  const item = store.get(req.params.id);
  if (!item) { res.status(404).json({ ok: false, error: '${Name} not found' }); return; }
  res.json({ ok: true, data: item });
});

router.post('/', (req: Request, res: Response, next: NextFunction): void => {
  try {
    const id = crypto.randomUUID();
    const item: ${Name} = {
      id,
${createBody}
      createdAt: new Date().toISOString(),
    };
    store.set(id, item);
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

export function apiTypeTemplate(resource: string, fields: string[]): string {
  const Name       = toPascalCase(resource);
  const fieldLines = fields.map(f => `  ${f}: string;`).join('\n');

  return `export interface ${Name} {
  id: string;
${fieldLines}
  createdAt: string;
}

export interface Create${Name}Dto {
${fieldLines}
}

export interface Update${Name}Dto {
${fields.map(f => `  ${f}?: string;`).join('\n')}
}
`;
}
