/**
 * server/agents/coderx/index.ts
 *
 * Public barrel for the CoderX agent.
 * Consumers import from here — never from internal sub-modules directly.
 */

// ── Agent entry point ─────────────────────────────────────────────────────────
export {
  initializeCoderX,
  shutdownCoderX,
  runCoderXAgent,
  getCoderXDiagnostics,
} from './coderx-agent.ts';

// ── Types ─────────────────────────────────────────────────────────────────────
export type {
  CodingTaskKind,
  CodingStepStatus,
  CodingSessionStatus,
  CodingRequest,
  CodingTask,
  CodingPlan,
  CodingStep,
  RuntimeCodingStep,
  CoderXExecutionContext,
  CoderXSession,
  CoderXAgentInput,
  CoderXAgentResult,
  CodingTaskOutput,
  CoderXLoopOptions,
  CoderXRetryConfig,
  RoutedCodingStep,
  CodingFailureRecord,
  CoderXMonitorSnapshot,
  CodingTaskAnalysis,
  DecisionOutcome,
  DecisionResult,
  ImplementationPlan,
  ImplementationPhase,
} from './types/coderx.types.ts';

// ── Retry defaults ────────────────────────────────────────────────────────────
export { DEFAULT_RETRY_CONFIG } from './execution/retry-manager.ts';

// ── Planning ──────────────────────────────────────────────────────────────────
export { buildCodingPlan }          from './planning/code-planner.ts';
export { buildImplementationPlan }  from './planning/implementation-planner.ts';
export { buildExecutionPlan }       from './planning/execution-plan-builder.ts';

// ── Reasoning ────────────────────────────────────────────────────────────────
export { analyzeCodingTask }        from './reasoning/task-analyzer.ts';
export { buildDependencyGraph }     from './reasoning/dependency-analyzer.ts';
export { decide, shouldAbortPlan }  from './reasoning/decision-engine.ts';

// ── Telemetry & monitoring ────────────────────────────────────────────────────
export { coderxLogger }        from './telemetry/coderx-logger.ts';
export { coderxMetrics }       from './telemetry/coderx-metrics.ts';
export { failureMonitor }      from './monitoring/failure-monitor.ts';
export { executionMonitor }    from './monitoring/execution-monitor.ts';

// ── Memory ────────────────────────────────────────────────────────────────────
export { workingMemory }       from './memory/working-memory.ts';
export { executionHistory }    from './memory/execution-history.ts';

// ── Context ───────────────────────────────────────────────────────────────────
export { buildCoderXContext, toToolContext } from './core/coderx-context.ts';
