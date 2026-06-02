/**
 * server/file-explorer/guards/path.guard.ts
 * Single source of truth for path traversal prevention.
 * ALL services call resolveSafe() — never duplicate this logic.
 */

import path from 'path';
import { FE_CONFIG } from '../config/index.ts';

/**
 * Throws if absPath escapes the sandbox root.
 * Call this before any filesystem operation.
 */
export function assertSafePath(absPath: string, sandboxRoot: string = FE_CONFIG.sandboxRoot): void {
  const resolved = path.resolve(absPath);
  const root     = path.resolve(sandboxRoot);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(`Path traversal denied: ${absPath}`);
  }
}

/**
 * Resolves a relative (or absolute) client-supplied path to an absolute sandbox path.
 * Strips leading slashes, resolves, and asserts safety. Returns the absolute path.
 */
export function resolveSafe(rel: string, sandboxRoot: string = FE_CONFIG.sandboxRoot): string {
  const cleaned = rel.replace(/^\/+/, '');
  const abs = path.resolve(sandboxRoot, cleaned);
  assertSafePath(abs, sandboxRoot);
  return abs;
}

/**
 * Returns true if the entry name matches any exclusion pattern or is a hidden file/dir.
 */
export function isExcluded(name: string, patterns: readonly string[]): boolean {
  if (name.startsWith('.')) return true;
  return patterns.some(p => name === p);
}
