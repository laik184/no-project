# EXECUTOR ↔ TOOLS: PUBLIC API EXPOSURE REPORT
> Deep Scan: tool-dispatcher.ts vs tools/index.ts
> Target: server/agents/executor/executor-agent.ts
> Generated: 2026-05-31

---

## TL;DR — Quick Answer

| Question | Answer |
|---|---|
| `executor-agent.ts` ko tools import karna chahiye? | **NAHI** — aur karta bhi nahi. Sahi hai. |
| Executor mein tools kahan se import hote hain? | `executor/coordination/dispatcher-client.ts` se |
| Woh kisse import karta hai? | `tool-dispatcher.ts` se DIRECTLY |
| `tools/index.ts` use hota hai executor mein? | **KABHI NAHI** — zero references |
| Kya change karna chahiye? | **Kuch nahi** — architecture correct hai |

---

## PART 1 — tool-dispatcher.ts Deep Scan

**File:** `server/tools/registry/tool-dispatcher.ts`

**Kya hai yeh file?**
Yeh THE single execution pipeline hai — har tool invocation is ek file se guzarta hai. Koi tool directly call nahi hota. Sab kuch yahan se.

**Public Exports (4 total):**

| # | Export | Type | Purpose |
|---|---|---|---|
| 1 | `dispatch<TInput, TOutput>` | `async function` | **Core** — ek tool by name execute karo |
| 2 | `dispatchAll<TOutput>` | `async function` | Multiple tools parallel mein execute karo |
| 3 | `dispatchSequential<TOutput>` | `async function` | Multiple tools sequence mein — first failure pe ruk jao |
| 4 | `DispatchOptions` | `interface` | `{ timeoutMs?, retry? }` — optional dispatch config |

**Internal-only (NOT exported):**
- `withTimeout()` — timeout wrapper
- `withRetry()` — retry + backoff engine
- `classifyError()` — error → ToolErrorCode
- `categoryOf()` — tool name → category

**`dispatch()` kya karta hai internally:**
```
dispatch(name, input, context, opts)
  ├── 1. resolveToolWithPermissions()   → permission check
  ├── 2. withRetry + withTimeout         → execution with safety nets
  ├── 3. definition.handler()            → actual tool function call
  ├── 4. recordMetric()                  → metrics (Fix #3)
  ├── 5. recordAudit()                   → audit log (Fix #4)
  └── returns ToolExecutionResult<TOutput>  — never throws
```

**Signature detail:**
```typescript
dispatch<TInput, TOutput>(
  name:    string,              // tool name e.g. "filesystem_read_file"
  input:   TInput,              // tool-specific input
  context: ToolExecutionContext, // { runId, projectId, sandboxRoot, permissions }
  opts:    DispatchOptions = {} // { timeoutMs?, retry? }
): Promise<ToolExecutionResult<TOutput>>
// ToolExecutionResult = { ok: true, data, durationMs } | { ok: false, error, code, durationMs }
```

---

## PART 2 — tools/index.ts Deep Scan

**File:** `server/tools/index.ts`

**Kya hai yeh file?**
Top-level **public barrel** — tools layer ka documented public API surface. Sab kuch ek jagah se re-export karta hai.

**Total exports:** ~50+ symbols

**Kya-kya export karta hai:**

