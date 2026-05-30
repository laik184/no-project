# CODERX_EXPORT_VALIDATION.md

## Export Validation — Named Exports

| Export Name              | Source File                              | File Exists? | Name Verified? | Status    |
|--------------------------|------------------------------------------|-------------|----------------|-----------|
| `initializeCoderX`       | `coderx-agent.ts`                        | ✓           | ✓ line 46      | **VALID** |
| `shutdownCoderX`         | `coderx-agent.ts`                        | ✓           | ✓ line 52      | **VALID** |
| `runCoderXAgent`         | `coderx-agent.ts`                        | ✓           | ✓ line 60      | **VALID** |
| `getCoderXDiagnostics`   | `coderx-agent.ts`                        | ✓           | ✓ line 166     | **VALID** |
| `DEFAULT_RETRY_CONFIG`   | `execution/retry-manager.ts`             | ✓           | ✓ line 14      | **VALID** |
| `buildCodingPlan`        | `planning/code-planner.ts`               | ✓           | ✓ line 42      | **VALID** |
| `buildImplementationPlan`| `planning/implementation-planner.ts`     | ✓           | ✓ line 27      | **VALID** |
| `buildExecutionPlan`     | `planning/execution-plan-builder.ts`     | ✓           | ✓ line 29      | **VALID** |
| `analyzeCodingTask`      | `reasoning/task-analyzer.ts`             | ✓           | ✓ line 67      | **VALID** |
| `buildDependencyGraph`   | `reasoning/dependency-analyzer.ts`       | ✓           | ✓ line 19      | **VALID** |
| `decide`                 | `reasoning/decision-engine.ts`           | ✓           | ✓ line 18      | **VALID** |
| `shouldAbortPlan`        | `reasoning/decision-engine.ts`           | ✓           | ✓ line 88      | **VALID** |
| `coderxLogger`           | `telemetry/coderx-logger.ts`             | ✓           | ✓ line 32      | **VALID** |
| `coderxMetrics`          | `telemetry/coderx-metrics.ts`            | ✓           | ✓ line 26      | **VALID** |
| `failureMonitor`         | `monitoring/failure-monitor.ts`          | ✓           | ✓ line 13      | **VALID** |
| `executionMonitor`       | `monitoring/execution-monitor.ts`        | ✓           | ✓ line 24      | **VALID** |
| `workingMemory`          | `memory/working-memory.ts`               | ✓           | ✓ line 25      | **VALID** |
| `executionHistory`       | `memory/execution-history.ts`            | ✓           | ✓ line 39      | **VALID** |
| `buildCoderXContext`     | `core/coderx-context.ts`                 | ✓           | ✓ line 27      | **VALID** |
| `toToolContext`          | `core/coderx-context.ts`                 | ✓           | ✓ line 44      | **VALID** |

## Export Validation — Type Exports (from `types/coderx.types.ts`)

| Type Name              | Line  | Status    |
|------------------------|-------|-----------|
| `CodingTaskKind`       | 10    | **VALID** |
| `CodingStepStatus`     | 26    | **VALID** |
| `CodingSessionStatus`  | 35    | **VALID** |
| `CodingRequest`        | 45    | **VALID** |
| `CodingTask`           | 57    | **VALID** |
| `CodingPlan`           | 68    | **VALID** |
| `CodingStep`           | 77    | **VALID** |
| `RuntimeCodingStep`    | 87    | **VALID** |
| `CoderXExecutionContext`| 99   | **VALID** |
| `CoderXSession`        | 110   | **VALID** |
| `CoderXAgentInput`     | 124   | **VALID** |
| `CoderXAgentResult`    | 128   | **VALID** |
| `CodingTaskOutput`     | 143   | **VALID** |
| `CoderXLoopOptions`    | 154   | **VALID** |
| `CoderXRetryConfig`    | 161   | **VALID** |
| `RoutedCodingStep`     | 169   | **VALID** |
| `CodingFailureRecord`  | 176   | **VALID** |
| `CoderXMonitorSnapshot`| 189   | **VALID** |
| `CodingTaskAnalysis`   | 202   | **VALID** |
| `DecisionOutcome`      | 212   | **VALID** |
| `DecisionResult`       | 214   | **VALID** |
| `ImplementationPlan`   | 222   | **VALID** |
| `ImplementationPhase`  | 228   | **VALID** |

## Summary

| Status      | Count |
|-------------|-------|
| VALID       | 43    |
| BROKEN      | 0     |
| DUPLICATE   | 0     |
| MISSING     | 7     |

## Missing (not broken — omitted from index)

| Missing Export       | Source File                          | Type             | Status    |
|----------------------|--------------------------------------|------------------|-----------|
| `BuiltCodingPlan`    | `planning/execution-plan-builder.ts` | interface        | **MISSING** |
| `DependencyGraph`    | `reasoning/dependency-analyzer.ts`   | interface        | **MISSING** |
| `getReadyTasks`      | `reasoning/dependency-analyzer.ts`   | function         | **MISSING** |
| `CoderXContextInput` | `core/coderx-context.ts`             | interface        | **MISSING** |
| `WorkingMemoryEntry` | `memory/working-memory.ts`           | interface        | **MISSING** |
| `ExecutionSnapshot`  | `memory/execution-history.ts`        | interface        | **MISSING** |
| `RetryHistoryEntry`  | `memory/execution-history.ts`        | interface        | **MISSING** |
