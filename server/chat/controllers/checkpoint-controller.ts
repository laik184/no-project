import type { Request, Response } from 'express';
import { checkpointService } from '../../services/chat/checkpoint.service.ts';

export const checkpointController = {
  async list(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.query.projectId);
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    try {
      const items = await checkpointService.listByProject(projectId);
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list checkpoints' });
    }
  },

  async get(req: Request, res: Response): Promise<void> {
    const { checkpointId } = req.params;
    const cp = await checkpointService.findById(checkpointId);
    if (!cp) { res.status(404).json({ error: 'Checkpoint not found' }); return; }
    res.json(cp);
  },

  async create(req: Request, res: Response): Promise<void> {
    const { projectId, label } = req.body as { projectId?: number; label?: string };
    if (!projectId || !label) { res.status(400).json({ error: 'projectId and label required' }); return; }
    try {
      const cp = await checkpointService.createManual(projectId, label);
      res.status(201).json(cp);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create checkpoint' });
    }
  },

  async rollback(req: Request, res: Response): Promise<void> {
    const { checkpointId } = req.params;
    try {
      const result = await checkpointService.rollback(checkpointId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Rollback failed' });
    }
  },

  async diff(req: Request, res: Response): Promise<void> {
    const { checkpointId }  = req.params;
    const { compareId }     = req.query as { compareId?: string };
    if (!compareId) { res.status(400).json({ error: 'compareId query param required' }); return; }
    try {
      const result = await checkpointService.diff(checkpointId, compareId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Diff failed' });
    }
  },

  async delete(req: Request, res: Response): Promise<void> {
    const { checkpointId } = req.params;
    const deleted = await checkpointService.delete(checkpointId);
    if (!deleted) { res.status(404).json({ error: 'Checkpoint not found' }); return; }
    res.status(204).send();
  },
};
