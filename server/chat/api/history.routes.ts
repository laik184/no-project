import { Router } from 'express';
import { historyController } from '../controllers/history-controller.ts';

const router = Router();

router.get('/',                    (req, res) => historyController.getHistory(req, res));
router.get('/messages',            (req, res) => historyController.getMessagesByProject(req, res));
router.get('/runs/:runId/messages',(req, res) => historyController.getMessagesByRun(req, res));

export { router as historyRouter };
