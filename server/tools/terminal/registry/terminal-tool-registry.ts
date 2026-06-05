/**
 * server/tools/terminal/registry/terminal-tool-registry.ts
 *
 * Registers all terminal tools with the central platform registry.
 * Called once at application boot by tool-loader.ts.
 */

import { registerTool } from '../../../tools/registry/tool-registry.ts';

// ── Commands ──────────────────────────────────────────────────────────────────
import { executeCommandTool } from '../commands/execute-command-tool.ts';
import { streamCommandTool }  from '../commands/stream-command-tool.ts';
import { cancelCommandTool }  from '../commands/cancel-command-tool.ts';

// ── Package manager ───────────────────────────────────────────────────────────
import { installPackageTool }       from '../package-manager/install-package-tool.ts';
import { uninstallPackageTool }     from '../package-manager/uninstall-package-tool.ts';
import { updatePackageTool }        from '../package-manager/update-package-tool.ts';
import { listPackagesTool }         from '../package-manager/list-packages-tool.ts';
import { detectPackageManagerTool } from '../package-manager/detect-package-manager-tool.ts';

// ── Runtime ───────────────────────────────────────────────────────────────────
import { startRuntimeTool }   from '../runtime/start-runtime-tool.ts';
import { stopRuntimeTool }    from '../runtime/stop-runtime-tool.ts';
import { restartRuntimeTool } from '../runtime/restart-runtime-tool.ts';
import { runtimeStatusTool }  from '../runtime/runtime-status-tool.ts';

// ── Process ───────────────────────────────────────────────────────────────────
import { listProcessesTool } from '../process/list-processes-tool.ts';
import { killProcessTool }   from '../process/kill-process-tool.ts';
import { processLogsTool }   from '../process/process-logs-tool.ts';

// ── Shell ─────────────────────────────────────────────────────────────────────
import { pwdTool }   from '../shell/pwd-tool.ts';
import { lsTool }    from '../shell/ls-tool.ts';
import { cdTool }    from '../shell/cd-tool.ts';
import { mkdirTool } from '../shell/mkdir-tool.ts';
import { rmTool }    from '../shell/rm-tool.ts';

// ── Registration list ─────────────────────────────────────────────────────────

const ALL_TERMINAL_TOOLS = [
  // Commands
  executeCommandTool,
  streamCommandTool,
  cancelCommandTool,
  // Package manager
  installPackageTool,
  uninstallPackageTool,
  updatePackageTool,
  listPackagesTool,
  detectPackageManagerTool,
  // Runtime
  startRuntimeTool,
  stopRuntimeTool,
  restartRuntimeTool,
  runtimeStatusTool,
  // Process
  listProcessesTool,
  killProcessTool,
  processLogsTool,
  // Shell
  pwdTool,
  lsTool,
  cdTool,
  mkdirTool,
  rmTool,
] as const;

let _registered = false;

export function registerTerminalTools(): void {
  if (_registered) return;
  for (const tool of ALL_TERMINAL_TOOLS) {
    registerTool(tool, { force: false });
  }
  _registered = true;
  console.log(`[register-terminal-tools] Registered ${ALL_TERMINAL_TOOLS.length} terminal tools`);
}

export const TERMINAL_TOOL_COUNT = ALL_TERMINAL_TOOLS.length;
export const TERMINAL_TOOL_NAMES = ALL_TERMINAL_TOOLS.map(t => t.name);
