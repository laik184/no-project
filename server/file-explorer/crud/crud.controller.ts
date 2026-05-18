import type { Request, Response } from 'express';
import { crudService } from './crud.service.ts';
import type { SaveFileInput, RenameFileInput, DeleteFileInput, CreateFolderInput } from './crud.types.ts';

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
    // 409 for conflicts so clients can distinguish from server errors
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
    res.status(result.ok ? 200 : 409).json(result);
  }

  async deleteFile(req: Request, res: Response): Promise<void> {
    const { targetPath, force } = req.body as DeleteFileInput;

    if (!targetPath) {
      res.status(400).json({ ok: false, error: 'Field required: targetPath' });
      return;
    }

    const result = await crudService.delete({ targetPath, force });
    res.status(result.ok ? 200 : 404).json(result);
  }

  createFolder(req: Request, res: Response): void {
    const { folderPath, recursive } = req.body as CreateFolderInput;

    if (!folderPath) {
      res.status(400).json({ ok: false, error: 'Field required: folderPath' });
      return;
    }

    const result = crudService.createFolder({ folderPath, recursive });
    res.status(result.ok ? 201 : 500).json(result);
  }

  healthCheck(_req: Request, res: Response): void {
    res.status(200).json({ ok: true, module: 'crud' });
  }
}

export const crudController = new CrudController();
