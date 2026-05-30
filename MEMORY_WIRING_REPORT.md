# MEMORY WIRING REPORT (Phase 8)
Audit date: 2026-05-30

---

## Wiring Scope

Three local memory subsystems:
1. `server/agents/executor/memory/` — execution-history, failure-memory, working-memory
2. `server/agents/executor/learning/` — learning-store, tool-selection, strategy-optimizer, etc.
3. `server/agents/coderx/memory/` — execution-history, working-memory

---

## 1. executor/memory/ ↔ server/memory/

### execution-history.ts

**Write-through (after Phase 6)**:
```
recordExecution(params) 
  → _history.push(entry)         ← in-process write ✓
  → memoryEngine.store('execution', { runId, taskId, toolName, kind, outcome, ... })
       .catch(console.error)      ← W-T to platform ✓
```
**Read from platform**: ✗ MISSING
- `_history` starts empty every restart
- `findSimilarFailure()`, `hasPriorFix()`, `summary()` all return empty on cold start
- `.data/memory/execution/store.json` has the data but nothing reads it back

**Wiring status**: ONE-WAY (write only) → TO platform

---

### failure-memory.ts

**Write-through (after Phase 6)**:
```
recordFailurePattern(runId, toolName, kind, error)
  → _patterns.set(sig, pattern)   ← in-process write ✓
  → memoryEngine.store('bug', { signature, toolName, occurrences, ... })
       .catch(console.error)       ← W-T to platform ✓
```
**Read from platform**: ✗ MISSING
- `_patterns` starts empty every restart
- `isRetryStorm()`, `chroniclePatterns()`, `hasSeenFailure()` return empty on cold start
- Storm detection works within a session but resets on restart

**Wiring status**: ONE-WAY (write only) → TO platform

---

### working-memory.ts

**Write-through**: ✗ INTENTIONALLY ABSENT (RUNTIME_STATE — per-run, correctly protected)
**Read from platform**: ✗ INTENTIONALLY ABSENT
**Wiring status**: ISOLATED (correct)

---

## 2. executor/learning/ ↔ server/memory/

### learning-store.ts (executor in-process)

**Write-through (after Phase 6)**:
```
upsert(kind, key, delta, metadata)
  → _store.set(ck, entry)          ← in-process write ✓
  → memoryEngine.store('learning', { kind, key, value, evidence, version })
       .catch(console.error)        ← W-T to platform ✓
```
**Read from platform**: ✗ MISSING
- `_store` starts empty every restart
- All learned tool reliability, strategy weights, workflow risk = reset to 0.5 (default) on cold start
- Multi-week learning completely lost between server restarts

**Schema note**: in-process `LearnedEntry` (numeric value/evidence) ≠ platform `LearningEntry` (lesson/domain/appliedFrom). 
The hydration path must parse `meta.kind`+`meta.key` from platform entries and reconstruct `LearnedEntry` objects.

**Wiring status**: ONE-WAY (write only) → TO platform

---

### tool-selection-engine.ts

**Reads from**: `learningStore` (in-process, synchronous) — NOT memoryEngine
**Writes to**: `learningStore.upsert()` → triggers write-through
**Wiring status**: IN-PROCESS ONLY (hot-path requires sync — acceptable)

---

### workflow-learning-engine.ts (planner)

**Reads from**: `learningStore` (executor's in-process store, synchronous)
**Writes to**: `learningStore.upsert()` → triggers write-through
**Note**: Planner imports executor's learning-store directly — cross-agent dependency
**Wiring status**: IN-PROCESS ONLY

---

## 3. coderx/memory/ ↔ server/memory/

### coderx/memory/execution-history.ts

**Write-through**: ✗ ABSENT
**Reason**: PER-RUN store (has `clearRun()`). Per-run data is runtime state, not long-term memory.
**Assessment**: CORRECTLY isolated. No migration needed.

### coderx/memory/working-memory.ts

**Write-through**: ✗ ABSENT (RUNTIME_STATE — correctly protected)

---

## Wiring Summary

| Module | Write → Platform | Read ← Platform | Classification |
|--------|-----------------|-----------------|----------------|
| executor/memory/execution-history | ✓ W-T | ✗ MISSING | ONE-WAY |
| executor/memory/failure-memory | ✓ W-T | ✗ MISSING | ONE-WAY |
| executor/memory/working-memory | ✗ (correct) | ✗ (correct) | ISOLATED |
| executor/learning/learning-store | ✓ W-T | ✗ MISSING | ONE-WAY |
| executor/learning/tool-selection | ✗ (in-process) | ✗ (in-process) | IN-PROCESS |
| coderx/memory/execution-history | ✗ (per-run) | ✗ (per-run) | CORRECTLY ISOLATED |
| coderx/memory/working-memory | ✗ (per-run) | ✗ (per-run) | CORRECTLY ISOLATED |

---

## The Missing Return Path

```
Runtime write cycle (✓ WORKS):
    executor tool step
      ↓
    execution-history.recordExecution()
      ↓ fire-and-forget
    memoryEngine.store('execution')
      ↓
    .data/memory/execution/store.json

Startup hydration cycle (✗ MISSING):
    server.start()
      ↓ NOTHING
    execution-history._history = []  ← starts empty
    failure-memory._patterns = {}    ← starts empty
    learning-store._store = {}       ← starts empty
```

**This is the primary remaining architectural gap**: intelligence is earned once and written to platform, but it is never reloaded into the in-process caches that make decisions.

**Recommended fix** (Phase 10 / future work):
Add a `hydrateFromPlatform()` function to each in-process store, called from `bootstrapMemory()` after all stores are registered:
```typescript
// In bootstrap.ts, after memoryManager.boot():
await hydrateExecutorMemory();  // loads learning, failure patterns, execution history
```

This requires the `meta` fields written by write-through to contain enough data to reconstruct the in-process schema.
