# MERGE REPLAY LIFECYCLE

> Complete trace of the merge pipeline execution and replay paths.

---

## EXECUTION LIFECYCLE TRACE

```
t=0   SpecialistResults[] arrive at MergePipeline.run(runId, results)
      │
      ├─ emit: merge.patch.received  (per patch per specialist)
      │
t=1   MergePlanBuilder.build(runId, results)
      │
      ├─ sort results by DOMAIN_MERGE_PRIORITY
      ├─ SpecialistConflictDetector.detect()
      │   ├─ Group patches by filePath
      │   ├─ Single-claimant → safe[]
      │   └─ Multi-claimant → classify CONTENT | OWNERSHIP | ORDERING
      │       └─ emit: merge.conflict.detected (per conflict)
      │
      ├─ ConflictGraphBuilder.build()
      │   ├─ _buildNodes() → ConflictNode[] (filePath, domains, priority)
      │   ├─ _buildEdges() → ConflictEdge[] (cross-file, structural)
      │   ├─ _detectCycles() → DFS with inStack tracking
      │   ├─ _topoSort() → Kahn's BFS (only if acyclic)
      │   └─ emit: graph.built (nodes, edges, cycles)
      │
      ├─ For each conflict → ResolutionStrategy.resolve()
      │   ├─ byAstMerge()       (CONTENT + 2 patches → LCS merge)
      │   ├─ byDomainPriority() (count candidates at min priority)
      │   ├─ byConfidence()     (sort descending, no tie)
      │   └─ byContentSize()    (sort descending, always returns)
      │       └─ emit: merge.conflict.resolved (strategy, reasoning)
      │
      ├─ _applyTopOrder() → groups reordered by topological sort
      │
      └─ MergePlan { runId, groups[], conflictCount, safeCount }

t=2   emit: merge.start (patchCount, conflictCount)

t=3   MergeTransactionManager.begin(runId, winners[])
      │
      ├─ PatchValidationBarrier.validateAll()
      │   └─ emit: merge.patch.validated (per patch, valid or rejected)
      │
      └─ txId = "tx-{uuid8}"  status=pending

t=4   For each valid patch → unifiedLockCoordinator.acquire()
      │
      ├─ [SUCCESS] lockHandle added to lockHandles[]
      └─ [TIMEOUT] emit: merge.patch.skipped (reason: lock_acquisition_failed)
                   patch excluded from commit

t=5   MergeTransactionManager.commit(txId)
      │
      ├─ transactionalPatchApplier.applyBatch(runId, patches)
      │   ├─ For each patch:
      │   │   ├─ snapshot = readFile(absPath) or undefined
      │   │   ├─ apply: mkdir + writeFile | unlink
      │   │   ├─ emit: merge.patch.applied (filePath, op, durationMs)
      │   │   └─ PatchApplyOutcome { status, snapshot, hadFile, durationMs }
      │   └─ [FAILURE at index N] → firstFailure = N, stop
      │
      ├─ [FAILURE] _rollbackOutcomes(outcomes[0..N-1]) in reverse
      │   ├─ For i = N-1 downto 0:
      │   │   └─ transactionalPatchApplier.rollback(outcome[i])
      │   │       ├─ hadFile=false → unlink created file
      │   │       └─ hadFile=true  → writeFile(snapshot)
      │   ├─ emit: merge.rollback (txId, reason, rolledBack)
      │   └─ tx.status = "rolled_back"
      │
      └─ [SUCCESS] replayJournal.recordBatch(runId, txId, patches, "TRANSACTIONAL")
          ├─ For each patch → JournalEntry appended to _store[runId]
          ├─ emit: journal.entry (entryId, filePath, strategy)
          └─ tx.status = "committed"
              └─ emit: tx.commit (txId, applied, durationMs)

t=6   lockHandles.forEach(h => h.release())   ← always, regardless of outcome

t=7   ReconciliationEngine.reconcile(runId, plan, appliedPatches)
      │
      ├─ emit: merge.reconcile.start (patchCount)
      │
      ├─ Check 1: winner_not_applied
      │   └─ plan.groups with winner not in appliedPaths → anomaly
      │
      ├─ Check 2: duplicate_application
      │   └─ applied.filter(p => p.filePath === filePath).length > 1 → anomaly
      │
      ├─ Check 3: delete_create_collision
      │   └─ ops.has("delete") && ops.has("create"|"update") → anomaly
      │
      ├─ Check 4: unresolved_conflict
      │   └─ group.hasConflict && !group.winner → anomaly
      │
      ├─ Check 5: journal_missing
      │   └─ applied patch filePath not in journalPaths → anomaly
      │
      ├─ consistent = anomalies.length === 0  ← computed LAST (post-fix)
      │
      └─ emit: merge.reconcile.complete (consistent, patchesVerified, anomalies)

t=8   MergeMemoryBridge.persist(runId, memoryOutcomes[])
      │
      └─ For each resolved conflict:
          ├─ key = "${domain}:${conflictType}"
          ├─ push StrategyRecord to ring buffer (cap=50)
          └─ emit: memory.write (filePath, outcome, strategy)

t=9   emit: merge.complete (applied, skipped, durationMs)

      return MergeResult {
        runId, patches, appliedCount, skippedCount,
        durationMs, consistent, txId, cyclesDetected
      }
```

