import type { Request, Response } from 'express';
import { chatOrchestrator } from '../orchestration/chat-orchestrator.ts';
import { runService }       from '@services/chat';
import { startRunSchema }   from '../schemas/chat.schema.ts';
import { unregisterRun }    from '../run/registry.ts';
import type { RunStartPayload } from '../types/run.types.ts';

export const runController = {
  async start(req: Request, res: Response): Promise<void> {
    const parsed = startRunSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
      return;
    }
    try {
      const run = await chatOrchestrator.startRun(parsed.data as RunStartPayload);
      res.status(202).json(run);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      console.error('[run-controller] startRun failed:', message);
      res.status(500).json({ error: message });
    }
  },

  async startWrapped(req: Request, res: Response): Promise<void> {
    const parsed = startRunSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, error: { message: 'Invalid request', details: parsed.error.flatten() } });
      return;
    }
    try {
      const run = await chatOrchestrator.startRun(parsed.data as RunStartPayload);
      res.status(202).json({ ok: true, data: run });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      console.error('[run-controller] startRun failed:', message);
      res.status(500).json({ ok: false, error: { message } });
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
    const run = await runService.findById(runId);
    if (!run) { res.status(404).json({ error: 'Run not found' }); return; }
    res.json(run);
  },

  async listByProject(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.query.projectId);
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    const runs = await runService.listByProject(projectId, 20);
    res.json(runs);
  },

  async getActive(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.query.projectId);
    if (!projectId) {
      res.json({ ok: true, run: null });
      return;
    }
    try {
      const runs   = await runService.listByProject(projectId, 5);
      const active = runs.find((r) => r.status === 'running');
      res.json({ ok: true, run: active ?? null });
    } catch {
      res.json({ ok: true, run: null });
    }
  },
};
