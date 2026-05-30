# EXECUTOR_EXPORT_VALIDATION.md

## Named Export Validation

| Export Name           | Source File                        | File Exists? | Symbol Verified? | Status    |
|-----------------------|------------------------------------|-------------|------------------|-----------|
| `initializeExecutor`  | `executor-agent.ts`                | ✓           | ✓ line 47        | **VALID** |
| `shutdownExecutor`    | `executor-agent.ts`                | ✓           | ✓ line 53        | **VALID** |
| `runExecutorAgent`    | `executor-agent.ts`                | ✓           | ✓ line 71        | **VALID** |
| `getExecutorDiagnostics` | `executor-agent.ts`            | ✓           | ✓ line 215       | **VALID** |
| `DEFAULT_RETRY_CONFIG`| `execution/retry-manager.ts`       | ✓           | ✓ line 14        | **VALID** |
| `planExecution`       | `planning/execution-planner.ts`    | ✓           | ✓ line 35        | **VALID** |
| `selectTool`          | `planning/tool-selection.ts`       | ✓           | ✓ line 77        | **VALID** |
| `listToolsForKind`    | `planning/tool-selection.ts`       | ✓           | ✓ line 81        | **VALID** |
| `defaultToolForKind`  | `planning/tool-selection.ts`       | ✓           | ✓ line 85        | **VALID** |
| `executorLogger`      | `telemetry/executor-logger.ts`     | ✓           | ✓ line 26        | **VALID** |
| `executorMetrics`     | `telemetry/executor-metrics.ts`    | ✓           | ✓ line 34        | **VALID** |
| `failureMonitor`      | `monitoring/failure-monitor.ts`    | ✓           | ✓ line 27        | **VALID** |
| `executionMonitor`    | `monitoring/execution-monitor.ts`  | ✓           | ✓ line 24        | **VALID** |
| `buildExecutorContext`| `core/executor-context.ts`         | ✓           | ✓ line 26        | **VALID** |
| `toToolContext`       | `core/executor-context.ts`         | ✓           | ✓ line 41        | **VALID** |

## Type Export Validation (from `types/executor.types.ts`)

| Type Name               | Line | Status    |
|-------------------------|------|-----------|
| `TaskKind`              | 10   | **VALID** |
| `ExecutionStepStatus`   | 19   | **VALID** |
| `ExecutionSessionStatus`| 28   | **VALID** |
| `ExecutionTask`         | 37   | **VALID** |
| `ExecutionPlan`         | 46   | **VALID** |
| `ExecutionStep`         | 53   | **VALID** |
| `RuntimeStep`           | 62   | **VALID** |
| `ExecutorExecutionContext`| 74 | **VALID** |
| `ExecutorSession`       | 84   | **VALID** |
| `ExecutorAgentInput`    | 97   | **VALID** |
| `ExecutorAgentResult`   | 105  | **VALID** |
| `TaskOutput`            | 119  | **VALID** |
| `ExecutorLoopOptions`   | 130  | **VALID** |
| `ExecutorRetryConfig`   | 137  | **VALID** |
| `RoutedStep`            | 145  | **VALID** |
| `ExecutionFailureRecord`| 152  | **VALID** |
| `BuiltExecutionPlan`    | 165  | **VALID** |
| `ExecutionMonitorSnapshot`| 174| **VALID** |

## Missing Exports (not broken — omitted from index, evidence below)

| Missing Export        | Source File                        | Why Public                                        |
|-----------------------|------------------------------------|---------------------------------------------------|
| `PlannerResult`       | `planning/execution-planner.ts:25` | Return type of exported `planExecution`           |
| `ExecutorContextInput`| `core/executor-context.ts:11`      | Input type of exported `buildExecutorContext`     |
| `executionHistory`    | `memory/execution-history.ts:61`   | Used directly by `server/memory/bootstrap/`       |
| `failureMemory`       | `memory/failure-memory.ts:74`      | Used directly by `server/memory/bootstrap/`       |
| `learningStore`       | `learning/learning-store.ts:73`    | Used directly by `server/memory/bootstrap/`       |
| `ExecutionHistoryEntry`| `memory/execution-history.ts:18`  | Used directly by `server/memory/bootstrap/`       |
| `FailurePattern`      | `memory/failure-memory.ts:16`      | Used directly by `server/memory/bootstrap/`       |
| `LearnedEntry`        | `learning/learning-store.ts:21`    | Used directly by `server/memory/bootstrap/`       |
| `LearnedKind`         | `learning/learning-store.ts:13`    | Used directly by `server/memory/bootstrap/`       |

## Summary

| Status    | Count |
|-----------|-------|
| VALID     | 33    |
| BROKEN    | 0     |
| DUPLICATE | 0     |
| MISSING   | 9     |
