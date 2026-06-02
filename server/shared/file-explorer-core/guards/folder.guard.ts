/**
 * server/file-explorer/guards/folder.guard.ts
 * Guards that assert folder-specific preconditions.
 */

import fs from 'fs';

/** Throws if the path does not exist or is not a directory. */
export function assertIsDirectory(absPath: string): void {
  if (!fs.existsSync(absPath)) {
    throw new Error(`Directory not found: ${absPath}`);
  }
  const stat = fs.statSync(absPath);
  if (!stat.isDirectory()) {
    throw new Error(`Expected a directory, got a file: ${absPath}`);
  }
}

/** Returns true if the given absolute path is a directory that exists. */
export function directoryExists(absPath: string): boolean {
  try {
    return fs.statSync(absPath).isDirectory();
  } catch {
    return false;
  }
}
