/**
 * server/console/index.ts
 *
 * PUBLIC API surface for the console module.
 *
 * Rules:
 *   - Services import console internals ONLY from this file (not sub-paths).
 *   - This file MUST NOT import from server/services/** (would create a circular dep).
 *   - External consumers (main.ts) use server/services/console/index.ts for services.
 */

// ── Router ────────────────────────────────────────────────────────────────────
export { consoleRouter } from './api/console-controller.ts';

// ── Runtime management (used by services/console/runtime-service & process-service) ──
export { consoleRuntimeManager } from './runtime/runtime-manager.ts';
export type { StartOptions }     from './runtime/runtime-manager.ts';

// ── Crash recovery (used by services/console/runtime-service) ────────────────
export { crashRecovery } from './runtime/crash-recovery.ts';

// ── Process supervisor (used by services/console/process-service) ─────────────
export { spawnSupervised }          from './runtime/process-supervisor.ts';
export type { SupervisorHandle, SupervisorOptions } from './runtime/process-supervisor.ts';

// ── Log parsers (used by services/console/log-service) ────────────────────────
export { parseLogLine } from './parsers/log-parser.ts';

// ── Domain factories (used by services/console/log-service) ──────────────────
export { makeLogLine, makeSystemLine, makeErrorLine, makeStdoutLine, makeStderrLine } from './domain/log-line.ts';

// ── Install tracker (used by services/console/log-service) ───────────────────
export { installTracker } from './install/install-tracker.ts';

// ── Event helpers (used by services and agent/tool integration) ───────────────
export { emitLogLine, emitRuntimeState, onLogLine, onRuntimeState, CONSOLE_EVENT } from './events/console-events.ts';
export type { ConsoleEventName } from './events/console-events.ts';

// ── Stream broker (used by services/console/console-service) ─────────────────
export { initStreamBroker, streamBrokerStats, registerConnection } from './streaming/stream-broker.ts';

// ── Types (re-exported from shared for convenience) ───────────────────────────
export type {
  LogLine,
  LogKind,
  RuntimeState,
  RuntimeStateEvent,
  ConsoleLineMeta,
  NpmMeta,
  ViteMeta,
  NodeMeta,
  ConsoleSession,
  RuntimeEntry,
  ConnectedEvent,
} from '../shared/console/types.ts';

// ── Tool Registry ─────────────────────────────────────────────────────────────
export { consoleToolRegistry }               from './registry/index.ts';
export type { ConsoleTool, ConsoleToolResult } from './registry/index.ts';

// ── Terminal tools ────────────────────────────────────────────────────────────
export { terminalTool }                      from './terminal/index.ts';
export type { TerminalInput, TerminalOutput } from './terminal/index.ts';

// ── Package tools ─────────────────────────────────────────────────────────────
export { installPackageTool, uninstallPackageTool } from './package/index.ts';
export type { InstallPackageInput, InstallPackageOutput,
              UninstallPackageInput, UninstallPackageOutput } from './package/index.ts';

// ── Runtime tools ─────────────────────────────────────────────────────────────
export { startRuntimeTool, restartRuntimeTool, stopRuntimeTool } from './runtime/index.ts';
export type { StartRuntimeInput, StartRuntimeOutput,
              RestartRuntimeInput, RestartRuntimeOutput,
              StopRuntimeInput, StopRuntimeOutput }              from './runtime/index.ts';

// ── Git tools ─────────────────────────────────────────────────────────────────
export { gitStatusTool, gitCommitTool, gitRestoreTool }          from './git/index.ts';
export type { GitStatusInput, GitStatusOutput,
              GitCommitInput, GitCommitOutput,
              GitRestoreInput, GitRestoreOutput }                 from './git/index.ts';

// ── Checkpoint tools ──────────────────────────────────────────────────────────
export { createCheckpointTool, restoreCheckpointTool }           from './checkpoint/index.ts';
export type { CreateCheckpointInput, CreateCheckpointOutput,
              RestoreCheckpointInput, RestoreCheckpointOutput }  from './checkpoint/index.ts';

// ── Preview tools ─────────────────────────────────────────────────────────────
export { openPreviewTool }                                        from './preview/index.ts';
export type { OpenPreviewInput, OpenPreviewOutput }               from './preview/index.ts';
