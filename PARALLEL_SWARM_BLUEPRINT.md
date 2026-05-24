# PARALLEL_SWARM_BLUEPRINT

**System:** NURA-X Quantum-Inspired Parallel Specialist Swarm  
**Version:** 1.0  
**Status:** Implemented — `server/coordination/` (13 files, ~1,325 lines)

---

## 1. ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────────────┐
│                    PARALLEL SPECIALIST SWARM                         │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                  coordinateSpecialists()                      │    │
│  │                  server/coordination/index.ts                 │    │
│  └──────────────────────────┬──────────────────────────────────┘    │
│                               │                                       │
│              ┌────────────────▼────────────────┐                     │
│              │         TaskDecomposer            │                     │
│              │   goal → SpecialistTask[]         │                     │
│              │   DependencyGraphBuilder → waves  │                     │
│              └────────────────┬────────────────┘                     │
│                               │ DecomposedPlan                        │
│              ┌────────────────▼────────────────┐                     │
│              │  ParallelSpecialistCoordinator   │                     │
│              │                                  │                     │
│              │  Wave 0: ████ database           │                     │
│              │  Wave 1: ████ backend            │                     │
│              │  Wave 2: ████ frontend           │                     │
│              │          ████ security  ← parallel│                    │
│              │          ████ runtime   ← parallel│                    │
│              │  Wave 3: ████ verification       │                     │
│              └────────────────┬────────────────┘                     │
│                               │                                       │
│     ┌─────────────────────────▼─────────────────────────┐           │
│     │              SpecialistWaveRunner                   │           │
│     │                                                     │           │
│     │  Promise.all([task1, task2, task3])                │           │
│     │       │           │           │                    │           │
│     │  acquireLock  acquireLock  acquireLock             │           │
│     │  workerPool   workerPool   workerPool              │           │
│     │  releaseLock  releaseLock  releaseLock             │           │
│     └─────────────────────────┬─────────────────────────┘           │
│                               │ SpecialistResult[]                    │
│     ┌─────────────────────────▼─────────────────────────┐           │
│     │              SpecialistResultMerger                │           │
│     │                                                     │           │
│     │  MergePlanBuilder                                  │           │
│     │    ├── SpecialistConflictDetector                  │           │
│     │    └── ResolutionStrategy (4-chain)                │           │
│     │                                                     │           │
│     │  Apply winning patches (lock-gated)                │           │
│     └─────────────────────────┬─────────────────────────┘           │
│                               │ CoordinationResult                    │
└───────────────────────────────┼─────────────────────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │  ParallelVerification  │
                    │  Wave A: Static+Build  │
                    │  Wave B: Runtime+Preview│
                    │  Wave C: Reconcile     │
                    └───────────────────────┘
```

---

## 2. COMPONENT CATALOG

### 2.1 TaskDecomposer
**File:** `server/coordination/task-decomposer/task-decomposer.ts`  
**Input:** `(goal: string, runId: string, projectId: number)`  
**Output:** `DecomposedPlan`  
**Responsibility:** Detect domains from goal text → assign tasks → assign dependencies

**Domain detection heuristics:**
```
database:     /database|schema|migration|table|query|sql|orm/
backend:      /api|route|endpoint|server|express|controller/
frontend:     /ui|component|page|layout|react|button|form/
security:     /security|auth|jwt|csrf|vulnerability|permission/
runtime:      /runtime|process|environment|deploy|docker|port/
verification: /test|verify|lint|typecheck|spec/
fullstack:    /fullstack|shared|utility|middleware|integration/
```

**Dependency model:**
```
database    → (no deps)
backend     → database
security    → backend
runtime     → backend
frontend    → backend
fullstack   → backend + frontend
verification→ frontend + security + runtime
```

### 2.2 DependencyGraphBuilder
**File:** `server/coordination/task-decomposer/dependency-graph-builder.ts`  
**Algorithm:** Kahn's BFS topological sort  
**Safety:** Cycle detection via DFS before wave computation  
**Output:** `DependencyGraph { nodes, edges, waves[] }`

**Wave example (full-stack task):**
```
Wave 0: [database]
Wave 1: [backend]
Wave 2: [frontend, security, runtime]   ← 3-way parallel
Wave 3: [verification]
```

### 2.3 ExecutionContextFactory
**File:** `server/coordination/scoped-context/execution-context-factory.ts`  
**Isolation:** One context per run, owned by factory, mutated only via explicit methods  
**Mutation methods:** `markStarted()`, `markCompleted()`, `markFailed()`, `isAborted()`  
**Abort propagation:** `AbortController` per context, propagated to all active tasks

### 2.4 ContextRegistry
**File:** `server/coordination/scoped-context/context-registry.ts`  
**Type:** In-process Map with TTL eviction (30 min)  
**Background sweeper:** Every 5 min  
**Thread safety:** Node.js single-threaded — no mutex needed

### 2.5 SpecialistWaveRunner
**File:** `server/coordination/parallel-specialist-coordinator/specialist-wave-runner.ts`  
**Concurrency:** `Promise.all()` — all tasks in wave run simultaneously  
**Lock model:** Exclusive lock per file in `task.scope.exclusiveFiles`  
**Error model:** Errors captured per-task — wave never throws  
**Worker pool:** `centralWorkerPool.submit()` with backpressure + priority

### 2.6 ParallelSpecialistCoordinator
**File:** `server/coordination/parallel-specialist-coordinator/parallel-specialist-coordinator.ts`  
**Wave sequencing:** Iterates `DependencyGraph.waves` in order  
**Abort condition:** All tasks in a wave fail → abort remaining waves  
**Partial success:** Some failures in a wave → continue to next wave  
**Parallelism metric:** `total_tasks / waves_count`

### 2.7 SpecialistConflictDetector
**File:** `server/coordination/conflict-resolution/specialist-conflict-detector.ts`  
**Conflict types:**
```
CONTENT   — same file, different content from multiple specialists
OWNERSHIP — multiple specialists claim exclusive write rights
ORDERING  — conflicting operations (create vs update) on same file
```
**Output:** `ConflictReport { conflicts[], safe[] }`

### 2.8 ResolutionStrategy
**File:** `server/coordination/conflict-resolution/resolution-strategy.ts`  
**Strategy chain (first match wins):**
```
1. DOMAIN_PRIORITY  — lowest DOMAIN_MERGE_PRIORITY number wins
2. CONFIDENCE       — highest patch confidence score wins
3. CONTENT_SIZE     — largest content patch wins
4. FIRST_WRITER     — first patch in list wins (deterministic fallback)
```
**Domain merge priority:** database(1) > backend(2) > security(3) > runtime(4) > frontend(5) > verification(6)

### 2.9 MergePlanBuilder
**File:** `server/coordination/aggregation/merge-plan-builder.ts`  
**Process:** Conflict detection → resolution → PatchGroup[] with winners

### 2.10 SpecialistResultMerger
**File:** `server/coordination/aggregation/specialist-result-merger.ts`  
**Lock model:** Exclusive lock per file before applying winning patch  
**Output:** `MergeResult { patches[], appliedCount, skippedCount }`

---

## 3. DATA FLOW

```
Goal (string)
    │
    ▼
