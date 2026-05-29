# PLANNING & EXECUTION INTELLIGENCE MRI REPORT
## Forensic Analysis — Nura-X Orchestration System
**Scope:** planner-agent.ts · phase-planner.ts · phase-runner.ts + supporting files  
**Method:** Static code analysis only. No assumptions. No recommendations. Evidence-only.

---

## PHASE 1 — PLANNER MRI

### Imports & Exports

**File:** `server/agents/planner/planner-agent.ts`

```
IMPORTS:
  PlanningRequest, PlanningResult          ← planner.types.ts
  buildPlanningContext                     ← planner-context.ts
  plannerSession                           ← planner-session.ts
  plannerMetrics                           ← planner-metrics.ts
  plannerLogger                            ← planner-logger.ts
  planningMonitor                          ← planning-monitor.ts
  validatePlanningRequest, validateRuntimeContext ← planning-validator.ts
  runPlanningLoop                          ← planning-loop.ts
  makeRunId                                ← planning-utils.ts

EXPORTS:
  initializePlanner()         → void
  shutdownPlanner()           → void
  runPlannerCycle(ctx)        → Promise<PlannerCycleResult>   ← called by orchestration
  plan(req)                   → Promise<PlanningResult>       ← main internal entry
  createExecutionPlan(input)  → Promise<CreateExecutionPlanResult>  ← wrapper
```

### Public Methods & Internal Workflow

```
runPlannerCycle(ctx: { runId, projectId, goal, metadata? })
  └─ calls plan({ runId, projectId, sandboxRoot, goal, meta })
       └─ returns PlannerCycleResult: { success, planId?, failedPhase?, error? }
       NOTE: planId is result.plan?.planId — the FULL plan is not returned

plan(req: PlanningRequest)
  1. validatePlanningRequest(req)
  2. validateRuntimeContext(runId, projectId, sandboxRoot)
  3. plannerSession.open(...)
  4. buildPlanningContext(runId, projectId, sandboxRoot, goal, meta, signal)
  5. runPlanningLoop(context)         ← returns ExecutionPlan | null
  6. plannerSession.close(...)
  └─ returns PlanningResult: { runId, success, plan?: ExecutionPlan, durationMs, errors }
```

**File:** `server/agents/planner/execution/planning-loop.ts`

```
runPlanningLoop(context: PlanningContext) → ExecutionPlan | null

  Step 1. analyzeGoal(goal)                    → analysis (components etc.)
  Step 2. buildTaskList(goal, projectId)        → PlannedTask[]
  Step 3. resolveDependencies(tasks, components)→ { orderedTasks, errors, warnings }
  Step 4. buildExecutionPhases(orderedTasks, components) → ExecutionPhase[]
  Step 5. refinement loop (MAX_REFINEMENTS = 2):
            buildExecutionPlan({ runId, projectId, goal, tasks, phases, meta, analysis })
            validateExecutionPlan(candidate)
            if valid:
              plan = buildExecutionPlan(... + validation)
              plannerState.setPlan(runId, plan)   ← stored in in-memory Map
              break
  Step 6. buildCoordinatorTasks(plan)           → CoordinatorTask[]
  Step 7. runCoordinatorTasks(coordinatorTasks, context)
  Step 8. return plan
```

### Q&A — Planner Reality

**Q1. What exactly does planner produce?**  
A real `ExecutionPlan` (planner.types.ts) with:
```typescript
{
  planId:            string,
  runId:             string,
  projectId:         string,
  goal:              string,
  phases:            ExecutionPhase[],   // grouped by phase index
  tasks:             PlanTask[],         // flat ordered list
  totalTasks:        number,
  estimatedMs:       number,
  createdAt:         number,
  meta:              Record<string, unknown>,
  appType:           string,
  complexity:        string,
  validationResults: PlanValidationResults
}
```

**Q2. Does planner create a real ExecutionPlan?**  
YES. `buildExecutionPlan()` is called in the refinement loop at `planning-loop.ts:93–112`. A real, validated `ExecutionPlan` with tasks, phases, dependencies, and complexity metadata is produced.

**Q3. Does planner create tasks?**  
YES. `buildTaskList(goal, projectId)` at `planning-loop.ts:53`. Tasks become `PlannedTask[]` then `PlanTask[]` in the final plan.

**Q4. Does planner create dependencies?**  
YES. `resolveDependencies(tasks, analysis.components)` at `planning-loop.ts:64`. Each `PlannedTask` has `dependencies: string[]`. Each `PlanTask` has `dependencies: string[]`.

**Q5. Does planner create DAGs?**  
YES. Dependency resolution produces an ordered task list. The execution plan's tasks field is a flat ordered list derived from topological sort.

**Q6. Does planner create workflows?**  
NO. The planner creates `ExecutionPhase[]` (planner.types.ts), NOT `Workflow[]` (orchestration.types.ts). These are different structures. The orchestration `Workflow` type is created by `workflow-planner.ts`, not by the planner agent.

**Q7. Does planner return only planId?**  
At the `runPlannerCycle` boundary: YES. `runPlannerCycle` returns `{ success, planId?, error? }`.  
At the `plan()` boundary: NO. Full `PlanningResult.plan` (ExecutionPlan) is returned.  
Evidence — `planner-agent.ts:70–74`:
```typescript
return {
  success:     result.success,
  planId:      result.plan?.planId,   // ← only planId extracted
  error:       result.errors[0],
  failedPhase: ...
};
```

**Q8. Where is the generated plan stored?**  
`plannerState.setPlan(runId, plan)` at `planning-loop.ts:113`. This is an in-memory Map keyed by `runId`.

**Q9. Is the plan discarded?**  
PARTIALLY. The plan is stored in `plannerState`. However, the caller of `runPlannerCycle` (agent-coordinator.ts, orchestration layer) receives only `PlannerCycleResult: { success, planId }`. Nothing reads from `plannerState` in the downstream executor path. The coordinator task dispatch via `runCoordinatorTasks` calls `routePlanningTask` with `toolName: 'create_execution_plan'` — this is a tool-layer call, not a direct pass to the executor agent.

**Q10. Is planner output actually used later?**  
PARTIAL. `plannerState.setPlan(runId, plan)` stores the plan. The coordinator tasks (Step 6/7) dispatch metadata about the plan via `toolName: 'create_execution_plan'` but this does not inject the full ExecutionPlan into the executor's phase input. The orchestration executor phase receives no plan from the planner phase output.

