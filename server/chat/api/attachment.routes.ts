import { Router }               from 'express';
import { attachmentController } from '../controllers/attachment-controller.ts';
import { attachmentManager }    from '../attachments/attachment-manager.ts';

const router = Router();

router.get('/',             (req, res) => attachmentController.listByProject(req, res));
router.get('/:id',          (req, res) => attachmentController.getById(req, res));
router.get('/run/:runId',   (req, res) => attachmentController.listByRun(req, res));

router.post('/upload', async (req, res) => {
  const projectId = Number((req as any).body?.projectId ?? (req as any).query?.projectId);
  const runId     = (req as any).body?.runId as string | undefined;
  const file      = (req as any).file as { originalname: string; mimetype: string; buffer: Buffer } | undefined;

  if (!projectId || !file) {
    res.status(400).json({ error: 'projectId and file are required' });
    return;
  }

  try {
    const record = await attachmentManager.upload(projectId, file.originalname, file.mimetype, file.buffer, runId);
    res.status(201).json(record);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed';
    res.status(400).json({ error: message });
  }
});

export { router as attachmentRouter };
