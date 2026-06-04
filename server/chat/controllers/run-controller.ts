/**
 * run-controller.ts — Handles /api/chat/runs/* route requests.
 * Request handling only: validate → call runManager / orchestrator → respond.
 *
 * Approved integration: calls runManager from orchestration/core/run-manager.
 */
import type { Request, Response } from 'express';
import { runManager }       from '../../orchestration/core/run-manager.ts';
import { chatOrchestrator } from '@services/chat';
import { runStore }         from '../persistence/run-store.ts';
import { cancelRunSchema, runIdParamSchema, runStatusQuerySchema } from '../schemas/run.schema.ts';

export const runController = {
  /**
   * GET /api/chat/runs/:runId — Get run metadata.
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    const parsed = runIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ ok: false, errors: parsed.error.flatten() });
      return;
    }

    const { runId } = parsed.data;

    // Check in-memory first (active runs)
    const inMemory = runManager.get(runId);
    if (inMemory) {
      res.json({ ok: true, data: inMemory });
      return;
    }

    // Fall back to DB (completed runs)
    try {
      const dbRun = await runStore.findById(runId);
      if (!dbRun) {
        res.status(404).json({ ok: false, error: `Run ${runId} not found` });
        return;
      }
      res.json({ ok: true, data: dbRun });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: message });
    }
  },

  /**
   * POST /api/chat/runs/:runId/cancel — Cancel an active run.
   */
  cancel(req: Request, res: Response): void {
    const paramParsed = runIdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      res.status(400).json({ ok: false, errors: paramParsed.error.flatten() });
      return;
    }

    const { runId } = paramParsed.data;
    const result = chatOrchestrator.cancelRun(runId);

    if (!result.cancelled) {
      res.status(400).json({ ok: false, error: result.reason ?? 'Cannot cancel run' });
      return;
    }

    res.json({ ok: true, data: result });
  },

  /**
   * GET /api/chat/runs?projectId=N — List runs for a project.
   */
  async listByProject(req: Request, res: Response): Promise<void> {
    const parsed = runStatusQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ ok: false, errors: parsed.error.flatten() });
      return;
    }

    const { projectId } = parsed.data;
    if (!projectId) {
      res.status(400).json({ ok: false, error: 'projectId is required' });
      return;
    }

    try {
      const runs = await runStore.listByProject(projectId);
      res.json({ ok: true, data: runs });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: message });
    }
  },

  /**
   * GET /api/chat/runs/active — Returns IDs of all currently active runs.
   */
  listActive(_req: Request, res: Response): void {
    const ids = runManager.activeRunIds();
    res.json({ ok: true, data: { runIds: ids, count: ids.length } });
  },
};
