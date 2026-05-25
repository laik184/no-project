# CROSS-AGENT MERGE INTELLIGENCE — BLUEPRINT

> Production-grade architectural specification for the merge intelligence fabric.

---

## TARGET ARCHITECTURE

```
SpecialistResults[] (from parallel specialist swarm)
         │
         ▼
┌─────────────────────────┐
│    MergePlanBuilder     │  Groups patches by file.
│                         │  Sorts by DOMAIN_MERGE_PRIORITY.
│  database  → 1          │  Calls SpecialistConflictDetector.
│  backend   → 2          │  Calls ResolutionStrategy per conflict.
│  security  → 3          │  Calls ConflictGraphBuilder for cycle detection.
│  runtime   → 4          │  Applies topological ordering to groups.
│  frontend  → 5          │
│  verif.    → 6          │
└────────────┬────────────┘
             │ MergePlan (groups + winners)
             ▼
┌─────────────────────────┐
│  ConflictGraphBuilder   │  Builds directed conflict dependency graph.
│                         │  Nodes = conflicting filePaths.
│  Rule 1: cross-file     │  Edges = shared-domain ordering constraints.
│  domain edges           │  Structural edges: schema→routes→components.
│                         │  Cycle detection (DFS).
│  Rule 2: structural     │  Topological sort (Kahn's algorithm).
│  path edges             │
└────────────┬────────────┘
             │ ConflictGraph (nodes, edges, cycles, topOrder)
             ▼
┌─────────────────────────┐
│  ResolutionStrategyChain│  For each conflict group:
│                         │    1. AST_MERGE       (CONTENT + 2 patches)
│  AST_MERGE    (new)     │    2. DOMAIN_PRIORITY (no tie)
│  DOMAIN_PRIORITY        │    3. CONFIDENCE      (no tie)
│  CONFIDENCE             │    4. CONTENT_SIZE    (deterministic fallback)
│  CONTENT_SIZE           │    5. FIRST_WRITER    (ultimate fallback)
│  FIRST_WRITER           │
└────────────┬────────────┘
             │ Winners []
             ▼
┌─────────────────────────┐
│  PatchValidationBarrier │  Pre-apply safety gate. Fail-closed.
│                         │  Validates: non-empty path, no absolute paths,
│  Rules:                 │  no path traversal, valid operation, content
│  - relative path        │  present for create/update, confidence in [0,1].
│  - no traversal         │
│  - valid operation      │
│  - content present      │
│  - confidence [0,1]     │
└────────────┬────────────┘
             │ valid patches []
             ▼
┌─────────────────────────┐
│ MergeTransactionManager │  begin(runId, patches) → txId
│                         │  Validates patches via PatchValidationBarrier.
│  begin()                │  Creates MergeTransaction record (pending).
│  commit()    ──────────►│  commit(txId) → CommitResult
│  abort()                │    Calls transactionalPatchApplier.applyBatch()
│  rollback()             │    On first failure: rollback all applied in reverse.
└────────────┬────────────┘
             │ txId
             ▼
┌─────────────────────────┐
│ unifiedLockCoordinator  │  Acquire exclusive file lock per patch.
│                         │  Timeout: 8 000 ms.
│  acquire(filePath, ...) │  On failure: patch is skipped (emits patch.skipped).
│  handle.release()       │  Locks released in finally block regardless of outcome.
└────────────┬────────────┘
             │ locked patches []
             ▼
┌─────────────────────────┐
│ TransactionalPatchApplier│ Atomic FS write per patch.
│                         │  Snapshots current content before write (for rollback).
│  apply(runId, patch)    │  create/update → mkdir + writeFile.
│  rollback(outcome)      │  delete → unlink.
│  applyBatch(...)        │  Returns PatchApplyOutcome (status, snapshot, durationMs).
│                         │  Never throws — errors captured in outcome.error.
└────────────┬────────────┘
             │ PatchApplyOutcome[]
             ▼
┌─────────────────────────┐
│    ReplayJournal        │  Append-only record of every committed patch.
│                         │  keyed by runId → JournalEntry[].
│  record(...)            │  Each entry: id, runId, txId, filePath, operation,
│  recordBatch(...)       │    content, strategy, confidence, recordedAt.
│  replay(runId)          │  replay(runId) → patches in journal order.
│  purge(runId)           │  Deterministic: sorted by recordedAt ascending.
└────────────┬────────────┘
             │ JournalEntry[]
             ▼
┌─────────────────────────┐
│  ReconciliationEngine   │  5-check post-merge consistency verification.
│  (fixed)                │
│  Check 1: winners       │  1. Every winner was applied.
│  Check 2: duplicates    │  2. No duplicate applications (idempotency).
│  Check 3: del+create    │  3. No delete+create collision on same path.
│  Check 4: unresolved    │  4. No conflict group with no winner.
│  Check 5: journal       │  5. Every applied patch in ReplayJournal.
│                         │  consistent = anomalies.length === 0 (computed last).
└────────────┬────────────┘
             │ ReconciliationReport
             ▼
┌─────────────────────────┐
│   MergeMemoryBridge     │  Persist strategy outcomes for learning.
│   (new)                 │
│  persist(runId, ...)    │  Ring buffer: MAX_RECORDS_PER_KEY = 50 per bucket.
│  hint(domain, type)     │  Key = "${domain}:${conflictType}".
│  confidence(strategy)   │  hint() → best strategy by historical success rate.
│  stats()                │  confidence() → overall success rate per strategy.
└────────────┬────────────┘
             │
             ▼
         MergeResult
   { runId, patches, appliedCount, skippedCount,
     durationMs, consistent, txId, cyclesDetected }
```

