/**
 * attachment.routes.ts — Route registration for /api/chat/attachments/* endpoints.
 * Route registration only — no business logic.
 *
 * Multer is scoped here — only applied to POST /upload.
 * Never rely on a globally mounted multer middleware.
 */
import { Router } from 'express';
import multer from 'multer';
import { attachmentController } from '../controllers/attachment-controller.ts';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

const router = Router();

/** Upload a file attachment (multipart/form-data). */
router.post('/upload', upload.single('file'), (req, res) => attachmentController.upload(req, res));

/** List attachments (by projectId or runId). */
router.get('/', (req, res) => attachmentController.list(req, res));

/** Get a single attachment record. */
router.get('/:id', (req, res) => attachmentController.getById(req, res));

export { router as attachmentRoutes };
