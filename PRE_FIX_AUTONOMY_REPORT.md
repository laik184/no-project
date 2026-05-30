# PRE_FIX_AUTONOMY_REPORT — Pipeline Break Evidence

Generated: Phase 1 scan of all five target files + supporting types.

---

## FINDING 1 — `planner-agent.ts` · `runPlannerCycle()` truncates ExecutionPlan

**File**: `server/agents/planner/planner-agent.ts`  
**Method**: `runPlannerCycle()`, lines 44–79  
**Code Evidence**:

```typescript
// Return type strips the plan to a single string
export interface PlannerCycleResult {
  success:      boolean;
  planId?:      string;      // ← only the ID survives
  failedPhase?: string;
  error?:       string;
  // plan is ABSENT
}

return {
  success:     result.success,
  planId:      result.plan?.planId,   // ← full ExecutionPlan discarded here
  error:       result.errors[0],
  failedPhase: result.success ? undefined : 'planning',
};
```

`runPlanningLoop()` → `buildExecutionPlan()` produces a rich `ExecutionPlan`
(phases, tasks, dependency graph, complexity, estimatedMs, appType, validation).
`runPlannerCycle()` discards everything except the `planId` string.

**Impact**: The executor receives `{ success: true, planId: "plan-xxx" }` as its
upstream output — no task list, no phases, no dependency graph.

---

## FINDING 2 — `workflow-runner.ts` · PhaseResult.output never forwarded

**File**: `server/orchestration/execution/workflow-runner.ts`  
**Method**: `runWorkflow()`, lines 60–87  
**Code Evidence**:

```typescript
const phaseResults: PhaseResult[] = [];
const phaseMap = new Map(workflow.phases.map(p => [p.phaseId, p]));
const waves    = buildPhaseOrder(workflow);

for (const wave of waves) {
  const wavePhases = wave.map(id => phaseMap.get(id)).filter(Boolean) as ...;

  const results = await Promise.all(
    wavePhases.map(phase =>
      runPhase(phase, workflow.workflowId, ctx, retryConfig),
      //       ^^^^^ ← static phase object, never enriched
    ),
  );
  phaseResults.push(...results);
  // ↑ outputs collected but never fed into the next wave's phase inputs
}
```

`dependsOn` determines execution *order* only. There is zero mechanism to
transfer a completed phase's `output` field into a dependent phase's `input`.

**Impact**: Planner → executor data flow: broken. Executor → verifier data flow: broken.

---

## FINDING 3 — `phase-planner.ts` · All phases receive identical frozen baseInput

**File**: `server/orchestration/planning/phase-planner.ts`  
**Method**: `buildStandardPhases()`, `buildBugFixPhases()`, `buildRefactorPhases()`, lines 38–89  
**Code Evidence**:

```typescript
const baseInput: Record<string, unknown> = {
  goal, projectId, sandboxRoot, runId, context,
};

const planPhase   = makePhase('plan',    'planner',  { ...baseInput, mode: 'plan' });
const execPhase   = makePhase('execute', agent,      { ...baseInput, mode: 'execute' },
                              false, [planPhase.phaseId]);
const verifyPhase = makePhase('verify',  'verifier', { ...baseInput, mode: 'verify' },
                              true,  [execPhase.phaseId]);
```

Every phase input is a spread of `baseInput` with one extra `mode` key.
Executor input: no `plan` field. Verifier input: no `phases`, no `port`.

`makePhase()` uses `Object.freeze()` on the returned object — these inputs
are immutable at planning time. Runtime enrichment must happen elsewhere.

**Impact**: Even after Fix 1, the executor phase input has no slot for the plan.
The planner→executor and executor→verifier data channels do not exist in the
static phase graph.

---

## FINDING 4 — `agent-coordinator.ts` · Synthetic fallback fires unconditionally

**File**: `server/orchestration/coordination/agent-coordinator.ts`  
**Method**: `invokeAgent()`, `case 'executor'`, lines 102–134  
**Code Evidence**:

```typescript
// Comment in the source already acknowledges this:
// "this happens in all standard phase sequences because phase-planner.ts
//  does not place a plan in the phase input."
const providedPlan = input.plan as { planId: string; tasks: unknown[] } | undefined;
// providedPlan is ALWAYS undefined:
//   1. phase-planner.ts never sets input.plan (Finding 3)
//   2. runPlannerCycle() strips plan to planId string (Finding 1)
const plan = providedPlan ?? {          // ← synthetic fires on every execution
  planId: `auto-${runId}`,
  tasks: [{
    taskId:      `task-${runId}`,
    kind:        'coding',
    description: effectiveGoal || 'Execute the requested goal',
    input: { goal, mode, runId, projectId, sandboxRoot },
  }],
};
```

The comment in the source explicitly states this is always the path taken.

**Impact**: Every executor run is a single generic "code something" task.
The planner's detailed, dependency-ordered task list is never consumed.
The synthetic plan is not an emergency fallback — it is the only path.

---

## FINDING 5 — `agent-coordinator.ts` · Verifier receives `phases = undefined`

