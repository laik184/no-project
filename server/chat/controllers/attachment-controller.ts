import type { Request, Response } from 'express';
import { attachmentStore } from '../persistence/attachment-store.ts';

export const attachmentController = {
  async listByProject(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.query.projectId);
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    const attachments = await attachmentStore.listByProject(projectId);
    res.json(attachments);
  },

  async listByRun(req: Request, res: Response): Promise<void> {
    const { runId } = req.params;
    if (!runId) { res.status(400).json({ error: 'runId required' }); return; }
    const attachments = await attachmentStore.listByRun(runId);
    res.json(attachments);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const attachment = await attachmentStore.findById(id);
    if (!attachment) { res.status(404).json({ error: 'Attachment not found' }); return; }
    res.json(attachment);
  },
};
