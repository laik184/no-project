/**
 * server/infrastructure/checkpoints/atomic-write.util.ts
 *
 * Atomic file write utilities with backup support.
 * Creates a .bak copy before overwriting to allow recovery.
 */
import fs   from 'fs/promises';
import path from 'path';

/**
 * Creates a .bak copy of the file at filePath before it is overwritten.
 * No-op if the file does not exist yet.
 */
export async function backupBeforeWrite(filePath: string): Promise<void> {
  try {
    await fs.access(filePath);
    const bakPath = filePath + '.bak';
    await fs.copyFile(filePath, bakPath);
  } catch {
    // File doesn't exist — nothing to back up
  }
}

/**
 * Write content to filePath atomically:
 *   1. Backup existing file (if any)
 *   2. Write to a .tmp sibling
 *   3. Rename .tmp → final path (atomic on POSIX)
 */
export async function atomicWrite(filePath: string, content: string): Promise<void> {
  await backupBeforeWrite(filePath);

  const dir     = path.dirname(filePath);
  const tmpPath = path.join(dir, `.${path.basename(filePath)}.tmp`);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tmpPath, content, 'utf8');
  await fs.rename(tmpPath, filePath);
}