---

## TELEMETRY EVENT TAXONOMY (11 canonical events)

| Event | Emitter | Payload |
|-------|---------|---------|
| `merge.start` | MergePipeline | patchCount, conflictCount |
| `merge.patch.received` | MergePipeline | filePath, domain |
| `merge.patch.validated` | PatchValidationBarrier | filePath, valid, reason? |
| `merge.conflict.detected` | SpecialistConflictDetector | filePath, type, domains |
| `merge.conflict.resolved` | ResolutionStrategy | filePath, strategy, reasoning |
| `merge.patch.applied` | TransactionalPatchApplier | filePath, op, durationMs |
| `merge.patch.skipped` | MergePipeline | filePath, reason |
| `merge.rollback` | MergeTransactionManager | txId, reason, rolledBack |
| `merge.reconcile.start` | ReconciliationEngine | patchCount |
| `merge.reconcile.complete` | ReconciliationEngine | consistent, patchesVerified, anomalies |
| `merge.complete` | MergePipeline | applied, skipped, durationMs |

---

## DOMAIN MERGE PRIORITY

```
Domain        Priority  Authority
─────────────────────────────────
database          1     Highest — schema changes before everything
backend           2     API routes and server logic
security          3     Vulnerability fixes, auth
runtime           4     Infrastructure, env, process config
frontend          5     UI components, styles
verification      6     Type-check, lint, test assertions
fullstack         7     Cross-cutting utilities
```

---

## ROLLBACK SAFETY MODEL

```
Transaction commit fails at patch N:
  outcomes[0..N-1] = "applied"  ← these get rolled back
  outcomes[N]      = "failed"   ← this one failed
  outcomes[N+1..] = not started

Rollback order: reverse of application order
  For each applied outcome (N-1..0):
    if hadFile=false: delete the created file
    if hadFile=true:  restore from snapshot

Lock release: happens in finally{} BEFORE rollback result is returned
```

---

## LOCK SAFETY MODEL

```
Per-file exclusive lock:
  Owner:    "merge-pipeline:{runId}"
  Timeout:  8 000 ms
  Scope:    One patch per file per transaction

Lock acquisition failure:
  Patch is skipped (not failed)
  emits: merge.patch.skipped { reason: "lock_acquisition_failed" }
  Transaction continues for remaining patches

Lock release:
  Always in finally{} block — never conditional
  Released before rollback check
```

---

## MEMORY / REPLAY SAFETY

```
ReplayJournal guarantees:
  - Append-only (no mutations to existing entries)
  - Ordered by recordedAt (monotonic timestamp)
  - Keyed by runId (isolated per run)
  - Purge-safe: purge(runId) removes all entries for completed runs

Replay usage:
  replayJournal.replay(runId) → { entries, patches }
  Patches are in journal order → re-applying them reproduces the merge
  ReconciliationEngine uses journalPaths for cross-check (Check 5)
```
