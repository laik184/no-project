/**
 * server/chat/api/checkpoint.routes.ts
 * Routes: /api/checkpoints/:projectId/*
 *
 * Mounted at /api/checkpoints — projectId comes from the path.
 */
import { Router } from 'express';
import { checkpointController } from '../controllers/checkpoint-controller.ts';

const router = Router();

/** GET  /api/checkpoints/:projectId */
router.get('/:projectId',                           (req, res) => checkpointController.list(req, res));

/** POST /api/checkpoints/:projectId — manual checkpoint creation */
router.post('/:projectId',                          (req, res) => checkpointController.create(req, res));

/** GET  /api/checkpoints/:projectId/recovery/diagnostics */
router.get('/:projectId/recovery/diagnostics',      (req, res) => checkpointController.diagnostics(req, res));

/** POST /api/checkpoints/:projectId/recovery/reset */
router.post('/:projectId/recovery/reset',           (req, res) => checkpointController.resetRecovery(req, res));

/** GET  /api/checkpoints/:projectId/:checkpointId */
router.get('/:projectId/:checkpointId',             (req, res) => checkpointController.get(req, res));

/** POST /api/checkpoints/:projectId/:checkpointId/rollback */
router.post('/:projectId/:checkpointId/rollback',   (req, res) => checkpointController.rollback(req, res));

/** DELETE /api/checkpoints/:projectId/:checkpointId */
router.delete('/:projectId/:checkpointId',          (req, res) => checkpointController.delete(req, res));

export { router as checkpointRoutes };
