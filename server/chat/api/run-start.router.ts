import { Router }         from 'express';
import type { Request, Response } from 'express';
import { runController }  from '../controllers/run-controller.ts';
import { startRunSchema } from '../schemas/chat.schema.ts';
import { chatOrchestrator } from '../orchestration/chat-orchestrator.ts';
import { runStore }       from '../persistence/run-store.ts';

const router = Router();

// POST /api/run — primary entry used by the frontend submitRun()
// Returns { ok: true, data: { runId, ... } }
router.post('/', async (req: Request, res: Response) => {
  const parsed = startRunSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: { message: 'Invalid request', details: parsed.error.flatten() } });
    return;
  }
  try {
    const run = await chatOrchestrator.startRun(parsed.data);
    res.status(202).json({ ok: true, data: run });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error';
    console.error('[run-start] startRun failed:', message);
    res.status(500).json({ ok: false, error: { message } });
  }
});

// POST /api/run/start — legacy alias kept for backwards compatibility
router.post('/start', (req: Request, res: Response) => runController.start(req, res));

// GET /api/run/active?projectId=N — used by useRunRecovery for stream reattach
router.get('/active', async (req: Request, res: Response) => {
  const projectId = Number(req.query.projectId);
  if (!projectId) {
    res.json({ ok: true, run: null });
    return;
  }
  try {
    const runs = await runStore.listByProject(projectId, 5);
    const active = runs.find((r: any) => r.status === 'running' || r.status === 'active');
    res.json({ ok: true, run: active ?? null });
  } catch {
    res.json({ ok: true, run: null });
  }
});

// POST /api/run/:runId/cancel — cancel an active run
router.post('/:runId/cancel', (req: Request, res: Response) => runController.cancel(req, res));

// POST /api/run/cancel/:runId — legacy alias
router.post('/cancel/:runId', (req: Request, res: Response) => { runController.cancel(req, res); });

export { router as runStartRouter };
