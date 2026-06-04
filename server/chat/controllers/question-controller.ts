import type { Request, Response } from 'express';
import { questionManager } from '../questions/question-manager.ts';
import { answerManager }   from '../questions/answer-manager.ts';
import { answerSchema }    from '../schemas/question.schema.ts';

export const questionController = {
  listPending(req: Request, res: Response): void {
    const { runId } = req.params;
    if (!runId) { res.status(400).json({ error: 'runId required' }); return; }
    res.json(questionManager.listPendingByRun(runId));
  },

  answer(req: Request, res: Response): void {
    const { questionId } = req.params;
    const parsed = answerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid answer', details: parsed.error.flatten() });
      return;
    }
    try {
      const result = answerManager.submit({ questionId, answer: parsed.data.answer });
      res.json(result);
    } catch (err) {
      const code    = (err as any).code;
      const message = err instanceof Error ? err.message : 'Failed to submit answer';
      const status  = code === 'NOT_FOUND' ? 404 : code === 'NOT_PENDING' ? 409 : 400;
      res.status(status).json({ error: message });
    }
  },

  cancel(req: Request, res: Response): void {
    const { questionId } = req.params;
    const cancelled = questionManager.cancel(questionId);
    if (!cancelled) { res.status(404).json({ error: 'Question not found' }); return; }
    res.json({ ok: true });
  },
};
