/**
 * server/file-explorer/services/git-status/git-status.service.ts
 * Runs `git status --short` and returns per-file status codes.
 * Returns empty map if the sandbox is not a git repo.
 */

import { execSync } from 'child_process';
import { FE_CONFIG } from '../../config/index.ts';

export type GitStatusCode = 'M' | 'A' | 'D' | 'R' | '??' | 'UU' | string;

interface GitStatusResult {
  ok:     boolean;
  status: Record<string, GitStatusCode>;
  error?: string;
}

class GitStatusService {

  /**
   * Returns a map of relative path → git status code.
   * Keys use forward-slash separators.
   */
  getStatus(): GitStatusResult {
    try {
      const raw = execSync('git status --short', {
        cwd:     FE_CONFIG.sandboxRoot,
        timeout: 5000,
        encoding: 'utf-8',
      });

      const status: Record<string, GitStatusCode> = {};
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue;
        const code    = line.slice(0, 2).trim();
        const rawPath = line.slice(3).trim();
        // Handle renames: "old -> new"
        const filePath = rawPath.includes(' -> ') ? rawPath.split(' -> ')[1] : rawPath;
        status[filePath.replace(/"/g, '')] = code as GitStatusCode;
      }

      return { ok: true, status };
    } catch (err) {
      // Not a git repo or git not installed — return empty map, not an error
      if (err instanceof Error && err.message.includes('not a git repository')) {
        return { ok: true, status: {} };
      }
      return { ok: true, status: {}, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

export const gitStatusService = new GitStatusService();
