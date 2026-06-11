import { Router } from 'express';
import { questionController } from '../controllers/question-controller.ts';

const router = Router();

router.get('/runs/:runId/questions',         (req, res) => questionController.listPending(req, res));
router.post('/:questionId/answer',           (req, res) => questionController.answer(req, res));
router.delete('/:questionId',                (req, res) => questionController.cancel(req, res));

// Legacy aliases retained for older clients that mounted the question resource name twice.
router.post('/questions/:questionId/answer', (req, res) => questionController.answer(req, res));
router.delete('/questions/:questionId',      (req, res) => questionController.cancel(req, res));

export { router as questionRouter };
