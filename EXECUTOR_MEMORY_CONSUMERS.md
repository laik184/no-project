# EXECUTOR MEMORY CONSUMERS REPORT
> Phase 4 — Import Analysis
> Generated: 2026-05-31

---

## execution-history.ts — Consumers

**Total consumers: 14** (10 direct, 2 re-exports, 2 bootstrap)

| # | File Path | Import | Usage | Runtime Dependency |
|---|---|---|---|---|
| 1 | `server/agents/executor/executor-agent.ts` | `import { executionHistory } from './memory/execution-history.ts'` | `recordExecution()`, `recordSuccess()`, `recordFailure()`, `summary()` on every tool dispatch | CRITICAL — records every tool invocation outcome |
| 2 | `server/agents/executor/learning/failure-predictor.ts` | `import { executionHistory } from '../memory/execution-history.ts'` | `getExecutionHistory()`, `findSimilarFailure()` to build failure predictions | HIGH — drives ML-like pattern prediction |
| 3 | `server/agents/executor/learning/pattern-learner.ts` | `import { executionHistory } from '../memory/execution-history.ts'` | `getExecutionHistory()` to extract patterns and update learning store | HIGH — drives tool success/failure learning |
| 4 | `server/agents/executor/reasoning/decision-engine.ts` | `import { executionHistory } from '../memory/execution-history.ts'` | `findSimilarFailure()`, `hasPriorFix()`, `summary()` for routing decisions | CRITICAL — informs every decision branch |
| 5 | `server/agents/executor/recovery/recovery-engine.ts` | `import { executionHistory } from '../memory/execution-history.ts'` | `getByRun()`, `findSimilarFailure()` to build recovery strategies | CRITICAL — determines recovery path |
| 6 | `server/agents/executor/recovery/rollback-manager.ts` | `import { executionHistory } from '../memory/execution-history.ts'` | `getByRun()` to identify steps to roll back | HIGH — identifies rollback targets |
| 7 | `server/agents/coderx/coderx-agent.ts` | `import { executionHistory } from './memory/execution-history.ts'` | Records coderx tool outcomes | HIGH — coderx uses executor's history store |
| 8 | `server/agents/coderx/execution/retry-manager.ts` | `import { executionHistory } from '../memory/execution-history.ts'` | `findSimilarFailure()`, `hasPriorFix()` to decide retry strategy | HIGH — drives retry logic |
| 9 | `server/agents/coderx/execution/step-runner.ts` | `import { executionHistory } from '../memory/execution-history.ts'` | `recordSuccess()`, `recordFailure()` after each step | CRITICAL — records every coderx step |
| 10 | `server/agents/coderx/execution/task-executor.ts` | `import { executionHistory } from '../memory/execution-history.ts'` | `recordExecution()` for task-level outcomes | HIGH |
| 11 | `server/agents/executor/index.ts` | `export { executionHistory } from './memory/execution-history.ts'` | Re-export for external consumers | N/A (re-export) |
| 12 | `server/agents/coderx/index.ts` | `export { executionHistory } from './memory/execution-history.ts'` | Re-export (points to executor's memory) | N/A (re-export) |
| 13 | `server/memory/bootstrap/memory-hydrator.ts` | `import { executionHistory } from '../../agents/executor/index.ts'` | Calls `executionHistory.hydrate()` at startup | STARTUP — restores persisted entries |
| 14 | `server/memory/bootstrap/memory-loader.ts` | (imports types only, loads data from memoryEngine) | `loadExecutionHistory()` reads platform, produces entries for hydrator | STARTUP |

**Synchronous dependency count: 10** — all read the in-process buffer synchronously. Making this store async would require refactoring all 10 callers.

---

## failure-memory.ts — Consumers

**Total consumers: 9** (6 direct, 1 re-export, 2 bootstrap)

| # | File Path | Import | Usage | Runtime Dependency |
|---|---|---|---|---|
| 1 | `server/agents/executor/executor-agent.ts` | `import { failureMemory } from './memory/failure-memory.ts'` | `analyze()`, `isRetryStorm()` on every tool failure | CRITICAL — gates retry vs. abort decisions |
| 2 | `server/agents/executor/learning/failure-predictor.ts` | `import { failureMemory } from '../memory/failure-memory.ts'` | `chroniclePatterns()`, `allPatterns()` to train predictor | HIGH |
| 3 | `server/agents/executor/learning/pattern-learner.ts` | `import { failureMemory } from '../memory/failure-memory.ts'` | `allPatterns()` to extract learnable signals | HIGH |
| 4 | `server/agents/executor/reasoning/decision-engine.ts` | `import { failureMemory } from '../memory/failure-memory.ts'` | `hasSeenFailure()`, `getFailureFrequency()`, `isRetryStorm()` | CRITICAL — used in every decision cycle |
| 5 | `server/agents/executor/recovery/recovery-engine.ts` | `import { failureMemory } from '../memory/failure-memory.ts'` | `analyze()`, `chroniclePatterns()` to select recovery strategy | CRITICAL |
| 6 | `server/agents/executor/index.ts` | `export { failureMemory } from './memory/failure-memory.ts'` | Re-export | N/A |
| 7 | `server/memory/bootstrap/memory-hydrator.ts` | `import { failureMemory } from '../../agents/executor/index.ts'` | Calls `failureMemory.hydrate()` at startup | STARTUP |
| 8 | `server/memory/bootstrap/memory-loader.ts` | (types only, loads from memoryEngine) | `loadFailurePatterns()` reads platform, produces patterns for hydrator | STARTUP |

**Synchronous dependency count: 6** — all read/write the in-process Map synchronously.

---

## working-memory.ts — Consumers

**Total consumers: 7** (6 direct, 1 type re-export)

| # | File Path | Import | Usage | Runtime Dependency |
|---|---|---|---|---|
| 1 | `server/agents/executor/recovery/rollback-manager.ts` | `import { workingMemory } from '../memory/working-memory.ts'` | `get()`, `restore()`, `update()` — restores workflow state during rollback | CRITICAL — rollback reads working state to undo steps |
| 2 | `server/agents/executor/recovery/self-healing-loop.ts` | `import { workingMemory } from '../memory/working-memory.ts'` | `get()`, `update()`, `snapshot()` — monitors and heals live run state | CRITICAL — reads browser/validation state to detect loops |
| 3 | `server/agents/executor/telemetry/runtime-visualizer.ts` | `import { workingMemory } from '../memory/working-memory.ts'` | `get()`, `allRunIds()` — builds live dashboard of running agents | MEDIUM — non-blocking telemetry |
| 4 | `server/agents/coderx/coderx-agent.ts` | `import { workingMemory } from './memory/working-memory.ts'` | `init()`, `update()`, `clear()` — manages CoderX run lifecycle | CRITICAL — owns CoderX run slot |
| 5 | `server/agents/coderx/execution/coding-loop.ts` | `import { workingMemory } from '../memory/working-memory.ts'` | `get()`, `update()`, `snapshot()`, `incrementRetry()` | CRITICAL — used every coding iteration |
| 6 | `server/agents/coderx/execution/task-executor.ts` | `import { workingMemory } from '../memory/working-memory.ts'` | `init()`, `update()`, `recordFileModified()`, `recordToolOutput()` | CRITICAL — records all task state |
| 7 | `server/agents/executor/index.ts` | (types only exported) | WorkingMemorySlot and related interfaces | N/A |

**Note:** CoderX consumers at lines 4-6 import via the relative path `./memory/working-memory.ts` from within the coderx agent directory. Per the grep results, these resolve to the executor's working-memory module (the coderx directory contains its own separate `working-memory.ts` for CoderX-specific state). The executor's `working-memory.ts` is the shared runtime state store.

---

## Consumer Count Summary

| File | Direct Callers | Re-exports | Bootstrap | Total |
|---|---|---|---|---|
| `execution-history.ts` | 10 | 2 | 2 | 14 |
| `failure-memory.ts` | 6 | 1 | 2 | 9 |
| `working-memory.ts` | 6 | 1 | 0 | 7 |

**Combined: 30 import references across the codebase.** Any migration that breaks these imports would cascade across the executor, coderx, and memory bootstrap subsystems.
