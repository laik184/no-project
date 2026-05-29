/**
 * attachment.routes.ts — Route registration for /api/chat/attachments/* endpoints.
 * Route registration only — no business logic.
 *
 * Note: multer middleware must be mounted by the parent router or main app
 * before upload routes. This router uses req.file (set by multer).
 */
import { Router } from 'express';
import { attachmentController } from '../controllers/attachment-controller.ts';

const router = Router();

/** Upload a file attachment (multipart/form-data). */
router.post('/upload', (req, res) => attachmentController.upload(req, res));

/** List attachments (by projectId or runId). */
router.get('/', (req, res) => attachmentController.list(req, res));

/** Get a single attachment record. */
router.get('/:id', (req, res) => attachmentController.getById(req, res));

export { router as attachmentRoutes };
