# CODERX_PUBLIC_API_AUDIT.md

## Audit: Public Entry Point

| Criterion                                   | Status | Evidence                                                     |
|---------------------------------------------|--------|--------------------------------------------------------------|
| Public Entry Point exists                   | ✓      | `server/agents/coderx/index.ts` exists with barrel header comment |
| Public API is clearly defined               | ✓      | Sections: agent, types, planning, reasoning, telemetry, memory, context |
| Internal implementation is hidden           | ✓      | `coordination/`, `validation/`, `core/coderx-session.ts`, `core/coderx-state.ts`, `execution/coding-loop.ts` not exposed |
| Consumers can import from `server/agents/coderx` | ✓ | All public symbols reachable via index |

---

## Public API Surface

### Agent Lifecycle
```typescript
import { initializeCoderX, shutdownCoderX, runCoderXAgent, getCoderXDiagnostics }
  from 'server/agents/coderx';
```

### Planning
```typescript
import { buildCodingPlan, buildImplementationPlan, buildExecutionPlan }
  from 'server/agents/coderx';
```

### Reasoning
```typescript
import { analyzeCodingTask, buildDependencyGraph, decide, shouldAbortPlan }
  from 'server/agents/coderx';
```

### Telemetry & Monitoring
```typescript
import { coderxLogger, coderxMetrics, failureMonitor, executionMonitor }
  from 'server/agents/coderx';
```

### Memory
```typescript
import { workingMemory, executionHistory }
  from 'server/agents/coderx';
```

### Context
```typescript
import { buildCoderXContext, toToolContext }
  from 'server/agents/coderx';
```

### Types
```typescript
import type {
  CodingRequest, CodingPlan, CodingTask, CodingStep, CoderXAgentInput,
  CoderXAgentResult, CoderXExecutionContext, /* ... 23 total */
} from 'server/agents/coderx';
```

---

## Hidden Internals (correct)

| File                              | Reason hidden                                          |
|-----------------------------------|--------------------------------------------------------|
| `coordination/dispatcher-client.ts` | Internal tool dispatch — implementation detail       |
| `coordination/coding-routing.ts`  | Internal routing — not a public concern               |
| `coordination/tool-coordinator.ts`| Internal task-to-tool mapping                         |
| `core/coderx-session.ts`          | Internal session lifecycle registry                   |
| `core/coderx-state.ts`            | Internal step state machine registry                  |
| `execution/coding-loop.ts`        | Internal agent loop — not callable externally          |
| `execution/step-runner.ts`        | Internal step execution                               |
| `execution/task-executor.ts`      | Internal task execution                               |
| `validation/*.ts`                 | Internal validation called inside the agent           |
| `utils/coding-utils.ts`           | Internal utility functions                            |

---

## Missing Public Exports (violations)

These are **return types or input types** of functions that ARE exported from the index.
Without them, consumers cannot properly type their code.

| Missing Export          | Source File                          | Reason Needed                                         |
|-------------------------|--------------------------------------|-------------------------------------------------------|
| `BuiltCodingPlan`       | `planning/execution-plan-builder.ts` | Return type of exported `buildExecutionPlan`          |
| `DependencyGraph`       | `reasoning/dependency-analyzer.ts`   | Return type of exported `buildDependencyGraph`        |
| `getReadyTasks`         | `reasoning/dependency-analyzer.ts`   | Public companion function to `buildDependencyGraph`   |
| `CoderXContextInput`    | `core/coderx-context.ts`             | Input type of exported `buildCoderXContext`           |
| `WorkingMemoryEntry`    | `memory/working-memory.ts`           | Type returned by exported `workingMemory` operations  |
| `ExecutionSnapshot`     | `memory/execution-history.ts`        | Type returned by exported `executionHistory`          |
| `RetryHistoryEntry`     | `memory/execution-history.ts`        | Type returned by exported `executionHistory`          |
