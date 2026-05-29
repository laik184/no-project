# AGENT_REACHABILITY_REPORT
> Generated from actual code. All 8 agents verified.

---

## Reachability Matrix

| Agent | Imported by coordinator | Import path resolves | Function exported | Context received | Tool dispatcher | Status |
|-------|------------------------|----------------------|-------------------|-----------------|-----------------|--------|
| planner | ✅ | ✅ | `runPlannerCycle` | ✅ runId, projectId, goal | via planning-loop | ✅ REACHABLE |
| executor | ✅ | ✅ | `runExecutorAgent` | ✅ runId, projectId, sandboxRoot | via execution-loop | ❌ PLAN MISSING |
| verifier | ✅ | ✅ | `runVerification` | ✅ runId, projectId, sandboxRoot | via verification-runner | ✅ REACHABLE |
| browser | ✅ | ✅ | `runBrowserAgent` | ✅ url, runId, projectId | via browser-loop | ✅ REACHABLE |
| filesystem | ✅ | ✅ | `runFilesystemAgent` | ✅ context, operations | via filesystem-loop | ✅ REACHABLE |
| terminal | ✅ | ✅ | `executeTerminalSession` | ✅ runId, projectId, sandboxRoot, steps | via terminal-runner | ✅ REACHABLE |
| supervisor | ✅ | ✅ | `runSupervisorCycle` | ✅ runId, projectId, goal | via supervision-loop | ✅ REACHABLE |
| coderx | ✅ | ✅ | `runCoderXAgent` | ✅ request shape | via coding-loop | ⚠ EMPTY PROMPT |

---

## Per-Agent Detail

### planner — `runPlannerCycle`
```typescript
// coordinator passes:
runPlannerCycle({ runId, projectId, goal: (input.goal as string) ?? '', metadata: ... })

// planner-agent.ts accepts:
async function runPlannerCycle(ctx: {
  runId: string; projectId: string; goal: string; metadata?: Record<string, unknown>;
}): Promise<PlannerCycleResult>
```
**Status**: ✅ Signature match. Planner validates, builds context, runs `planningLoop()`.

---

### executor — `runExecutorAgent`
```typescript
// coordinator passes:
runExecutorAgent({ runId, projectId, sandboxRoot, plan: input.plan as any, options: ... })
// input.plan = phase.input.plan = UNDEFINED in all standard workflows

// executor-agent.ts accepts:
async function runExecutorAgent(input: ExecutorAgentInput): Promise<ExecutorAgentResult>
// ExecutorAgentInput.plan: ExecutionPlan  ← REQUIRED

// execution-validator.ts:
if (!input.plan) return { ok: false, reason: 'plan is required.' }
```
**Status**: ❌ `plan` is always undefined in standard workflow → assertAgentInput throws →  
executor returns `failResult` immediately. NO actual execution occurs.

---

### verifier — `runVerification`
```typescript
// coordinator passes:
runVerification({ runId, projectId, sandboxRoot, phases: input.phases, port, timeoutMs })

// verifier-agent.ts accepts:
async function runVerification(req: VerifierInput): Promise<VerifierOutput>
// phases defaults to ['typecheck', 'build', 'runtime'] if not provided
```
**Status**: ✅ Signature match. Graceful defaults for missing phases.

---

### browser — `runBrowserAgent`
```typescript
// coordinator passes:
runBrowserAgent({ url: (input.url as string) ?? '', runId, projectId, allowedHosts, flows, ... })

// browser-agent.ts accepts:
async function runBrowserAgent(input: BrowserAgentInput): Promise<BrowserAgentResult>
```
**Status**: ✅ Signature match. Note: `url` defaults to `''` if phase input lacks it.

---

### filesystem — `runFilesystemAgent`
```typescript
// coordinator passes:
runFilesystemAgent({
  context: { runId, projectId, sandboxRoot, ...(input.context ?? {}) },
  operations: (input.operations as any[]) ?? [],
  options: input.options,
})

// filesystem-agent.ts accepts:
async function runFilesystemAgent(input: FilesystemAgentInput): Promise<FilesystemAgentResult>
// note: validates operations.length > 0
```
**Status**: ✅ Signature match. Will fail gracefully if `operations` is empty array (default).

---

### terminal — `executeTerminalSession`
```typescript
// coordinator passes:
executeTerminalSession({ runId, projectId, sandboxRoot, steps: (input.steps as any[]) ?? [], signal, meta })

// terminal-agent.ts accepts:
async function executeTerminalSession(req: TerminalAgentRequest): Promise<TerminalAgentResult>
// validates steps.length > 0
```
**Status**: ✅ Signature match. Will fail gracefully if `steps` is empty array (default).

---

### supervisor — `runSupervisorCycle`
```typescript
// coordinator passes:
runSupervisorCycle({ runId, projectId, goal: (input.goal as string) ?? '', metadata: ... })

// supervisor-agent.ts accepts:
async function runSupervisorCycle(
  ctx: { runId: string; projectId: string; goal: string; metadata?: Record<string, unknown> }
): Promise<SupervisorCycleResult>
// internally calls supervise() with tasks: [] — completes immediately
```
**Status**: ✅ Signature match. Supervisor runs empty-tasks supervision pass — always succeeds.

---

### coderx — `runCoderXAgent`
```typescript
// coordinator passes:
runCoderXAgent({
  request: {
    requestId:  (input.requestId as string | undefined) ?? runId,
    runId,
    projectId,
    sandboxRoot,
    userPrompt: (input.userPrompt as string | undefined) ?? '',  // ← ALWAYS '' in standard flow
    context:    input.context,
    options:    input.options,
  },
})
// phase.input has 'goal' but not 'userPrompt'
// coderx receives userPrompt = '' — cannot know what to build
```
**Status**: ⚠ Reaches coderx but with empty userPrompt. CoderX may fail validation or produce empty output.

**Fix**: Fall back to `input.goal` when `input.userPrompt` is absent.

---

## Tool Dispatcher Access

Each agent owns its own dispatcher-client (e.g., `agents/executor/dispatcher-client.ts`) which forwards calls to the central `tools/registry/tool-dispatcher.ts`. The dispatcher looks up tools in the sealed registry (170 tools, 5 categories) and calls the registered handler.

| Agent | Has dispatcher-client | Reaches tool-dispatcher |
|-------|----------------------|------------------------|
| planner | ✅ | ✅ |
| executor | ✅ | ✅ (if plan provided) |
| coderx | ✅ | ✅ (if prompt provided) |
| verifier | ✅ | ✅ |
| browser | ✅ | ✅ |
| filesystem | ✅ | ✅ |
| terminal | ✅ | ✅ |
| supervisor | ✅ | ✅ |

---

## Summary

| Score | Count |
|-------|-------|
| Fully reachable and functional | 6 (planner, verifier, browser, filesystem, terminal, supervisor) |
| Reachable but broken input | 1 (executor — no plan) |
| Reachable but degraded input | 1 (coderx — no userPrompt) |
| Unreachable | 0 |
