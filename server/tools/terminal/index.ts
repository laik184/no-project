/**
 * server/tools/terminal/index.ts
 *
 * Centralized terminal tool architecture.
 *
 * Architecture:
 *   Agents → Tool Registry → Tool Dispatcher → Terminal Tools
 *
 * All terminal execution logic lives here.
 * server/agents/terminal/ becomes a thin compatibility adapter layer.
 */

export { shellExecute }     from './execution/shell-execute.ts';
export { runCommand }       from './execution/run-command.ts';
export { spawnProcess }     from './execution/spawn-process.ts';
export { terminateProcess } from './execution/terminate-process.ts';
export { forceKill }        from './execution/force-kill.ts';
export {
  registerTimeout,
  cancelTimeout,
  clampTimeout,
}                           from './execution/timeout-manager.ts';

export { npmInstall }       from './npm/npm-install.ts';
export { npmCi }            from './npm/npm-ci.ts';
export { npmRunScript }     from './npm/npm-run-script.ts';
export { npmBuild }         from './npm/npm-build.ts';
export { npmTest }          from './npm/npm-test.ts';
export { writePackageJson } from './npm/write-package-json.ts';
export { getLockfileStatus } from './npm/lockfile-status.ts';
export { deleteLockfile }   from './npm/delete-lockfile.ts';
export { validatePackageName }           from './npm/validate-package-name.ts';

export { resolvePort }      from './ports/resolve-port.ts';
export { releasePort }      from './ports/release-port.ts';
export { releaseRunPorts }  from './ports/release-run-ports.ts';
export { getAssignedPort }  from './ports/assigned-port.ts';
export { isPortInUse }      from './ports/port-in-use.ts';
export { scanPortRange }    from './ports/scan-port-range.ts';
export { findFreePort }     from './ports/find-free-port.ts';

export { registerProcess }  from './process/process-register.ts';
export { processHistory }   from './process/process-history.ts';
export { startProcess }     from './process/process-start.ts';
export { stopProcess }      from './process/process-stop.ts';
export { watchProcess }     from './process/process-watch.ts';
export { cleanupRun }       from './process/cleanup-run.ts';
export { emitProcessStarted } from './process/process-started.ts';
export { emitProcessExited }  from './process/process-exited.ts';

export { processMonitor }   from './monitoring/process-monitor.ts';
export { runtimeMonitor }   from './monitoring/runtime-monitor.ts';
export { resourceMonitor }  from './monitoring/resource-monitor.ts';
export { executionMetrics } from './monitoring/execution-metrics.ts';

export { registerTerminalTools } from './registry/register-terminal-tools.ts';

export type {
  ExecutionResult,
  ExecutionOptions,
  PolicyDecision,
  ValidationResult,
  PortAllocation,
  ProcessRecord,
  ProcessHistoryEntry,
}                           from './shared/terminal-types.ts';

export {
  TerminalError,
  CommandBlockedError,
  CommandTimeoutError,
  SandboxViolationError,
  NpmValidationError,
  ProcessNotFoundError,
}                           from './shared/terminal-errors.ts';
