/**
 * server/infrastructure/checkpoints/safe-fs.util.ts
 *
 * Safe filesystem operations with error swallowing and backup support.
 */
import fs   from 'fs/promises';
import path from 'path';
import { backupBeforeWrite } from './atomic-write.util.ts';

/**
 * Write a file safely — creates parent directories, backs up existing content.
 * Never throws; returns ok/error result.
 */
export async function safeWriteFile(
  filePath: string,
  content:  string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await backupBeforeWrite(filePath);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Delete a file safely — no-op if it doesn't exist.
 * Never throws; returns ok/error result.
 */
export async function safeDeleteFile(
  filePath: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await fs.unlink(filePath);
    return { ok: true };
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { ok: true };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
