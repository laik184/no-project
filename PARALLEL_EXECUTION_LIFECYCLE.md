# PARALLEL_EXECUTION_LIFECYCLE

**System:** NURA-X Parallel Specialist Swarm  
**Document:** Complete lifecycle from user input to completion

---

## FULL LIFECYCLE DIAGRAM

```
════════════════════════════════════════════════════════════════════
PHASE 0 — INGEST
════════════════════════════════════════════════════════════════════

User Input (WebSocket / HTTP)
    │
    ▼
ChatOrchestrator  [server/chat/orchestrator.ts]
    ├── Open SSE stream for client
    ├── Validate input
    └── Create run context (runId, projectId)
    │
    ▼
bus.emit("agent.event", { eventType: "run.started" })


════════════════════════════════════════════════════════════════════
PHASE 1 — PLAN (PARALLELIZABLE — not yet parallel)
════════════════════════════════════════════════════════════════════

OrchestrationEngine.executeOrchestration()
    │
    ├── Phase: observe   → read project state
    ├── Phase: analyze   → understand current codebase
    └── Phase: plan      → intent analysis + task graph
    │
    ▼
coordinateSpecialists(goal, runId, projectId)  [ENTRY POINT]
    │
    ▼
TaskDecomposer.decompose(goal)
    │
    ├── detectDomains(goal)    → ["database", "backend", "frontend", "security", "verification"]
    ├── buildDependsOn()       → assign inter-domain dependencies
    └── inferFileScope()       → assign exclusive + readonly file patterns
    │
    ▼
DependencyGraphBuilder.build(tasks)
    │
    ├── Kahn's topological sort
    ├── Cycle detection (DFS)
    └── Wave assignment:
          Wave 0: [database]
          Wave 1: [backend]
          Wave 2: [frontend, security]  ← PARALLEL
          Wave 3: [verification]
    │
    ▼
DecomposedPlan {
  runId, projectId, goal,
  tasks: SpecialistTask[],
  dependencyGraph: { nodes, edges, waves },
  estimatedWaves: 4
}


════════════════════════════════════════════════════════════════════
PHASE 2 — CONTEXT INITIALIZATION
════════════════════════════════════════════════════════════════════

ParallelSpecialistCoordinator.coordinate(plan)
    │
    ├── ExecutionContextFactory.create(plan)
    │     → CoordinationContext {
    │         activeTaskIds:    Set<string>   (initially empty)
    │         completedTaskIds: Set<string>   (initially empty)
    │         failedTaskIds:    Set<string>   (initially empty)
    │         results:          Map<taskId, SpecialistResult>
    │         abortController:  AbortController
    │         startedAt:        Date.now()
    │       }
    │
    ├── contextRegistry.register(ctx)
    │
    └── bus.emit("agent.event", { eventType: "coordination.start" })


════════════════════════════════════════════════════════════════════
PHASE 3 — WAVE EXECUTION LOOP
════════════════════════════════════════════════════════════════════

FOR EACH wave in dependencyGraph.waves:

    ┌──────────────────────────────────────────────────────┐
    │               WAVE N (e.g., Wave 2)                  │
    │                                                       │
    │  Tasks: [frontend, security]  (both start NOW)        │
    │                                                       │
    │  SpecialistWaveRunner.runWave(2, waveTasks, ctx)      │
    │                                                       │
    │  Promise.all([                                        │
    │    executeTask(frontend_task, ctx),                   │
    │    executeTask(security_task, ctx),                   │
    │  ])                                                   │
    └──────────────────────────────────────────────────────┘

For each task in the wave (in parallel):

    executeTask(task, ctx)
        │
        ├── bus.emit("agent.start")
        ├── executionContextFactory.markStarted(ctx, taskId)
        │
        ├── bus.emit("lock.acquire", { files })
        ├── unifiedLockCoordinator.acquire(filePath) × N files
        │         ← 10s timeout
        │         ← exclusive per file
        │         ← RAII: stored in `locks[]` for finally block
        ├── bus.emit("lock.acquired")
        │
        ├── centralWorkerPool.submit(CentralTask)
        │     ├── workerBackpressure.isAdmissionAllowed(tier)
        │     ├── workerPool.submit(workerTask)
        │     │     ├── [SPECIALIST EXECUTION HERE]
        │     │     └── return SpecialistResult
        │     └── telemetry: onCompleted / onFailed
        │
        ├── [SUCCESS]:
        │     executionContextFactory.markCompleted(ctx, result)
        │     bus.emit("agent.complete")
        │
        └── [FAILURE]:
              executionContextFactory.markFailed(ctx, taskId, error)
              bus.emit("agent.failed")
        │
        └── [FINALLY]: releaseAll(locks)
              bus.emit("lock.release")

After wave settles:
    bus.emit("DAG.node.complete", { waveIndex, succeeded, failed })

    IF succeeded === 0 AND failed > 0:
        ctx.abortController.abort()
        bus.emit("coordination.wave.total_failure")
        BREAK — skip remaining waves


════════════════════════════════════════════════════════════════════
PHASE 4 — RESULT AGGREGATION + CONFLICT RESOLUTION
════════════════════════════════════════════════════════════════════

After ALL waves complete (or run is aborted):

SpecialistResultMerger.merge(runId, allResults)
    │
    ├── MergePlanBuilder.build(runId, results)
    │     │
    │     ├── sortByDomainPriority(results)
    │     │     → [database, backend, security, frontend, verification]
    │     │
    │     ├── SpecialistConflictDetector.detect(runId, ordered)
    │     │     │
    │     │     ├── Index patches by filePath
    │     │     ├── Identify files with multiple patches
    │     │     ├── Classify: CONTENT | OWNERSHIP | ORDERING
    │     │     └── bus.emit("conflict.detected") per conflict
    │     │
    │     └── ResolutionStrategy.resolveAll(runId, conflicts)
    │           │
    │           ├── For each conflict:
    │           │     Strategy 1: byDomainPriority(patches, domains)
    │           │     Strategy 2: byConfidence(patches)
    │           │     Strategy 3: byContentSize(patches)
    │           │     Strategy 4: byFirstWriter(patches)  [deterministic]
    │           └── bus.emit("conflict.resolved") per decision
    │
    └── For each PatchGroup.winner:
          unifiedLockCoordinator.acquire(filePath, { timeoutMs: 8000 })
          appliedPatches.push(winner)
          bus.emit("merge.patch.applied")
          lockResult.handle.release()
    │
    └── bus.emit("merge.complete")


════════════════════════════════════════════════════════════════════
PHASE 5 — VERIFICATION (EXISTING — WAVE-PARALLEL)
════════════════════════════════════════════════════════════════════

ParallelVerificationEngine.run(runId, projectId)
    │
    ├── Wave A (PARALLEL):
    │     StaticVerifier    → TypeScript checks
    │     BuildVerifier     → compilation check
    │
    ├── VerificationBarrier.waitAll(waveA, timeout=30s)
    │
    ├── Wave B (PARALLEL):
    │     RuntimeVerifier   → process health check
    │     PreviewVerifier   → visual/DOM verification
    │
    ├── VerificationBarrier.waitAll(waveB, timeout=30s)
    │
    └── Wave C:
          StateReconciler   → final state consistency
    │
    └── CompletionAuthority.approve(runId)
          EvidenceGate.check(runId)


════════════════════════════════════════════════════════════════════
PHASE 6 — REFLECTION + MEMORY
════════════════════════════════════════════════════════════════════

[IF any phase failed]:
ReflectionEngine.analyze(runId, failures)
    ├── Root-cause classification
    ├── Strategy recommendation (retry/reroute/escalate)
    └── bus.emit("reflection.agent.completed")

ReflectionMemoryBridge
    └── Persist reflection findings to MemoryPipeline

[IF successful]:
MemoryPipeline.ingest(runId, results)
    └── Store successful patterns for future runs


════════════════════════════════════════════════════════════════════
PHASE 7 — COMPLETION
════════════════════════════════════════════════════════════════════

ParallelSpecialistCoordinator:
    ├── contextRegistry.unregister(runId)
    └── return CoordinationResult {
          success, results[], mergedPatches[],
          wavesExecuted, specialistsRan,
          parallelismFactor, durationMs
        }

OrchestrationEngine:
    └── Phase: score → grade run quality
        Phase: learn → persist successful patterns
        Phase: CompletionGate → final sign-off

SSE stream → frontend:
    └── Emit final run.completed event with CoordinationResult
```

