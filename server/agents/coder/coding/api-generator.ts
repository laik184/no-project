/**
 * api-generator.ts
 * Generates CRUD API endpoint stubs.
 * Single responsibility: produce files for a full REST resource.
 */

export interface GeneratedFile {
  relativePath: string;
  content:      string;
}

function crudTemplate(name: string): string {
  const lower = name.toLowerCase();
  return [
    `import { Router } from 'express';`,
    ``,
    `export const ${lower}CrudRouter = Router();`,
    ``,
    `${lower}CrudRouter.get('/',        async (_req, res) => { res.json({ data: [] }); });`,
    `${lower}CrudRouter.get('/:id',     async (req, res) => { res.json({ id: req.params.id }); });`,
    `${lower}CrudRouter.post('/',       async (req, res) => { res.status(201).json({ created: true }); });`,
    `${lower}CrudRouter.put('/:id',     async (req, res) => { res.json({ updated: true }); });`,
    `${lower}CrudRouter.delete('/:id',  async (req, res) => { res.json({ deleted: true }); });`,
  ].join('\n');
}

export const apiGenerator = {
  generateCrudEndpoints(name: string): GeneratedFile[] {
    const safe  = name.replace(/[^a-zA-Z0-9]/g, '');
    return [{
      relativePath: `server/api/${safe.toLowerCase()}-crud.ts`,
      content:      crudTemplate(safe),
    }];
  },
};
