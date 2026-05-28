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
export { planExecution }           from './planning/execution-planner.ts';
export { selectTool, listToolsForKind, defaultToolForKind } from './planning/tool-selection.ts';

// ── Telemetry & monitoring ────────────────────────────────────────────────────
export { executorLogger }    from './telemetry/executor-logger.ts';
export { executorMetrics }   from './telemetry/executor-metrics.ts';
export { failureMonitor }    from './monitoring/failure-monitor.ts';
export { executionMonitor }  from './monitoring/execution-monitor.ts';

// ── Context ───────────────────────────────────────────────────────────────────
export { buildExecutorContext, toToolContext } from './core/executor-context.ts';
