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

// ── Monitoring ────────────────────────────────────────────────────────────────
export { runtimeMonitor, runtimeHealthMonitor } from './monitoring/runtime-health-monitor.ts';

// ── Validation ────────────────────────────────────────────────────────────────
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
} from './types/terminal.types.ts';
