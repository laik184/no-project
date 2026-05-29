/**
 * run.routes.ts — Route registration for /api/chat/runs/* endpoints.
 * Route registration only — no business logic.
 */
import { Router } from 'express';
import { runController } from '../controllers/run-controller.ts';

const router = Router();

/** List all currently active run IDs. */
router.get('/active', (req, res) => runController.listActive(req, res));

/** List runs for a project. */
router.get('/', (req, res) => runController.listByProject(req, res));

/** Get status of a specific run. */
router.get('/:runId', (req, res) => runController.getStatus(req, res));

/** Cancel an active run. */
router.post('/:runId/cancel', (req, res) => runController.cancel(req, res));

export { router as runRoutes };
