# CROSS-AGENT MERGE — CODE REVIEW

> Merge correctness checklist · Race-condition audit · Deterministic replay audit
> AST safety audit · Conflict resolution audit

---

## ✅ MERGE CORRECTNESS CHECKLIST

### MergePlanBuilder
- [x] Results sorted by DOMAIN_MERGE_PRIORITY before conflict detection
- [x] Only `success=true` results are processed (`results.filter(r => r.success)`)
- [x] `SpecialistConflictDetector.detect()` called before any winner selection
- [x] `ConflictGraphBuilder.build()` called; cycles logged as warnings
- [x] Topological order applied to groups when graph is acyclic
- [x] Safe patches (single-specialist) pass through without resolution overhead
- [x] `extractWinners()` filters groups with `winner !== undefined`
- [x] `domainSummary()` does not affect merge output (pure observability)

### SpecialistConflictDetector
- [x] Patches grouped by `filePath` (correct key)
- [x] Single-claimant files go directly to `safe[]`
- [x] ORDERING conflict detected when operations differ (`ops.size > 1`)
- [x] CONTENT conflict detected when content differs (`contents.size > 1`)
- [x] OWNERSHIP conflict is the fallback for same-op, same-content multi-claim
- [x] Telemetry emitted per conflict (`conflict.detected`)

### ResolutionStrategy (chain)
- [x] AST_MERGE checked first for CONTENT conflicts with exactly 2 patches
- [x] DOMAIN_PRIORITY: tie detected by counting `priorities.filter(p => p === min).length`
- [x] CONFIDENCE: tie detected by `sorted[0].confidence === sorted[1]?.confidence`
- [x] CONTENT_SIZE: no tie — always returns (deterministic fallback)
- [x] FIRST_WRITER: `byContentSize` already covers this (largest content is first)
- [x] `resolve()` never throws — always returns a `ResolutionDecision`
- [x] Every resolution emits `merge.conflict.resolved` telemetry

### PatchValidationBarrier
- [x] Empty/whitespace filePath → rejected (`empty_file_path`)
- [x] Absolute paths rejected (`absolute_path`)
- [x] Path traversal `../` rejected (`path_traversal`)
- [x] Unknown operation rejected (`unknown_operation`)
- [x] create/update without content → rejected (`missing_content`)
- [x] delete with content → rejected (`unexpected_content`)
- [x] Confidence outside [0,1] → rejected (`invalid_confidence`)
- [x] Every validation emits `merge.patch.validated` telemetry (valid or not)

### MergeTransactionManager
- [x] `begin()` validates all patches via `PatchValidationBarrier`
- [x] Only valid patches queued in transaction (rejected count returned)
- [x] `commit()` checks `tx.status === "pending"` before proceeding
- [x] `commit()` returns early with `transaction_not_found` if txId unknown
- [x] First failure triggers `_rollbackOutcomes()` for all applied patches
- [x] Rollback iterates outcomes in **reverse** order (correct LIFO)
- [x] `tx.status` transitions: `pending → committed | rolled_back`
- [x] `abort()` only works on `pending` transactions (prevents double-rollback)
- [x] `emitTxBegin/Commit/Rollback` emitted at correct lifecycle points

### TransactionalPatchApplier
- [x] `sandboxPath()` joins resolved SANDBOX_ROOT with patch.filePath
- [x] Snapshot captured BEFORE write (enables rollback)
- [x] `mkdir({ recursive: true })` ensures directory exists before write
- [x] `apply()` never throws — all errors captured in `outcome.error`
- [x] `rollback()` never throws — returns boolean success
- [x] delete rollback: removes created file if `hadFile=false`
- [x] update rollback: restores snapshot content if `hadFile=true`
- [x] `applyBatch()` fail-fast on first failure (stops further writes)

### ReconciliationEngine (fixed)
- [x] Check 1: winner_not_applied — every group.winner appears in applied set
- [x] Check 2: duplicate_application — at most one patch per filePath
- [x] Check 3: delete_create_collision — ops.has("delete") && ops.has("create"|"update")
- [x] Check 4: unresolved_conflict — hasConflict=true groups must have winner
- [x] Check 5: journal_missing — applied patches appear in ReplayJournal
- [x] `consistent = anomalies.length === 0` computed AFTER all 5 checks (**critical fix**)
- [x] `isConsistent()` checks both `report.consistent` AND `report.anomalies.length === 0`

### ReplayJournal
- [x] Append-only (`push()` to store, no mutation of existing entries)
- [x] `record()` increments `_seq` (module-level counter — single-threaded safe in Node.js)
- [x] `replay()` returns entries sorted by `recordedAt` (deterministic)
- [x] `purge(runId)` removes all entries for a run (no leaks)
- [x] `totalEntries()` sums across all runs (observability)

### MergeMemoryBridge
- [x] Ring buffer capped at `MAX_RECORDS_PER_KEY = 50` (no unbounded growth)
- [x] `hint()` returns best strategy by success rate, breaks ties by sample size
- [x] `confidence()` computes global success rate per strategy
- [x] `stats()` provides observability endpoint for dashboards
- [x] `purgeRun()` enables privacy-safe per-run data removal
- [x] `persist()` emits `memory.write` telemetry per patch outcome

