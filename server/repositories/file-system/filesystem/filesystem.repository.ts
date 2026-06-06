/**
 * server/file-explorer/repositories/filesystem.repository.ts
 * ONLY layer permitted to access fs and path directly.
 * All filesystem I/O for the file-explorer module flows through this class.
 */

import fs   from 'fs';
import path from 'path';
import type { FileEntry, FileStat } from '../../../shared/file-explorer-core/types/index.ts';
import { isExcluded } from '../../../shared/file-explorer-core/guards/index.ts';
import { FE_CONFIG }  from '../../../shared/file-explorer-core/config/index.ts';
import { emitFileChange } from '../../../infrastructure/index.ts';

/** Minimal record yielded by walkFiles. */
export interface FileWalkRecord {
  readonly absPath: string;
  readonly relPath: string;
  readonly size:    number;
  readonly mtime:   number;
}

/** Optional mutation context — when provided, a FileChangeEvent is emitted. */
export interface MutationContext {
  readonly projectId: number;
  readonly relPath:   string;
}

class FilesystemRepository {

  /** Returns stat info for any path. Never throws — returns exists:false instead. */
  stat(absPath: string): FileStat {
    try {
      const s = fs.statSync(absPath);
      return { size: s.size, mtime: s.mtimeMs, isDir: s.isDirectory(), exists: true };
    } catch {
      return { size: 0, mtime: 0, isDir: false, exists: false };
    }
  }

  /** Returns true if path exists on disk. */
  exists(absPath: string): boolean {
    return fs.existsSync(absPath);
  }

  /** Reads raw Buffer from a file. Throws on I/O error. */
  readBuffer(absPath: string): Buffer {
    return fs.readFileSync(absPath);
  }

  /** Reads UTF-8 text from a file. Throws on I/O error. */
  readText(absPath: string): string {
    return fs.readFileSync(absPath, 'utf-8');
  }

  /** Writes text content to a file, creating parent dirs as needed. */
  writeText(absPath: string, content: string, ctx?: MutationContext): void {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, content, 'utf-8');
    if (ctx) {
      emitFileChange({ projectId: ctx.projectId, path: ctx.relPath, kind: 'modified' });
    }
  }

  /** Writes a binary buffer to a file, creating parent dirs as needed. */
  writeBuffer(absPath: string, buf: Buffer, ctx?: MutationContext): void {
    fs.mkdirSync(path.dirname(absPath), { recursive: true });
    fs.writeFileSync(absPath, buf);
    if (ctx) {
      emitFileChange({ projectId: ctx.projectId, path: ctx.relPath, kind: 'modified' });
    }
  }

  /** Creates a directory (and any missing parents). */
  mkdir(absPath: string): void {
    fs.mkdirSync(absPath, { recursive: true });
  }

  /** Renames / moves src to dest. Creates dest parent dirs as needed. */
  rename(absSrc: string, absDest: string, ctx?: MutationContext): void {
    fs.mkdirSync(path.dirname(absDest), { recursive: true });
    fs.renameSync(absSrc, absDest);
    if (ctx) {
      emitFileChange({ projectId: ctx.projectId, path: ctx.relPath, kind: 'renamed' });
    }
  }

  /** Deletes a file or directory recursively. */
  remove(absPath: string, ctx?: MutationContext): void {
    const s = this.stat(absPath);
    if (!s.exists) return;
    if (s.isDir) { fs.rmSync(absPath, { recursive: true, force: true }); }
    else          { fs.unlinkSync(absPath); }
    if (ctx) {
      emitFileChange({ projectId: ctx.projectId, path: ctx.relPath, kind: 'deleted' });
    }
  }

  /** Recursively copies src to dest, creating parent dirs as needed. */
  copy(absSrc: string, absDest: string, ctx?: MutationContext): void {
    const s = this.stat(absSrc);
    if (s.isDir) {
      fs.mkdirSync(absDest, { recursive: true });
      for (const entry of fs.readdirSync(absSrc)) {
        this.copy(path.join(absSrc, entry), path.join(absDest, entry));
      }
    } else {
      fs.mkdirSync(path.dirname(absDest), { recursive: true });
      fs.copyFileSync(absSrc, absDest);
    }
    if (ctx) {
      emitFileChange({ projectId: ctx.projectId, path: ctx.relPath, kind: 'created' });
    }
  }

  /** Reads direct children of a directory, returns typed FileEntry list. */
  readDir(absDir: string, sandboxRoot: string): FileEntry[] {
    if (!this.exists(absDir)) return [];
    const cfg     = FE_CONFIG;
    const entries = fs.readdirSync(absDir, { withFileTypes: true });
    const result: FileEntry[] = [];

    for (const e of entries) {
      if (isExcluded(e.name, cfg.excludePatterns)) continue;
      if (!cfg.showHidden && e.name.startsWith('.')) continue;
      const abs  = path.join(absDir, e.name);
      const rel  = path.relative(sandboxRoot, abs).split(path.sep).join('/');
      const kind = e.isDirectory() ? 'folder' as const : 'file' as const;
      const stat = this.stat(abs);
      result.push({ name: e.name, absPath: abs, relPath: rel, kind, size: stat.size, mtime: stat.mtime });
    }
    return result;
  }

  /** Reads siblings of absPath (entries in the same parent directory). */
  siblingNames(absPath: string): string[] {
    const dir = path.dirname(absPath);
    if (!this.exists(dir)) return [];
    return fs.readdirSync(dir);
  }

  /**
   * Recursively walks all FILES (not directories) under absRoot, applying the
   * module's exclude and showHidden rules. Yields one FileWalkRecord per file.
   * This is the only method services may use for recursive filesystem traversal.
   */
  *walkFiles(absRoot: string, sandboxRoot: string): Generator<FileWalkRecord> {
    const cfg = FE_CONFIG;
    let dirents: fs.Dirent[];
    try {
      dirents = fs.readdirSync(absRoot, { withFileTypes: true });
    } catch {
      return;
    }

    for (const e of dirents) {
      if (isExcluded(e.name, cfg.excludePatterns)) continue;
      if (!cfg.showHidden && e.name.startsWith('.')) continue;

      const abs = path.join(absRoot, e.name);
      if (e.isDirectory()) {
        yield* this.walkFiles(abs, sandboxRoot);
      } else {
        const s = this.stat(abs);
        const rel = path.relative(sandboxRoot, abs).split(path.sep).join('/');
        yield { absPath: abs, relPath: rel, size: s.size, mtime: s.mtime };
      }
    }
  }
}

export const filesystemRepository = new FilesystemRepository();
