/**
 * question-controller.ts — Handles /api/chat/questions/* route requests.
 * Request handling only: validate → call answerManager / questionManager → respond.
 */
import type { Request, Response } from 'express';
import { answerManager }   from '../questions/answer-manager.ts';
import { questionManager } from '../questions/question-manager.ts';
import { answerQuestionSchema, questionIdParamSchema } from '../schemas/question.schema.ts';

export const questionController = {
  /**
   * POST /api/chat/questions/:questionId/answer — Submit an answer.
   */
  async answer(req: Request, res: Response): Promise<void> {
    const paramParsed = questionIdParamSchema.safeParse(req.params);
    if (!paramParsed.success) {
      res.status(400).json({ ok: false, errors: paramParsed.error.flatten() });
      return;
    }

    const bodyParsed = answerQuestionSchema.safeParse({
      questionId: paramParsed.data.questionId,
      runId:      req.body?.runId ?? '',
      answer:     req.body?.answer ?? '',
    });
    if (!bodyParsed.success) {
      res.status(400).json({ ok: false, errors: bodyParsed.error.flatten() });
      return;
    }

    try {
      const { questionId, runId, answer } = bodyParsed.data;
      const updated = answerManager.submit({
        questionId: questionId!,
        runId:      runId!,
        answer:     answer!,
      });
      res.json({ ok: true, data: updated });
    } catch (err) {
      const code    = (err as { code?: string }).code;
      const message = err instanceof Error ? err.message : String(err);
      const status  = code === 'NOT_FOUND' ? 404 : code === 'NOT_PENDING' ? 409 : 400;
      res.status(status).json({ ok: false, error: message });
    }
  },

  /**
   * GET /api/chat/questions/:questionId — Get a question by ID.
   */
  getById(req: Request, res: Response): void {
    const parsed = questionIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ ok: false, errors: parsed.error.flatten() });
      return;
    }

    const question = questionManager.get(parsed.data.questionId);
    if (!question) {
      res.status(404).json({ ok: false, error: `Question ${parsed.data.questionId} not found` });
      return;
    }

    res.json({ ok: true, data: question });
  },

  /**
   * GET /api/chat/questions?runId=X — List pending questions for a run.
   */
  listPending(req: Request, res: Response): void {
    const runId = req.query.runId as string;
    if (!runId) {
      res.status(400).json({ ok: false, error: 'runId query param is required' });
      return;
    }

    const questions = questionManager.listPendingByRun(runId);
    res.json({ ok: true, data: questions });
  },

  /**
   * DELETE /api/chat/questions/:questionId — Cancel a pending question.
   */
  cancel(req: Request, res: Response): void {
    const parsed = questionIdParamSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({ ok: false, errors: parsed.error.flatten() });
      return;
    }

    const cancelled = questionManager.cancel(parsed.data.questionId);
    if (!cancelled) {
      res.status(409).json({ ok: false, error: 'Question is not in pending state' });
      return;
    }

    res.json({ ok: true });
  },
};