---

## PHASE 2 — PHASE PLANNER MRI

**File:** `server/orchestration/planning/phase-planner.ts`

### Phase Generation Logic

```typescript
buildPhases(req, intent, primaryAgent) → Phase[]
  intent='build_feature'|'add_api'|'generate_ui' → buildStandardPhases(baseInput, primaryAgent)
  intent='fix_bug'                                → buildBugFixPhases(baseInput)
  intent='refactor'                               → buildRefactorPhases(baseInput)
  intent='verify_runtime'                         → buildVerifyPhases(baseInput)
  default                                         → buildStandardPhases(baseInput, primaryAgent)
```

### baseInput Construction (line 38–44)

```typescript
const baseInput: Record<string, unknown> = {
  goal:        req.goal,
  projectId:   req.projectId,
  sandboxRoot: req.sandboxRoot,
  runId:       req.runId,
  context:     req.context ?? {},   // ← defaults to empty object if not provided
};
```

### Standard Phases Input Matrix

| Phase | agentType | input (beyond baseInput) | plan injected? | prior output injected? |
|-------|-----------|--------------------------|----------------|------------------------|
| plan  | planner   | `mode: 'plan'`           | NO             | NO                     |
| execute | primaryAgent | `mode: 'execute'`   | NO             | NO                     |
| verify | verifier  | `mode: 'verify'`         | NO             | NO                     |

### Bug Fix Phases Input Matrix

| Phase   | agentType | input (beyond baseInput)   | plan injected? | prior output injected? |
|---------|-----------|----------------------------|----------------|------------------------|
| analyze | planner   | `mode: 'analyze_bug'`      | NO             | NO                     |
| fix     | executor  | `mode: 'fix'`              | NO             | NO                     |
| verify  | verifier  | `mode: 'verify_fix'`       | NO             | NO                     |

### Refactor Phases Input Matrix

| Phase    | agentType | input (beyond baseInput)     | plan injected? | prior output injected? |
|----------|-----------|------------------------------|----------------|------------------------|
| analyze  | planner   | `mode: 'analyze_refactor'`   | NO             | NO                     |
| refactor | executor  | `mode: 'refactor'`           | NO             | NO                     |
| verify   | verifier  | `mode: 'verify_refactor'`    | NO             | NO                     |

### Verify Phases Input Matrix

| Phase  | agentType  | input (beyond baseInput) | plan injected? | prior output injected? |
|--------|------------|--------------------------|----------------|------------------------|
| verify | verifier   | `mode: 'verify'`         | NO             | NO                     |
| report | supervisor | `mode: 'report'`         | NO             | NO                     |

### Q&A — Phase Planner Reality

**Q1. How are phases created?**  
`makePhase(name, agentType, input, optional, dependsOn)` factory using `Object.freeze()`. Phase IDs are generated via `newPhaseId()`. Dependencies are expressed as phaseId arrays.

**Q2. What inputs are sent to planner?**  
`{ goal, projectId, sandboxRoot, runId, context: req.context??{}, mode: 'plan' }` — no prior analysis, no history, no context beyond what arrived in the original request.

**Q3. What inputs are sent to executor?**  
`{ goal, projectId, sandboxRoot, runId, context: req.context??{}, mode: 'execute' }` — **no plan from planner phase**. The executor receives only the original request fields plus a `mode` string.

**Q4. What inputs are sent to verifier?**  
`{ goal, projectId, sandboxRoot, runId, context: req.context??{}, mode: 'verify' }` — **no executor output**, no file list, no port number from the actual run.

**Q5. Are browser/filesystem/terminal inputs valid?**  
NO. When these agents are invoked via phase dispatch, their required fields (`url`, `operations`, `steps`) are NOT in any phase input. agent-coordinator.ts supplies fallback empty defaults:
- `browser.url` → `''` (line 91)  
- `filesystem.operations` → `[]` (line 152)  
- `terminal.steps` → `[]` (line 162)

**Q6. Which fields are hardcoded?**  
`mode: 'plan' | 'execute' | 'verify' | 'fix' | ...` — hardcoded strings at phase build time.

**Q7. Which fields are empty?**  
`context: req.context ?? {}` — defaults to `{}` when the orchestration request carries no context.

**Q8. Which fields are placeholders?**  
The `mode` field across all phases is a plain string label with no runtime effect on what the planner or executor actually does with it beyond prefixing the goal string in agent-coordinator.ts line 111.

**Q9. Which fields are never populated?**  
- `plan` — never present in any phase input at build time  
- `phases` (verifier) — never present in phase input at build time  
- `port` (verifier) — never present in phase input at build time  
- `url` (browser) — never present in phase input at build time  
- `flows` (browser) — never present  
- `operations` (filesystem) — never present  
- `steps` (terminal) — never present  

**Q10. Which fields can cause silent failures?**  
- `verifier.phases` is `input.phases as any` with no default. If undefined, verifier receives `phases: undefined`.  
- `browser.url` defaults to `''` — browser agent receives empty URL, likely producing a failed navigation.  
- `context: req.context ?? {}` — silently passes empty context to all phases, giving planner no historical state.

---

## PHASE 3 — PHASE RUNNER MRI

**File:** `server/orchestration/execution/phase-runner.ts`

### Execution Sequence

```
runPhase(phase, workflowId, ctx, config)
  1. toToolContext(ctx, { workflowId, phaseId })  → toolCtx
  2. createRetryState(phase.phaseId, config)       → retryState
  3. recordPhaseStarted / setActivePhase
  LOOP:
    4. dispatchPhaseToAgent(phase, toolCtx, attempt)  → PhaseResult
    5. if result.ok → return result
    6. if not ok → buildRetryDecision(result, retryState, phase.optional)
       decision='skip'  → return { ...result, ok:true }
       decision='abort' → return result
       else             → advanceRetry, applyRetryDelay, continue loop
```

### Q&A — Phase Runner Reality

**Q1. Does phase output flow into next phase?**  
NO. `runPhase` returns `PhaseResult` containing `output?: unknown`. That output is collected into `phaseResults` array in `workflow-runner.ts` but is **never read** to enrich any subsequent phase's `phase.input`. Each phase runs against its frozen, build-time input.

**Q2. Does planner output reach executor?**  
NO. The planner phase returns a `PlannerCycleResult: { success, planId }` wrapped in `PhaseResult.output`. The executor phase runs next with the same static `baseInput` it had at construction time. There is no code path that reads `phaseResults[0].output` and merges it into `phaseResults[1]`'s phase input.

