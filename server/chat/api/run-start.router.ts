import { Router }        from 'express';
import type { Request, Response } from 'express';
import { runController } from '../controllers/run-controller.ts';

const router = Router();

// POST /api/run — primary entry used by the frontend submitRun()
// Returns { ok: true, data: { runId, ... } }
router.post('/', (req: Request, res: Response) => runController.startWrapped(req, res));

// POST /api/run/start — legacy alias kept for backwards compatibility
router.post('/start', (req: Request, res: Response) => runController.start(req, res));

// GET /api/run/active?projectId=N — used by useRunRecovery for stream reattach
router.get('/active', (req: Request, res: Response) => runController.getActive(req, res));

// POST /api/run/:runId/cancel — cancel an active run
router.post('/:runId/cancel', (req: Request, res: Response) => runController.cancel(req, res));

// POST /api/run/cancel/:runId — legacy alias
router.post('/cancel/:runId', (req: Request, res: Response) => { runController.cancel(req, res); });

export { router as runStartRouter };
