/**
 * server/file-explorer/controllers/file-explorer.controller.ts
 * HTTP adapter: validate request → call orchestrator → send response.
 * Contains NO business logic and NO direct filesystem access.
 */

import type { Request, Response } from 'express';
import { explorerOrchestrator }  from '../orchestrator/index.ts';
import { validateCreate, toCreateRequest } from '../validators/index.ts';
import { validateRename, toRenameRequest } from '../validators/index.ts';
import { validateDelete, toDeleteRequest } from '../validators/index.ts';
import { validateUpload }        from '../validators/index.ts';
import { assertHasFiles }        from '../guards/index.ts';
import { FE_CONFIG }             from '../config/index.ts';

class FileExplorerController {

  getTree(req: Request, res: Response): void {
    const { projectPath, showHidden } = req.query as Record<string, string>;
    const result = explorerOrchestrator.getTree(projectPath, showHidden === 'true');
    res.json(result);
  }

  readFile(req: Request, res: Response): void {
    const { filePath } = req.query as Record<string, string>;
    if (!filePath?.trim()) { res.status(400).json({ ok: false, error: 'filePath is required' }); return; }
    const result = explorerOrchestrator.readFile(filePath);
    res.status(result.ok ? 200 : 404).json(result);
  }

  writeFile(req: Request, res: Response): void {
    const { filePath, content, clientMtime } = req.body as Record<string, unknown>;
    if (!filePath || typeof filePath !== 'string') { res.status(400).json({ ok: false, error: 'filePath is required' }); return; }
    if (typeof content !== 'string')               { res.status(400).json({ ok: false, error: 'content must be a string' }); return; }
    const mtime  = typeof clientMtime === 'number' ? clientMtime : undefined;
    const result = explorerOrchestrator.writeFile(filePath, content, mtime);
    res.status(result.conflict ? 409 : result.ok ? 200 : 500).json(result);
  }

  createEntry(req: Request, res: Response): void {
    const validation = validateCreate(req.body);
    if (!validation.ok) { res.status(400).json({ ok: false, error: validation.errors[0]?.message }); return; }
    const body   = toCreateRequest(req.body as Record<string, unknown>);
    const result = explorerOrchestrator.createEntry(body.filePath, body.isFolder ?? false, body.content ?? '');
    res.status(result.ok ? 201 : 400).json(result);
  }

  renameEntry(req: Request, res: Response): void {
    const validation = validateRename(req.body);
    if (!validation.ok) { res.status(400).json({ ok: false, error: validation.errors[0]?.message }); return; }
    const body   = toRenameRequest(req.body as Record<string, unknown>);
    const result = explorerOrchestrator.renameEntry(body.oldPath, body.newPath);
    res.status(result.ok ? 200 : 400).json(result);
  }

  deleteEntry(req: Request, res: Response): void {
    const validation = validateDelete(req.body);
    if (!validation.ok) { res.status(400).json({ ok: false, error: validation.errors[0]?.message }); return; }
    const body   = toDeleteRequest(req.body as Record<string, unknown>);
    const result = explorerOrchestrator.deleteEntry(body.targetPath);
    res.status(result.ok ? 200 : 404).json(result);
  }

  duplicateEntry(req: Request, res: Response): void {
    const { sourcePath, destPath } = req.body as Record<string, string>;
    if (!sourcePath?.trim()) { res.status(400).json({ ok: false, error: 'sourcePath is required' }); return; }
    const result = explorerOrchestrator.duplicateEntry(sourcePath, destPath);
    res.status(result.ok ? 200 : 400).json(result);
  }

  uploadFiles(req: Request, res: Response): void {
    const files = req.files as Express.Multer.File[] | undefined;
    const uv    = validateUpload(files);
    if (!uv.ok) { res.status(400).json({ ok: false, error: uv.errors[0]?.message }); return; }
    try { assertHasFiles(files); } catch (e) { res.status(400).json({ ok: false, error: (e as Error).message }); return; }
    const result = explorerOrchestrator.uploadFiles(files!);
    res.json(result);
  }

  async downloadZip(req: Request, res: Response): Promise<void> {
    const { projectPath } = req.query as Record<string, string>;
    const result = await explorerOrchestrator.downloadZip(projectPath);
    if (!result.ok || !result.buffer) { res.status(500).json({ ok: false, error: result.error }); return; }
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer.length);
    res.send(result.buffer);
  }

  searchFiles(req: Request, res: Response): void {
    const { q, projectPath, caseSensitive } = req.query as Record<string, string>;
    if (!q?.trim()) { res.status(400).json({ ok: false, error: 'q is required' }); return; }
    const result = explorerOrchestrator.search(q, projectPath, caseSensitive === 'true');
    res.json(result);
  }

  getMetadata(req: Request, res: Response): void {
    const { filePath } = req.query as Record<string, string>;
    if (!filePath?.trim()) { res.status(400).json({ ok: false, error: 'filePath is required' }); return; }
    res.json(explorerOrchestrator.getMetadata(filePath));
  }

  getHistory(req: Request, res: Response): void {
    const { filePath } = req.query as Record<string, string>;
    if (!filePath?.trim()) { res.status(400).json({ ok: false, error: 'filePath is required' }); return; }
    res.json(explorerOrchestrator.getHistory(filePath));
  }

  getGitStatus(_req: Request, res: Response): void {
    res.json(explorerOrchestrator.getGitStatus());
  }

  getInsights(_req: Request, res: Response): void {
    res.json(explorerOrchestrator.getInsights());
  }

  health(_req: Request, res: Response): void {
    res.json({ ok: true, module: 'file-explorer', sandboxRoot: FE_CONFIG.sandboxRoot, uptime: process.uptime() });
  }

  /**
   * Legacy /files/stat handler.
   * Accepts ?path= (not ?filePath=) and returns a FLAT { ok, size, mtime } envelope
   * rather than the nested { ok, meta: {...} } shape used by the canonical endpoint.
   */
  getMetadataFlat(req: Request, res: Response): void {
    const filePath = ((req.query.path ?? req.query.filePath) as string | undefined)?.trim();
    if (!filePath) { res.status(400).json({ ok: false, error: 'path is required' }); return; }
    const result = explorerOrchestrator.getMetadata(filePath);
    if (!result.ok) { res.status(404).json({ ok: false, error: result.error }); return; }
    res.json({ ok: true, size: result.meta?.size, mtime: result.meta?.mtime });
  }

  /** POST /file/undo — restore the most recent history snapshot for a file. */
  undoFile(req: Request, res: Response): void {
    const { filePath } = req.body as Record<string, string>;
    if (!filePath?.trim()) { res.status(400).json({ ok: false, error: 'filePath is required' }); return; }
    res.json(explorerOrchestrator.undoFile(filePath));
  }

  /**
   * POST /file/conflict-check — check whether the server has advanced beyond
   * the client's last known history version (baseVersionId).
   */
  conflictCheck(req: Request, res: Response): void {
    const { filePath, baseVersionId } = req.body as { filePath?: string; baseVersionId?: string | null };
    if (!filePath?.trim()) {
      res.status(400).json({ ok: false, conflict: false, error: 'filePath is required' }); return;
    }
    res.json(explorerOrchestrator.conflictCheck(filePath, baseVersionId ?? null));
  }
}

export const fileExplorerController = new FileExplorerController();
