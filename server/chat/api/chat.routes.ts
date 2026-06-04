import { Router } from 'express';
import { chatController }   from '../controllers/chat-controller.ts';
import { historyController } from '../controllers/history-controller.ts';

const router = Router();

router.get('/conversations',           (req, res) => chatController.listConversations(req, res));
router.post('/messages',               (req, res) => chatController.sendMessage(req, res));
router.patch('/messages/:id/feedback', (req, res) => chatController.feedback(req, res));
router.get('/messages',                (req, res) => historyController.getMessagesByProject(req, res));
router.get('/runs/:runId/messages',    (req, res) => historyController.getMessagesByRun(req, res));

export { router as chatRouter };