**Q3. Does executor output reach verifier?**  
NO. Same mechanism. Verifier receives `{ goal, projectId, sandboxRoot, runId, context, mode: 'verify' }` from phase build time. `PhaseResult.output` from executor phase is collected but never forwarded.

**Q4. Is context merged?**  
NO. `OrchestrationContext` is immutable (`Object.freeze` in `buildOrchestrationContext`). `toToolContext` projects it to `{ runId, projectId, sandboxRoot, signal, meta }`. No merge of prior phase outputs occurs.

**Q5. Is context discarded?**  
PARTIALLY. The static orchestration context (IDs, timestamps) is passed through. Dynamic phase outputs are discarded between phases.

**Q6. Is phase memory preserved?**  
NO. There is no per-run memory store that accumulates phase results and makes them available to subsequent phases. The `phaseResults` array lives only within the `runWorkflow` stack frame.

**Q7. Is phase state preserved?**  
NO. Beyond the in-memory `plannerState.setPlan(runId, plan)` (never read externally), no phase state is persisted or forwarded.

**Q8. Are outputs persisted?**  
NO evidence in any of these files that `PhaseResult.output` is written to the database or any persistent store.

**Q9. Are outputs ignored?**  
YES. `phaseResults.push(...results)` at `workflow-runner.ts:74` collects them for the `WorkflowResult` envelope, but they are not read for inter-phase enrichment.

**Q10. Are outputs overwritten?**  
NO — they are not overwritten, but they are never read by the phases that follow them.

---

## PHASE 4 — EXECUTION PLAN LIFECYCLE TRACE

### Two Distinct ExecutionPlan Types

```
TYPE A: server/agents/planner/types/planner.types.ts — "Planner ExecutionPlan"
  { planId, runId, projectId, goal, phases: ExecutionPhase[], tasks: PlanTask[],
    totalTasks, estimatedMs, createdAt, meta, appType, complexity, validationResults }

TYPE B: server/orchestration/types/orchestration.types.ts — "Orchestration ExecutionPlan"
  { planId, requestId, workflows: Workflow[], createdAt }

TYPE C: server/agents/executor/types/executor.types.ts — "Executor ExecutionPlan"
  { planId: string, tasks: ExecutionTask[] }
```

### Planner ExecutionPlan (Type A) Lifecycle

| Event | File | Line | Method |
|-------|------|------|--------|
| Created | planning-loop.ts | 93 | `buildExecutionPlan({...})` inside refinement loop |
| Re-created (with validation) | planning-loop.ts | 105 | `buildExecutionPlan({..., validation})` |
| Stored | planning-loop.ts | 113 | `plannerState.setPlan(runId, plan)` |
| Returned up | planning-loop.ts | 147 | `return plan` → `runPlanningLoop` caller |
| Received | planner-agent.ts | 124 | `const executionPlan = await runPlanningLoop(context)` |
| Returned up | planner-agent.ts | 150–154 | `return { ..., plan: executionPlan }` inside `plan()` |
| Discarded | planner-agent.ts | 70–74 | `runPlannerCycle` extracts only `result.plan?.planId` |
| **LOST** | agent-coordinator.ts | 137–142 | `runPlannerCycle(...)` caller receives only `{ success, planId }` |

### Synthetic ExecutionPlan (Type C fallback) Lifecycle

| Event | File | Line | Evidence |
|-------|------|------|---------|
| Built | agent-coordinator.ts | 112–126 | `const plan = providedPlan ?? { planId: 'auto-${runId}', tasks: [{ taskId, kind: 'coding', description: effectiveGoal }] }` |
| Trigger condition | agent-coordinator.ts | 106 | `const providedPlan = input.plan as {...} | undefined` — undefined because phase-planner never adds `plan` to executor phase input |
| Always fires | phase-planner.ts | 73 | `makePhase('execute', primaryAgent, { ...baseInput, mode: 'execute' })` — no `plan` key |
| Passed to executor | agent-coordinator.ts | 127–133 | `runExecutorAgent({ runId, projectId, sandboxRoot, plan: plan as any })` |

**Q6. Is ExecutionPlan ever lost?**  
YES. The rich Planner ExecutionPlan is lost at the `runPlannerCycle` boundary. Only `planId` string escapes.

**Q7. Is ExecutionPlan rebuilt?**  
YES. agent-coordinator.ts always rebuilds a synthetic flat single-task plan for the executor.

