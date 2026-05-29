# EXECUTION_BREAKPOINTS
> All facts from actual code. Each breakpoint is confirmed by line reference.

---

## Execution Trace: POST /api/chat/run

```
HTTP POST /api/chat/run
    ↓ ✅
main.ts → app.use('/api/chat', chatOrchestrator.buildChatRouter())
    ↓ ✅
chat.routes.ts → router.post('/run', chatController.startRun)
    ↓ ✅
chat-controller.ts → chatOrchestrator.startRun(parsed.data)
    ↓ ✅
chat-orchestrator.ts → startRun():
  steps 1-10: conversation, run registry, session, turn, messages, stream, context
    ↓ ✅
  step 11: void orchestrate({orchestrationId, runId, projectId, sandboxRoot, goal})
    ↓ ✅
orchestration/index.ts → orchestrate() re-export → orchestrator.ts
    ↓ ✅
orchestrator.ts → orchestrate():
  validateRequest()   ✅
  buildOrchestrationContext()  ✅
  validateContext()   ✅
  initState()         ✅
  createSession()     ✅ (fixed: unified UUID)
    ↓ ✅
orchestration-loop.ts → runOrchestrationLoop():
  startPlanning()     ✅
  buildExecutionPlan():
    classifyIntent(goal)              ✅
    primaryAgentForIntent(intent)     ✅ → 'executor' (for most intents)
    buildPhases(req, intent, 'executor'):
      planPhase:   { agentType: 'planner',  input: {goal, ...} }  ✅
      execPhase:   { agentType: 'executor', input: {goal, ...} }  ⚠ no plan field
      verifyPhase: { agentType: 'verifier', input: {goal, ...} }  ✅
  validateExecutionPlan()  ✅ (coderx now allowed — fixed)
  registerOrchestration()  ✅ (sessionId unified — fixed)
  startRunning()           ✅
    ↓ ✅
workflow-runner.ts → runWorkflow() → runPhase()
    ↓ ✅
agent-coordinator.ts → dispatchPhaseToAgent() → invokeAgent():

  PHASE 1 — agentType: 'planner'
    ↓ ✅
  runPlannerCycle({runId, projectId, goal})
    → validates, builds context, runs planning-loop
    → returns PlannerCycleResult { success, planId? }
    ↓ PhaseResult.ok = true (if goal is valid)

  PHASE 2 — agentType: 'executor'
    ↓ ❌ BP-3
  runExecutorAgent({runId, projectId, sandboxRoot, plan: undefined, options: undefined})
    assertAgentInput(input)
    → validateAgentInput: if (!input.plan) → { ok: false, reason: 'plan is required.' }
    → throws ExecutionValidationError('plan is required.')
    ← caught → failResult('unknown', 'unknown', 0, '[execution-validator] plan is required.', ...)
    ← PhaseResult.ok = false, optional = false
    ← workflow fails → orchestration fails

  PHASE 3 — agentType: 'verifier' (never reached due to BP-3)
```

---

## Breakpoint Catalog

### BP-3 — Executor receives undefined plan (CRITICAL)

**Status**: Unrepaired (new finding this session)

**Files**:
- `server/orchestration/planning/workflow-planner.ts` lines 41–51 (primaryAgentForIntent)
- `server/orchestration/planning/phase-planner.ts` lines 68–76 (buildStandardPhases)
- `server/orchestration/coordination/agent-coordinator.ts` lines 102–109 (executor case)
- `server/agents/executor/validation/execution-validator.ts` lines 60–68 (assertAgentInput)

**Evidence**:
```typescript
// workflow-planner.ts — executor chosen for ALL non-verify intents
const map: Record<WorkflowIntent, AgentType> = {
  build_feature:  'executor',  // ← executor
  fix_bug:        'executor',  // ← executor
  refactor:       'executor',  // ← executor
  generate_ui:    'executor',  // ← executor
  add_api:        'executor',  // ← executor
  verify_runtime: 'verifier',
  general:        'executor',  // ← executor
};

// phase-planner.ts — executor phase input has NO plan field
const execPhase = makePhase('execute', primaryAgent, {
  goal, projectId, sandboxRoot, runId, context, mode: 'execute'
  // ← no plan field
});

// execution-validator.ts — plan is required
if (!input.plan) return { ok: false, reason: 'plan is required.' };
if (!Array.isArray(input.plan.tasks) || input.plan.tasks.length === 0) {
  return { ok: false, reason: 'plan.tasks must be a non-empty array.' };
}
```

**Effect**: 5 of 6 workflow intents fail at executor phase. Only `verify_runtime` succeeds.

**Fix**: In `agent-coordinator.ts`, construct a minimal valid `ExecutionPlan` from the phase input `goal` when `phase.input.plan` is absent.

---

### AV-1 — Architecture violation: chat imports run-manager from orchestration/core

**Status**: Unrepaired (new finding this session)

**File**: `server/chat/orchestration/chat-orchestrator.ts` line 18

**Evidence**:
```typescript
import { runManager } from '../../orchestration/core/run-manager.ts'; // ← bypasses public surface
```

**Effect**: chat layer is coupled to orchestration internals. Any internal refactor of run-manager breaks chat without going through the public API contract.

**Fix**: Export `runManager` from `server/orchestration/index.ts`. Update chat-orchestrator to import from the public surface.

---

### AV-2 — CoderX receives empty userPrompt

**Status**: Unrepaired (new finding this session)

**File**: `server/orchestration/coordination/agent-coordinator.ts` line 165

**Evidence**:
```typescript
case 'coderx':
  return runCoderXAgent({
    request: {
      userPrompt: (input.userPrompt as string | undefined) ?? '',
      // ← phase.input has 'goal' but not 'userPrompt'
      // ← coderx always gets empty string
    },
  });
```

**Effect**: CoderX agent receives empty userPrompt — cannot code anything meaningful.

**Fix**: Fall back to `input.goal` when `input.userPrompt` is absent.

---

### BP-1 — coderx absent from VALID_AGENT_TYPES
**Status**: ✅ REPAIRED (previous session)

---

### BP-2 — Dual sessionId generation
**Status**: ✅ REPAIRED (previous session)
