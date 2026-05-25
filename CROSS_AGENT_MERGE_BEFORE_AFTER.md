# CROSS-AGENT MERGE INTELLIGENCE — BEFORE vs AFTER

---

## BEFORE: Partial / Broken Pipeline

```
SpecialistResults[]
    ↓
MergePlanBuilder.build()          ✅ Domain priority ordering
    ↓
SpecialistConflictDetector        ✅ Conflict detection
    ↓
ResolutionStrategy                ⚠️  Tie detection bug (object identity)
    ↓
ConflictGraphBuilder              ❌  NOT CALLED — cycles undetected
    ↓
SpecialistResultMerger            ❌  Acquires locks → in-memory array → releases locks
                                      NO FS write, NO transaction, NO rollback
    ↓
(nothing)                         ❌  MergeTransactionManager: NEVER CALLED
(nothing)                         ❌  ReconciliationEngine: NEVER CALLED
(nothing)                         ❌  MergeMemoryBridge: FILE DID NOT EXIST
    ↓
Returns in-memory patch list      ⚠️  Not persisted to filesystem
```

**Critical failures in BEFORE state:**
- Patches were collected in memory but **never written to the sandbox filesystem**
- `MergeTransactionManager` existed but was **orphaned** — no caller
- `ReconciliationEngine` existed but was **orphaned** — no caller
- `MergeMemoryBridge` was referenced in telemetry names but **file did not exist**
- `ConflictGraphBuilder` existed but was **never called from MergePlanBuilder**
- Cycle detection output (`graph.cycles`) was **always empty** due to self-loop bug
- Topological sort output (`graph.topOrder`) was **meaningless** (all nodes, no edges)
- AST merge was available in `distributed/conflicts/` but **not wired** into `ResolutionStrategy`
- `reconciliation-engine.ts` had early `consistent` flag that **missed journal anomalies**
- `ast-merge-engine.ts` had **index-drift** causing wrong conflict detection after any insertion

---

## AFTER: Full Production Pipeline

```
SpecialistResults[]
    ↓
MergePlanBuilder.build()          ✅ Domain priority ordering
    ↓
SpecialistConflictDetector        ✅ CONTENT / OWNERSHIP / ORDERING detection
    ↓
ResolutionStrategy (fixed)        ✅ AST_MERGE → DOMAIN_PRIORITY → CONFIDENCE
                                      → CONTENT_SIZE → FIRST_WRITER
                                      Tie detection uses count-of-minimum (not identity)
    ↓
ConflictGraphBuilder (fixed)      ✅ Cross-file edges (distinct from/to)
                                      Cycle detection active
                                      Topological sort drives group ordering
    ↓
PatchValidationBarrier            ✅ Path safety, traversal guard, op validation
    ↓
MergeTransactionManager           ✅ begin() → validates patches
    ↓
unifiedLockCoordinator            ✅ Per-file exclusive locks acquired
    ↓
TransactionalPatchApplier         ✅ Atomic FS writes with before-snapshot
    ↓
[Lock release]                    ✅ All locks released regardless of outcome
    ↓
MergeTransactionManager.commit()  ✅ Rollback on first failure (reverse order)
    ↓
ReplayJournal.recordBatch()       ✅ Append-only journal per committed patch
    ↓
ReconciliationEngine (fixed)      ✅ All 5 checks THEN consistent flag computed
                                      Check 5: journal cross-check (new)
    ↓
MergeMemoryBridge.persist()       ✅ Strategy outcomes recorded for learning
    ↓
MergeResult                       ✅ { patches, appliedCount, consistent,
                                         txId, cyclesDetected, durationMs }
```

---

## METRIC COMPARISON

| Metric | Before | After |
|--------|--------|-------|
| Patches written to FS | ❌ 0 (in-memory only) | ✅ All committed patches |
| Rollback on failure | ❌ Not possible | ✅ Full reverse-order rollback |
| Replay journaling | ❌ Never recorded | ✅ Every committed patch journaled |
| Cycle detection | ❌ Always 0 (self-loop bug) | ✅ Real cross-file cycle detection |
| Topological ordering | ❌ Meaningless | ✅ Drives group processing order |
| AST merge integration | ❌ Not wired | ✅ First strategy for CONTENT conflicts |
| Reconciliation | ❌ Never called | ✅ 5-check post-merge validation |
| Journal cross-check | ❌ Missing | ✅ Anomaly kind: journal_missing |
| Memory learning | ❌ File missing | ✅ Ring-buffer per domain×conflictType |
| Telemetry events | ❌ 7 of 11 | ✅ 11 of 11 |
| Tie detection accuracy | ❌ Object identity (fragile) | ✅ Priority count comparison |
| AST line-diff accuracy | ❌ Index-drift after insertions | ✅ LCS-based proper hunk tracking |

---

## FILES CHANGED

### Fixed (existing files corrected)
1. `server/coordination/aggregation/specialist-result-merger.ts` — Delegates to MergePipeline
2. `server/coordination/aggregation/merge-plan-builder.ts` — Wires ConflictGraphBuilder
3. `server/coordination/aggregation/reconciliation-engine.ts` — Late consistent flag + journal_missing
4. `server/coordination/conflict-resolution/conflict-graph-builder.ts` — Cross-file edges, no self-loops
5. `server/coordination/conflict-resolution/resolution-strategy.ts` — AST first, fixed tie detection
6. `server/coordination/telemetry/merge-telemetry.ts` — Full 11-event taxonomy
7. `server/distributed/conflicts/ast-merge-engine.ts` — LCS-based diff, no index-drift
8. `server/coordination/index.ts` — Full export surface for all new modules

### Created (net-new files)
9. `server/coordination/aggregation/merge-pipeline.ts` — 8-stage wired lifecycle
10. `server/coordination/aggregation/merge-memory-bridge.ts` — Confidence learning store
