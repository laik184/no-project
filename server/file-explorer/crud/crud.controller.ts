import type { Request, Response } from 'express';
import { crudService } from './crud.service.ts';
import type { SaveFileInput, RenameFileInput, DeleteFileInput, CreateFolderInput } from './crud.types.ts';
import { emitFileChange } from '../../infrastructure/events/file-change-emitter.ts';

/**
 * Resolve numeric project ID from the request.
 * Priority: x-project-id header > query param > body field > 0.
 * projectId=0 is accepted by all frontend file-event filters (the
 * `!d.projectId` branch in use-file-explorer.ts) so it acts as a
 * broadcast that every mounted explorer receives.
 */
function resolveProjectId(req: Request): number {
  const header = req.headers['x-project-id'];
  if (header) {
    const n = parseInt(Array.isArray(header) ? header[0] : header, 10);
    if (!isNaN(n)) return n;
  }
  const body = (req.body as Record<string, unknown>)?.projectId;
  if (typeof body === 'number') return body;
  if (typeof body === 'string') {
    const n = parseInt(body, 10);
    if (!isNaN(n)) return n;
  }
  return 0;
}

export class CrudController {
  async saveFile(req: Request, res: Response): Promise<void> {
    const { filePath, content, encoding, createDirs, clientMtime } = req.body as SaveFileInput;

    if (!filePath) {
      res.status(400).json({ ok: false, error: 'Field required: filePath' });
      return;
    }

    if (content === undefined || content === null) {
      res.status(400).json({ ok: false, error: 'Field required: content' });
      return;
    }

    const result = await crudService.save({ filePath, content, encoding, createDirs, clientMtime });

    if (result.ok) {
      // Emit onto the main EventBus so the SSE "file" topic reaches the frontend.
      // This is the missing link — CRUD saves were previously invisible to SSE clients.
      const projectId = resolveProjectId(req);
      emitFileChange(projectId, result.created ? 'add' : 'change', filePath);
    }

    const status = result.ok ? 200 : result.conflict ? 409 : 500;
    res.status(status).json(result);
  }

  readFile(req: Request, res: Response): void {
    const filePath = req.query.filePath as string;

    if (!filePath) {
      res.status(400).json({ ok: false, error: 'Query param required: filePath' });
      return;
    }

    const result = crudService.read({ filePath });
    res.status(result.ok ? 200 : 404).json(result);
  }

  async renameFile(req: Request, res: Response): Promise<void> {
    const { oldPath, newPath, overwrite } = req.body as RenameFileInput;

    if (!oldPath || !newPath) {
      res.status(400).json({ ok: false, error: 'Fields required: oldPath, newPath' });
      return;
    }

    const result = await crudService.rename({ oldPath, newPath, overwrite });

    if (result.ok) {
      const projectId = resolveProjectId(req);
      emitFileChange(projectId, 'unlink', oldPath);
      emitFileChange(projectId, 'add',    newPath);
    }

    res.status(result.ok ? 200 : 409).json(result);
  }

  async deleteFile(req: Request, res: Response): Promise<void> {
    const { targetPath, force } = req.body as DeleteFileInput;

    if (!targetPath) {
      res.status(400).json({ ok: false, error: 'Field required: targetPath' });
      return;
    }

    const result = await crudService.delete({ targetPath, force });

    if (result.ok) {
      const projectId = resolveProjectId(req);
      emitFileChange(projectId, 'unlink', targetPath);
    }

    res.status(result.ok ? 200 : 404).json(result);
  }

  createFolder(req: Request, res: Response): void {
    const { folderPath, recursive } = req.body as CreateFolderInput;

    if (!folderPath) {
      res.status(400).json({ ok: false, error: 'Field required: folderPath' });
      return;
    }

    const result = crudService.createFolder({ folderPath, recursive });

    if (result.ok) {
      const projectId = resolveProjectId(req);
      emitFileChange(projectId, 'add', folderPath);
    }

    res.status(result.ok ? 201 : 500).json(result);
  }

  healthCheck(_req: Request, res: Response): void {
    res.status(200).json({ ok: true, module: 'crud' });
  }
}

export const crudController = new CrudController();
