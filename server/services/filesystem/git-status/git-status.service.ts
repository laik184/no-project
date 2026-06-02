/**
 * server/file-explorer/services/git-status/git-status.service.ts
 *
 * Returns per-file git status codes for the configured sandbox root.
 * Returns an empty map if the sandbox is not a git repository.
 *
 * Architecture:
 *   API route → GitStatusService (this) → gitRepository (child_process)
 *
 * This service must NOT import child_process directly.
 */

import { FE_CONFIG }     from '../../shared/file-explorer-core/config/index.ts';
import { gitRepository } from '../../repositories/file-system/index.ts';

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
    return gitRepository.getStatus(FE_CONFIG.sandboxRoot);
  }
}

export const gitStatusService = new GitStatusService();
