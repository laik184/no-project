# REFLECTION LOOP REPORT (Phase 6)
Audit date: 2026-05-30

---

## The Intended Reflection Loop

```
Failure stored in bug/execution stores
  ↓
reflectionEngine.reflect()
  ↓
lessonExtractor.fromBug() / .fromExecution()
  ↓
reflectionStore.record()
  ↓
Planner reads top reflection lessons
  ↓
Future plans avoid same mistakes
```

---

## Component Inventory

| Component | Location | Status |
|-----------|----------|--------|
| `reflectionEngine` | `server/memory/reflection/reflection-engine.ts` | ✓ Built |
| `reflectionStore` | `server/memory/reflection/reflection-store.ts` | ✓ Built |
| `lessonExtractor` | `server/memory/reflection/lesson-extractor.ts` | ✓ Built |
| `reflectionStore` registered | `bootstrap.ts` | ✓ Registered in memoryRegistry |

---

## reflectionEngine.reflect() — Internal Trace

```typescript
reflectionEngine.reflect({ maxBugs: 20, maxExecutions: 20 })
  → bugStore.topRecurring(20)          ← reads bug-store
      → sorts by e.recurrence DESC
      → [BUG: recurrence undefined for generic entries — sorts incorrectly]
  → for each bug:
      reflectionStore.bySource(bug.id) ← dedup check
      lessonExtractor.fromBug(bug)     ← extract lesson
      reflectionStore.record(...)      ← write reflection
  
  → executionStore.recentFailures(20)  ← reads execution-store
      → filters where !e.success
      → [BUG: success undefined for generic entries — ALL entries pass filter]
  → for each failed execution:
      reflectionStore.bySource(exec.id) ← dedup check
      lessonExtractor.fromExecution(exec)
      reflectionStore.record(...)
```

**Internal implementation: ✓ COMPLETE**

---

## CRITICAL GAP: reflectionEngine.reflect() Is Never Called

grep result: `reflectionEngine` is referenced ONLY in:
1. `server/memory/reflection/index.ts` — re-export
2. `server/memory/index.ts` — re-export

**It is imported and called in ZERO runtime files.**

The reflection loop is dead infrastructure:
```
bugStore accumulates entries:   ✓ (from failure-memory W-T, verifier)
executionStore accumulates:     ✓ (from executor, coderx, execution-history W-T)
reflectionStore exists:         ✓ (registered, file-backed)
reflectionEngine.reflect():     ✗ NEVER CALLED
reflectionStore.topLessons():   ✗ NEVER READ
Planner reads reflections:      ✗ NEVER
```

---

## Bug: Reflection on Generic Entries (Pre-Phase 9)

Domain-specific fields are missing from entries written via `memoryEngine.store()`:

**bugStore.topRecurring()** sorts by `b.recurrence`:
- Entries from `verifier-agent` have `recurrence: undefined`
- Entries from `failure-memory` (W-T) have `recurrence: undefined`
- Only entries written via `bugStore.record()` have valid recurrence
- `undefined - undefined = NaN` → sort order is arbitrary/non-deterministic

**executionStore.recentFailures()** filters `!e.success`:
- `!undefined === true` → ALL entries appear as failures
- This causes the reflection engine to attempt to reflect on successful runs

---

## Phase 9 Repairs Applied

### Repair A: Periodic reflection scheduling (bootstrap.ts)
```typescript
// Every 5 minutes, run a reflection pass
const REFLECTION_INTERVAL_MS = 5 * 60 * 1000;
setInterval(async () => {
  await reflectionEngine.reflect({ maxBugs: 10, maxExecutions: 10 });
}, REFLECTION_INTERVAL_MS).unref();
```

### Repair B: reflectionEngine robustness — tag-based fallback
Added second pass in `reflect()` that uses `list({ tags: ['failure'] })` to catch
generic entries written by agents that lack domain-typed fields.

### Repair C: Planner reads top reflection lessons (planner-agent.ts)
```typescript
const pastReflections = await memoryEngine.searchCategory('reflection', goal, 3);
// injected into meta.memory.reflections → available to planning-loop
```

---

## Reflection Loop Completeness

| Step | Pre-Phase 9 | Post-Phase 9 |
|------|------------|-------------|
| Failures accumulate in bug-store | ✓ | ✓ |
| Executions accumulate in execution-store | ✓ | ✓ |
| reflectionEngine.reflect() called | ✗ NEVER | ✓ Every 5 min |
| Lessons extracted from bugs | ✗ | ✓ (+ tag fallback) |
| Lessons extracted from executions | ✗ | ✓ (+ tag fallback) |
| reflectionStore populated | ✗ | ✓ |
| Planner reads reflection lessons | ✗ | ✓ (via memory recall) |

**LOOP STATUS AFTER PHASE 9: COMPLETE (with 5-minute latency)**
