/**
 * chat-controller.ts — Handles /api/chat/* route requests.
 * Request handling only: validate → call orchestrator → return response.
 *
 * Run start is handled by run-start.router.ts (POST /api/run).
 */
import type { Request, Response } from 'express';
import { conversationManager } from '../orchestration/conversation-manager.ts';
import { messageStore }        from '../persistence/message-store.ts';
import { sendMessageSchema, feedbackSchema } from '../schemas/chat.schema.ts';

export const chatController = {
  /**
   * POST /api/chat/message — Persist a user message outside of a run.
   */
  async sendMessage(req: Request, res: Response): Promise<void> {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, errors: parsed.error.flatten() });
      return;
    }

    try {
      const { projectId, content, runId } = parsed.data;
      const record = await messageStore.insertUser({ projectId, content, runId });
      res.status(201).json({ ok: true, data: record });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: message });
    }
  },

  /**
   * POST /api/chat/feedback — Set thumbs-up/down on a message.
   */
  async setFeedback(req: Request, res: Response): Promise<void> {
    const parsed = feedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, errors: parsed.error.flatten() });
      return;
    }

    try {
      await messageStore.setFeedback(parsed.data.messageId, parsed.data.feedback);
      res.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.status(500).json({ ok: false, error: message });
    }
  },

  /**
   * GET /api/chat/conversations?projectId=N — List conversations for a project.
   */
  listConversations(req: Request, res: Response): void {
    const projectId = Number(req.query.projectId);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      res.status(400).json({ ok: false, error: 'projectId is required and must be a positive integer' });
      return;
    }
    const data = conversationManager.listByProject(projectId);
    res.json({ ok: true, data });
  },
};
