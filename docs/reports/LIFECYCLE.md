# LIFECYCLE — Specialist Coordination Request Lifecycle

Full end-to-end trace of a single swarm coordination request.

---

## Phase 1: Entry — Orchestration Engine Routes to Swarm

```
OrchestrationEngine.run({ mode: "swarm", goal, runId, projectId })
  → execution-router.ts#route()
  → case "swarm": executeSwarm(ctx)
  → coordinateSpecialists(goal, runId, projectId, metadata)
```

**New**: `"swarm"` case was missing before this upgrade. All swarm requests
were silently ignored.

---

## Phase 2: Task Decomposition

```
taskDecomposer.decompose(goal, runId, projectId, context)
  → LLM-based or heuristic decomposition of `goal` into SpecialistTask[]
  → Each task: { taskId, domain, goal, scope, dependsOn, timeoutMs }
  → Returns DecomposedPlan with ordered wave assignments
```

**Wave assignment example** for "Add users table + REST API + React UI":
- Wave 1: `database` (schema), `backend` (routes) — independent, run parallel
- Wave 2: `frontend` (UI), `security` (auth guard) — depend on wave 1
- Wave 3: `verification` — must run last

---

## Phase 3: Wave Execution

```
specialistWaveRunner.runWave(wave, ctx)
  For each task in wave (concurrent Promise.all):
    1. contextRegistry.create(runId, taskId)
    2. acquireTaskLocks(task.scope.exclusiveFiles)
    3. centralWorkerPool.submit({
         fn: () => specialistDispatcher.dispatch(task, signal)
       })
    4. Release locks on completion or error
    5. executionContextFactory.markCompleted(ctx, result)
```

**Lock semantics**: Exclusive locks prevent two specialists from writing the same file
concurrently. The `unifiedLockCoordinator` handles deadlock detection.

---

## Phase 4: Specialist Execution (per task)

```
specialistDispatcher.dispatch(task, signal)
  → emit "specialist.start" on bus
  → executeSpecialist(task, signal)
      → getDomainConfig(task.domain) → { systemPrompt, maxSteps }
      → runAgentLoop({
          goal: "[DOMAIN SPECIALIST] " + task.goal,
          systemPrompt: <domain-specific prompt>,
          maxSteps: <domain budget>,
          signal: <from CoordinationContext.abortController>,
        })
          → N × LLM calls to OpenRouter
          → Tool calls: write_file, read_file, search, etc.
          → Returns AgentLoopResult { success, summary, steps, stopReason }
      → extractPatches(summary, domain) → FilePatch[]
  → emit "specialist.complete" or "specialist.failed" on bus
  → return SpecialistResult { taskId, domain, success, patches, durationMs }
```

---

## Phase 5: Conflict Resolution

```
specialistConflictDetector.detect(wave1Results, wave2Results, ...)
  → Identifies overlapping file writes across domain boundaries
  → Returns ConflictSet[]

resolutionStrategy.resolve(conflicts)
  → Applies domain priority rules (database > backend > frontend)
  → Returns ResolvedConflict[] with winner/loser decisions
```

---

## Phase 6: Merge Planning

```
mergePlanBuilder.build(results, resolvedConflicts)
  → Groups patches by file path
  → Assigns merge strategy: last-write-wins | union | manual
  → Returns MergePlan with ordered patch application steps

specialistResultMerger.merge(plan)
  → Applies patches in dependency order
  → Emits merge.patch.applied / merge.patch.skipped events
  → Returns CoordinationResult with mergedPatches[]
```

---

## Phase 7: Post-Coordination Verification

```
verifyCoordinationResult(coordinationResult)  ← NEW
  → Check 1: specialistsRan > 0
  → Check 2: no duplicate patch file paths
  → Check 3: avg patch confidence ≥ 0.60
  → Verdict: pass | warn | block
  → block → surfaced to orchestration engine as error
  → pass/warn → result returned to executeSwarm()
```

---

## Phase 8: Cleanup

```
contextRegistry sweeper (every 60s)  ← NEW
  → Evicts contexts marked completed
  → Evicts contexts exceeding maxAgeMsActive (default: 30 min)
  → Prevents unbounded memory accumulation
```

---

## Timeline (typical 3-domain swarm, 5-second LLM response times)

```
T+0s     Request received, task decomposition started
T+1s     Wave 1 starts: database + backend agents dispatched in parallel
T+6s     Wave 1 completes (5s avg LLM time × 2 domains in parallel = ~5s)
T+7s     Conflict detection + merge plan built
T+8s     Wave 2 starts: frontend + security dispatched in parallel
T+13s    Wave 2 completes
T+14s    Wave 3 starts: verification
T+19s    Wave 3 completes
T+20s    Post-coordination verification
T+20s    CoordinationResult returned to executeSwarm()
         parallelismFactor = 5 domains / 3 waves = 1.67x
```
