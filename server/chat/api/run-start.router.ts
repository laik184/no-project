import { Router } from 'express';
import { runController } from '../controllers/run-controller.ts';

const router = Router();

router.post('/start', (req, res) => runController.start(req, res));
router.post('/cancel/:runId', (req, res) => { runController.cancel(req, res); });

export { router as runStartRouter };
