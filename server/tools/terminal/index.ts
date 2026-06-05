/**
 * server/tools/terminal/index.ts
 *
 * Public surface of the terminal tool domain.
 * All consumers import from this barrel — never from sub-paths.
 */

// ── Registration ──────────────────────────────────────────────────────────────
export {
  registerTerminalTools,
  TERMINAL_TOOL_COUNT,
  TERMINAL_TOOL_NAMES,
} from './registry/index.ts';

// ── Contracts ─────────────────────────────────────────────────────────────────
export type {
  CommandInput,
  CommandResult,
  PackageInput,
  PackageResult,
  RuntimeInput,
  RuntimeResult,
  ProcessEntry,
  ShellEntry,
} from './contracts/index.ts';

// ── Commands ──────────────────────────────────────────────────────────────────
export { executeCommandTool } from './commands/execute-command-tool.ts';
export { streamCommandTool }  from './commands/stream-command-tool.ts';
export { cancelCommandTool }  from './commands/cancel-command-tool.ts';

// ── Package manager ───────────────────────────────────────────────────────────
export { installPackageTool }       from './package-manager/install-package-tool.ts';
export { uninstallPackageTool }     from './package-manager/uninstall-package-tool.ts';
export { updatePackageTool }        from './package-manager/update-package-tool.ts';
export { listPackagesTool }         from './package-manager/list-packages-tool.ts';
export { detectPackageManagerTool } from './package-manager/detect-package-manager-tool.ts';

// ── Runtime ───────────────────────────────────────────────────────────────────
export { startRuntimeTool }   from './runtime/start-runtime-tool.ts';
export { stopRuntimeTool }    from './runtime/stop-runtime-tool.ts';
export { restartRuntimeTool } from './runtime/restart-runtime-tool.ts';
export { runtimeStatusTool }  from './runtime/runtime-status-tool.ts';

// ── Process ───────────────────────────────────────────────────────────────────
export { listProcessesTool } from './process/list-processes-tool.ts';
export { killProcessTool }   from './process/kill-process-tool.ts';
export { processLogsTool }   from './process/process-logs-tool.ts';

// ── Shell ─────────────────────────────────────────────────────────────────────
export { pwdTool }   from './shell/pwd-tool.ts';
export { lsTool }    from './shell/ls-tool.ts';
export { cdTool }    from './shell/cd-tool.ts';
export { mkdirTool } from './shell/mkdir-tool.ts';
export { rmTool }    from './shell/rm-tool.ts';
