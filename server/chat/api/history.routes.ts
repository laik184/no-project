/**
 * history.routes.ts — Route registration for /api/chat/history/* endpoints.
 * Route registration only — no business logic.
 */
import { Router } from 'express';
import { historyController } from '../controllers/history-controller.ts';

const router = Router();

/** Paginated history (runs + messages) for a project. */
router.get('/', (req, res) => historyController.getHistory(req, res));

/** Recent messages for a project. */
router.get('/messages', (req, res) => historyController.getProjectMessages(req, res));

/** All messages for a specific run. */
router.get('/run/:runId', (req, res) => historyController.getRunMessages(req, res));

export { router as historyRoutes };
