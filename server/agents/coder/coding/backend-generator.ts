/**
 * backend-generator.ts
 * Generates Express route file stubs.
 * Single responsibility: produce file path + content for backend artifacts.
 */

export interface GeneratedFile {
  relativePath: string;
  content:      string;
}

function routeTemplate(name: string): string {
  const lower = name.toLowerCase();
  return [
    `import { Router } from 'express';`,
    ``,
    `export const ${lower}Router = Router();`,
    ``,
    `${lower}Router.get('/', async (_req, res) => {`,
    `  res.json({ data: [] });`,
    `});`,
    ``,
    `${lower}Router.post('/', async (req, res) => {`,
    `  res.status(201).json({ created: true, body: req.body });`,
    `});`,
  ].join('\n');
}

export const backendGenerator = {
  generateRoute(name: string): GeneratedFile {
    const safe = name.replace(/[^a-zA-Z0-9]/g, '');
    return {
      relativePath: `server/routes/${safe.toLowerCase()}.ts`,
      content:      routeTemplate(safe),
    };
  },
};
