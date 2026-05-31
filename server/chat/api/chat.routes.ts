/**
 * chat.routes.ts — Route registration for /api/chat/* endpoints.
 * Route registration only — no business logic.
 *
 * Run start is NOT here — use POST /api/run (run-start.router.ts).
 * File upload alias /upload is here for frontend compatibility.
 */
import { Router } from 'express';
import multer from 'multer';
import { chatController }       from '../controllers/chat-controller.ts';
import { attachmentController } from '../controllers/attachment-controller.ts';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const router = Router();

/** Send a standalone message (not tied to a run). */
router.post('/message', (req, res) => chatController.sendMessage(req, res));

/** Set feedback on a message. */
router.post('/feedback', (req, res) => chatController.setFeedback(req, res));

/** List conversations for a project. */
router.get('/conversations', (req, res) => chatController.listConversations(req, res));

/**
 * POST /api/chat/upload — file upload alias used by the frontend (ChatInput.tsx).
 * Canonical path is /api/chat/attachments/upload; this alias keeps both working.
 */
router.post('/upload', upload.single('file'), (req, res) => attachmentController.upload(req, res));

export { router as chatRoutes };
