/**
 * server/agents/executor/index.ts
 *
 * Public barrel for the executor agent.
 * Consumers import from here — never from internal sub-modules directly.
 */

// ── Agent entry point ─────────────────────────────────────────────────────────
export {
  initializeExecutor,
  shutdownExecutor,
  runExecutorAgent,
  getExecutorDiagnostics,
} from './executor-agent.ts';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  TaskKind,
  ExecutionStepStatus,
  ExecutionSessionStatus,
  ExecutionTask,
  ExecutionPlan,
  ExecutionStep,
  RuntimeStep,
  ExecutorExecutionContext,
  ExecutorSession,
  ExecutorAgentInput,
  ExecutorAgentResult,
  TaskOutput,
  ExecutorLoopOptions,
  ExecutorRetryConfig,
  RoutedStep,
  ExecutionFailureRecord,
  BuiltExecutionPlan,
  ExecutionMonitorSnapshot,
} from './types/executor.types.ts';

// ── Loop options ──────────────────────────────────────────────────────────────
export { DEFAULT_RETRY_CONFIG } from './execution/retry-manager.ts';

// ── Planning ──────────────────────────────────────────────────────────────────
export { planExecution }      from './planning/execution-planner.ts';
export type { PlannerResult } from './planning/execution-planner.ts';

// ── Telemetry & monitoring ────────────────────────────────────────────────────
export { executorLogger }    from './telemetry/executor-logger.ts';
export { executorMetrics }   from './telemetry/executor-metrics.ts';
export { failureMonitor }    from './monitoring/failure-monitor.ts';
export { executionMonitor }  from './monitoring/execution-monitor.ts';

// ── Context ───────────────────────────────────────────────────────────────────
export { buildExecutorContext, toToolContext } from './core/executor-context.ts';
export type { ExecutorContextInput }           from './core/executor-context.ts';

// ── Memory (used by memory bootstrap layer) ───────────────────────────────────
export { executionHistory }                                           from './memory/execution-history.ts';
export type { ExecutionHistoryEntry, ExecutionHistorySummary }        from './memory/execution-history.ts';
export { failureMemory }                                              from './memory/failure-memory.ts';
export type { FailurePattern, FailureCategory, FailureAnalysis }      from './memory/failure-memory.ts';

// ── Learning (used by memory bootstrap layer) ─────────────────────────────────
export { learningStore }                                              from './learning/learning-store.ts';
export type { LearnedEntry, LearnedKind, LearningStoreSummary }       from './learning/learning-store.ts';
