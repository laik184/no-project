/**
 * server/services/terminal/shell/shell-service.ts
 *
 * Pure shell utility operations: pwd, ls, mkdir, rm.
 * Uses Node.js fs/path — no child_process spawning needed.
 */

import { readdirSync, statSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join, resolve, relative }                              from 'path';

export class ShellServiceError extends Error {
  constructor(message: string) {
    super(`[shell-service] ${message}`);
    this.name = 'ShellServiceError';
  }
}

export interface DirEntry {
  name:      string;
  type:      'file' | 'directory' | 'symlink' | 'unknown';
  sizeBytes: number;
  modified:  string;
}

export interface LsResult {
  path:    string;
  total:   number;
  entries: DirEntry[];
}

function guardPath(sandboxRoot: string, rel: string | undefined): string {
  const target   = rel ? join(sandboxRoot, rel) : sandboxRoot;
  const resolved = resolve(target);
  const root     = resolve(sandboxRoot);
  if (!resolved.startsWith(root + '/') && resolved !== root) {
    throw new ShellServiceError(`Path escapes sandbox: ${rel}`);
  }
  return resolved;
}

export const shellService = {
  pwd(sandboxRoot: string, cwd?: string): { cwd: string; relative: string } {
    const resolved = cwd ? guardPath(sandboxRoot, cwd) : resolve(sandboxRoot);
    return {
      cwd:      resolved,
      relative: relative(resolve(sandboxRoot), resolved) || '.',
    };
  },

  ls(sandboxRoot: string, path?: string, all = false): LsResult {
    const dir = guardPath(sandboxRoot, path ?? '.');

    if (!existsSync(dir)) {
      throw new ShellServiceError(`Directory not found: ${path ?? '.'}`);
    }

    const entries: DirEntry[] = readdirSync(dir)
      .filter(name => all || !name.startsWith('.'))
      .map(name => {
        const full = join(dir, name);
        try {
          const stat = statSync(full);
          return {
            name,
            type:      stat.isDirectory()   ? 'directory'
                     : stat.isSymbolicLink() ? 'symlink'
                     : 'file',
            sizeBytes: stat.size,
            modified:  stat.mtime.toISOString(),
          };
        } catch {
          return { name, type: 'unknown' as const, sizeBytes: 0, modified: '' };
        }
      });

    return { path: dir, total: entries.length, entries };
  },

  mkdir(sandboxRoot: string, path: string, recursive = true): { path: string; created: boolean } {
    const resolved = guardPath(sandboxRoot, path);
    const existed  = existsSync(resolved);
    if (!existed) mkdirSync(resolved, { recursive });
    return { path: resolved, created: !existed };
  },

  rm(
    sandboxRoot: string,
    path:        string,
    recursive  = false,
    force      = false,
  ): { path: string; removed: boolean; message?: string } {
    const resolved = guardPath(sandboxRoot, path);

    if (!existsSync(resolved)) {
      if (force) return { path: resolved, removed: false, message: 'Path did not exist.' };
      throw new ShellServiceError(`Path does not exist: ${path}`);
    }

    rmSync(resolved, { recursive, force });
    return { path: resolved, removed: true };
  },
};