**Q8. Is ExecutionPlan ignored?**  
YES (the planner's real one). The executor always runs against the synthetic fallback.

---

## PHASE 5 — CONTEXT PROPAGATION AUDIT

### What Survives Between Phases

```
Goal ──────────────────────────────────────────────────────────► Planner    ✓ (in phase.input.goal)
Goal ──────────────────────────────────────────────────────────► Executor   ✓ (in phase.input.goal, synthetic plan)
Goal ──────────────────────────────────────────────────────────► Verifier   ✓ (in phase.input.goal)
runId, projectId, sandboxRoot ─────────────────────────────────► all phases ✓ (in baseInput)
req.context ────────────────────────────────────────────────────► all phases ✓ (or {} if absent)
mode string ────────────────────────────────────────────────────► each phase ✓ (hardcoded per intent)
```

### What Gets Lost Between Phases

```
Planner ExecutionPlan (tasks, phases, deps, complexity) ────────► LOST at runPlannerCycle boundary
Planner analysis (components, appType, complexity) ─────────────► LOST (stays in planning-loop stack)
Planner task list (full PlanTask[]) ────────────────────────────► LOST
Planner dependency graph ────────────────────────────────────────► LOST
Executor outputs (files written, commands run, errors) ──────────► LOST (in PhaseResult.output, never read)
Verifier findings ───────────────────────────────────────────────► LOST (in PhaseResult.output, never read)
```

### Context Propagation Graph

```
OrchestrationRequest
 { orchestrationId, runId, projectId, sandboxRoot, goal, context? }
        │
        ▼
OrchestrationContext (frozen)
 { orchestrationId, runId, projectId, sandboxRoot, sessionId, startedAt, signal? }
        │
        ├──► Phase[0] input: { goal, projectId, sandboxRoot, runId, context, mode:'plan' }
        │           │
        │    dispatchPhaseToAgent(phase, toolCtx, attempt)
        │           │
        │    runPlannerCycle(...)  → PlannerCycleResult { success, planId }
        │           │
        │    PhaseResult[0].output = PlannerCycleResult    ← collected but never forwarded
        │
        ├──► Phase[1] input: { goal, projectId, sandboxRoot, runId, context, mode:'execute' }
        │    [SAME baseInput as Phase[0] — planner output NOT merged]
        │           │
        │    dispatchPhaseToAgent(phase, toolCtx, attempt)
        │           │
        │    synthetic plan built: { planId:'auto-${runId}', tasks:[{...goal...}] }
        │           │
        │    runExecutorAgent({ plan: synthetic })
        │           │
        │    PhaseResult[1].output = ExecutorAgentResult    ← collected but never forwarded
        │
        └──► Phase[2] input: { goal, projectId, sandboxRoot, runId, context, mode:'verify' }
             [SAME baseInput — executor output NOT merged]
                    │
             dispatchPhaseToAgent(phase, toolCtx, attempt)
                    │
             runVerification({ phases: undefined, port: undefined })
```

---

## PHASE 6 — DESIGN DEBT DETECTION

### Finding 001 — Planner Output Truncated at runPlannerCycle Boundary
- **File:** `server/agents/planner/planner-agent.ts`
- **Lines:** 69–74
- **Severity:** CRITICAL
- **Evidence:**
  ```typescript
  return {
    success:     result.success,
    planId:      result.plan?.planId,  // only planId
    error:       result.errors[0],
    failedPhase: ...
  };
  ```
- **Impact:** Full ExecutionPlan with tasks, dependencies, phases never exits runPlannerCycle.
- **Runtime consequence:** Executor never receives the plan the planner spent cycles building.

### Finding 002 — Synthetic Plan Always Fires
- **File:** `server/orchestration/coordination/agent-coordinator.ts`
- **Lines:** 102–126
- **Severity:** CRITICAL
- **Evidence:**
  ```typescript
  // Build a minimal valid ExecutionPlan when the orchestration workflow
  // did not inject one — this happens in all standard phase sequences
  const providedPlan = input.plan as { planId: string; tasks: unknown[] } | undefined;
  const plan = providedPlan ?? {
    planId: `auto-${runId}`,
    tasks: [{
      taskId:      `task-${runId}`,
      kind:        'coding',
      description: effectiveGoal || 'Execute the requested goal',
      input: { goal: effectiveGoal || goal, mode, runId, projectId, sandboxRoot },
    }],
  };
  ```
- **Impact:** Executor always runs a single flat synthetic task regardless of planner output.
- **Runtime consequence:** All dependency ordering, phase grouping, and task decomposition from planner is discarded. Executor performs one coding task per run.

### Finding 003 — Phase Output Never Forwarded to Next Phase
- **File:** `server/orchestration/execution/workflow-runner.ts`
- **Lines:** 64–87
- **Severity:** CRITICAL
- **Evidence:**
  ```typescript
  const results = await Promise.all(
    wavePhases.map(phase => runPhase(phase, workflow.workflowId, ctx, retryConfig))
  );
  phaseResults.push(...results);
  // results are pushed to phaseResults array only — no injection into next phase
  ```
  Next wave: `runPhase(phase, ...)` where `phase.input` is the original frozen build-time object.
- **Impact:** Planner output never reaches executor. Executor output never reaches verifier.
- **Runtime consequence:** Each phase runs in total isolation from its predecessors.

### Finding 004 — Two Incompatible ExecutionPlan Types With Same Name
- **Files:** `server/agents/planner/types/planner.types.ts` / `server/orchestration/types/orchestration.types.ts` / `server/agents/executor/types/executor.types.ts`
- **Lines:** planner.types.ts:88, orchestration.types.ts:110, executor.types.ts:46
- **Severity:** HIGH
- **Impact:** Three different shapes named `ExecutionPlan` with no shared interface. Type casts via `as any` at agent-coordinator.ts:131 mask the incompatibility.
- **Runtime consequence:** TypeScript does not catch misaligned field access across boundaries.

### Finding 005 — Coordinator Tasks Call Tool 'create_execution_plan' But Don't Transfer Plan to Executor
- **File:** `server/agents/planner/coordination/agent-coordinator.ts`
- **Lines:** 25–58
- **Severity:** HIGH
- **Evidence:**
  ```typescript
  toolName:  'create_execution_plan',
  input: {
    planId, runId, projectId, phaseIndex, strategy, taskCount, taskIds, goal
  }
  ```
  No `tasks`, no `phases`, no full plan object. The sealed task adds `totalTasks` and `phaseCount` but not the actual task records.
- **Impact:** Coordinator tasks transmit plan metadata but not the plan itself.
- **Runtime consequence:** Whatever tool 'create_execution_plan' does receives only identifiers, not executable tasks.

### Finding 006 — Coordinator Task Failures Are Non-Fatal
- **File:** `server/agents/planner/coordination/agent-coordinator.ts`
- **Lines:** 74–78
- **Severity:** HIGH
- **Evidence:**
  ```typescript
  if (!outcome.success) {
    plannerLogger.warn(runId, `Coordinator task failed — label="${task.label}"`, {...});
    // Non-fatal: coordinator failures are logged but don't abort plan delivery
  }
  ```
- **Impact:** The coordinator dispatch (Step 6/7 of planning-loop) can fail entirely and the plan is still returned as successful.
- **Runtime consequence:** Plan delivery failures are silent — the system reports success when coordinators fail.

### Finding 007 — Verifier Receives Undefined `phases` and `port`
- **File:** `server/orchestration/coordination/agent-coordinator.ts`
- **Lines:** 174–183
- **Severity:** HIGH
- **Evidence:**
  ```typescript
  case 'verifier':
    return runVerification({
      runId, projectId, sandboxRoot,
      phases:    input.phases   as any,   // undefined — never set in phase input
      port:      input.port     as number | undefined,  // undefined
      timeoutMs: input.timeoutMs as number | undefined, // undefined
    });
  ```
- **Impact:** Verifier cannot know which phases executed, what port to probe, or what timeout to apply.
- **Runtime consequence:** Verification runs blind — no port to hit, no phase context.

### Finding 008 — Browser Agent Receives Empty String URL
- **File:** `server/orchestration/coordination/agent-coordinator.ts`
- **Line:** 91
- **Severity:** HIGH
- **Evidence:**
  ```typescript
  url: (input.url as string) ?? '',
  ```
- **Impact:** Browser agent receives `url: ''` when phase input does not specify a URL.
- **Runtime consequence:** Browser navigation fails or navigates to `about:blank`.

### Finding 009 — Terminal Agent Receives Empty Steps Array
- **File:** `server/orchestration/coordination/agent-coordinator.ts`
- **Line:** 162
- **Severity:** MEDIUM
- **Evidence:**
  ```typescript
  steps: (input.steps as any[]) ?? [],
  ```
- **Impact:** Terminal agent executes zero steps when dispatched from a phase with no steps defined.
- **Runtime consequence:** Terminal phase is a no-op.

### Finding 010 — Filesystem Agent Receives Empty Operations Array
- **File:** `server/orchestration/coordination/agent-coordinator.ts`
- **Line:** 152
- **Severity:** MEDIUM
- **Evidence:**
  ```typescript
  operations: (input.operations as any[]) ?? [],
  ```
- **Impact:** Filesystem agent performs no operations when dispatched from a phase without them.
- **Runtime consequence:** Filesystem phase is a no-op.

### Finding 011 — plannerState Stores Plan But Nothing Reads It Downstream
- **File:** `server/agents/planner/execution/planning-loop.ts`
- **Line:** 113
- **Evidence:**
  ```typescript
  plannerState.setPlan(runId, plan);
  ```
  No external module reads `plannerState.getPlan(runId)` to inject the plan into the executor.
- **Severity:** HIGH
- **Impact:** In-memory plan store is a write-only store from the executor's perspective.
- **Runtime consequence:** Plan exists in memory but is unreachable by any execution agent.

### Finding 012 — Planner Runs Twice Per Standard Workflow
- **Files:** `server/orchestration/coordination/agent-coordinator.ts:136–142` + `server/agents/planner/execution/planning-loop.ts:136–138`
- **Severity:** MEDIUM
- **Evidence path:**
  1. Orchestration dispatches Phase[0] → `runPlannerCycle()` (full planning-loop)
  2. Inside planning-loop, after building the plan, `runCoordinatorTasks()` is called
  3. `runCoordinatorTasks` calls `routePlanningTask(task, context, 1)` for each phase
  4. Each coordinator task has `toolName: 'create_execution_plan'`
  5. The orchestration's own planner phase already ran the full plan generation
- **Impact:** Planning computation is duplicated. Coordinator sub-dispatch may trigger additional planning passes.
- **Runtime consequence:** CPU waste, potential double-execution artifacts.

### Finding 013 — `mode` String Has No Behavioral Effect on Executor
- **File:** `server/orchestration/coordination/agent-coordinator.ts`
- **Lines:** 110–111
- **Evidence:**
  ```typescript
  const mode        = (input.mode as string | undefined) ?? 'execute';
  const effectiveGoal = mode !== 'execute' ? `${mode}: ${goal}` : goal;
  ```
  The `mode` only prepends itself to the goal string for non-execute modes. It does not change agent behavior, tool selection, or task structure.
- **Severity:** MEDIUM
- **Impact:** `mode: 'fix'`, `mode: 'refactor'`, `mode: 'analyze_bug'` all produce the same single-task synthetic plan — only the description string differs.
- **Runtime consequence:** Bug-fix and refactor intents are indistinguishable at execution time.

### Finding 014 — `as any` Type Erasures at Coordinator Boundaries
- **File:** `server/orchestration/coordination/agent-coordinator.ts`
- **Lines:** 94, 131, 147, 153, 163, 179, 187
- **Severity:** MEDIUM
- **Evidence:**
  ```typescript
  flows:       input.flows as any | undefined,
  plan:        plan as any,
  context:     input.context as any,
  options:     input.options as any,
  phases:      input.phases as any,
  ```
- **Impact:** 7 type erasures at the most critical boundary in the system.
- **Runtime consequence:** Type mismatches silently pass through at runtime.

### Finding 015 — Optional Verify Phase Can Be Silently Skipped as Success
- **File:** `server/orchestration/execution/phase-runner.ts`
- **Lines:** 76–80
- **Evidence:**
  ```typescript
  if (decision.outcome === 'skip') {
    logPhaseSkipped(...);
    recordPhaseCompleted(ctx.runId);
    return { ...result, ok: true, error: undefined };  // ← failure becomes success
  }
  ```
  `buildStandardPhases` marks verify as `optional: true` at `phase-planner.ts:74`.
- **Impact:** A failed verifier phase returns `ok: true`. The workflow reports full success.
- **Runtime consequence:** Broken apps can pass verification.

---

## PHASE 7 — AUTONOMY SCORE

### Planner Intelligence — 68/100
**Evidence:** Real goal analysis (`analyzeGoal`), multi-step task decomposition (`buildTaskList`), dependency resolution with topological sort (`resolveDependencies`), phase grouping, execution strategy selection, iterative refinement loop (up to 3 attempts), plan validation. Substantial planning machinery exists.  
**Deduction:** No LLM call observed in the planning-loop itself — `analyzeGoal` and `buildTaskList` are deterministic. Intelligence depends on the implementation of these functions.

### Planner Utilization — 8/100
**Evidence:** `runPlannerCycle` discards the full ExecutionPlan at line 71 of planner-agent.ts, returning only `planId`. The orchestration layer's executor phase never receives the plan. The only path to utilization is `plannerState.getPlan(runId)` which no downstream consumer reads.

### Plan Propagation — 5/100
**Evidence:** Zero code paths carry the planner's `ExecutionPlan` from `plannerState` to `runExecutorAgent`. The synthetic plan at agent-coordinator.ts:112 fires on every standard execution. PhaseResult.output is never read by workflow-runner to enrich next phase.

### Phase Propagation — 5/100
**Evidence:** workflow-runner.ts collects `phaseResults` but no code reads prior results to build subsequent phase inputs. All phases receive the same frozen baseInput constructed before any phase runs.

### Execution Intelligence — 42/100
**Evidence:** Executor has real machinery: `planExecution`, dependency validation, `buildExecutionPlan` (executor's version), `runExecutionLoop`, step ordering. However, it always receives a single-task synthetic plan. All this machinery operates on a plan containing exactly one coding task with the goal string as description.

### Context Preservation — 18/100
**Evidence:** `runId`, `projectId`, `sandboxRoot`, `goal` survive unchanged. All derived intelligence (planner analysis, task decomposition, executor outputs, verifier findings) is lost between phases.

### Autonomy Level — 22/100
**Evidence:** The system presents a 3-phase autonomous pipeline (plan → execute → verify). In practice: planner builds a real plan that is discarded; executor runs one flat synthetic task; verifier runs with no port and no phase context. The autonomy is structural, not functional.

### Architecture Discipline — 58/100
**Evidence:** Clean layer separation (no spawn/exec/fs in orchestration), consistent use of Result envelopes, telemetry on all operations, frozen context objects, immutable Phase definitions, no-throw contracts at agent boundaries. Deductions: 7 `as any` erasures at the coordinator, two same-named but incompatible ExecutionPlan types, coordinator failure is non-fatal.

---

## FINAL REPORT

### 1. Planner Reality

The planner agent is architecturally sophisticated. It performs: goal analysis → task decomposition → dependency resolution → execution phase grouping → plan validation with up to 3 refinement attempts → plan storage → coordinator dispatch. It produces a real, validated `ExecutionPlan` (planner.types.ts) containing structured tasks with dependencies, phases, complexity metadata, and timing estimates.

**The plan is abandoned at the `runPlannerCycle` return boundary.** `runPlannerCycle` extracts only `result.plan?.planId` before returning to the orchestration coordinator. The full plan object stays within the planner agent's stack.

### 2. Phase Planner Reality

The orchestration phase planner (`phase-planner.ts`) generates `Phase` objects with static, build-time inputs. All phases in every template (`buildStandardPhases`, `buildBugFixPhases`, `buildRefactorPhases`, `buildVerifyPhases`) receive the same `baseInput = { goal, projectId, sandboxRoot, runId, context }`. No phase template ever injects a plan, prior phase output, port number, file list, or execution result into any subsequent phase's input.

### 3. Phase Runner Reality

`runPhase` executes one phase against its frozen input. The returned `PhaseResult.output` is accumulated into `phaseResults` in `workflow-runner.ts` but is never read to enrich subsequent phases. The retry mechanism is functional. The optional-phase skip correctly sets `ok: true` on failure. Phase isolation is complete and absolute.

### 4. Execution Plan Lifecycle

```
PLANNER AGENT LAYER:
  buildExecutionPlan() → ExecutionPlan (planner.types.ts)
  plannerState.setPlan(runId, plan)               ← stored, never externally consumed
  runPlannerCycle() → { success, planId }          ← plan discarded here

ORCHESTRATION COORDINATOR LAYER:
  invokeAgent('planner') → PlannerCycleResult      ← only planId received
  PhaseResult.output = PlannerCycleResult          ← collected, never forwarded

  invokeAgent('executor') → synthetic plan built:  ← real plan never arrives
    { planId: 'auto-${runId}', tasks: [1 task] }

EXECUTOR AGENT LAYER:
  planExecution(syntheticPlan) → BuiltExecutionPlan
  runExecutionLoop([1 task])
```

### 5. Context Propagation Graph

```
                          ┌─────────────────────────────────────────────────┐
                          │         OrchestrationRequest                     │
                          │  { runId, projectId, sandboxRoot, goal, ctx? }  │
                          └────────────────────┬────────────────────────────┘
                                               │  (frozen, no enrichment)
                    ┌──────────────────────────▼─────────────────────────────────┐
Phase[0] input ────►│ { goal, projectId, sandboxRoot, runId, ctx:{}, mode:plan } │
                    └──────────────────────────┬─────────────────────────────────┘
                                               │
                                        runPlannerCycle()
                                               │
                              ┌────────────────▼────────────────┐
                              │ PlannerCycleResult               │
                              │  { success:true, planId:'xyz' }  │
                              │  ← full ExecutionPlan LOST here  │
                              └────────────────┬────────────────┘
                                               │ stored in PhaseResult.output
                                               │ NEVER READ BY NEXT PHASE
                    ┌──────────────────────────▼─────────────────────────────────┐
Phase[1] input ────►│ { goal, projectId, sandboxRoot, runId, ctx:{}, mode:exec } │
                    │  ← SAME as Phase[0] — no plan injected                     │
                    └──────────────────────────┬─────────────────────────────────┘
                                               │
                                  synthetic plan built internally
                                  { planId:'auto-X', tasks:[1] }
                                               │
                                        runExecutorAgent()
                                               │
                              ┌────────────────▼──────────────────┐
                              │ ExecutorAgentResult                │
                              │  { ok, tasksCompleted, outputs[] } │
                              └────────────────┬──────────────────┘
                                               │ stored in PhaseResult.output
                                               │ NEVER READ BY NEXT PHASE
                    ┌──────────────────────────▼──────────────────────────────────┐
Phase[2] input ────►│ { goal, projectId, sandboxRoot, runId, ctx:{}, mode:verify }│
                    │  ← SAME baseInput — no executor output injected              │
                    │  phases:undefined, port:undefined                            │
                    └─────────────────────────────────────────────────────────────┘
```

### 6. Planner → Executor Graph

```
Planner
  ├── analyzeGoal(goal)                  → analysis (LOST after planning-loop returns)
  ├── buildTaskList(goal, projectId)     → PlannedTask[] (LOST)
  ├── resolveDependencies(...)           → orderedTasks, deps (LOST)
  ├── buildExecutionPhases(...)          → ExecutionPhase[] (LOST)
  ├── buildExecutionPlan(...)            → ExecutionPlan (planner.types) (LOST at boundary)
  └── plannerState.setPlan(runId, plan)  → in-memory (NEVER READ by executor path)
           ↓
     runPlannerCycle() returns { success, planId }
           ↓
     [BRIDGE BROKEN — planId string is the only survivor]
           ↓
Executor
  └── synthetic plan: { planId:'auto-X', tasks:[{ kind:'coding', description:goal }] }
```

### 7. Executor → Verifier Graph

```
Executor
  ├── runExecutionLoop(orderedTasks, ctx)
  │     → TaskOutput[] (files written, commands run, errors)
  └── ExecutorAgentResult: { ok, tasksCompleted, tasksFailed, outputs[] }
           ↓
     PhaseResult.output = ExecutorAgentResult
           ↓
     [BRIDGE BROKEN — output sits in phaseResults array, never read]
           ↓
Verifier
  ├── phases:    undefined  ← no phase context from executor
  ├── port:      undefined  ← no port from executor (app may not be running)
  └── timeoutMs: undefined  ← no timeout configuration
```

### 8. Lost Information Report

| Information | Created At | Lost At | Severity |
|-------------|-----------|---------|----------|
| Full ExecutionPlan (tasks, deps, phases) | planning-loop.ts:93 | planner-agent.ts:71 | CRITICAL |
| Goal analysis (appType, complexity, components) | planning-loop.ts:48 | planning-loop.ts stack frame | HIGH |
| Dependency-ordered task list | planning-loop.ts:64 | planning-loop.ts stack frame | CRITICAL |
| Phase grouping strategy | planning-loop.ts:83 | planning-loop.ts stack frame | HIGH |
| PlannerCycleResult.output (planId) | agent-coordinator.ts:51 | workflow-runner.ts phaseResults | HIGH |
| Executor outputs (files, commands, errors) | executor-agent.ts:127 | workflow-runner.ts phaseResults | HIGH |
| Verifier findings | verifier invocation | workflow-runner.ts phaseResults | MEDIUM |
| Coordinator task results | planning/agent-coordinator.ts:73 | non-fatal, discarded | MEDIUM |
| Executor port (app bind address) | executor runtime | not captured anywhere | HIGH |

### 9. Design Debt Report

| ID | Description | Files | Lines |
|----|-------------|-------|-------|
| DD-01 | Three incompatible types named `ExecutionPlan` | planner.types.ts:88, orchestration.types.ts:110, executor.types.ts:46 | — |
| DD-02 | `runPlannerCycle` discards full plan | planner-agent.ts | 69–74 |
| DD-03 | Synthetic plan fallback hardcoded in coordinator | agent-coordinator.ts | 112–126 |
| DD-04 | Phase inputs never enriched with prior outputs | workflow-runner.ts | 64–87 |
| DD-05 | `plannerState` is write-only from executor's view | planning-loop.ts:113 | — |
| DD-06 | Coordinator task failure is non-fatal, silently skipped | planner/agent-coordinator.ts | 74–78 |
| DD-07 | `verifier.phases` receives `undefined` | orchestration/agent-coordinator.ts | 179 |
| DD-08 | `browser.url` receives `''` | orchestration/agent-coordinator.ts | 91 |
| DD-09 | `terminal.steps` receives `[]` | orchestration/agent-coordinator.ts | 162 |
| DD-10 | `filesystem.operations` receives `[]` | orchestration/agent-coordinator.ts | 152 |
| DD-11 | `mode` string only affects goal prefix string | orchestration/agent-coordinator.ts | 110–111 |
| DD-12 | Optional verify phase failure becomes `ok: true` | phase-runner.ts | 76–80 |
| DD-13 | 7× `as any` type erasures at coordinator | orchestration/agent-coordinator.ts | 94,131,147,153,163,179,187 |
| DD-14 | Planner runs twice per standard workflow | planning-loop.ts:136, agent-coordinator.ts:137 | — |
| DD-15 | `context: req.context ?? {}` silently defaults | phase-planner.ts | 43 |

### 10. Hidden Runtime Risks

1. **Verifier always receives `phases: undefined, port: undefined`** — verifier must handle or crash on undefined inputs.
2. **Browser phase will navigate to `''`** — may throw or produce a meaningless result with no error surfaced to orchestration.
3. **Coordinator task failures log at WARN but do not fail the plan** — a broken tool registry silently passes.
4. **Optional verify skip turns failures into success** — `WorkflowResult.ok: true` reported when app is broken.
5. **plannerState grows unbounded** — `setPlan(runId, plan)` adds to a Map, `clearPlan` or TTL not visible in these files.
6. **Type coercion `plan as any`** at agent-coordinator.ts:131 — executor receives a synthetic object cast to `any`; field mismatches at runtime.
7. **`effectiveGoal` truncation** — `mode !== 'execute' ? \`${mode}: ${goal}\` : goal` silently mutates the goal for all non-execute phases.
8. **Cycle guard in `buildPhaseOrder`** — `if (wave.length === 0) break` silently truncates phases on dependency cycles with no error reported.

---

## TOP 20 FINDINGS

| # | Finding | File | Severity |
|---|---------|------|----------|
| 1 | Full ExecutionPlan discarded at `runPlannerCycle` boundary | planner-agent.ts:71 | CRITICAL |
| 2 | Synthetic fallback plan always fires — real plan never reaches executor | agent-coordinator.ts:112 | CRITICAL |
| 3 | Phase outputs never forwarded to subsequent phase inputs | workflow-runner.ts:68–75 | CRITICAL |
| 4 | Three incompatible types named `ExecutionPlan` | 3 files | HIGH |
| 5 | Verifier receives `phases: undefined` and `port: undefined` | agent-coordinator.ts:179 | HIGH |
| 6 | `plannerState.setPlan` is externally write-only — never consumed by executor | planning-loop.ts:113 | HIGH |
| 7 | Coordinator task failures are non-fatal | planner/agent-coordinator.ts:74 | HIGH |
| 8 | Browser agent receives `url: ''` from phase dispatch | agent-coordinator.ts:91 | HIGH |
| 9 | Optional verify failure returns `ok: true` | phase-runner.ts:76–80 | HIGH |
| 10 | 7× `as any` type erasures at the critical dispatch boundary | agent-coordinator.ts multiple | HIGH |
| 11 | `mode` string only prefixes goal text — no behavioral effect | agent-coordinator.ts:110–111 | MEDIUM |
| 12 | Terminal agent dispatched with `steps: []` | agent-coordinator.ts:162 | MEDIUM |
| 13 | Filesystem agent dispatched with `operations: []` | agent-coordinator.ts:152 | MEDIUM |
| 14 | Planner runs twice per standard workflow execution | planning-loop.ts:136 | MEDIUM |
| 15 | Cycle guard silently truncates phases on dependency cycles | workflow-runner.ts:37 | MEDIUM |
| 16 | `context: req.context ?? {}` defaults to empty on all phases | phase-planner.ts:43 | MEDIUM |
| 17 | `effectiveGoal` mutates goal for non-execute modes | agent-coordinator.ts:111 | LOW |
| 18 | `plannerState` Map grows unbounded — no eviction visible | planning-loop.ts:113 | LOW |
| 19 | Coordinator tasks use `toolName: 'create_execution_plan'` — transmits metadata, not plan | planner/agent-coordinator.ts:25 | HIGH |
| 20 | No port tracking from executor to verifier — verifier cannot probe the running app | agent-coordinator.ts:175–183 | HIGH |

---

## TOP 20 ARCHITECTURE WEAKNESSES

| # | Weakness |
|---|----------|
| 1 | The planner→executor information bridge is broken: planId travels, plan does not |
| 2 | Phase inputs are static, frozen at build time — no runtime enrichment mechanism exists |
| 3 | Three types share the name `ExecutionPlan` with no shared interface |
| 4 | The only executor input that matters (the plan) always comes from a synthetic fallback |
| 5 | `PhaseResult.output` field exists but has zero consumers in the execution path |
| 6 | The orchestration coordinator and the planner's internal coordinator share a name but are different modules with different responsibilities |
| 7 | Verifier is architecturally blind: no port, no phase list, no prior outputs |
| 8 | Coordinator task failures are silently swallowed in the most critical dispatch layer |
| 9 | Optional phase skip converts failures to success at the result level |
| 10 | `as any` is the seam between orchestration and agent layers — type safety ends there |
| 11 | `mode` string is the only semantic differentiator between intent types at execution time, and it has no behavioral effect beyond goal string mutation |
| 12 | Browser agent's required URL has no injection path from any planner or orchestration component |
| 13 | Terminal and filesystem phases are no-ops when dispatched from standard workflow sequences |
| 14 | `plannerState` stores the most valuable artifact in the system but is not part of any read path |
| 15 | The planning and orchestration layers use the same concept (phase) with different schemas and no conversion layer |
| 16 | Dependency-ordered task lists from planner are rebuilt from scratch inside the executor using a synthetic single-task plan |
| 17 | Wave-based parallel execution in `workflow-runner.ts` is implemented but all waves receive isolated, non-enriched inputs |
| 18 | The `context` field from `OrchestrationRequest` passes through unchanged to all phases — historical context from prior runs is never accumulated |
| 19 | No mechanism exists to discover what port the executor started the app on — verifier cannot probe it |
| 20 | Retry logic at the phase level is functional but retries the same static input — planner output cannot be incorporated on retry |

---

## TOP 20 FUTURE FAILURE POINTS

| # | Failure Point | Trigger Condition |
|---|--------------|-------------------|
| 1 | Executor ignores all planner task decomposition | Every standard workflow run |
| 2 | Verifier crashes or no-ops on `phases: undefined` | Every standard workflow run |
| 3 | Browser agent fails navigation on `url: ''` | Every browser phase dispatch |
| 4 | Terminal/filesystem phases silently do nothing | Every workflow with these agent types |
| 5 | Broken app passes verification because verify is `optional: true` | Any executor failure |
| 6 | `plannerState` accumulates plans across runs without eviction → memory leak | Long-running server |
| 7 | Goal mutation (`mode: fix: <goal>`) passed to executor but not to verifier | Bug-fix and refactor intents |
| 8 | Coordinator task failures go undetected — plan reported as delivered when it isn't | Tool registry degradation |
| 9 | Dependency cycle in phase graph silently drops phases | Malformed workflow |
| 10 | Multi-task plans from planner are collapsed to 1 task by synthetic fallback — partial execution | All multi-step goals |
| 11 | Type mismatch between `ExecutionPlan` variants causes runtime field-not-found errors | Any type boundary crossing |
| 12 | `plan as any` cast means executor receives structurally wrong object silently | Synthetic plan schema drift |
| 13 | Verifier port probe: app may not be running on any port — verifier checks undefined port | Executor didn't start a server |
| 14 | Second planner invocation (coordinator sub-dispatch) may race with first | High-concurrency runs |
| 15 | `context: {}` means planner has no history — always plans from zero | Every run |
| 16 | `effectiveGoal` passed to executor is `"fix: <goal>"` — tools receive mutated description | All non-build intents |
| 17 | Refinement loop uses `buildExecutionPlan` twice (candidate + final) — second may differ from validated candidate | Plan validation edge cases |
| 18 | Non-fatal coordinator failures produce `ok: true` from `runPlannerCycle` — callers have no signal | Coordinator tool registry issues |
| 19 | `input.context as object | undefined ?? {}` spread at filesystem case — unknown context fields merge silently | Unexpected context shapes |
| 20 | Wave-parallel execution (`Promise.all`) in workflow-runner — all phases in a wave receive identical context with no isolation — shared `OrchestrationContext` across concurrent phase invocations | Parallel wave execution |

---

## AUTONOMY SCORECARD

| Dimension | Score | Evidence |
|-----------|-------|----------|
| Planner Intelligence | 68/100 | Real task decomposition, dependency resolution, refinement loop, plan validation |
| Planner Utilization | 8/100 | Full plan discarded at runPlannerCycle; only planId string exits |
| Plan Propagation | 5/100 | No code path carries plan to executor; synthetic fallback always fires |
| Phase Propagation | 5/100 | PhaseResult.output exists but zero consumers read it for next phase |
| Execution Intelligence | 42/100 | Good executor machinery (dependency ordering, retry, step routing) but operates on 1-task synthetic plan |
| Context Preservation | 18/100 | Static IDs survive; all derived intelligence lost between phases |
| Autonomy Level | 22/100 | Structural autonomy; functional pipeline is plan→discard→synthetic→blind-verify |
| Architecture Discipline | 58/100 | Clean layering, no-spawn enforced, Result envelopes consistent; broken by 7× any, 3× same-name types, non-fatal coordinator failures |
| **OVERALL** | **28/100** | |

---

## PRODUCTION READINESS ASSESSMENT

**Status: NOT PRODUCTION READY for multi-task agentic goals.**

**What works in production:**
- Single-task coding goals: executor receives synthetic plan with goal as description; CoderX/coding tools can act on a goal string directly.
- Orchestration lifecycle: telemetry, retry, session management, event publication all function.
- Planner: produces a complete, validated plan in isolation.
- Executor: executes a single coding task reliably when given a valid plan.

**What does not work:**
- Multi-task goals: decomposed tasks never reach executor. Always collapses to one task.
- Dependency ordering: computed, immediately discarded.
- Verification: runs blind without port or phase context.
- Browser automation: dispatched with empty URL.
- Terminal/filesystem phases: dispatched with empty action lists.
- Plan continuity: zero memory between phases.
- Intent differentiation: fix/refactor/build produce identical execution behavior.

**The system currently functions as:** a single-step coding agent with planning theatrics — the planner runs, produces a real plan, and that plan is not used.