**File**: `server/orchestration/coordination/agent-coordinator.ts`  
**Method**: `invokeAgent()`, `case 'verifier'`, lines 174–182  
**Code Evidence**:

```typescript
case 'verifier':
  return runVerification({
    runId,
    projectId,
    sandboxRoot,
    phases:    input.phases   as any,           // ← always undefined
    port:      input.port     as number | undefined,  // ← always undefined
    timeoutMs: input.timeoutMs as number | undefined,
  });
```

`input` is the frozen `phase.input` from `phase-planner.ts` which only contains
`{ goal, projectId, sandboxRoot, runId, context, mode }`.

`runVerification()` handles `phases: undefined` by defaulting to `DEFAULT_PHASES`:
```typescript
const phases = (req.phases && req.phases.length > 0) ? req.phases : DEFAULT_PHASES;
// DEFAULT_PHASES = ['typecheck', 'build', 'runtime']
```

**Impact**: Verifier runs generic checks blind to what the executor actually produced.
It has no knowledge of executed phases, their outputs, runtime metadata, or port.

---

## EXECUTION PLAN TRACE (Phase 2)

```
User Request
  ↓
orchestrator.ts → runOrchestrationLoop()
  ↓
orchestration-loop.ts → runWorkflow()
  ↓
workflow-runner.ts buildPhaseOrder() → waves = [[planPhase], [execPhase], [verifyPhase]]
  ↓
  Wave 1: runPhase(planPhase)
    ↓
    phase-runner.ts → dispatchPhaseToAgent(planPhase, ctx, 1)
      ↓
      agent-coordinator.ts case 'planner' → runPlannerCycle({runId, projectId, goal})
        ↓
        planner-agent.ts plan() → runPlanningLoop() → buildExecutionPlan()
          → returns full ExecutionPlan
        ↓
        runPlannerCycle() STRIPS to { success, planId }  ← PLAN LOST HERE
      ↓
    PhaseResult { ok: true, output: { success: true, planId: "plan-xxx" } }
    ↑ output collected in phaseResults[] but NOT injected into execPhase.input
  ↓
  Wave 2: runPhase(execPhase)  ← execPhase.input has no 'plan'
    ↓
    phase-runner.ts → dispatchPhaseToAgent(execPhase, ctx, 1)
      ↓
      agent-coordinator.ts case 'executor'
        input.plan = undefined  ← providedPlan always undefined
        ↓
        SYNTHETIC PLAN GENERATED  ← planner's work discarded
        ↓
        runExecutorAgent({ plan: syntheticPlan })
      ↓
    PhaseResult { ok: true, output: ExecutorAgentResult }
    ↑ output collected but NOT injected into verifyPhase.input
  ↓
  Wave 3: runPhase(verifyPhase)  ← verifyPhase.input has no 'phases', no 'port'
    ↓
    agent-coordinator.ts case 'verifier'
      input.phases = undefined
      input.port   = undefined
      ↓
      runVerification({ phases: undefined })
        → falls back to DEFAULT_PHASES ['typecheck', 'build', 'runtime']
        → runs generic checks, blind to executor output
```

**Exact break point for plan loss**: `planner-agent.ts` line 69–74, `runPlannerCycle()` return statement.

**Exact break point for executor blind spot**: `agent-coordinator.ts` line 112, `const plan = providedPlan ?? { ... }` — `providedPlan` is always `undefined`.

**Exact break point for propagation void**: `workflow-runner.ts` line 68–74 — `wavePhases` is built from the static `phaseMap`; no prior outputs are merged.

**Exact break point for verifier blindness**: `agent-coordinator.ts` line 178–181 — `input.phases` and `input.port` are always `undefined`.

---

## ExecutionPlan Type Audit (Phase 9)

Three distinct `ExecutionPlan` types exist:

| Type | Location | Shape |
|---|---|---|
| **Planner** | `server/agents/planner/types/planner.types.ts` | `{ planId, runId, projectId, goal, phases: ExecutionPhase[], tasks: PlanTask[], totalTasks, estimatedMs, createdAt, meta, appType, complexity, validationResults }` |
| **Orchestration** | `server/orchestration/types/orchestration.types.ts` | `{ planId, requestId, workflows: Workflow[], createdAt }` |
| **Executor** | `server/agents/executor/types/executor.types.ts` | `{ planId, tasks: ExecutionTask[] }` |

The executor consumes the **Executor** `ExecutionPlan` shape `{ planId, tasks: ExecutionTask[] }`.
The planner produces the **Planner** `ExecutionPlan` shape.
These are compatible at the `planId` + `tasks[]` level — the executor only reads `planId` and `tasks`.
The planner's `tasks: PlanTask[]` maps directly to the executor's `tasks: ExecutionTask[]` expectation
(`taskId` → used as lookup, `kind`, `description`, `input` all match).

**Conclusion**: No unification required. The planner plan can be passed directly to the executor.
The executor's `as any` cast in `agent-coordinator.ts` already handles this.
