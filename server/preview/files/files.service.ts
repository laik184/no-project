import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { pipeline } from 'stream';
import type {
  FileItem, ListFilesResult, CreateFileInput, CreateFileResult,
  UploadFileResult, UploadedFile, DeleteFileResult, DownloadResult, FilesServiceConfig,
} from './files.types.ts';

const pipelineAsync = promisify(pipeline);

const DEFAULT_CONFIG: FilesServiceConfig = {
  rootPath: process.env.AGENT_PROJECT_ROOT ?? '.sandbox',
  maxUploadSizeMb: 50,
  excludePatterns: ['node_modules', '.git', '.env', 'dist', '.cache'],
};

export class FilesService {
  private config: FilesServiceConfig;

  constructor(config?: Partial<FilesServiceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async list(): Promise<ListFilesResult> {
    try {
      const root = path.resolve(this.config.rootPath);
      if (!fs.existsSync(root)) {
        return { ok: true, files: [], total: 0 };
      }
      const files = await this.buildTree(root, root);
      return { ok: true, files, total: this.countFiles(files) };
    } catch (e: any) {
      return { ok: false, files: [], total: 0, error: e.message };
    }
  }

  async create(input: CreateFileInput): Promise<CreateFileResult> {
    const { fileName, isFolder, content = '', parentPath = '' } = input;
    try {
      const base = path.resolve(this.config.rootPath, parentPath);
      const target = path.join(base, fileName);

      this.assertSafePath(target);

      if (isFolder) {
        fs.mkdirSync(target, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content, 'utf-8');
      }

      const rel = path.relative(this.config.rootPath, target);
      return { ok: true, path: rel, isDirectory: isFolder };
    } catch (e: any) {
      return { ok: false, path: '', isDirectory: isFolder, error: e.message };
    }
  }

  async upload(files: Express.Multer.File[]): Promise<UploadFileResult> {
    const uploaded: UploadedFile[] = [];
    const failed: string[] = [];

    for (const file of files) {
      try {
        const dest = path.join(path.resolve(this.config.rootPath), file.originalname);
        this.assertSafePath(dest);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, file.buffer);
        uploaded.push({ originalName: file.originalname, savedPath: dest, size: file.size });
      } catch {
        failed.push(file.originalname);
      }
    }

    return { ok: failed.length === 0, uploaded, failed };
  }

  async download(): Promise<DownloadResult> {
    try {
      const { default: archiver } = await import('archiver');
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        const archive = archiver('zip', { zlib: { level: 6 } });
        archive.on('data', (chunk: Buffer) => chunks.push(chunk));
        archive.on('error', reject);
        archive.on('end', resolve);
        archive.directory(path.resolve(this.config.rootPath), false);
        archive.finalize();
      });

      return {
        ok: true,
        buffer: Buffer.concat(chunks),
        filename: 'project-files.zip',
        mimeType: 'application/zip',
      };
    } catch (e: any) {
      return { ok: false, filename: '', mimeType: '', error: e.message };
    }
  }

  async delete(filePath: string): Promise<DeleteFileResult> {
    try {
      const target = path.resolve(this.config.rootPath, filePath);
      this.assertSafePath(target);

      const stat = fs.statSync(target);
      const isDir = stat.isDirectory();

      if (isDir) {
        fs.rmSync(target, { recursive: true, force: true });
      } else {
        fs.unlinkSync(target);
      }

      return { ok: true, path: filePath, wasDirectory: isDir };
    } catch (e: any) {
      return { ok: false, path: filePath, wasDirectory: false, error: e.message };
    }
  }

  private async buildTree(absPath: string, root: string): Promise<FileItem[]> {
    const entries = fs.readdirSync(absPath, { withFileTypes: true });
    const items: FileItem[] = [];

    for (const entry of entries) {
      if (this.isExcluded(entry.name)) continue;
      const entryPath = path.join(absPath, entry.name);
      const relPath = path.relative(root, entryPath);

      if (entry.isDirectory()) {
        const children = await this.buildTree(entryPath, root);
        items.push({ name: entry.name, path: relPath, isDirectory: true, children });
      } else {
        const stat = fs.statSync(entryPath);
        items.push({
          name: entry.name, path: relPath, isDirectory: false,
          size: stat.size, modifiedAt: stat.mtime, children: [],
        });
      }
    }

    return items.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  async stat(filePath: string): Promise<{ ok: boolean; size?: number; mtime?: number; error?: string }> {
    try {
      const root   = path.resolve(this.config.rootPath);
      const target = path.resolve(root, filePath.replace(/^\//, ''));
      this.assertSafePath(target);
      const st = fs.statSync(target);
      return { ok: true, size: st.size, mtime: st.mtimeMs };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  private isExcluded(name: string): boolean {
    return this.config.excludePatterns.some(p => name === p || name.startsWith('.'));
  }

  private assertSafePath(target: string): void {
    const root = path.resolve(this.config.rootPath);
    if (!target.startsWith(root)) {
      throw new Error(`Path traversal denied: ${target}`);
    }
  }

  private countFiles(items: FileItem[]): number {
    return items.reduce((acc, i) => acc + 1 + (i.isDirectory ? this.countFiles(i.children) : 0), 0);
  }
}

export const filesService = new FilesService();