| Group | Symbols | True Source |
|---|---|---|
| **Registry** | `dispatch`, `dispatchAll`, `dispatchSequential`, `DispatchOptions` | `registry/tool-dispatcher.ts` |
| **Registry** | `registerTool`, `getTool`, `listTools`, `sealRegistry`, etc. | `registry/tool-registry.ts` |
| **Registry** | `resolveTool`, `ToolNotFoundError`, `ToolPermissionError` | `registry/tool-resolver.ts` |
| **Registry** | `recordAudit`, `getAuditLog`, `auditStats` | `registry/tool-security.ts` |
| **Registry** | `recordMetric`, `getMetrics` | `registry/tool-metrics.ts` |
| **Registry** | `defineTool`, `defineCodingTool` | `registry/define-tool.ts` |
| **Types** | `ToolDefinition`, `ToolExecutionContext`, `ToolExecutionResult`, etc. | `registry/tool-types.ts` |
| **Shared** | `buildContext`, `buildSystemContext` | `shared/context-builder.ts` |
| **Shared** | `validateInput`, `applyDefaults` | `shared/input-validator.ts` |
| **Shared** | `ok`, `fail`, `isOk`, `isFail`, `unwrapOrThrow` | `shared/result-helpers.ts` |
| **Shared** | `toolsLogger` | `shared/logger.ts` |
| **String** | `toPascalCase`, `toCamelCase`, `toKebabCase`, `toSnakeCase`, `pluralize`, `capitalize`, `truncate` | `shared/string-utils.ts` |
| **Domains** | `registerFilesystemTools`, `registerTerminalTools`, etc. | Domain sub-barrels |
| **Codegen** | `CodingToolError`, `validateGeneratedCode`, etc. | `codegen/index.ts` |
| **Telemetry** | `getGlobalStats`, `getToolMetrics`, `getRecentAudit`, `getTopTools` | `telemetry/index.ts` |

**Relationship with tool-dispatcher.ts:**
```
tools/index.ts
  └── export * from './registry/index.ts'
        └── export { dispatch, dispatchAll, dispatchSequential }
              └── from './tool-dispatcher.ts'   ← actual implementation
```
`tools/index.ts` mein `dispatch` available hai, lekin yeh DIRECTLY `tool-dispatcher.ts` ka hi symbol hai, ek extra re-export layer ke saath.

---

## PART 3 — executor-agent.ts Complete Import Analysis

**File:** `server/agents/executor/executor-agent.ts`

**Current imports — complete list:**

```typescript
// Internal executor modules only
import type { ExecutorAgentInput, ExecutorAgentResult }  from './types/executor.types.ts'
import { buildExecutorContext }                           from './core/executor-context.ts'
import { createSession, startSession, ... }              from './core/executor-session.ts'
import { resetState }                                     from './core/executor-state.ts'
import { planExecution }                                  from './planning/execution-planner.ts'
import { runExecutionLoop }                               from './execution/execution-loop.ts'
import { assertAgentInput }                               from './validation/execution-validator.ts'
import { executorLogger }                                 from './telemetry/executor-logger.ts'
import { executorMetrics }                                from './telemetry/executor-metrics.ts'
import { failureMonitor }                                 from './monitoring/failure-monitor.ts'
import { executionMonitor }                               from './monitoring/execution-monitor.ts'
import { elapsedMs, toErrorMessage }                      from './utils/execution-utils.ts'
import { memoryEngine, buildMemoryContext }               from '../../memory/index.ts'
import { executionHistory }                               from './memory/execution-history.ts'
import { failureMemory }                                  from './memory/failure-memory.ts'
import { learningStore }                                  from './learning/learning-store.ts'
```

**`server/tools` se import: ZERO**

`executor-agent.ts` na `tool-dispatcher.ts` import karta hai, na `tools/index.ts`.

**Kyun? Kyunki executor-agent.ts tools directly call hi nahi karta.**

---

## PART 4 — Actual Tool Dispatch Path in Executor

Executor ka actual execution flow yeh hai:

```
executor-agent.ts
  → runExecutionLoop()        [execution/execution-loop.ts]
      → executeTask()         [execution/task-executor.ts]
          → runStep()         [execution/step-runner.ts]
              → routeStep()   [coordination/execution-routing.ts]
                  → executeTool()  [coordination/dispatcher-client.ts]  ← YAHAN tools import hota hai
                        ↓
                  tools/registry/tool-dispatcher.ts::dispatch()
                        ↓
                  actual tool handler()
```

**`executor/coordination/dispatcher-client.ts` — exact imports:**
```typescript
// Line 10:
import { dispatch, dispatchAll, dispatchSequential }
  from '../../../tools/registry/tool-dispatcher.ts';

// Line 12:
import type { DispatchOptions }
  from '../../../tools/registry/tool-dispatcher.ts';
```

---

## PART 5 — Kisse Import Karna Chahiye?

### Q: `executor-agent.ts` ko `tool-dispatcher.ts` ya `tools/index.ts` import karna chahiye?

