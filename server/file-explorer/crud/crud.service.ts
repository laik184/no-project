import fs from 'fs';
import path from 'path';
import { safeWriteFile, safeDeleteFile, safeBackup } from '../../infrastructure/checkpoints/safe-fs.util.ts';
import type {
  SaveFileInput, SaveFileResult, ReadFileInput, ReadFileResult,
  RenameFileInput, RenameFileResult, DeleteFileInput, DeleteFileResult,
  CreateFolderInput, CreateFolderResult, CrudServiceConfig, CrudEventPayload,
} from './crud.types.ts';

function guessLang(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith('.tsx') || n.endsWith('.ts')) return 'typescript';
  if (n.endsWith('.jsx') || n.endsWith('.js')) return 'javascript';
  if (n.endsWith('.css') || n.endsWith('.scss')) return 'css';
  if (n.endsWith('.html')) return 'html';
  if (n.endsWith('.json')) return 'json';
  if (n.endsWith('.md')) return 'markdown';
  if (n.endsWith('.py')) return 'python';
  return 'plaintext';
}

const DEFAULT_CONFIG: CrudServiceConfig = {
  rootPath: process.cwd(),
  maxFileSizeBytes: 10 * 1024 * 1024,
};

type EventHook = (payload: CrudEventPayload) => void;

export class CrudService {
  private config: CrudServiceConfig;
  private eventHook?: EventHook;

  constructor(config?: Partial<CrudServiceConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  onEvent(hook: EventHook): void {
    this.eventHook = hook;
  }

  async save(input: SaveFileInput): Promise<SaveFileResult> {
    const { filePath, content, createDirs = true, clientMtime } = input;
    try {
      const abs = this.resolve(filePath);
      this.assertSafe(abs);

      const existed = fs.existsSync(abs);

      // Version guard: reject if file was externally modified since client last read it.
      // A 200ms epsilon absorbs filesystem timestamp rounding and network latency.
      if (existed && clientMtime != null) {
        const stat = fs.statSync(abs);
        const serverMtime = stat.mtimeMs;
        if (serverMtime > clientMtime + 200) {
          return {
            ok: false,
            filePath,
            created: false,
            conflict: true,
            serverMtime,
            error: 'Conflict: file was modified externally since last read.',
          };
        }
      }

      if (createDirs) fs.mkdirSync(path.dirname(abs), { recursive: true });

      // Atomic write with backup — crash-safe, recoverable
      const result = await safeWriteFile(abs, content);
      if (!result.ok) throw new Error(result.error ?? 'safeWriteFile failed');
      const stat = fs.statSync(abs);

      this.emit({ type: existed ? 'updated' : 'created', path: filePath });
      return { ok: true, filePath, bytesWritten: stat.size, created: !existed, serverMtime: stat.mtimeMs };
    } catch (e: any) {
      return { ok: false, filePath, created: false, error: e.message };
    }
  }

  read(input: ReadFileInput): ReadFileResult {
    const { filePath } = input;
    try {
      const abs = this.resolve(filePath);
      this.assertSafe(abs);

      if (!fs.existsSync(abs)) {
        return { ok: false, filePath, error: `File not found: ${filePath}` };
      }

      const stat = fs.statSync(abs);
      if (stat.size > this.config.maxFileSizeBytes) {
        return { ok: false, filePath, error: `File too large: ${stat.size} bytes` };
      }

      const content = fs.readFileSync(abs, 'utf-8');
      return {
        ok: true, filePath, content, size: stat.size,
        lang: guessLang(path.basename(filePath)),
        modifiedAt: stat.mtime,
      };
    } catch (e: any) {
      return { ok: false, filePath, error: e.message };
    }
  }

  async rename(input: RenameFileInput): Promise<RenameFileResult> {
    const { oldPath, newPath, overwrite = false } = input;
    try {
      const absOld = this.resolve(oldPath);
      const absNew = this.resolve(newPath);
      this.assertSafe(absOld);
      this.assertSafe(absNew);

      if (!fs.existsSync(absOld)) {
        return { ok: false, oldPath, newPath, error: `Source not found: ${oldPath}` };
      }

      if (!overwrite && fs.existsSync(absNew)) {
        return { ok: false, oldPath, newPath, error: `Target already exists: ${newPath}` };
      }

      fs.mkdirSync(path.dirname(absNew), { recursive: true });

      // Backup source before rename so the original path is recoverable
      await safeBackup(absOld);
      fs.renameSync(absOld, absNew);

      this.emit({ type: 'renamed', path: newPath, oldPath });
      return { ok: true, oldPath, newPath };
    } catch (e: any) {
      return { ok: false, oldPath, newPath, error: e.message };
    }
  }

  async delete(input: DeleteFileInput): Promise<DeleteFileResult> {
    const { targetPath, force = false } = input;
    try {
      const abs = this.resolve(targetPath);
      this.assertSafe(abs);

      if (!fs.existsSync(abs)) {
        return { ok: false, targetPath, wasDirectory: false, error: `Not found: ${targetPath}` };
      }

      const stat = fs.statSync(abs);
      const wasDirectory = stat.isDirectory();

      // Safe delete — backs up the file before removal so it is recoverable
      const del = await safeDeleteFile(abs, force);
      if (!del.ok) return { ok: false, targetPath, wasDirectory, error: del.error };

      this.emit({ type: 'deleted', path: targetPath });
      return { ok: true, targetPath, wasDirectory };
    } catch (e: any) {
      return { ok: false, targetPath, wasDirectory: false, error: e.message };
    }
  }

  createFolder(input: CreateFolderInput): CreateFolderResult {
    const { folderPath, recursive = true } = input;
    try {
      const abs = this.resolve(folderPath);
      this.assertSafe(abs);
      fs.mkdirSync(abs, { recursive });
      this.emit({ type: 'created', path: folderPath });
      return { ok: true, folderPath };
    } catch (e: any) {
      return { ok: false, folderPath, error: e.message };
    }
  }

  private resolve(filePath: string): string {
    if (path.isAbsolute(filePath)) return filePath;
    return path.resolve(this.config.rootPath, filePath);
  }

  private assertSafe(abs: string): void {
    const root = path.resolve(this.config.rootPath);
    if (!abs.startsWith(root) && !path.isAbsolute(abs.split(path.sep)[0])) {
      throw new Error(`Path traversal denied: ${abs}`);
    }
  }

  private emit(payload: CrudEventPayload): void {
    try { this.eventHook?.(payload); } catch {}
  }
}

export const crudService = new CrudService();
