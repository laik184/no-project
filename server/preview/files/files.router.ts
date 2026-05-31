import { Router } from 'express';
import multer from 'multer';
import { filesController } from './files.controller.ts';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

router.get('/files/list', (req, res) => filesController.listFiles(req, res));
router.post('/files/create', (req, res) => filesController.createFile(req, res));
router.post('/files/upload', upload.array('files', 50), (req, res) => filesController.uploadFiles(req, res));
router.get('/files/download', (req, res) => filesController.downloadZip(req, res));
router.delete('/files/*', (req, res) => filesController.deleteFile(req, res));
router.get('/files/stat', (req, res) => filesController.statFile(req, res));
router.get('/files/health', (req, res) => filesController.healthCheck(req, res));

export default router;