---

## ✅ RACE-CONDITION CHECKLIST

| Scenario | Risk | Mitigation |
|----------|------|------------|
| Two merges on same run simultaneously | HIGH | Per-file exclusive locks via `unifiedLockCoordinator` |
| Lock acquisition timeout | MEDIUM | 8 000 ms timeout → patch skipped, not failed |
| Partial commit (write succeeds, lock release fails) | LOW | `finally{}` block ensures lock release always happens |
| Concurrent `begin()` on same runId | LOW | Each `begin()` generates unique `txId` (uuidv4) |
| ReplayJournal concurrent writes | NONE | Node.js single-thread; `Map.get().push()` is atomic |
| MergeMemoryBridge ring-buffer overflow | NONE | Capped at 50 per key; splice removes oldest entries |
| ConflictGraph cycle during concurrent resolution | LOW | Cycles detected before any resolution begins; warning emitted |
| Stale lock from crashed merger | MEDIUM | `stale-lock-cleaner` sweeps every 10 s (existing system) |
| Double-commit of same txId | PREVENTED | `tx.status !== "pending"` guard in `commit()` |
| Double-rollback of same txId | PREVENTED | `abort()` only acts on `pending` status |

---

## ✅ DETERMINISTIC REPLAY CHECKLIST

| Property | Implementation | Status |
|----------|---------------|--------|
| Merge order is input-independent | DOMAIN_MERGE_PRIORITY sort before conflict detection | ✅ |
| Conflict resolution is deterministic | Strategy chain: AST→Domain→Confidence→Size | ✅ |
| Topo order is deterministic | Kahn's BFS on acyclic graph — stable with queue | ✅ |
| Journal entries ordered by recordedAt | `replay()` sorts ascending | ✅ |
| Patch application order matches journal | `applyBatch()` sequential, `recordBatch()` sequential | ✅ |
| Rollback order is reverse of apply order | `_rollbackOutcomes()` reverses before iterating | ✅ |
| Confidence scoring is pure | No external state — scores computed from input only | ✅ |
| Memory bridge hints are advisory only | `hint()` used for logging/telemetry — not in merge path | ✅ |

---

## ✅ AST SAFETY CHECKLIST

| Property | Implementation | Status |
|----------|---------------|--------|
| AST merge only for CONTENT conflicts | `type !== "CONTENT"` check in `byAstMerge()` | ✅ |
| AST merge only when exactly 2 patches | `patches.length !== 2` guard | ✅ |
| AST merge requires non-empty content | `!a.content \|\| !b.content` guard | ✅ |
| Failed AST merge falls through to chain | Returns `null` on non-clean outcome | ✅ |
| LCS-based diff prevents index drift | DP table computed before hunk extraction | ✅ |
| Multi-line hunk consumption correct | `anchorLen` tracks consumed ancestor lines | ✅ |
| Conflict markers syntactically inert | `<<<<<<< OURS / ======= / >>>>>>> THEIRS` format | ✅ |
| Clean merge produces valid output | `outcome === "clean"` check before accepting | ✅ |

---

## ✅ CONFLICT RESOLUTION CHECKLIST

| Property | Implementation | Status |
|----------|---------------|--------|
| All conflict types detected | CONTENT, OWNERSHIP, ORDERING | ✅ |
| Conflict graph has no self-loops | `from !== to` guard in edge construction | ✅ |
| Cross-file edges based on shared domain | Domain intersection check in `_buildEdges()` | ✅ |
| Structural ordering edges added | `structuralPriority()` heuristic for schema→routes | ✅ |
| Cycle detection uses DFS with inStack | Correct Tarjan-adjacent detection | ✅ |
| Cyclic graphs fall back to plan order | `topOrder.length === 0` when cycles present | ✅ |
| Domain priority tie detection correct | `candidateCount !== 1` (count, not identity) | ✅ |
| Unresolved conflicts reported | ReconciliationEngine check 4 catches them | ✅ |

---

## ⚠️ KNOWN LIMITATIONS (By Design)

1. **AST merge uses empty ancestor:** When `ResolutionStrategy` calls `AstMergeEngine`, it passes `ancestor: ""` because no common ancestor content is available at this layer. The 3-way merge degrades to 2-way (identity checks pass, LCS runs on empty baseline). True 3-way merge requires ancestor tracking at the specialist task level.

2. **ReplayJournal is in-process:** `_seq` and `_store` live in memory. Multi-node deployments require a Redis-backed implementation (documented in replay-journal.ts as a known extension point).

3. **MergeMemoryBridge is in-process:** Ring-buffer is per-process. For distributed deployments, replace `_store: Map` with a Redis hash.

4. **No partial-merge resume:** If the process crashes mid-commit, `ReplayJournal` entries for successfully applied patches survive but the transaction record is lost. Resume logic would require WAL-style durability.
