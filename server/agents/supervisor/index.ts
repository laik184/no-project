/**
 * server/agents/supervisor/index.ts
 *
 * Public API for the supervisor agent orchestration layer.
 * Only export what callers outside this module need.
 */

// ── Entry point ───────────────────────────────────────────────────────────────
export {
  supervise,
  initSupervisorAgent,
  shutdownSupervisorAgent,
  runSupervisorCycle,
} from './supervisor-agent.ts';
export type { SupervisorCycleResult } from './supervisor-agent.ts';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  SupervisionRequest,
  SupervisionResult,
  SupervisionTask,
  TaskOutcome,
  SupervisionPhase,
  SupervisionStatus,
  AgentDomain,
  RetryPolicy,
  RecoveryAction,
  ValidationResult,
  SupervisionSessionMeta,
} from './types/supervisor.types.ts';

// ── Context ───────────────────────────────────────────────────────────────────
export { buildSupervisionContext }  from './core/supervisor-context.ts';
export type { SupervisionContext }  from './core/supervisor-context.ts';

// ── Session snapshot (read-only) ──────────────────────────────────────────────
export { supervisorSession }        from './core/supervisor-session.ts';

// ── Metrics snapshot (read-only) ─────────────────────────────────────────────
export { supervisorMetrics }        from './telemetry/supervisor-metrics.ts';

// ── Failure monitor (read-only) ───────────────────────────────────────────────
export { failureMonitor }           from './monitoring/failure-monitor.ts';

// ── Validators (testable) ─────────────────────────────────────────────────────
export {
  validateSupervisionRequest,
  validateTask,
  validateRuntimeContext,
} from './validation/supervision-validator.ts';

export {
  validatePhaseTransition,
  validateExecutionLifecycle,
  validateOrchestrationFlow,
} from './validation/execution-validator.ts';
