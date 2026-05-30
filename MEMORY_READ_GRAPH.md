# MEMORY READ GRAPH (Phase 4)
Audit date: 2026-05-30

---

## CRITICAL FINDING

**No agent reads from memoryEngine.**

Every agent in the system writes to memory (fire-and-forget). Zero agents read back from memory
before making decisions. The memory platform is currently a **write-only journal** from the
agent layer's perspective.

---

## Verified Read Paths (inside memory/ itself)

### reflectionEngine.reflect() → reads bugStore + executionStore
```
reflectionEngine.reflect()
  ├─ bugStore.topRecurring(20)      → reads BugEntry[]  ✓
  └─ executionStore.recentFailures(20) → reads ExecutionEntry[]  ✓
```
**STATUS**: INTERNAL READ PATH EXISTS but reflectionEngine.reflect() is NEVER CALLED.

### checkpointManager.rollback(id) → reads all stores
```
checkpointManager.rollback(checkpointId)
  └─ memoryRegistry.all() → for each store: store.clear() + store.create()
```
**STATUS**: Rollback path exists but no agent calls it.

---

## Agent Read Paths — ALL ABSENT

### planner-agent.ts
- Reads from memory: **NONE**
- Does NOT query past decisions before planning
- Does NOT query known bugs before planning
- Does NOT query reflection lessons before planning
- Plans from scratch every run — ignores all historical intelligence

### executor-agent.ts
- Reads from memory via memoryEngine: **NONE**
- DOES read from in-process stores (synchronous):
  - `executionHistory.findSimilarFailure()` — reads in-process array
  - `failureMemory.analyze()` — reads in-process Map
  - `learningStore.getValue()` — reads in-process Map (hot-path)
- These in-process reads are backed by write-through persistence BUT are not reloaded from platform on restart → data lost between server restarts

### verifier-agent.ts
- Reads from memory: **NONE**
- Verifies fresh every run with no knowledge of past failures

### browser-agent.ts
- Reads from memory: **NONE**
- No knowledge of past browser reliability patterns at planning time

### supervisor-agent.ts
- Reads from memory: **NONE**

### coderx-agent.ts
- Reads from memory: **NONE**

### chat-orchestrator.ts
- Reads from memory: **NONE**
- Does NOT load past conversation context from memory platform
- Conversation context loaded via `contextLoader.loadForRun()` which reads from Drizzle DB (different tier)

---

## In-Process Reads (bypassing memoryEngine)

These reads are synchronous and work within the same process session:

```
executor/learning/tool-selection-engine.ts
  → learningStore.getValue('tool-reliability', ...)  SYNC READ ✓
  → learningStore.byKind('tool-reliability')         SYNC READ ✓

executor/reasoning/decision-engine.ts
  → failureMemory.analyze(...)                       SYNC READ ✓
  → executionHistory.hasPriorFix(...)                SYNC READ ✓
  → executionHistory.findSimilarFailure(...)         SYNC READ ✓

executor/learning/failure-predictor.ts
  → executionHistory.summary()                       SYNC READ ✓
  → failureMemory.isRetryStorm()                     SYNC READ ✓

agents/planner/learning/workflow-learning-engine.ts
  → learningStore.getValue('workflow-risk', ...)     SYNC READ ✓
  → learningStore.get('execution-quality', ...)      SYNC READ ✓
```

**CRITICAL GAP**: All these reads are from in-process Maps/arrays. On server restart,
these stores start EMPTY. The write-through to server/memory/ persists the data but
there is NO startup hydration path — no code reads from the platform back into these
in-process stores on boot. Intelligence earned across many runs is **lost on every restart**.

---

## Read Gap Summary

| Agent | Memory Reads | Gap Severity |
|-------|-------------|-------------|
| planner | ZERO | CRITICAL — plans blind every run |
| executor (hot path) | In-process only, ephemeral | HIGH — learning resets on restart |
| verifier | ZERO | HIGH — verifies blind every run |
| browser | ZERO | MEDIUM |
| supervisor | ZERO | MEDIUM |
| coderx | ZERO | HIGH |
| chat | ZERO (uses DB tier) | MEDIUM |
| reflectionEngine | Internal reads only, never triggered | CRITICAL |

---

## What Was Added in Phase 9 (Repairs)

After Phase 9 repairs, the following read paths are added:

### planner-agent.ts (REPAIRED)
```
plan(req) → before runPlanningLoop()
  ├─ memoryEngine.searchCategory('decision', goal, 3)    ASYNC READ ✓
  ├─ memoryEngine.searchCategory('bug', 'failure', 5)    ASYNC READ ✓
  └─ memoryEngine.searchCategory('reflection', goal, 3)  ASYNC READ ✓
→ injected into planning meta as meta.memory.*
```

### memoryEngine.recall() (ADDED)
```
memoryEngine.recall(text, options)
  → retrievalEngine.search({ text, mode: 'hybrid', ... })
  → multi-store, hybrid scoring, reranked results
  ← SearchResult with ranked entries
```
Now agents can call `memoryEngine.recall(goal)` to get semantically relevant memories.
