import { toPascalCase, toCamelCase } from '../utils/code-utils.ts';

export interface ExpressRouterOptions {
  prefix: string;
  middlewares?: string[];
}

export function expressRouterTemplate(opts: ExpressRouterOptions): string {
  const imports = opts.middlewares
    ? opts.middlewares.map(m => `import { ${m} } from '../middleware/${toCamelCase(m)}.ts';`).join('\n')
    : '';

  const uses = opts.middlewares
    ? opts.middlewares.map(m => `router.use(${m});`).join('\n') + '\n\n'
    : '';

  return `import { Router, Request, Response, NextFunction } from 'express';
${imports}

const router = Router();

${uses}router.get('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    res.json({ ok: true, data: [] });
  } catch (err) {
    next(err);
  }
});

export default router;
`;
}

export function expressServerTemplate(port: number, routes: Array<{ prefix: string; module: string }>): string {
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

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.message);
  res.status(500).json({ ok: false, error: err.message });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(\`Server running on port \${PORT}\`);
});

export default app;
`;
}

export function expressMiddlewareTemplate(name: string, logic: string): string {
  const fn = toCamelCase(name);
  return `import { Request, Response, NextFunction } from 'express';

export function ${fn}(req: Request, res: Response, next: NextFunction): void {
${logic}
}
`;
}
