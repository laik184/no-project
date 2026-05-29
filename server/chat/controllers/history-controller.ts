/**
 * history-controller.ts — Handles /api/chat/history/* route requests.
 * Request handling only: validate → call chatStore → return response.
 */
import type { Request, Response } from 'express';
import { chatStore }          from '../persistence/chat-store.ts';
import { messageStore }       from '../persistence/message-store.ts';
import { historyQuerySchema } from '../schemas/chat.schema.ts';
import { runIdParamSchema }   from '../schemas/run.schema.ts';

export const historyController = {
  /**
   * GET /api/chat/history?projectId=N&page=N&limit=N
   * Paginated chat history for a project (runs + messages).
   */
  async getHistory(req: Request, res: Response): Promise<void> {
    const parsed = historyQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ ok: false, errors: parsed.error.flatten() });
      return;
    }

    const { projectId, page, limit } = parsed.data;

    try {
      const history = await chatStore.getHistory(projectId, page, limit);
      res.json({ ok: true, data: history });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: message });
    }
  },

  /**
   * GET /api/chat/history/run/:runId — All messages for a specific run.
   */
  async getRunMessages(req: Request, res: Response): Promise<void> {
    const parsed = runIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ ok: false, errors: parsed.error.flatten() });
      return;
    }

    try {
      const messages = await messageStore.listByRun(parsed.data.runId);
      res.json({ ok: true, data: messages });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: message });
    }
  },

  /**
   * GET /api/chat/history/messages?projectId=N&limit=N — Recent messages for project.
   */
  async getProjectMessages(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.query.projectId);
    const limit     = Math.min(Number(req.query.limit ?? 50), 200);

    if (!Number.isInteger(projectId) || projectId <= 0) {
      res.status(400).json({ ok: false, error: 'projectId must be a positive integer' });
      return;
    }

    try {
      const messages = await messageStore.listByProject(projectId, limit);
      res.json({ ok: true, data: messages });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: message });
    }
  },
};