---

## EXECUTION TIMING (ESTIMATED)

### Scenario: Full-stack feature (users table + API + React UI)

```
t=0ms     coordination.start
t=0ms     TaskDecomposer.decompose()               ~5ms
t=5ms     DependencyGraphBuilder.build()            ~2ms
t=7ms     ExecutionContextFactory.create()          ~1ms

t=8ms     Wave 0: database starts
t=8ms       lock.acquire (shared/schema.ts)          ~2ms
t=10ms      centralWorkerPool.submit(database)
t=4010ms    database completes                       ~4000ms

t=4010ms  Wave 1: backend starts
t=4010ms    lock.acquire (server/routes.ts)          ~2ms
t=4012ms    centralWorkerPool.submit(backend)
t=8012ms    backend completes                        ~4000ms

t=8012ms  Wave 2: frontend + security START PARALLEL
t=8012ms    ├── lock.acquire(client/src/)            ~2ms
t=8012ms    │   centralWorkerPool.submit(frontend)
t=8012ms    └── lock.acquire(server/security/)       ~2ms
t=8014ms        centralWorkerPool.submit(security)
t=13014ms   frontend completes                       ~5000ms
t=11014ms   security completes                       ~3000ms
t=13014ms  Wave 2 barrier resolves (both done)

t=13014ms Wave 3: verification starts
t=13014ms   centralWorkerPool.submit(verification)
t=16014ms   verification completes                   ~3000ms

t=16014ms SpecialistResultMerger.merge()             ~50ms
t=16064ms coordination.complete

TOTAL: ~16,064ms
vs SEQUENTIAL: ~20,000ms
SPEEDUP: 1.24x (constrained by database→backend serial dependency)

For tasks where backend+frontend+security all run in parallel:
SPEEDUP: up to 3x
```

