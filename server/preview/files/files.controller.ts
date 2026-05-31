import type { Request, Response } from 'express';
import { filesService } from './files.service.ts';
import type { CreateFileInput } from './files.types.ts';

export class FilesController {
  async listFiles(_req: Request, res: Response): Promise<void> {
    const result = await filesService.list();
    if (!result.ok) {
      res.status(500).json(result);
      return;
    }
    res.status(200).json(result);
  }

  async createFile(req: Request, res: Response): Promise<void> {
    const { fileName, isFolder, content, parentPath } = req.body as CreateFileInput;

    if (!fileName) {
      res.status(400).json({ ok: false, error: 'Field required: fileName' });
      return;
    }

    if (typeof isFolder !== 'boolean') {
      res.status(400).json({ ok: false, error: 'Field required: isFolder (boolean)' });
      return;
    }

    const result = await filesService.create({ fileName, isFolder, content, parentPath });
    const status = result.ok ? 201 : 500;
    res.status(status).json(result);
  }

  async uploadFiles(req: Request, res: Response): Promise<void> {
    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      res.status(400).json({ ok: false, error: 'No files provided in multipart upload' });
      return;
    }

    const result = await filesService.upload(files);
    const status = result.ok ? 200 : 207;
    res.status(status).json(result);
  }

  async downloadZip(_req: Request, res: Response): Promise<void> {
    const result = await filesService.download();

    if (!result.ok || !result.buffer) {
      res.status(500).json({ ok: false, error: result.error ?? 'Download failed' });
      return;
    }

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.setHeader('Content-Length', result.buffer.length);
    res.status(200).send(result.buffer);
  }

  async deleteFile(req: Request, res: Response): Promise<void> {
    const filePath = decodeURIComponent(req.params[0] ?? req.params.path ?? '');

    if (!filePath) {
      res.status(400).json({ ok: false, error: 'Path param required' });
      return;
    }

    const result = await filesService.delete(filePath);
    const status = result.ok ? 200 : (result.error?.includes('denied') ? 403 : 500);
    res.status(status).json(result);
  }

  async statFile(req: Request, res: Response): Promise<void> {
    const filePath = req.query.path as string;
    if (!filePath) { res.status(400).json({ ok: false, error: 'path query param required' }); return; }
    const result = await filesService.stat(filePath);
    res.status(result.ok ? 200 : 404).json(result);
  }

  healthCheck(_req: Request, res: Response): void {
    res.status(200).json({ ok: true, module: 'files' });
  }
}

export const filesController = new FilesController();
