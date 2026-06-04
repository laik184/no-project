import type { Request, Response } from 'express';
import { chatStore }    from '../persistence/chat-store.ts';
import { messageStore } from '../persistence/message-store.ts';

export const historyController = {
  async getHistory(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.query.projectId);
    const page      = Number(req.query.page ?? 1);
    const limit     = Number(req.query.limit ?? 20);
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    const history = await chatStore.getHistory(projectId, page, limit);
    res.json(history);
  },

  async getMessagesByProject(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.query.projectId);
    const limit     = Number(req.query.limit ?? 50);
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    const messages = await messageStore.listByProject(projectId, limit);
    res.json(messages);
  },

  async getMessagesByRun(req: Request, res: Response): Promise<void> {
    const { runId } = req.params;
    if (!runId) { res.status(400).json({ error: 'runId required' }); return; }
    const messages = await messageStore.listByRun(runId);
    res.json(messages);
  },
};
