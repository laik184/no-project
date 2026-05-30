---
name: Memory runtime gaps
description: Confirmed gaps in nura-x memory platform, repairs applied in Phase 9, and remaining known gaps.
---

## Confirmed Gaps (found by full audit, 2026-05-30)

### GAP 1 (REPAIRED): Zero agent reads from memoryEngine
All 7 agents wrote fire-and-forget but never read back. Memory was a write-only journal.
**Repair**: Added `_recallPlanningMemory()` to `planner-agent.ts` — reads decision/bug/reflection before planning loop. Results in `meta.memory.*`.

### GAP 2 (REPAIRED): reflectionEngine.reflect() never called
Complete internal loop (bugStore → lessonExtractor → reflectionStore) but no trigger.
**Repair**: Added 5-minute `setInterval` in `bootstrapMemory()` (unref'd). Logs when new reflections are created.

### GAP 3 (REPAIRED): graphBuilder.ingest() never called
Knowledge graph had zero entities despite full BFS/DFS infrastructure.
**Repair**: Added `try { graphBuilder.ingest(entry); } catch {}` inside `memoryEngine.store()` — every write now auto-populates graph.

### GAP 4 (REPAIRED): retrievalEngine never used
Full hybrid/vector/semantic pipeline idle. memoryEngine.search() used basic keyword only.
**Repair**: Added `memoryEngine.recall(text, options)` → delegates to `retrievalEngine.search({ mode: 'hybrid', ... })`. Never throws.

### GAP 5 (REPAIRED): Reflection engine breaks on generic entries
Agents write via generic `store()` — entries lack typed fields (`recurrence`, `success`, `errorType`, `rootCause`). `bugStore.topRecurring()` sorts by NaN; `executionStore.recentFailures()` returns all entries.
**Repair**: Two-pass strategy in `reflection-engine.ts` — Pass 1 = typed domain methods; Pass 2 = `list({ tags: ['failure'] })` with synthetic typed objects built from `meta` fields.

---

## Remaining Gaps (NOT repaired in Phase 9)

### REMAINING GAP 1 (CRITICAL): In-process store startup hydration missing
executor/learning/learning-store.ts, executor/memory/execution-history.ts, executor/memory/failure-memory.ts all start EMPTY on every server restart. Write-through persists to `.data/memory/` but nothing reads it back.
**Impact**: All learned tool reliability, failure patterns, strategy weights reset to defaults (0.5) after every restart. System re-learns from scratch.
**Fix required**: Add `hydrateFromPlatform()` to each store, called from bootstrapMemory(). Requires `_seed(entry)` method on each store to set absolute values bypassing delta mechanism. Key: `meta.kind`+`meta.key` hold the in-process schema fields.

### REMAINING GAP 2: Domain typed record() not accessible via memoryEngine
Agents can only call generic `store()`. Domain-typed `record()` methods (on ExecutionStore, BugStore, etc.) are unreachable without importing sub-modules (prohibited).
**Fix**: Add typed variants to MemoryEngine (e.g. `recordExecution(params)`) that delegate to domain store `record()` with proper typing.

### REMAINING GAP 3: 'checkpoint' MemoryCategory registered in type but not in bootstrap
`MemoryCategory` type includes `'checkpoint'` but no store is registered. Any `memoryEngine.store({ category: 'checkpoint' })` call THROWS. The checkpoint system uses its own parallel persistence (checkpoint-store.ts).

### REMAINING GAP 4: graphTraversal never queried by agents
Graph will now accumulate entities (after GAP 3 repair) but agents still don't query it. `graphTraversal.bfs()` and `.query()` are idle. Graph-aware planning context would add significant intelligence.

---

## Key Type Facts
- `BugEntry` fields: errorType, stackTrace?, rootCause, fix, recurrence, resolved (NO affectedRun)
- `ExecutionEntry` fields: runId, goal, agentType, toolsUsed, durationMs, success, errorSummary? (NO taskId)
- Generic entries from agents have `meta.runId`, `meta.agentSource`, `meta.errorSnippet`, `meta.occurrences` etc.

## Why
These gaps caused the memory platform to be write-only infrastructure — agents learned nothing from stored data. The repairs above close the most critical feedback loops.
