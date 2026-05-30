# LEARNING LOOP REPORT (Phase 5)
Audit date: 2026-05-30

---

## The Intended Learning Loop

```
Execution failure
  ↓
failure-memory.recordFailurePattern()
  ↓
pattern-learner.learnPattern()
  ↓
learningStore.upsert()
  ↓
feedback-loop.process()
  ↓
tool-selection-engine uses getValue()
  ↓
Next execution uses better tool/strategy
```

---

## Step-by-Step Trace

### Step 1: Failure occurs
**VERIFIED**: Every failed tool step calls `recovery-engine.recordFailure()` or `decision-engine.decide()`.

```
step-runner → execution-routing → recovery-engine
  → failureMemory.recordFailurePattern(runId, toolName, kind, error)
     → _patterns.set(sig, pattern)  ← in-process Map
     → memoryEngine.store({ category: 'bug', ... }).catch()  ← W-T ✓
```
**Status**: ✓ WORKING

---

### Step 2: Pattern learning
**VERIFIED**: `pattern-learner.learnPattern()` is called from `feedback-loop.process()`.

```
feedbackLoop.process(record)
  → patternLearner.learnPattern(record.taskOutcomes)
     → for each outcome:
        failureMemory.chroniclePatterns()  ← reads in-process
        learningStore.upsert('tool-reliability', ...)
        learningStore.upsert('kind-pattern', ...)
```
**Status**: ✓ WORKING (in-process)

---

### Step 3: Learning persistence (write-through)
**VERIFIED**: `learningStore.upsert()` now fires write-through.

```
learningStore.upsert(kind, key, delta, metadata)
  → _store.set(ck, entry)  ← in-process Map
  → memoryEngine.store({ category: 'learning', ... }).catch()  ← W-T ✓
  → .data/memory/learning/store.json  ← persisted
```
**Status**: ✓ WORKING — data written to platform

---

### Step 4: Future decision uses learning
**VERIFIED**: tool-selection-engine, failure-predictor, strategy-optimizer all read from learningStore.

```
runExecutionLoop() → taskRouter → tool-selection-engine.selectBestTool()
  → learningStore.getValue('tool-reliability', toolName)  ← SYNC READ
  → returns learned reliability score
  → adjusts tool ranking
```
**Status**: ✓ WORKING — within same server session

---

## CRITICAL GAP: Restart Hydration Missing

The entire learning loop works **within a single server session**. On restart:

```
Server restart
  → executor/learning/learning-store.ts constructor: new Map()
  → _store is EMPTY
  → _version = 0
  → learningStore.getValue('tool-reliability', ...) → returns default 0.5 for everything
  → All learned reliability scores LOST
  → All strategy weights LOST
  → All workflow risk data LOST
```

**What IS persisted**: `.data/memory/learning/store.json` contains all learning entries from write-through.

**What is NOT done**: No code reads `.data/memory/learning/store.json` back into the executor's in-process `learningStore` on startup.

**The gap**:
```
.data/memory/learning/store.json  ← DATA EXISTS
        ↓ NO CODE READS THIS BACK
executor/learning/learning-store.ts (in-process)  ← starts empty every restart
```

This is the same gap for:
- `executor/memory/execution-history.ts` (in-process array starts empty)
- `executor/memory/failure-memory.ts` (in-process Map starts empty)

**Impact**: Every server restart is a "cold start" with no learned intelligence. The learning system re-learns from scratch every time.

---

## Learning Store Schema Mismatch

`executor/learning/learning-store.ts` uses `LearnedEntry`:
```typescript
{ kind: LearnedKind, key: string, value: number, evidence: number, version: number, ... }
```

`server/memory/learning-memory/learning-store.ts` (platform) expects `LearningEntry`:
```typescript
{ lesson: string, domain: string, appliedFrom: string, validated: boolean }
```

The write-through stores `{ kind, key, value, evidence }` in the `content` field as JSON and `kind`/`key` in `meta`. Platform's typed `LearningEntry` fields (lesson, domain, appliedFrom) are never populated.

**Impact**: `learningStore.byDomain()`, `learningStore.validate()`, `learningStore.topLessons()` return data incompatible with what agents wrote.

---

## Loop Completeness Assessment

| Step | Status | Notes |
|------|--------|-------|
| Failure → in-process failure-memory | ✓ COMPLETE | |
| failure-memory → platform bug store (W-T) | ✓ COMPLETE | |
| pattern-learner → in-process learning-store | ✓ COMPLETE | |
| learning-store → platform learning store (W-T) | ✓ COMPLETE | |
| tool-selection-engine reads in-process store | ✓ COMPLETE | same session |
| Platform store → in-process store on restart | ✗ MISSING | cold start every time |
| Platform bug/learning → reflection entries | ✗ MISSING | reflectionEngine never called |
| Reflection lessons → planner decisions | ✗ MISSING | planner never reads memory |

**LOOP STATUS: PARTIALLY COMPLETE (within session) / BROKEN ACROSS RESTARTS**

---

## Phase 9 Repairs Applied

**NOT REPAIRED in Phase 9** (complexity + risk): Startup hydration of in-process stores.
This requires a careful multi-store bootstrap that:
1. Reads `.data/memory/learning/store.json` on startup
2. Parses `meta.kind` and `meta.key` from each entry
3. Reconstructs `LearnedEntry` objects into the in-process Map
4. Bypasses the delta-based `upsert()` to set absolute values

This is documented as **REMAINING GAP #1** in the final report.
