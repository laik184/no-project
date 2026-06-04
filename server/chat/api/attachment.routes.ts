import { Router }               from 'express';
import { attachmentController } from '../controllers/attachment-controller.ts';

const router = Router();

router.get('/',             (req, res) => attachmentController.listByProject(req, res));
router.get('/:id',          (req, res) => attachmentController.getById(req, res));
router.get('/run/:runId',   (req, res) => attachmentController.listByRun(req, res));
router.post('/upload',      (req, res) => attachmentController.upload(req, res));

export { router as attachmentRouter };
