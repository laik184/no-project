/**
 * server/infrastructure/checkpoints/git-runner.ts
 *
 * Owns all shell execution for git operations.
 * This is the ONLY place in the infrastructure layer that calls child_process
 * for git. Chat/persistence layers must delegate here instead of exec-ing directly.
 */

import { execFile }  from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Attempt to capture the current git commit SHA in the given directory.
 * Returns null if git is unavailable, not a git repo, or the call times out.
 * Never throws.
 */
export async function captureGitSha(dir: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], {
      cwd:     dir,
      timeout: 3000,
    });
    const sha = stdout.trim();
    return sha.length >= 7 ? sha.slice(0, 64) : null;
  } catch {
    return null;
  }
}