---

## REPLAY PATH (given a runId)

```
replayJournal.replay(runId)
    │
    ├─ entries = _store.get(runId) ?? []
    ├─ sort by recordedAt (ascending — deterministic order)
    └─ patches = entries.map(e => ({
           filePath:   e.filePath,
           operation:  e.operation,
           content:    e.content,
           confidence: e.confidence,
       }))
    └─ return { runId, entries, patches }

To re-apply a merge from journal:
    const { patches } = replayJournal.replay(runId)
    const { txId }    = mergeTransactionManager.begin(runId, patches)
    await mergeTransactionManager.commit(txId)
```

---

## ROLLBACK PATH (on commit failure)

```
Commit fails at patch index N (0-based):
    outcomes = [applied, applied, ..., failed]
                [0]      [1]              [N]

_rollbackOutcomes(outcomes.slice(0, N)):
    Iterate reverse: [N-1, N-2, ..., 0]
    For each outcome where status === "applied":
        if hadFile === false:
            unlink(absPath)          ← undo created file
        elif snapshot !== undefined:
            writeFile(absPath, snapshot)  ← restore previous content
        → returns true on success, false on FS error

After rollback:
    tx.status = "rolled_back"
    emit: merge.rollback { txId, reason: outcome[N].error, rolledBack: count }
```

---

## CONFLICT GRAPH LIFECYCLE

```
ConflictReport { conflicts[], safe[] }
    │
    ▼
ConflictGraphBuilder.build(runId, report)
    │
    ├─ _buildNodes()
    │   For each conflict:
    │       node.filePath = conflict.filePath
    │       node.domains  = conflict.domains
    │       node.priority = min(DOMAIN_MERGE_PRIORITY[d] for d in domains)
    │
    ├─ _buildEdges()
    │   Rule 1 — Cross-file domain edges:
    │       For conflicts[i] and conflicts[j] where i≠j:
    │           sharedDomains = ci.domains ∩ cj.domains
    │           if sharedDomains non-empty:
    │               edge: lowerPriorityFile → higherPriorityFile
    │               (lower priority number = higher authority = resolved first)
    │
    │   Rule 2 — Structural path edges:
    │       Sort nodes by structuralPriority(filePath):
    │           *.schema.ts  → 1
    │           migration/*  → 2
    │           *.routes.*   → 4
    │           *.service.*  → 5
    │           *.component* → 7
    │           *.test.*     → 9
    │       Add edge: sortedNodes[i] → sortedNodes[i+1]
    │
    ├─ _detectCycles()  [DFS with inStack]
    │   Color: white=unvisited, gray=inStack, black=visited
    │   Cycle = path from gray node back to another gray node
    │   Returns: string[][] (each inner array = cycle file paths)
    │
    └─ _topoSort()  [Kahn's BFS]
        inDegree[] initialized from edges
        Queue = nodes where inDegree === 0
        Pop node → result.push → decrement successors' inDegree
        Result = [] if cyclic (caller falls back to plan order)
```

---

## TELEMETRY TIMELINE

```
t=0   merge.patch.received   × N   (one per incoming patch)
t=1   merge.conflict.detected × C  (one per conflict group)
t=1   merge.conflict.resolved × C  (one per conflict group)
t=1   graph.built             × 1
t=2   merge.start             × 1
t=3   merge.patch.validated   × P  (one per patch, valid or not)
t=3   tx.begin               × 1
t=4   merge.patch.skipped    × S  (lock failures)
t=5   merge.patch.applied    × A  (successful FS writes)
t=5   merge.rollback         × 0|1 (only on failure)
t=5   tx.commit              × 0|1 (only on success)
t=5   journal.entry          × A  (one per committed patch)
t=7   merge.reconcile.start  × 1
t=7   merge.reconcile.complete × 1
t=8   memory.write           × R  (one per resolved conflict outcome)
t=9   merge.complete         × 1

Total events per run: 5 + 4×(patches) + 3×(conflicts) + 2×(applied)
```