**Answer: Dono NAHI — aur correctly dono import karta bhi nahi.**

**Reason:**
`executor-agent.ts` ek **pure orchestrator** hai. Uski responsibility sirf yeh hai:
1. Input validate karo
2. Context banao
3. Session manage karo
4. Plan banao
5. Execution loop call karo
6. Result return karo

Woh tools kabhi directly dispatch nahi karta. Yeh kaam `dispatcher-client.ts` ka hai.

---

### Q: `dispatcher-client.ts` ko `tool-dispatcher.ts` ya `tools/index.ts` se import karna chahiye?

**Answer: `tool-dispatcher.ts` se DIRECTLY — aur yahi sahi bhi hai.**

**Evidence — kyun `tool-dispatcher.ts` sahi hai:**

| Criterion | `tool-dispatcher.ts` (direct) | `tools/index.ts` (barrel) |
|---|---|---|
| Specificity | Sirf dispatch symbols milte hain (4) | ~50+ unrelated symbols bhi milte hain |
| Dependency surface | Minimal — sirf jo chahiye | Over-exposed — registry, string-utils, domain registrations sab |
| Circular risk | Zero — direct leaf file | Higher — barrel imports many sub-modules |
| Architectural clarity | "Main tools dispatcher se dispatch lete hain" — clear | "Main top-level tools barrel se import karta hoon" — vague |
| Tool → Agent violation risk | None | Barrel has more surface area, more risk |
| Current usage | CORRECT — already this way | NOT used — no executor file imports this |

**Architectural rule confirmed:**
```
// SAHI (current):
import { dispatch } from '../../../tools/registry/tool-dispatcher.ts';

// GALAT (nahi karna):
import { dispatch } from '../../../tools/index.ts';
// Kyun galat? Kyunki tools/index.ts ek public-facing barrel hai
// jo registry, string-utils, domain registrations sab export karta hai.
// Ek agent ko itni broad dependency nahi chahiye.
```

---

## PART 6 — Final Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│           server/agents/executor/                       │
│                                                         │
│  executor-agent.ts                                      │
│    ↓ (no tools import — pure orchestrator)              │
│  execution/execution-loop.ts                            │
│    ↓                                                    │
│  execution/task-executor.ts                             │
│    ↓                                                    │
│  execution/step-runner.ts                               │
│    ↓                                                    │
│  coordination/execution-routing.ts                      │
│    ↓                                                    │
│  coordination/dispatcher-client.ts                      │
│    ↓ imports from ────────────────────────────────────┐ │
└─────────────────────────────────────────────────────── │─┘
                                                         │
                                          DIRECT IMPORT  │
                                                         ▼
┌─────────────────────────────────────────────────────────┐
│  server/tools/registry/tool-dispatcher.ts               │
│                                                         │
│  Exports:                                               │
│    dispatch()          ← executeTool() wraps this       │
│    dispatchAll()       ← executeAll() wraps this        │
│    dispatchSequential()← executeSequential() wraps this │
│    DispatchOptions     ← type used by dispatcher-client │
└─────────────────────────────────────────────────────────┘
          ↑
          │  NOT used by executor anywhere
┌─────────────────────────────────────────────────────────┐
│  server/tools/index.ts  (top-level barrel)              │
│                                                         │
│  Re-exports dispatch + 50 other symbols                 │
│  Zero consumers in executor layer                       │
│  Zero consumers anywhere (per prior audit)              │
└─────────────────────────────────────────────────────────┘
```

---

## PART 7 — Summary Verdict

| File | Executor Use Karta Hai? | Karna Chahiye? | Current Status |
|---|---|---|---|
| `tool-dispatcher.ts` | YES — via `dispatcher-client.ts` | YES — correct path | ✅ CORRECT |
| `tools/index.ts` | NO — zero imports | NO | ✅ CORRECT |
| `executor-agent.ts` tools import | NO | NO — pure orchestrator | ✅ CORRECT |

**Koi change ki zaroorat nahi. Architecture sahi hai.**

`tool-dispatcher.ts` = executor ka actual tool API  
`tools/index.ts` = forward-looking public surface, executor ke liye nahi