---

## EVENT SEQUENCE (BUS EVENTS)

```
run.started
coordination.start
  DAG.node.start (wave=0)
    agent.start (database)
    lock.acquire
    lock.acquired
    agent.complete (database)
    lock.release
  DAG.node.complete (wave=0)
  DAG.node.start (wave=1)
    agent.start (backend)
    agent.complete (backend)
  DAG.node.complete (wave=1)
  DAG.node.start (wave=2)
    agent.start (frontend) ─┐
    agent.start (security)  │← emitted simultaneously
    lock.acquire (frontend)─┘
    lock.acquire (security)
    lock.acquired (frontend)
    lock.acquired (security)
    agent.complete (security)
    lock.release (security)
    agent.complete (frontend)
    lock.release (frontend)
  DAG.node.complete (wave=2)
  DAG.node.start (wave=3)
    agent.start (verification)
    agent.complete (verification)
  DAG.node.complete (wave=3)
merge.start
  [IF conflicts]: conflict.detected × N
  [IF conflicts]: conflict.resolved × N
merge.patch.applied × N
merge.complete
coordination.complete
verification.start
  [Wave A parallel]: static + build
  [Wave B parallel]: runtime + preview
  [Wave C]: reconcile
verification.complete
run.completed
```

---

## FAILURE HANDLING DECISION TREE

```
executeTask fails:
    ├── [retryable=true] → mark failed, continue wave
    └── [retryable=false] → mark failed, continue wave

Wave settles:
    ├── succeeded > 0 → continue to next wave
    └── succeeded = 0 → abort run, skip remaining waves

Lock acquisition fails (timeout):
    ├── Task proceeds without lock (availability mode)
    └── Patch may be skipped in merge (consistency mode)

Merge conflict unresolvable:
    └── ResolutionStrategy fallback chain always selects a winner
        (FIRST_WRITER is the deterministic terminal fallback)

Verification fails:
    └── ReflectionEngine → root-cause → recovery strategy
        → Retry or Reroute (existing infrastructure)
```