SpecialistTask[] (typed, with FileScope, timeoutMs, dependsOn[])
    │
    ▼
DependencyGraph (topologically sorted waves[])
    │
    ▼
CoordinationContext (isolated per run, never shared)
    │
    ├── Wave loop:
    │     SpecialistTask[] → Promise.all → SpecialistResult[]
    │     (per wave, parallel)
    │
    ▼
SpecialistResult[] (all waves combined)
    │
    ▼
MergePlan (PatchGroup[] with winners)
    │
    ▼
FilePatch[] (lock-gated, ordered by DOMAIN_MERGE_PRIORITY)
    │
    ▼
CoordinationResult {
  success, results, mergedPatches,
  wavesExecuted, specialistsRan, parallelismFactor
}
```

---

## 4. SAFETY GUARANTEES

### 4.1 File Safety
- Every write-path file is protected by `UnifiedLockCoordinator`
- Lock acquired before execution, released in `finally` block (always)
- Lock timeout: 10s (task) + 8s (merge) — deadlock prevention via timeout

### 4.2 Execution Safety
- `AbortController` per context — clean cancellation propagation
- All task errors captured, never thrown (wave isolation)
- Total wave failure → abort remaining waves (fail-fast)

### 4.3 Merge Safety
- Conflict detection before any merge
- Domain-priority ordering prevents schema overwritten by UI code
- Lock-gated patch application prevents concurrent file corruption

### 4.4 Memory Safety
- Context registry TTL: 30 min auto-eviction
- `unifiedLockCoordinator.releaseRun(runId)` for batch release
- No global mutable state — contexts are per-instance

---

## 5. EXTENSION POINTS

### Add a new specialist domain

1. Add entry to `SpecialistDomain` type in `contracts/specialist.contracts.ts`
2. Add regex to `DOMAIN_SIGNALS` in `task-decomposer.ts`
3. Add dependencies to `DOMAIN_DEPS` in `task-decomposer.ts`
4. Add file patterns to `DOMAIN_FILE_PATTERNS` in `task-decomposer.ts`
5. Add merge priority to `DOMAIN_MERGE_PRIORITY` in `specialist.contracts.ts`

### Add a new conflict resolution strategy

1. Add strategy function in `resolution-strategy.ts`
2. Insert it in the strategy chain in `ResolutionStrategy.resolve()`
3. Add strategy name to `ResolutionStrategyName` union type

### Wire real agent execution

Replace the stub in `specialist-wave-runner.ts` `fn:` body with:
```typescript
fn: async () => {
  const { dispatchSpecialist } = await import("../../agents/coordination/specialist-dispatcher.ts");
  return dispatchSpecialist(task, ctx.abortController.signal);
},
```

---

## 6. KNOWN LIMITATIONS & NEXT STEPS

| Limitation | Impact | Next Step |
|-----------|--------|-----------|
| `fn:` in wave runner is a stub | No real agent execution yet | Wire to actual specialist agents |
| Domain detection is regex-based | May miss complex goals | Replace with LLM-based intent analysis |
| File scope is pattern-based | Patterns may not match project structure | Dynamic file scope from project index |
| No retry per specialist | Failed specialist not retried | Add `RetryPolicyEngine` call in wave runner |
| Redis required for distributed locks | Single-node only without Redis | Configure REDIS_URL secret |
