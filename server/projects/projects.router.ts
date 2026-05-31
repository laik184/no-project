import { Router, type Request, type Response } from 'express';
import { db } from '../infrastructure/db/index.ts';
import { projects } from '../../shared/schema.ts';
import { desc, eq } from 'drizzle-orm';

const router = Router();

router.get('/projects', async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(projects).orderBy(desc(projects.updatedAt));
    res.json({ ok: true, data: rows });
  } catch (err) {
    console.error('[projects] GET /api/projects error:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch projects' });
  }
});

router.post('/projects', async (req: Request, res: Response) => {
  try {
    const { name, description, framework } = req.body as {
      name?: string; description?: string; framework?: string;
    };
    if (!name) return res.status(400).json({ ok: false, error: 'name is required' });
    const [row] = await db.insert(projects).values({ name, description, framework }).returning();
    res.status(201).json({ ok: true, data: row });
  } catch (err) {
    console.error('[projects] POST /api/projects error:', err);
    res.status(500).json({ ok: false, error: 'Failed to create project' });
  }
});

router.get('/projects/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const [row] = await db.select().from(projects).where(eq(projects.id, id));
    if (!row) return res.status(404).json({ ok: false, error: 'Project not found' });
    res.json({ ok: true, data: row });
  } catch (err) {
    console.error('[projects] GET /api/projects/:id error:', err);
    res.status(500).json({ ok: false, error: 'Failed to fetch project' });
  }
});

router.patch('/projects/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { name, description, framework, status } = req.body as {
      name?: string; description?: string; framework?: string; status?: string;
    };
    const [row] = await db
      .update(projects)
      .set({ ...(name && { name }), ...(description !== undefined && { description }), ...(framework && { framework }), ...(status && { status }), updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    if (!row) return res.status(404).json({ ok: false, error: 'Project not found' });
    res.json({ ok: true, data: row });
  } catch (err) {
    console.error('[projects] PATCH /api/projects/:id error:', err);
    res.status(500).json({ ok: false, error: 'Failed to update project' });
  }
});

router.delete('/projects/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    await db.delete(projects).where(eq(projects.id, id));
    res.json({ ok: true });
  } catch (err) {
    console.error('[projects] DELETE /api/projects/:id error:', err);
    res.status(500).json({ ok: false, error: 'Failed to delete project' });
  }
});

router.post('/project/save', async (req: Request, res: Response) => {
  try {
    const { name, projectPath } = req.body as { name?: string; projectPath?: string };
    if (!name) return res.status(400).json({ ok: false, error: 'name is required' });
    const existing = await db.select().from(projects).where(eq(projects.name, name));
    if (existing.length > 0) {
      const [row] = await db.update(projects).set({ sandboxPath: projectPath ?? null, updatedAt: new Date() }).where(eq(projects.name, name)).returning();
      return res.json({ ok: true, data: row });
    }
    const [row] = await db.insert(projects).values({ name, sandboxPath: projectPath ?? null }).returning();
    res.json({ ok: true, data: row });
  } catch (err) {
    console.error('[projects] POST /api/project/save error:', err);
    res.status(500).json({ ok: false, error: 'Failed to save project' });
  }
});

router.post('/project/load', async (req: Request, res: Response) => {
  try {
    const { name } = req.body as { name?: string };
    if (!name) return res.status(400).json({ ok: false, error: 'name is required' });
    const [row] = await db.select().from(projects).where(eq(projects.name, name));
    if (!row) return res.status(404).json({ ok: false, error: 'Project not found' });
    res.json({ ok: true, data: row });
  } catch (err) {
    console.error('[projects] POST /api/project/load error:', err);
    res.status(500).json({ ok: false, error: 'Failed to load project' });
  }
});

export default router;
