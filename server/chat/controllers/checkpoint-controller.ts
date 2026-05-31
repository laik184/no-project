/**
 * server/chat/controllers/checkpoint-controller.ts
 * Request handling for checkpoint REST endpoints.
 */
import type { Request, Response } from 'express';
import { chatCheckpointStore } from '../persistence/checkpoint-store.ts';
import type { CheckpointListItem } from '../types/checkpoint.types.ts';

function toListItem(cp: import('../types/checkpoint.types.ts').ChatCheckpoint): CheckpointListItem {
  return {
    id:            cp.id,
    runId:         cp.runId,
    projectId:     cp.projectId,
    title:         cp.title,
    description:   cp.description,
    trigger:       cp.trigger,
    filesChanged:  cp.filesChanged,
    createdFiles:  cp.createdFiles,
    modifiedFiles: cp.modifiedFiles,
    deletedFiles:  cp.deletedFiles,
    createdAt:     cp.createdAt.toISOString(),
  };
}

export const checkpointController = {

  /** GET /api/checkpoints/:projectId */
  async list(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    if (!projectId || isNaN(projectId)) {
      res.status(400).json({ ok: false, error: 'Invalid projectId' });
      return;
    }
    try {
      const checkpoints = await chatCheckpointStore.listByProject(projectId);
      res.json({ ok: true, checkpoints: checkpoints.map(toListItem) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  /** GET /api/checkpoints/:projectId/:checkpointId */
  async get(req: Request, res: Response): Promise<void> {
    const { checkpointId } = req.params;
    try {
      const cp = await chatCheckpointStore.findById(checkpointId);
      if (!cp) { res.status(404).json({ ok: false, error: 'Not found' }); return; }
      res.json({ ok: true, checkpoint: toListItem(cp) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  /** POST /api/checkpoints/:projectId/:checkpointId/rollback */
  async rollback(req: Request, res: Response): Promise<void> {
    const { checkpointId } = req.params;
    try {
      const result = await chatCheckpointStore.rollback(checkpointId);
      if (!result.ok) {
        res.status(400).json({ ok: false, error: result.error ?? 'Rollback failed' });
        return;
      }
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  /** GET /api/checkpoints/:projectId/recovery/diagnostics — stub for hook compat */
  diagnostics(_req: Request, res: Response): void {
    res.json({
      ok: true,
      diagnostics: { locked: false, consecutiveFailures: 0, circuitOpen: false },
    });
  },

  /** POST /api/checkpoints/:projectId/recovery/reset — stub for hook compat */
  resetRecovery(_req: Request, res: Response): void {
    res.json({ ok: true });
  },
};
