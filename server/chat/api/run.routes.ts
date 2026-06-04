import { Router } from 'express';
import { runController } from '../controllers/run-controller.ts';

const router = Router();

router.get('/',                  (req, res) => runController.listByProject(req, res));
router.get('/:runId',            (req, res) => runController.status(req, res));
router.post('/:runId/cancel',    (req, res) => { runController.cancel(req, res); });

export { router as runRouter };
