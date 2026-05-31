/**
 * server/chat/controllers/checkpoint-controller.ts
 * Request handling for checkpoint REST endpoints.
 */
import type { Request, Response } from 'express';
import { chatCheckpointStore } from '../persistence/checkpoint-store.ts';
import { bus } from '../../infrastructure/index.ts';
import {
  makeCheckpointCreatedPayload,
  makeCheckpointRollbackPayload,
  makeCheckpointDeletedEvent,
} from '../events/checkpoint.events.ts';
import type { CheckpointListItem } from '../types/checkpoint.types.ts';

function toListItem(
  cp:     import('../types/checkpoint.types.ts').ChatCheckpoint,
  status: 'stable' | 'rolled_back' | 'failed' | 'creating' = 'stable',
): CheckpointListItem {
  const sha = cp.gitCommitSha ?? undefined;
  return {
    id:            cp.id,
    runId:         cp.runId,
    projectId:     cp.projectId,
    label:         cp.title,
    title:         cp.title,
    description:   cp.description,
    trigger:       cp.trigger,
    status,
    filesChanged:  cp.filesChanged,
    fileCount:     cp.filesChanged,
    createdFiles:  cp.createdFiles,
    modifiedFiles: cp.modifiedFiles,
    deletedFiles:  cp.deletedFiles,
    createdAt:     cp.createdAt.toISOString(),
    gitCommitSha:  sha,
    gitSha:        sha,
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
      const cps = await chatCheckpointStore.listByProject(projectId);
      res.json({ ok: true, checkpoints: cps.map(cp => toListItem(cp)) });
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

  /** POST /api/checkpoints/:projectId — manual checkpoint creation */
  async create(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.params.projectId);
    if (!projectId || isNaN(projectId)) {
      res.status(400).json({ ok: false, error: 'Invalid projectId' });
      return;
    }
    const label = typeof req.body?.label === 'string' ? req.body.label.trim() : 'manual';
    try {
      const cp = await chatCheckpointStore.createManual(projectId, label || 'manual');
      const payload = makeCheckpointCreatedPayload(cp);
      bus.emit('checkpoint', payload as unknown as Record<string, unknown>);
      res.status(201).json({ ok: true, checkpoint: toListItem(cp) });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  /** POST /api/checkpoints/:projectId/:checkpointId/rollback */
  async rollback(req: Request, res: Response): Promise<void> {
    const { projectId, checkpointId } = req.params;
    try {
      const result = await chatCheckpointStore.rollback(checkpointId);
      if (!result.ok) {
        res.status(400).json({ ok: false, error: result.error ?? 'Rollback failed' });
        return;
      }
      const payload = makeCheckpointRollbackPayload(checkpointId, '', Number(projectId));
      bus.emit('checkpoint', payload as unknown as Record<string, unknown>);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  /** DELETE /api/checkpoints/:projectId/:checkpointId */
  async delete(req: Request, res: Response): Promise<void> {
    const { projectId, checkpointId } = req.params;
    try {
      const deleted = await chatCheckpointStore.deleteCheckpoint(checkpointId);
      if (!deleted) {
        res.status(404).json({ ok: false, error: 'Checkpoint not found' });
        return;
      }
      const event = makeCheckpointDeletedEvent(checkpointId, Number(projectId));
      bus.emit('checkpoint', event as unknown as Record<string, unknown>);
      res.json({ ok: true, checkpointId });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  /**
   * GET /api/checkpoints/:projectId/:checkpointId/diff?compareId=<id>
   * Returns file-level diff between two checkpoint snapshots.
   */
  async diff(req: Request, res: Response): Promise<void> {
    const { checkpointId } = req.params;
    const compareId = typeof req.query.compareId === 'string' ? req.query.compareId : '';
    if (!compareId) {
      res.status(400).json({ ok: false, error: 'compareId query param is required' });
      return;
    }
    try {
      const diff = await chatCheckpointStore.diffCheckpoints(checkpointId, compareId);
      const summary = `${diff.added.length} added, ${diff.removed.length} removed, ${diff.modified.length} modified`;
      res.json({ ok: true, diff, summary });
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
