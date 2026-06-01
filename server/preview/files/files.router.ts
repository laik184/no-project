import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { filesController } from './files.controller.ts';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ── Existing routes ────────────────────────────────────────────────────────────
router.get('/files/list',    (req, res) => filesController.listFiles(req, res));
router.post('/files/create', (req, res) => filesController.createFile(req, res));
router.post('/files/upload', upload.array('files', 50), (req, res) => filesController.uploadFiles(req, res));
router.get('/files/download',(req, res) => filesController.downloadZip(req, res));
router.delete('/files/*',    (req, res) => filesController.deleteFile(req, res));
router.get('/files/stat',    (req, res) => filesController.statFile(req, res));
router.get('/files/health',  (req, res) => filesController.healthCheck(req, res));

// ── Helpers ────────────────────────────────────────────────────────────────────
const SANDBOX_ROOT = path.resolve(process.env.AGENT_PROJECT_ROOT ?? '.sandbox');
const EXCLUDE = new Set(['node_modules', 'dist', '.cache', '.git']);

function safePath(rel: string): string {
  const abs = path.resolve(SANDBOX_ROOT, rel.replace(/^\//, ''));
  if (!abs.startsWith(SANDBOX_ROOT)) throw new Error('Path traversal denied');
  return abs;
}

type RawNode = { name: string; type: 'file' | 'folder'; children?: RawNode[] };

function buildTree(absDir: string): RawNode[] {
  if (!fs.existsSync(absDir)) return [];
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  const nodes: RawNode[] = [];
  for (const e of entries) {
    if (EXCLUDE.has(e.name) || e.name.startsWith('.')) continue;
    if (e.isDirectory()) {
      nodes.push({ name: e.name, type: 'folder', children: buildTree(path.join(absDir, e.name)) });
    } else {
      nodes.push({ name: e.name, type: 'file' });
    }
  }
  return nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

function cpRecursive(src: string, dest: string) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      cpRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

// ── GET /api/list-files?projectPath=<rel> ─────────────────────────────────────
// Returns a recursive tree of files/folders under projectPath (or sandbox root).
router.get('/list-files', (req, res) => {
  try {
    const projectPath = (req.query.projectPath as string) ?? '';
    const absRoot = projectPath ? safePath(projectPath) : SANDBOX_ROOT;
    const tree = buildTree(absRoot);
    res.json({ ok: true, tree });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── GET /api/read-file?filePath=<rel> ─────────────────────────────────────────
router.get('/read-file', (req, res) => {
  try {
    const filePath = req.query.filePath as string;
    if (!filePath) { res.status(400).json({ ok: false, error: 'filePath required' }); return; }
    const abs = safePath(filePath);
    if (!fs.existsSync(abs)) { res.status(404).json({ ok: false, error: 'File not found' }); return; }
    const content = fs.readFileSync(abs, 'utf-8');
    const stat    = fs.statSync(abs);
    res.json({ ok: true, content, modifiedAt: stat.mtime.toISOString(), serverMtime: stat.mtimeMs });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── POST /api/save-file  { filePath, content, clientMtime? } ──────────────────
router.post('/save-file', (req, res) => {
  try {
    const { filePath, content = '', clientMtime } = req.body as { filePath: string; content?: string; clientMtime?: number };
    if (!filePath) { res.status(400).json({ ok: false, error: 'filePath required' }); return; }
    const abs = safePath(filePath);

    if (clientMtime !== undefined && fs.existsSync(abs)) {
      const serverMtime = fs.statSync(abs).mtimeMs;
      if (Math.abs(serverMtime - clientMtime) > 1000) {
        res.status(409).json({ ok: false, error: 'conflict', serverMtime });
        return;
      }
    }

    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf-8');
    const serverMtime = fs.statSync(abs).mtimeMs;
    res.json({ ok: true, serverMtime });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── POST /api/rename-file  { oldPath, newPath } ───────────────────────────────
router.post('/rename-file', (req, res) => {
  try {
    const { oldPath, newPath } = req.body as { oldPath: string; newPath: string };
    if (!oldPath || !newPath) { res.status(400).json({ ok: false, error: 'oldPath and newPath required' }); return; }
    const absOld = safePath(oldPath);
    const absNew = safePath(newPath);
    if (!fs.existsSync(absOld)) { res.status(404).json({ ok: false, error: 'Source not found' }); return; }
    fs.mkdirSync(path.dirname(absNew), { recursive: true });
    fs.renameSync(absOld, absNew);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── POST /api/delete-file  { targetPath } ────────────────────────────────────
router.post('/delete-file', (req, res) => {
  try {
    const { targetPath } = req.body as { targetPath: string };
    if (!targetPath) { res.status(400).json({ ok: false, error: 'targetPath required' }); return; }
    const abs = safePath(targetPath);
    if (!fs.existsSync(abs)) { res.status(404).json({ ok: false, error: 'Not found' }); return; }
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) { fs.rmSync(abs, { recursive: true, force: true }); }
    else { fs.unlinkSync(abs); }
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ── POST /api/duplicate-file  { sourcePath, destPath } ───────────────────────
router.post('/duplicate-file', (req, res) => {
  try {
    const { sourcePath, destPath } = req.body as { sourcePath: string; destPath: string };
    if (!sourcePath || !destPath) { res.status(400).json({ ok: false, error: 'sourcePath and destPath required' }); return; }
    const absSrc  = safePath(sourcePath);
    const absDest = safePath(destPath);
    if (!fs.existsSync(absSrc)) { res.status(404).json({ ok: false, error: 'Source not found' }); return; }
    cpRecursive(absSrc, absDest);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
