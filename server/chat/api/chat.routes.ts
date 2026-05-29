/**
 * chat.routes.ts — Route registration for /api/chat/* endpoints.
 * Route registration only — no business logic.
 */
import { Router } from 'express';
import { chatController } from '../controllers/chat-controller.ts';

const router = Router();

/** Start a new agent run with a goal. */
router.post('/run', (req, res) => chatController.startRun(req, res));

/** Send a standalone message (not tied to a run). */
router.post('/message', (req, res) => chatController.sendMessage(req, res));

/** Set feedback on a message. */
router.post('/feedback', (req, res) => chatController.setFeedback(req, res));

/** List conversations for a project. */
router.get('/conversations', (req, res) => chatController.listConversations(req, res));

export { router as chatRoutes };
