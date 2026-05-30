---
name: Write-through memory pattern
description: Why executor's synchronous stores use write-through to server/memory/ rather than full async migration.
---

## Rule
Executor's 3 cross-run intelligence stores use write-through persistence: the local in-process store
is kept for fast synchronous reads; `memoryEngine.store().catch(console.error)` is added
fire-and-forget on every write.

Modules using this pattern:
- `server/agents/executor/memory/execution-history.ts` → category `execution`, fires in `recordExecution()`
- `server/agents/executor/memory/failure-memory.ts` → category `bug`, fires in `recordFailurePattern()`
- `server/agents/executor/learning/learning-store.ts` → category `learning`, fires in `upsert()`

**Why:** All three stores have synchronous APIs used in the execution hot-path:
- `learningStore.getValue()` is called per task in `tool-selection-engine` during routing
- `failureMemory.isRetryStorm()` is called per failure in `decision-engine.decide()`
- `executionHistory.hasPriorFix()` is called per repair decision in `decision-engine`

Making them async would require refactoring 18+ call sites across 5 agent subsystems.
The write-through pattern achieves "server/memory/ is the only persistent store" with zero hot-path
impact and zero caller changes.

**How to apply:** Any new cross-run in-process store should follow this pattern. Steps:
1. Import only `memoryEngine` from `server/memory/core/memory-engine.ts` (never sub-modules)
2. Add `.catch(console.error)` — never await, never block
3. Choose the right category: `execution`, `bug`, `learning`, `plan`, `code`, `verify`, `browser`, `task`, `chat`, `sandbox`
4. Keep the local store as a fast cache — do NOT remove it

**Deleted orphan:** `server/agents/executor/memory/context-window-manager.ts` had zero importers
after the executor 5-way split and was safely deleted.
