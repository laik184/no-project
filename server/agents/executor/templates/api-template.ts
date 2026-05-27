import { fileHeader, toCamelCase, toPascalCase, toKebabCase } from '../utils/code-utils.ts';

export function generateApiRoute(
  method: string,
  routePath: string,
  description: string,
): string {
  const fn = toCamelCase(`handle ${routePath.replace(/[/:]/g, ' ')}`);

  return `${fileHeader(`${method.toUpperCase()} ${routePath} — ${description}`)}import type { Request, Response } from 'express';

export async function ${fn}(req: Request, res: Response): Promise<void> {
  try {
    // ${description}
    res.json({ ok: true, data: null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    res.status(500).json({ error: message });
  }
}
`;
}

export function generateRequestHandler(resourceName: string, action: string): string {
  const pascal = toPascalCase(resourceName);
  const fn     = toCamelCase(`${action} ${resourceName}`);

  return `${fileHeader(`${fn} request handler`)}import type { Request, Response } from 'express';

export async function ${fn}(req: Request, res: Response): Promise<void> {
  try {
    const input = req.body as Partial<${pascal}Input>;
    if (!input) {
      res.status(400).json({ error: 'Request body is required' });
      return;
    }
    res.json({ ok: true, data: input });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    res.status(500).json({ error: message });
  }
}

interface ${pascal}Input {
  [key: string]: unknown;
}
`;
}

export function generateResponseSchema(resourceName: string): string {
  const pascal = toPascalCase(resourceName);
  const kebab  = toKebabCase(resourceName);

  return `${fileHeader(`${pascal} API response schemas (Zod)`)}import { z } from 'zod';

export const ${toCamelCase(resourceName)}Schema = z.object({
  id:        z.string(),
  createdAt: z.string().datetime().optional(),
});

export const ${toCamelCase(resourceName)}ListResponseSchema = z.object({
  data:  z.array(${toCamelCase(resourceName)}Schema),
  total: z.number().int().min(0),
});

export const ${toCamelCase(resourceName)}ResponseSchema = z.object({
  data: ${toCamelCase(resourceName)}Schema,
});

export type ${pascal}           = z.infer<typeof ${toCamelCase(resourceName)}Schema>;
export type ${pascal}Response   = z.infer<typeof ${toCamelCase(resourceName)}ResponseSchema>;
export type ${pascal}ListResponse = z.infer<typeof ${toCamelCase(resourceName)}ListResponseSchema>;
// API path: /api/${kebab}s
`;
}
