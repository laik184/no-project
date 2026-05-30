---
name: Company Brain completion
description: Key decisions and contracts from the memory platform gap-fix session — hydration, recall, graph wiring.
---

## Critical contract: recall() returns RankedResult, not MemoryEntry

`memoryEngine.recall()` returns `RecallResult` where `results: RankedResult<T>[]`.
Each `RankedResult` has `{ entry: T, relevance: number, matchedTerms: string[], retrievalMode }`.
**Always map `.map(r => r.entry)` before using results as `MemoryEntry[]`.**
Failing to do this causes TS2345 and silent type mismatches.

## Critical contract: TaskKind has no 'tool' value

`TaskKind = 'terminal' | 'filesystem' | 'coding' | 'verify' | 'browser'`
When deserialising stored ExecutionHistoryEntry or FailurePattern kind fields, always validate with a Set and fall back to `'coding'`, never `'tool'`.

## Critical contract: CoderX logger has no generic info/warn

`coderxLogger` only has specific event methods (`agentStarted`, `agentCompleted`, `agentFailed`, `planBuilt`, `stepFailed`, `stuckStep`, `repeatedFailure`). No generic `info()/warn()`. Use `console.log`/`console.warn` with `[coderx-agent]` prefix for memory recall logging.

## Hydration lifecycle

`bootstrapMemory()` → `runStartupHydration()` (fire-and-forget, after store registration).
Hydration reads from memory platform → injects via `hydrate()` on each in-process executor store.
`hydrate()` is idempotent (skips if store already populated).
Cold start = "no prior data" message (not an error).

## Memory context builder usage

`buildMemoryContext(topic, opts)` — always await, always `.catch(() => null)`.
Returns `MemoryContext` with `entries: MemoryEntry[]` (already extracted), `graphEntities`, `summary`, `totalFound`, `hasGraphData`, `durationMs`.
All 4 agents (Planner, Executor, Verifier, CoderX) now call this before their main logic.

## Dormant stores (business, feedback, revenue, prediction)

These are `BaseMemoryStore` subclasses — auto-load from `.data/memory/<category>/store.json` on construction.
No hydration required. No agent writes to them yet (not a bug — no domain data source exists).
When a future agent needs to write to them, use their `.record()` method (not `.create()`).

**Why:** record() adds domain-specific fields with correct typing; create() bypasses them through the base class contravariance.
