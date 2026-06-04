import { Router } from 'express';
import { questionController } from '../controllers/question-controller.ts';

const router = Router();

router.get('/runs/:runId/questions',         (req, res) => questionController.listPending(req, res));
router.post('/questions/:questionId/answer', (req, res) => questionController.answer(req, res));
router.delete('/questions/:questionId',      (req, res) => questionController.cancel(req, res));

export { router as questionRouter };
