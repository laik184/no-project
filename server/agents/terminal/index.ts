/**
 * server/agents/terminal/index.ts
 *
 * Public surface of the terminal agent orchestration module.
 * Exports only what consumers outside this module need.
 * All execution flows through the dispatcher — never imported directly.
 */

// ── Agent entry point ─────────────────────────────────────────────────────────
export {
  initTerminalAgent,
  shutdownTerminalAgent,
  executeTerminalSession,
  type TerminalAgentRequest,
  type TerminalAgentResult,
} from './terminal-agent.ts';

// ── Monitoring ────────────────────────────────────────────────────────────────
export { runtimeMonitor, runtimeHealthMonitor } from './monitoring/runtime-health-monitor.ts';

// ── Validation helpers ────────────────────────────────────────────────────────
export {
  validateExecutionRequest,
  validateGeneratedOutput,
  validateCommandOutput,
} from './validation/execution-validator.ts';

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
  TerminalPhase,
  RetryPolicy,
  RecoveryAction,
  StepType,
} from './types/terminal.types.ts';
