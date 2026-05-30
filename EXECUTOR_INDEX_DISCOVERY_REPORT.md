# EXECUTOR_INDEX_DISCOVERY_REPORT.md

## File
`server/agents/executor/index.ts`

---

## File Path
`server/agents/executor/index.ts`

## Export Count (pre-fix)
- Named function/value exports: **15**
- Type exports: **18**
- Total: **33**

---

## Current Exports

### Agent Entry Point (`./executor-agent.ts`)
| Export | Kind |
|--------|------|
| `initializeExecutor` | function |
| `shutdownExecutor` | function |
| `runExecutorAgent` | function |
| `getExecutorDiagnostics` | function |

### Types (`./types/executor.types.ts`)
| Export | Kind |
|--------|------|
| `TaskKind` | type |
| `ExecutionStepStatus` | type |
| `ExecutionSessionStatus` | type |
| `ExecutionTask` | interface |
| `ExecutionPlan` | interface |
| `ExecutionStep` | interface |
| `RuntimeStep` | interface |
| `ExecutorExecutionContext` | interface |
| `ExecutorSession` | interface |
| `ExecutorAgentInput` | interface |
| `ExecutorAgentResult` | interface |
| `TaskOutput` | interface |
| `ExecutorLoopOptions` | interface |
| `ExecutorRetryConfig` | interface |
| `RoutedStep` | interface |
| `ExecutionFailureRecord` | interface |
| `BuiltExecutionPlan` | interface |
| `ExecutionMonitorSnapshot` | interface |

### Retry (`./execution/retry-manager.ts`)
| Export | Kind |
|--------|------|
| `DEFAULT_RETRY_CONFIG` | const |

### Planning (`./planning/execution-planner.ts`, `./planning/tool-selection.ts`)
| Export | Kind |
|--------|------|
| `planExecution` | function |
| `selectTool` | function |
| `listToolsForKind` | function |
| `defaultToolForKind` | function |

### Telemetry & Monitoring
| Export | Kind | Source |
|--------|------|--------|
| `executorLogger` | singleton | `./telemetry/executor-logger.ts` |
| `executorMetrics` | singleton | `./telemetry/executor-metrics.ts` |
| `failureMonitor` | singleton | `./monitoring/failure-monitor.ts` |
| `executionMonitor` | singleton | `./monitoring/execution-monitor.ts` |

### Context (`./core/executor-context.ts`)
| Export | Kind |
|--------|------|
| `buildExecutorContext` | function |
| `toToolContext` | function |

---

## Module File Tree

```
server/agents/executor/
├── index.ts                           ← barrel (this file)
├── executor-agent.ts                  ← agent entry (exported)
├── types/
│   └── executor.types.ts              ← type contracts (exported)
├── execution/
│   ├── retry-manager.ts               ← partially exported (DEFAULT_RETRY_CONFIG only)
│   ├── execution-loop.ts              ← INTERNAL
│   ├── parallel-executor.ts           ← INTERNAL
│   ├── step-runner.ts                 ← INTERNAL
│   └── task-executor.ts               ← INTERNAL
├── planning/
│   ├── execution-planner.ts           ← partially exported (PlannerResult missing)
│   ├── execution-plan-builder.ts      ← INTERNAL
│   └── tool-selection.ts              ← exported
├── telemetry/
│   ├── executor-logger.ts             ← exported
│   ├── executor-metrics.ts            ← exported
│   ├── adaptation-tracer.ts           ← INTERNAL
│   ├── execution-timeline.ts          ← INTERNAL
│   ├── learning-insights.ts           ← INTERNAL
│   ├── runtime-visualizer.ts          ← INTERNAL
│   └── workflow-tracer.ts             ← INTERNAL
├── monitoring/
│   ├── failure-monitor.ts             ← exported
│   └── execution-monitor.ts           ← exported
├── memory/
│   ├── execution-history.ts           ← PUBLIC (used by memory bootstrap) — MISSING from index
│   ├── failure-memory.ts              ← PUBLIC (used by memory bootstrap) — MISSING from index
│   └── working-memory.ts              ← INTERNAL (no external consumer)
├── learning/
│   └── learning-store.ts              ← PUBLIC (used by memory bootstrap) — MISSING from index
├── core/
│   ├── executor-context.ts            ← partially exported (ExecutorContextInput missing)
│   ├── executor-session.ts            ← INTERNAL
│   └── executor-state.ts              ← INTERNAL
├── coordination/
│   ├── dispatcher-client.ts           ← INTERNAL
│   └── tool-coordinator.ts            ← INTERNAL
├── reasoning/
│   ├── decision-engine.ts             ← INTERNAL
│   └── task-analyzer.ts               ← INTERNAL
├── recovery/
│   ├── recovery-engine.ts             ← INTERNAL
│   ├── rollback-manager.ts            ← INTERNAL
│   └── self-healing-loop.ts           ← INTERNAL
├── runtime/
│   └── execution-state-machine.ts     ← INTERNAL
├── validation/
│   ├── execution-validator.ts         ← INTERNAL
│   ├── integrity-validator.ts         ← INTERNAL
│   ├── response-validator.ts          ← INTERNAL
│   └── tool-validator.ts              ← INTERNAL
└── utils/
    └── execution-utils.ts             ← INTERNAL
```
