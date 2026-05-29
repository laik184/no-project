/**
 * attachment-controller.ts — Handles /api/chat/attachments/* route requests.
 * Request handling only: parse multipart → call attachmentManager → respond.
 */
import type { Request, Response } from 'express';
import { attachmentManager } from '../attachments/attachment-manager.ts';
import { attachmentStore }   from '../persistence/attachment-store.ts';
import { attachmentUploadSchema, attachmentQuerySchema } from '../schemas/attachment.schema.ts';

export const attachmentController = {
  /**
   * POST /api/chat/attachments/upload
   * Expects multipart/form-data with fields: projectId, [runId], file.
   * The file buffer is read from req.body.file (set by multer or raw body middleware).
   */
  async upload(req: Request, res: Response): Promise<void> {
    const metaParsed = attachmentUploadSchema.safeParse(req.body);
    if (!metaParsed.success) {
      res.status(400).json({ ok: false, errors: metaParsed.error.flatten() });
      return;
    }

    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      res.status(400).json({ ok: false, error: 'No file received in request' });
      return;
    }

    try {
      const record = await attachmentManager.upload({
        projectId: metaParsed.data.projectId,
        runId:     metaParsed.data.runId,
        filename:  file.originalname,
        mimeType:  file.mimetype,
        data:      file.buffer,
      });
      res.status(201).json({ ok: true, data: record });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const status  = (err as { code?: string }).code === 'LIMIT_EXCEEDED' ? 429 : 500;
      res.status(status).json({ ok: false, error: message });
    }
  },

  /**
   * GET /api/chat/attachments?projectId=N&[runId=X]
   * List attachments for a project or specific run.
   */
  async list(req: Request, res: Response): Promise<void> {
    const parsed = attachmentQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ ok: false, errors: parsed.error.flatten() });
      return;
    }

    const { projectId, runId } = parsed.data;

    try {
      const records = runId
        ? await attachmentStore.listByRun(runId)
        : await attachmentStore.listByProject(projectId);
      res.json({ ok: true, data: records });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: message });
    }
  },

  /**
   * GET /api/chat/attachments/:id — Get a single attachment record.
   */
  async getById(req: Request, res: Response): Promise<void> {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ ok: false, error: 'id must be a positive integer' });
      return;
    }

    try {
      const record = await attachmentStore.findById(id);
      if (!record) {
        res.status(404).json({ ok: false, error: `Attachment ${id} not found` });
        return;
      }
      res.json({ ok: true, data: record });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: message });
    }
  },
};
