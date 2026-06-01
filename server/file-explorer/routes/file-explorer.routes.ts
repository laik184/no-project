/**
 * server/file-explorer/routes/file-explorer.routes.ts
 * Express Router with all file-explorer endpoints.
 * Thin: only wires routes, sets up multer, delegates everything to the controller.
 */

import { Router }              from 'express';
import multer                  from 'multer';
import { fileExplorerController as ctrl } from '../controllers/index.ts';
import { FE_CONFIG }           from '../config/index.ts';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: FE_CONFIG.maxUploadSizeMb * 1024 * 1024 },
});

// ── Tree ─────────────────────────────────────────────────────────────────────
router.get('/tree', (req, res) => ctrl.getTree(req, res));

// ── Read / Write ──────────────────────────────────────────────────────────────
router.get ('/read',  (req, res) => ctrl.readFile(req, res));
router.post('/write', (req, res) => ctrl.writeFile(req, res));

// ── Create / Rename / Delete / Duplicate ─────────────────────────────────────
router.post('/create',    (req, res) => ctrl.createEntry(req, res));
router.post('/rename',    (req, res) => ctrl.renameEntry(req, res));
router.post('/delete',    (req, res) => ctrl.deleteEntry(req, res));
router.post('/duplicate', (req, res) => ctrl.duplicateEntry(req, res));

// ── Upload / Download ─────────────────────────────────────────────────────────
router.post('/upload',   upload.array('files', 50), (req, res) => ctrl.uploadFiles(req, res));
router.get ('/download', (req, res) => ctrl.downloadZip(req, res));

// ── Search / Metadata / History ───────────────────────────────────────────────
router.get('/search',   (req, res) => ctrl.searchFiles(req, res));
router.get('/metadata', (req, res) => ctrl.getMetadata(req, res));
router.get('/history',  (req, res) => ctrl.getHistory(req, res));

// ── Git / Insights / Health ───────────────────────────────────────────────────
router.get('/git-status', (req, res) => ctrl.getGitStatus(req, res));
router.get('/insights',   (req, res) => ctrl.getInsights(req, res));
router.get('/health',     (req, res) => ctrl.health(req, res));

// ── Legacy aliases (old hotfix paths — keep frontend working without changes) ─
// These are mounted at / within the pipeline which is at /api, so:
//   /list-files → /api/list-files  ✓  (matches existing frontend calls)
router.get ('/list-files',      (req, res) => ctrl.getTree(req, res));
router.get ('/read-file',       (req, res) => ctrl.readFile(req, res));
router.post('/save-file',       (req, res) => ctrl.writeFile(req, res));
router.post('/rename-file',     (req, res) => ctrl.renameEntry(req, res));
router.post('/delete-file',     (req, res) => ctrl.deleteEntry(req, res));
router.post('/duplicate-file',  (req, res) => ctrl.duplicateEntry(req, res));
router.get ('/files/stat',      (req, res) => ctrl.getMetadata(req, res));

export { router as fileExplorerRouter };
