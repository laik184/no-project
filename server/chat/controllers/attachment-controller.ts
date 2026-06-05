import type { Request, Response } from 'express';
import { attachmentService } from '@services/chat';

export const attachmentController = {
  async listByProject(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.query.projectId);
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    const attachments = await attachmentService.listByProject(projectId);
    res.json(attachments);
  },

  async listByRun(req: Request, res: Response): Promise<void> {
    const { runId } = req.params;
    if (!runId) { res.status(400).json({ error: 'runId required' }); return; }
    const attachments = await attachmentService.listByRun(runId);
    res.json(attachments);
  },

  async getById(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    const attachment = await attachmentService.findById(id);
    if (!attachment) { res.status(404).json({ error: 'Attachment not found' }); return; }
    res.json(attachment);
  },

  async upload(req: Request, res: Response): Promise<void> {
    const projectId = Number((req as any).body?.projectId ?? (req as any).query?.projectId);
    const runId     = (req as any).body?.runId as string | undefined;
    const file      = (req as any).file as { originalname: string; mimetype: string; buffer: Buffer } | undefined;

    if (!projectId || !file) {
      res.status(400).json({ error: 'projectId and file are required' });
      return;
    }

    try {
      const record = await attachmentService.upload(projectId, file.originalname, file.mimetype, file.buffer, runId);
      res.status(201).json(record);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      res.status(400).json({ error: message });
    }
  },
};
