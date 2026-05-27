/**
 * server/tools/coding/templates/express-template.ts
 *
 * Template-based Express code generators.
 * All functions are pure and synchronous.
 */

import { toPascalCase, toCamelCase } from '../../../agents/coderx/utils.ts';

export function expressRouteTemplate(
  name: string,
  prefix: string,
  middlewares: string[] = [],
): string {
  const imports = middlewares
    .map(m => `import { ${m} } from '../middleware/${toCamelCase(m)}.ts';`)
    .join('\n');
  const uses = middlewares.map(m => `router.use(${m});`).join('\n');
  return `import { Router, type Request, type Response, type NextFunction } from 'express';
${imports}

const router = Router();

${uses ? uses + '\n\n' : ''}router.get('/', async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json({ ok: true, data: [] });
  } catch (err) {
    next(err);
  }
});

export default router;
`;
}

export function expressControllerTemplate(resource: string, fields: string[] = []): string {
  const Name   = toPascalCase(resource);
  const store  = `${toCamelCase(resource)}Store`;
  const fieldDecl = fields.map(f => `  ${f}: string;`).join('\n');
  const createBody = fields.map(f => `      ${f}: req.body.${f} as string,`).join('\n');
  return `import { type Request, type Response, type NextFunction } from 'express';

interface ${Name} {
  id: string;
${fieldDecl}
}

const ${store} = new Map<string, ${Name}>();

export function getAll(_req: Request, res: Response): void {
  res.json({ ok: true, data: [...${store}.values()] });
}

export function getOne(req: Request, res: Response): void {
  const item = ${store}.get(req.params.id);
  if (!item) { res.status(404).json({ ok: false, error: '${Name} not found' }); return; }
  res.json({ ok: true, data: item });
}

export function create(req: Request, res: Response, next: NextFunction): void {
  try {
    const id = crypto.randomUUID();
    const item: ${Name} = {
      id,
${createBody}
    };
    ${store}.set(id, item);
    res.status(201).json({ ok: true, data: item });
  } catch (err) { next(err); }
}

export function remove(req: Request, res: Response): void {
  if (!${store}.delete(req.params.id)) {
    res.status(404).json({ ok: false, error: '${Name} not found' }); return;
  }
  res.json({ ok: true, message: '${Name} deleted' });
}
`;
}

export function expressServiceTemplate(resource: string, fields: string[] = []): string {
  const Name      = toPascalCase(resource);
  const fieldDecl = fields.map(f => `  ${f}: string;`).join('\n');
  const createBody = fields.map(f => `    ${f}: dto.${f},`).join('\n');
  return `interface ${Name} {
  id: string;
${fieldDecl}
}

interface Create${Name}Dto {
${fieldDecl}
}

const store = new Map<string, ${Name}>();

export const ${toCamelCase(resource)}Service = {
  findAll(): ${Name}[] {
    return [...store.values()];
  },
  findById(id: string): ${Name} | undefined {
    return store.get(id);
  },
  create(dto: Create${Name}Dto): ${Name} {
    const item: ${Name} = { id: crypto.randomUUID(),
${createBody}
    };
    store.set(item.id, item);
    return item;
  },
  delete(id: string): boolean {
    return store.delete(id);
  },
};
`;
}

export function expressMiddlewareTemplate(name: string, logic: string): string {
  return `import { type Request, type Response, type NextFunction } from 'express';

export function ${toCamelCase(name)}(req: Request, res: Response, next: NextFunction): void {
${logic}
}
`;
}

export function expressServerTemplate(
  port:   number,
  routes: Array<{ prefix: string; module: string }>,
): string {
  const imports = routes
    .map(r => `import ${toCamelCase(r.module)}Router from './routes/${r.module}.ts';`)
    .join('\n');
  const mounts = routes
    .map(r => `app.use('${r.prefix}', ${toCamelCase(r.module)}Router);`)
    .join('\n');
  return `import express from 'express';
${imports}

const app = express();
const PORT = Number(process.env.PORT) || ${port};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

${mounts}

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[server]', err.message);
  res.status(500).json({ ok: false, error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`[server] Listening on port \${PORT}\`);
});

export default app;
`;
}
