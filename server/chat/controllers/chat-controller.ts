import type { Request, Response } from 'express';
import { messageService }    from '@services/chat';
import { messageBuilder }    from '../messages/message-builder.ts';
import { buildUserPayload }  from '../messages/user-message.ts';
import { conversationManager } from '../orchestration/conversation-manager.ts';
import { sendMessageSchema, feedbackSchema } from '../schemas/chat.schema.ts';

export const chatController = {
  async sendMessage(req: Request, res: Response): Promise<void> {
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
      return;
    }
    try {
      const payload = buildUserPayload(parsed.data.projectId, parsed.data.content, parsed.data.runId);
      const record  = await messageBuilder.buildUser(payload);
      res.status(201).json(record);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to store message';
      res.status(400).json({ error: message });
    }
  },

  async feedback(req: Request, res: Response): Promise<void> {
    const messageId = Number(req.params.id);
    const parsed    = feedbackSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid feedback' }); return; }
    await messageService.setFeedback(messageId, parsed.data.feedback);
    res.json({ ok: true });
  },

  async listConversations(req: Request, res: Response): Promise<void> {
    const projectId = Number(req.query.projectId);
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    res.json(conversationManager.listByProject(projectId));
  },
};
