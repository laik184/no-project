/**
 * server/agents/terminal — Public API
 *
 * Dependency direction (low → high):
 *   types/ utils/ → validation/ security/ workspace/ →
 *   events/ telemetry/ streaming/ → execution/ npm/ process/ monitoring/ ports/ recovery/
 *
 * NO execution logic lives here — only re-exports.
 */

// ── Types ─────────────────────────────────────────────────────────────────────
export type { RuntimeContext, RuntimeHealth, ResourceSnapshot, RuntimeStatus, RunId, ProjectId, ProcessId } from './types/runtime.types.ts';
export type { ProcessRecord, ProcessStatus, ProcessStartOptions, ProcessHistoryEntry } from './types/process.types.ts';
export type { StreamChunk, StreamResult, StreamOptions, ParsedLine } from './types/stream.types.ts';
export type { ValidatedCommand, ExecutionResult, ExecutionOptions, ValidationResult, PolicyDecision } from './types/execution.types.ts';

// ── Execution ─────────────────────────────────────────────────────────────────
export { shellExecute }    from './execution/shell-executor.ts';
export { runCommand }      from './execution/command-runner.ts';
export { spawnProcess }    from './execution/process-spawner.ts';
export { terminateProcess, forceKill } from './execution/process-terminator.ts';
export { registerTimeout, cancelTimeout } from './execution/execution-timeout.ts';

// ── Streaming ─────────────────────────────────────────────────────────────────
export { runStreaming }          from './streaming/process-stream.ts';
export { executeWithStreaming }  from './streaming/output-streamer.ts';
export { StreamBuffer }         from './streaming/stream-buffer.ts';
export { LineParser, splitToLines } from './streaming/line-parser.ts';
export { sanitizeChunk, containsSecret } from './streaming/stream-sanitizer.ts';

// ── NPM ───────────────────────────────────────────────────────────────────────
export { npmInstall, npmCi }      from './npm/npm-installer.ts';
export { npmRunScript, npmBuild, npmTest } from './npm/npm-script-runner.ts';
export { writePackageJson }        from './npm/package-json-writer.ts';
export { validatePackageList, isPackageAllowed } from './npm/dependency-validator.ts';
export { getLockfileStatus, lockfileExists } from './npm/package-lock-manager.ts';

// ── Process ───────────────────────────────────────────────────────────────────
export { processManager }  from './process/process-manager.ts';
export { processMonitor }  from './process/process-monitor.ts';
export { processHistory }  from './process/process-history.ts';
export { processRegistry } from './process/process-registry.ts';
export { onProcessStarted, onProcessExited, cleanupRun } from './process/process-lifecycle.ts';

// ── Monitoring ────────────────────────────────────────────────────────────────
export { runtimeMonitor }   from './monitoring/runtime-monitor.ts';
export { failureMonitor }   from './monitoring/failure-monitor.ts';
export { executionMetrics } from './monitoring/execution-metrics.ts';
export { resourceMonitor }  from './monitoring/resource-monitor.ts';
export { runtimeAlerts }    from './monitoring/runtime-alerts.ts';

// ── Ports ─────────────────────────────────────────────────────────────────────
export { portManager }   from './ports/port-manager.ts';
export { portRegistry }  from './ports/port-registry.ts';
export { isPortInUse, findFreePort } from './ports/port-scanner.ts';

// ── Recovery ──────────────────────────────────────────────────────────────────
export { attemptRecovery }      from './recovery/runtime-recovery.ts';
export { restartProcess }       from './recovery/process-restart.ts';
export { onProcessCrashed }     from './recovery/crash-handler.ts';
export { evaluatePolicy, DEFAULT_POLICY } from './recovery/recovery-policy.ts';
export { checkpointManager }    from './recovery/checkpoint-manager.ts';

// ── Security ──────────────────────────────────────────────────────────────────
export { validateCommand, validateCommandSafe } from './security/command-validator.ts';
export { checkCommandSafety }   from './security/command-safety.ts';
export { assertWithinSandbox }  from './security/sandbox-guard.ts';
export { getLimitsForCommand, DEFAULT_LIMITS } from './security/resource-limits.ts';
export { evaluateExecutionPolicy } from './security/execution-policy.ts';

// ── Validation ────────────────────────────────────────────────────────────────
export { validateGeneratedOutput, validateCommandOutput } from './validation/output-validator.ts';
export { validateExecutionOptions } from './validation/execution-validator.ts';
export { validateExitCode, categorizeExitCode } from './validation/exitcode-validator.ts';
export { validateStreamChunk }  from './validation/stream-validator.ts';
export { validateRuntimeContext, validateRuntimeHealth } from './validation/runtime-validator.ts';

// ── Workspace ─────────────────────────────────────────────────────────────────
export { ensureWorkspace, getWorkspaceRoot } from './workspace/runtime-workspace.ts';
export { resolveWorkspace }   from './workspace/workspace-resolver.ts';
export { createExecutionContext, destroyExecutionContext } from './workspace/execution-context.ts';
export { bindSandboxContext, releaseSandboxContext } from './workspace/sandbox-context.ts';

// ── Events ────────────────────────────────────────────────────────────────────
export { terminalBus, publishEvent } from './events/event-publisher.ts';
export type { RuntimeEventName, RuntimeEventMap } from './events/runtime-events.ts';

// ── Telemetry ─────────────────────────────────────────────────────────────────
export { runtimeLogger }       from './telemetry/runtime-logger.ts';
export { runtimeMetrics }      from './telemetry/runtime-metrics.ts';
export { executionTrace }      from './telemetry/execution-trace.ts';
export { performanceTracker }  from './telemetry/performance-tracker.ts';

// ── Utils ─────────────────────────────────────────────────────────────────────
export { parseCommand, isNpmInstall, isNpmRun, buildNpmCommand } from './utils/command-utils.ts';
export { isProcessAlive, killProcess, generateProcessId }        from './utils/process-utils.ts';
export { stripAnsi, truncateOutput, estimateBytes }              from './utils/stream-utils.ts';
export { generateRunId, generateTraceId, elapsedMs }             from './utils/runtime-utils.ts';
