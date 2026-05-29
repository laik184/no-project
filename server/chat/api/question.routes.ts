/**
 * question.routes.ts — Route registration for /api/chat/questions/* endpoints.
 * Route registration only — no business logic.
 */
import { Router } from 'express';
import { questionController } from '../controllers/question-controller.ts';

const router = Router();

/** List pending questions for a run. */
router.get('/', (req, res) => questionController.listPending(req, res));

/** Get a specific question by ID. */
router.get('/:questionId', (req, res) => questionController.getById(req, res));

/** Submit an answer to a pending question. */
router.post('/:questionId/answer', (req, res) => questionController.answer(req, res));

/** Cancel a pending question. */
router.delete('/:questionId', (req, res) => questionController.cancel(req, res));

export { router as questionRoutes };
