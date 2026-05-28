/**
 * server/agents/terminal/index.ts
 *
 * Public surface of the terminal agent module.
 * Only export what consumers outside this module need.
 */

// ── Agent entry point ─────────────────────────────────────────────────────────
export {
  initTerminalAgent,
  shutdownTerminalAgent,
  executeTerminalSession,
  type TerminalAgentRequest,
  type TerminalAgentResult,
} from './terminal-agent.ts';

// ── Executor-consumed wrappers ────────────────────────────────────────────────
export { runCommand }                              from './execution/command-runner.ts';
export { npmInstall, npmInstallOne }               from './npm/npm-installer.ts';
export { npmRunScript }                            from './npm/npm-script-runner.ts';
export { checkpointManager }                       from './recovery/checkpoint-manager.ts';
export { validateGeneratedOutput, validateCommandOutput } from './validation/output-validator.ts';
export { getWorkspaceRoot, isWithinWorkspace, resolveWorkspacePath } from './workspace/runtime-workspace.ts';
export { runtimeMonitor }                          from './monitoring/runtime-monitor.ts';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  ExecutionStep,
  StepOutcome,
  CommandResult,
  NpmOptions,
  CommandRunOptions,
  ValidationResult,
  SessionStatus,
  TerminalSessionMeta,
} from './types/terminal.types.ts';
