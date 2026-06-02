/**
 * server/file-explorer/repositories/git.repository.ts
 *
 * ONLY layer permitted to call child_process for git operations.
 * All git I/O for the file-explorer module flows through this class.
 *
 * Architecture:
 *   gitStatusService → gitRepository → child_process (infrastructure)
 */

import { execSync } from 'child_process';

export type GitStatusCode = 'M' | 'A' | 'D' | 'R' | '??' | 'UU' | string;

export interface GitStatusMap {
  [relativePath: string]: GitStatusCode;
}

class GitRepository {

  /**
   * Runs `git status --short` in the given working directory.
   * Returns a map of relative file path → status code.
   * Returns an empty map if cwd is not a git repository.
   * Never throws — callers receive a typed result.
   */
  getStatus(cwd: string): { ok: boolean; status: GitStatusMap; error?: string } {
    try {
      const raw = execSync('git status --short', {
        cwd,
        timeout:  5_000,
        encoding: 'utf-8',
      });

      const status: GitStatusMap = {};

      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        const code    = line.slice(0, 2).trim();
        const rawPath = line.slice(3).trim();
        const filePath = rawPath.includes(' -> ')
          ? rawPath.split(' -> ')[1]
          : rawPath;
        status[filePath.replace(/"/g, '')] = code as GitStatusCode;
      }

      return { ok: true, status };
    } catch (err) {
      if (err instanceof Error && err.message.includes('not a git repository')) {
        return { ok: true, status: {} };
      }
      return {
        ok:     true,
        status: {},
        error:  err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Returns true if the given directory is inside a git repository.
   */
  isGitRepo(cwd: string): boolean {
    try {
      execSync('git rev-parse --git-dir', { cwd, timeout: 3_000, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
}

export const gitRepository = new GitRepository();
