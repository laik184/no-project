/**
 * atomic-write.util.ts
 * Safe atomic file writes using a temp-file rename strategy.
 * Prevents partial writes from corrupting files mid-operation.
 */

import fs   from "fs/promises";
import path from "path";
import { ATOMIC_WRITE_SUFFIX } from "./checkpoint.constants.ts";

/**
 * Write content atomically:
 * 1. Write to a .nura_tmp sibling file
 * 2. fsync (flush to OS buffer)
 * 3. rename (atomic on POSIX)
 * 4. Clean up temp on failure
 */
export async function atomicWrite(
  absPath:  string,
  content:  string,
  encoding: BufferEncoding = "utf-8",
): Promise<void> {
  const tmpPath = absPath + ATOMIC_WRITE_SUFFIX;
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  let handle: fs.FileHandle | null = null;
  try {
    handle = await fs.open(tmpPath, "w");
    await handle.writeFile(content, encoding);
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(tmpPath, absPath);
  } catch (err) {
    if (handle) { await handle.close().catch(() => {}); }
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }
}

/**
 * Atomic write from a Buffer (for binary content).
 */
export async function atomicWriteBuffer(
  absPath: string,
  buf:     Buffer,
): Promise<void> {
  const tmpPath = absPath + ATOMIC_WRITE_SUFFIX;
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  let handle: fs.FileHandle | null = null;
  try {
    handle = await fs.open(tmpPath, "w");
    await handle.writeFile(buf);
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(tmpPath, absPath);
  } catch (err) {
    if (handle) { await handle.close().catch(() => {}); }
    await fs.unlink(tmpPath).catch(() => {});
    throw err;
  }
}

/**
 * Safe backup: copy current file to <absPath>.bak before overwriting.
 * Returns the backup path, or null if original doesn't exist.
 */
export async function backupBeforeWrite(absPath: string): Promise<string | null> {
  try {
    const backupPath = `${absPath}.bak`;
    await fs.copyFile(absPath, backupPath);
    return backupPath;
  } catch {
    return null;
  }
}
