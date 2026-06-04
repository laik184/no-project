import { Router } from 'express';
import { checkpointController } from '../controllers/checkpoint-controller.ts';

const router = Router();

router.get('/',                                (req, res) => checkpointController.list(req, res));
router.post('/',                               (req, res) => checkpointController.create(req, res));
router.get('/:checkpointId',                   (req, res) => checkpointController.get(req, res));
router.delete('/:checkpointId',                (req, res) => checkpointController.delete(req, res));
router.post('/:checkpointId/rollback',         (req, res) => checkpointController.rollback(req, res));
router.get('/:checkpointId/diff',              (req, res) => checkpointController.diff(req, res));

export { router as checkpointRouter };
