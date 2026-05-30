# CODERX_INDEX_DISCOVERY_REPORT.md

## File
`server/agents/coderx/index.ts`

---

## File Contents (verbatim structure)

```typescript
// Agent entry point
export { initializeCoderX, shutdownCoderX, runCoderXAgent, getCoderXDiagnostics }
  from './coderx-agent.ts';

// Types (20 types)
export type { CodingTaskKind, CodingStepStatus, CodingSessionStatus, CodingRequest,
  CodingTask, CodingPlan, CodingStep, RuntimeCodingStep, CoderXExecutionContext,
  CoderXSession, CoderXAgentInput, CoderXAgentResult, CodingTaskOutput,
  CoderXLoopOptions, CoderXRetryConfig, RoutedCodingStep, CodingFailureRecord,
  CoderXMonitorSnapshot, CodingTaskAnalysis, DecisionOutcome, DecisionResult,
  ImplementationPlan, ImplementationPhase }
  from './types/coderx.types.ts';

// Retry defaults
export { DEFAULT_RETRY_CONFIG } from './execution/retry-manager.ts';

// Planning (3 functions)
export { buildCodingPlan }         from './planning/code-planner.ts';
export { buildImplementationPlan } from './planning/implementation-planner.ts';
export { buildExecutionPlan }      from './planning/execution-plan-builder.ts';

// Reasoning (3 functions + 1 missing companion)
export { analyzeCodingTask }       from './reasoning/task-analyzer.ts';
export { buildDependencyGraph }    from './reasoning/dependency-analyzer.ts';
export { decide, shouldAbortPlan } from './reasoning/decision-engine.ts';

// Telemetry & monitoring (4 singletons)
export { coderxLogger }     from './telemetry/coderx-logger.ts';
export { coderxMetrics }    from './telemetry/coderx-metrics.ts';
export { failureMonitor }   from './monitoring/failure-monitor.ts';
export { executionMonitor } from './monitoring/execution-monitor.ts';

// Memory (2 singletons)
export { workingMemory }    from './memory/working-memory.ts';
export { executionHistory } from './memory/execution-history.ts';

// Context (2 functions)
export { buildCoderXContext, toToolContext } from './core/coderx-context.ts';
```

---

## Export Inventory

| Category          | Exports                                                               |
|-------------------|-----------------------------------------------------------------------|
| Functions         | `initializeCoderX`, `shutdownCoderX`, `runCoderXAgent`, `getCoderXDiagnostics`, `DEFAULT_RETRY_CONFIG`, `buildCodingPlan`, `buildImplementationPlan`, `buildExecutionPlan`, `analyzeCodingTask`, `buildDependencyGraph`, `decide`, `shouldAbortPlan`, `buildCoderXContext`, `toToolContext` |
| Singletons        | `coderxLogger`, `coderxMetrics`, `failureMonitor`, `executionMonitor`, `workingMemory`, `executionHistory` |
| Types (exported)  | 23 type/interface/enum exports from `coderx.types.ts`                |
| Re-exports        | None (all are direct named exports)                                   |
| Wildcards         | None                                                                  |
| Classes           | None (errors and classes in sub-modules not exposed)                  |

---

## Module File Tree

```
server/agents/coderx/
├── index.ts                         ← barrel (this file)
├── coderx-agent.ts                  ← agent entry point (exported)
├── types/
│   └── coderx.types.ts              ← type contracts (exported)
├── execution/
│   ├── retry-manager.ts             ← retry config (partially exported)
│   ├── coding-loop.ts               ← INTERNAL
│   ├── step-runner.ts               ← INTERNAL
│   └── task-executor.ts             ← INTERNAL
├── planning/
│   ├── code-planner.ts              ← exported
│   ├── implementation-planner.ts    ← exported
│   └── execution-plan-builder.ts    ← partially exported (type missing)
├── reasoning/
│   ├── task-analyzer.ts             ← exported
│   ├── dependency-analyzer.ts       ← partially exported (companion + type missing)
│   └── decision-engine.ts           ← exported
├── telemetry/
│   ├── coderx-logger.ts             ← exported
│   └── coderx-metrics.ts            ← exported
├── monitoring/
│   ├── failure-monitor.ts           ← exported
│   └── execution-monitor.ts         ← exported
├── memory/
│   ├── working-memory.ts            ← partially exported (type missing)
│   └── execution-history.ts         ← partially exported (types missing)
├── core/
│   ├── coderx-context.ts            ← partially exported (input type + error missing)
│   ├── coderx-session.ts            ← INTERNAL
│   └── coderx-state.ts              ← INTERNAL
├── coordination/
│   ├── coding-routing.ts            ← INTERNAL
│   ├── dispatcher-client.ts         ← INTERNAL
│   └── tool-coordinator.ts          ← INTERNAL
├── validation/
│   ├── coding-validator.ts          ← INTERNAL
│   ├── integrity-validator.ts       ← INTERNAL
│   └── response-validator.ts        ← INTERNAL
└── utils/
    ├── utils.ts                     ← INTERNAL (re-export shim)
    └── utils/coding-utils.ts        ← INTERNAL
```
