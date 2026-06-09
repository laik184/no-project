/**
 * server/tools/git/register-git-tools.ts
 *
 * Registers all git tools with the central tool registry.
 * Called once at application boot by tool-loader.ts.
 * Idempotent — subsequent calls are no-ops.
 */

import { registerTool } from '../registry/tool-registry.ts';

import { gitStatusTool } from './git-status-tool.ts';
import { gitDiffTool }   from './git-diff-tool.ts';
import { gitAddTool }    from './git-add-tool.ts';
import { gitCommitTool } from './git-commit-tool.ts';
import { gitLogTool }    from './git-log-tool.ts';

const ALL_GIT_TOOLS = [
  gitStatusTool,
  gitDiffTool,
  gitAddTool,
  gitCommitTool,
  gitLogTool,
] as const;

let _registered = false;

export function registerGitTools(): void {
  if (_registered) return;
  for (const tool of ALL_GIT_TOOLS) {
    registerTool(tool, { force: false });
  }
  _registered = true;
  console.log(`[register-git-tools] Registered ${ALL_GIT_TOOLS.length} git tools`);
}
