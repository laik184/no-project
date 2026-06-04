/**
 * run-start.router.ts — Top-level /api/run routes.
 *
 * The frontend uses /api/run (not /api/chat/runs) for:
 *   POST /api/run               — start a new agent run
 *   POST /api/run/:runId/cancel — cancel an active run
 *   GET  /api/run/active        — list active run IDs
 *
 * This is the single source of truth for run lifecycle actions.
 * All three routes delegate to the same controllers used by /api/chat/runs/*.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { chatOrchestrator } from '@services/chat';
import { runController }    from '../controllers/run-controller.ts';

const router = Router();

const startRunSchema = z.object({
  projectId: z.number().int().positive(),
  goal:      z.string().min(1),
  mode:      z.enum(['planned', 'direct', 'auto']).optional(),
  conversationId: z.string().optional(),
});

/**
 * GET /api/run/active
 * List active run IDs. Must be registered before /:runId to avoid param capture.
 */
router.get('/active', (req: Request, res: Response) => runController.listActive(req, res));

/**
 * POST /api/run
 * Start a new agent run. Returns { ok: true, data: { runId } }.
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = startRunSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, error: parsed.error.flatten() });
    return;
  }

  try {
    const chatRun = await chatOrchestrator.startRun(parsed.data);
    res.status(201).json({ ok: true, data: chatRun });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[run-start] startRun failed:', message);
    res.status(500).json({ ok: false, error: { message } });
  }
});

/**
 * POST /api/run/:runId/cancel
 * Cancel an active run. Returns { ok: true, data: { runId, cancelled } }.
 */
router.post('/:runId/cancel', (req: Request, res: Response): void => {
  const { runId } = req.params;
  if (!runId) {
    res.status(400).json({ ok: false, error: { message: 'runId is required' } });
    return;
  }

  const result = chatOrchestrator.cancelRun(runId);
  if (!result.cancelled) {
    res.status(400).json({ ok: false, error: { message: result.reason ?? 'Cannot cancel run' } });
    return;
  }

  res.json({ ok: true, data: result });
});

export { router as runStartRouter };
