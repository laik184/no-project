import type { Request, Response } from 'express';
import { chatOrchestrator }       from '../orchestration/chat-orchestrator.ts';
import { runStore }               from '../persistence/run-store.ts';
import { startRunSchema }         from '../schemas/chat.schema.ts';
import { unregisterRun }          from '../run/registry.ts';

export const runController = {
  async start(req: Request, res: Response): Promise<void> {
    const parsed = startRunSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }

    try {
      const run = await chatOrchestrator.startRun(parsed.data);
      res.status(202).json(run);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      console.error('[run-controller] startRun failed:', message);
      res.status(500).json({ error: message });
    }
  },

  cancel(req: Request, res: Response): void {
    const { runId } = req.params;
    if (!runId) { res.status(400).json({ error: 'runId required' }); return; }
    const result = chatOrchestrator.cancelRun(runId);
    unregisterRun(runId);
    res.json(result);
  },

  async status(req: Request, res: Response): Promise<void> {
    const { runId } = req.params;
    if (!runId) { res.status(400).json({ error: 'runId required' }); return; }
    const run = await runStore.findById(runId);
    if (!run) { res.status(404).json({ error: 'Run not found' }); return; }
    res.json(run);
  },

  async listByProject(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.query.projectId);
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    const runs = await runStore.listByProject(projectId, 20);
    res.json(runs);
  },
};
