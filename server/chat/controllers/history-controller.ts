import type { Request, Response } from 'express';
import { runService, messageService } from '@services/chat';

export const historyController = {
  async getHistory(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.query.projectId);
    const page      = Number(req.query.page ?? 1);
    const limit     = Number(req.query.limit ?? 20);
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    const history = await runService.getHistory(projectId, page, limit);
    res.json(history);
  },

  async getMessagesByProject(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.query.projectId);
    const limit     = Number(req.query.limit ?? 50);
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    const messages = await messageService.listByProject(projectId, limit);
    res.json(messages);
  },

  async getMessagesByRun(req: Request, res: Response): Promise<void> {
    const { runId } = req.params;
    if (!runId) { res.status(400).json({ error: 'runId required' }); return; }
    const messages = await messageService.listByRun(runId);
    res.json(messages);
  },
};
