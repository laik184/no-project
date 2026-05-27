import { fileHeader, toCamelCase, toPascalCase, toKebabCase } from '../utils/code-utils.ts';

export function generateExpressApp(): string {
  return `${fileHeader('Express application entry point')}import express from 'express';
import cors from 'cors';

export const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});
`;
}

export function generateExpressRoute(resourceName: string): string {
  const name   = toKebabCase(resourceName);
  const pascal = toPascalCase(resourceName);
  const camel  = toCamelCase(resourceName);

  return `${fileHeader(`${pascal} router`)}import { Router } from 'express';
import type { Request, Response } from 'express';

export const ${camel}Router = Router();

${camel}Router.get('/', async (_req: Request, res: Response) => {
  res.json({ data: [] });
});

${camel}Router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  res.json({ data: { id } });
});

${camel}Router.post('/', async (req: Request, res: Response) => {
  const body = req.body as Record<string, unknown>;
  res.status(201).json({ data: body });
});

${camel}Router.put('/:id', async (req: Request, res: Response) => {
  const { id }  = req.params;
  const body    = req.body as Record<string, unknown>;
  res.json({ data: { id, ...body } });
});

${camel}Router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  res.json({ data: { id, deleted: true } });
});

export default ${camel}Router;
// Mount: app.use('/api/${name}', ${camel}Router);
`;
}

export function generateMiddleware(name: string): string {
  const fn = toCamelCase(name);
  return `${fileHeader(`${fn} middleware`)}import type { Request, Response, NextFunction } from 'express';

export function ${fn}(req: Request, _res: Response, next: NextFunction): void {
  // ${fn} middleware
  next();
}
`;
}
