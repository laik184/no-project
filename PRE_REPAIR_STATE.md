# PRE_REPAIR_STATE
> Snapshot taken before execution-chain repair. All facts from actual code only.
> Previous entry (migration phase) superseded — migration complete, orchestrate() now wired.

---

## Current Execution Graph (post-migration, pre-repair)

```
HTTP POST /api/chat/run
        │
        ▼
chat.routes.ts              router.post('/run', chatController.startRun)
        │
        ▼
chat-controller.ts          chatController.startRun()
        │
        ▼
chat-orchestrator.ts        chatOrchestrator.startRun()
        │  1. conversationManager.create()
        │  2. runManager.register(runId, projectId)
        │  3. sessionManager.open()
        │  4. turnManager.start()
        │  5. messageBuilder.buildUser()
        │  6. eventPublisher.publish(run.started)
        │  7. messageBuilder.buildSystem()
        │  8. clarificationManager.maybeAskClarification()
        │  9. streamManager.open()
        │  10. contextLoader.loadForRun() + buildContext()
        │  11. void orchestrate({orchestrationId, runId, projectId, sandboxRoot, goal})
        ▼
orchestration/index.ts      orchestrate() re-export → orchestrator.ts
        │
        ▼
orchestrator.ts             orchestrate()                            [TARGET-5]
        │  validateRequest()                      ← passes
        │  buildOrchestrationContext(fullReq)     → ctx.sessionId = newSessionId() = UUID-A
        │  validateContext(ctx)                   ← passes
        │  initState(ctx.orchestrationId, ...)
        │  createSession(orchestrationId, runId, projectId, workflowsTotal=0)
        │                                         → session.sessionId = newSessionId() = UUID-B
        │                                           BP-2: UUID-A ≠ UUID-B
        │  runOrchestrationLoop(fullReq, ctx, session.sessionId=UUID-B)
        ▼
orchestration-loop.ts       runOrchestrationLoop(req, ctx, sessionId=UUID-B)
        │  initRunMetrics()
        │  logOrchestrationStarted()
        │  publishOrchestrationStarted()
        │  startPlanning(ctx, sessionId=UUID-B)   ← transitions session keyed UUID-B ✓
        │  buildExecutionPlan(req)
        │    └─ planWorkflows() → buildPhases()
        │         produces phases: planner / executor / verifier / supervisor
        │  validateExecutionPlan()
        │    └─ for each phase: validatePhase()
        │         VALID_AGENT_TYPES = {planner,executor,verifier,browser,
        │                              filesystem,terminal,supervisor}
        │         BP-1: 'coderx' absent → any coderx phase rejected here
        │  registerOrchestration(orchestrationId, ctx.sessionId=UUID-A, runId, count)
        │                         BP-2: registers UUID-A in monitor, not UUID-B
        │  startRunning(ctx, sessionId=UUID-B)
        │  for each wave: runWorkflow()
        ▼
workflow-runner.ts → phase-runner.ts → agent-coordinator.ts → agents → tools
        (this sub-chain is structurally complete and clean)
```

---

## Current Import Graph (5 Target Files)

```
main.ts                                                              [TARGET-1]
  ├── server/chat/index.ts
  │     └── chat.routes.ts → chat-controller.ts
  │           └── chat-orchestrator.ts                              [TARGET-2]
  │                 └── server/orchestration/index.ts               [TARGET-3]
  ├── server/tools/registry/tool-loader.ts                          [TARGET-4]
  │     ├── filesystem (57 tools), terminal (18), verifier (18)
  │     ├── browser (35 tools), coding (42 tools)
  │     └── tool-registry.ts  → sealed at boot, 170 tools
  └── server/orchestration/index.ts                                 [TARGET-3]
        └── server/orchestration/orchestrator.ts                    [TARGET-5]
              ├── orchestration-context.ts  → generates UUID-A (ctx.sessionId)
              ├── orchestration-session.ts  → generates UUID-B (session.sessionId)  [BP-2]
              ├── orchestration-state.ts
              └── orchestration-loop.ts
                    └── workflow-validator.ts  [BP-1: coderx missing]
```

---

## Current Ownership Graph

| Concern | Owner | Status |
|---------|-------|--------|
| Chat lifecycle | chat-orchestrator.ts | ✅ Reachable |
| Orchestration dispatch | orchestrator.ts | ✅ Reachable |
| Orchestration context (UUID-A) | orchestration-context.ts | ✅ but see BP-2 |
| Session lifecycle (UUID-B) | orchestration-session.ts | ✅ but see BP-2 |
| Monitor registration | orchestration-monitor.ts (via loop) | ⚠ wrong sessionId |
| coderx agent | agent-coordinator.ts → coderx-agent.ts | ❌ blocked by BP-1 |
| Standard agents | agent-coordinator.ts | ✅ Reachable |
| Tool dispatch | tool-dispatcher.ts | ✅ Reachable |
| Tool registry | tool-registry.ts | ✅ 170 tools sealed |

---

## Confirmed Breakpoints

### BP-1 — `coderx` absent from VALID_AGENT_TYPES
- **File**: `server/orchestration/validation/workflow-validator.ts` lines 10–13
- **Code**:
  ```typescript
  const VALID_AGENT_TYPES = new Set([
    'planner', 'executor', 'verifier', 'browser',
    'filesystem', 'terminal', 'supervisor',
    // 'coderx' missing
  ]);
  ```
- **Contradiction**: `orchestration.types.ts` `AgentType` includes `'coderx'`. `agent-coordinator.ts` handles `case 'coderx'`.
- **Effect**: `validatePhase()` line 27 pushes an error for any coderx phase → `validateExecutionPlan()` returns `{ valid: false }` → loop calls `failResult()` immediately — coderx agent is unreachable

### BP-2 — Dual sessionId generation, monitoring/lifecycle disconnected
- **File**: `server/orchestration/orchestrator.ts` line 87 + `orchestration-session.ts` line 24
- **Code**:
  ```typescript
  const ctx = buildOrchestrationContext(fullReq);  // ctx.sessionId = UUID-A
  const session = createSession(..., 0);           // session.sessionId = UUID-B
  return runOrchestrationLoop(fullReq, ctx, session.sessionId); // passes UUID-B
  ```
  ```typescript
  // inside orchestration-loop.ts line 61:
  registerOrchestration(orchestrationId, ctx.sessionId, runId, count); // uses UUID-A
  startPlanning(ctx, sessionId);  // uses UUID-B → transitions session in Map
  ```
- **Effect**: monitoring snapshot carries UUID-A, session lifecycle operates on UUID-B — permanently disconnected. Also: `workflowsTotal=0` in `createSession` because workflow count not yet known at session-creation time.

---

## Modules Verified Clean

| File | Verdict |
|------|---------|
| `main.ts` | Clean — bootstrap order correct: tools → orchestration → routes |
| `chat-orchestrator.ts` | Clean — correct `void orchestrate({...})` call with valid shape |
| `orchestration/index.ts` | Clean — correct re-exports |
| `tool-loader.ts` | Clean — all 5 categories registered, registry sealed |
| `orchestration-context.ts` | Clean — `toToolContext` output matches `ToolExecutionContext` exactly |
| `orchestration-validator.ts` | Clean |
| `lifecycle-manager.ts` | Clean |
| `integrity-validator.ts` | Clean |
| `orchestration-state.ts` | Clean |
| `phase-planner.ts` | Clean |
| `tool-types.ts` | Clean |
