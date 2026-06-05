/**
 * server/services/git/git.service.ts
 *
 * Full git operations: status, commit, restore.
 * Wraps child_process execFile — infrastructure concern lives here, NOT in tools.
 *
 * Dependency rule:
 *   Tool → GitService (this) → child_process (infra)
 */

import { execFile }  from 'child_process';
import { promisify } from 'util';
import { getProjectDir } from '../../infrastructure/index.ts';

const exec = promisify(execFile);

export type GitStatusCode = 'M' | 'A' | 'D' | 'R' | 'U' | '??' | string;

export interface GitStatusResult {
  ok:     boolean;
  files:  Record<string, GitStatusCode>;
  error?: string;
}

export interface GitCommitResult {
  ok:     boolean;
  sha?:   string;
  error?: string;
}

export interface GitRestoreResult {
  ok:     boolean;
  error?: string;
}

class GitService {
  private get cwd(): string {
    return getProjectDir(1);
  }

  async status(): Promise<GitStatusResult> {
    try {
      const { stdout } = await exec('git', ['status', '--porcelain'], { cwd: this.cwd, timeout: 5000 });
      const files: Record<string, GitStatusCode> = {};
      for (const line of stdout.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const code = trimmed.slice(0, 2).trim();
        const file = trimmed.slice(3).trim();
        if (file) files[file] = code || '?';
      }
      return { ok: true, files };
    } catch (err) {
      return { ok: false, files: {}, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async commit(message: string): Promise<GitCommitResult> {
    try {
      await exec('git', ['add', '-A'], { cwd: this.cwd, timeout: 10000 });
      await exec('git', ['commit', '-m', message, '--allow-empty'], { cwd: this.cwd, timeout: 10000 });
      const { stdout } = await exec('git', ['rev-parse', 'HEAD'], { cwd: this.cwd, timeout: 5000 });
      return { ok: true, sha: stdout.trim().slice(0, 40) };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async restore(filePath?: string): Promise<GitRestoreResult> {
    try {
      const args = filePath ? ['restore', filePath] : ['restore', '.'];
      await exec('git', args, { cwd: this.cwd, timeout: 10000 });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async isRepo(): Promise<boolean> {
    try {
      await exec('git', ['rev-parse', '--is-inside-work-tree'], { cwd: this.cwd, timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }
}

export const gitService = new GitService();
