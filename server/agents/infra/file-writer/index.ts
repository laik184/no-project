import * as fs from 'fs/promises';
import * as path from 'path';
import { atomicWrite }       from '../../infrastructure/checkpoints/atomic-write.util.ts';
import { backupBeforeWrite } from '../../infrastructure/checkpoints/atomic-write.util.ts';
import { emitFileChange }    from '../../infrastructure/events/file-change-emitter.ts';

export type FileAction = 'create' | 'update' | 'delete';

export interface FileEntry {
  path: string;
  action: FileAction;
  content?: string;
}

export interface FileWriterOptions {
  rootDir: string;
  projectId?: number;
  overwrite?: boolean;
  backup?: boolean;
  mergeMode?: 'overwrite' | 'merge' | 'skip';
}

export interface FileWriterLogEntry {
  level: 'INFO' | 'WARN' | 'ERROR';
  code: string;
  message: string;
}

export interface FileWriterReport {
  writtenFiles: string[];
  failedFiles: string[];
  skippedFiles: string[];
  logs: FileWriterLogEntry[];
}

export interface FileWriterInput {
  files: FileEntry[];
  options: FileWriterOptions;
}

export async function writeGeneratedFiles(input: FileWriterInput): Promise<Readonly<FileWriterReport>> {
  const { files, options } = input;
  const { rootDir, projectId, overwrite = true, backup = true, mergeMode = 'overwrite' } = options;
  const writtenFiles: string[] = [];
  const failedFiles: string[] = [];
  const skippedFiles: string[] = [];
  const logs: FileWriterLogEntry[] = [];

  for (const file of files) {
    const absolutePath = path.isAbsolute(file.path)
      ? file.path
      : path.join(rootDir, file.path);

    try {
      if (file.action === 'delete') {
        try {
          // Backup before delete so it is recoverable
          await backupBeforeWrite(absolutePath);
          await fs.unlink(absolutePath);
          writtenFiles.push(file.path);
          logs.push({ level: 'INFO', code: 'DELETED', message: `Deleted: ${file.path}` });
          if (projectId !== undefined) emitFileChange(projectId, 'unlink', file.path);
        } catch {
          logs.push({ level: 'WARN', code: 'DELETE_SKIP', message: `File not found for deletion: ${file.path}` });
          skippedFiles.push(file.path);
        }
        continue;
      }

      if (!file.content && ((file.action as string) !== "delete")) {
        logs.push({ level: 'WARN', code: 'NO_CONTENT', message: `No content provided for: ${file.path}` });
        skippedFiles.push(file.path);
        continue;
      }

      let exists = false;
      try {
        await fs.access(absolutePath);
        exists = true;
      } catch { /* not found */ }

      if (exists && mergeMode === 'skip') {
        skippedFiles.push(file.path);
        logs.push({ level: 'INFO', code: 'SKIPPED', message: `Skipped existing: ${file.path}` });
        continue;
      }

      // Backup existing file before overwrite (safe recovery point)
      if (exists && backup) {
        const backupPath = await backupBeforeWrite(absolutePath);
        if (backupPath) {
          logs.push({ level: 'INFO', code: 'BACKUP', message: `Backup created: ${backupPath}` });
        } else {
          logs.push({ level: 'WARN', code: 'BACKUP_FAIL', message: `Backup failed: ${file.path}` });
        }
      }

      // Atomic write: tmp → fsync → rename (crash-safe)
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await atomicWrite(absolutePath, file.content ?? '');
      writtenFiles.push(file.path);
      logs.push({ level: 'INFO', code: 'WRITTEN', message: `Written: ${file.path}` });
      if (projectId !== undefined) emitFileChange(projectId, exists ? 'change' : 'add', file.path);

    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      failedFiles.push(file.path);
      logs.push({ level: 'ERROR', code: 'WRITE_FAIL', message: `Failed to write ${file.path}: ${message}` });
    }
  }

  return Object.freeze({ writtenFiles, failedFiles, skippedFiles, logs });
}
