/**
 * server/file-explorer/guards/file.guard.ts
 * Guards that assert file-specific preconditions.
 */

import fs from 'fs';
import { FE_CONFIG } from '../config/index.ts';

/** Throws if the path does not exist on disk. */
export function assertExists(absPath: string): void {
  if (!fs.existsSync(absPath)) {
    throw new Error(`Not found: ${absPath}`);
  }
}

/** Throws if the path is a directory (expected a file). */
export function assertIsFile(absPath: string): void {
  const stat = fs.statSync(absPath);
  if (stat.isDirectory()) {
    throw new Error(`Expected a file, got a directory: ${absPath}`);
  }
}

/** Throws if file size exceeds the configured max read limit. */
export function assertReadable(absPath: string): void {
  const stat = fs.statSync(absPath);
  if (stat.size > FE_CONFIG.maxReadSizeBytes) {
    throw new Error(
      `File too large to read (${stat.size} bytes, limit ${FE_CONFIG.maxReadSizeBytes} bytes)`,
    );
  }
}

/** Returns true if the first 8 KB of the file contains null bytes (binary heuristic). */
export function isBinaryFile(absPath: string): boolean {
  const SAMPLE = 8192;
  const stat   = fs.statSync(absPath);
  if (stat.size === 0) return false;
  const fd  = fs.openSync(absPath, 'r');
  const buf = Buffer.alloc(Math.min(SAMPLE, stat.size));
  fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);
  return buf.includes(0);
}
