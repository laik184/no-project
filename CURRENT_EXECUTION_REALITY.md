# CURRENT_EXECUTION_REALITY
> Generated from actual code only. No assumptions.

---

## Who Imports Whom

```
main.ts
  ├── server/chat/index.ts
  │     └── (facade — exports buildChatRouter, buildSseRouter, attachWebSocket, startPersistence)
  ├── server/tools/registry/tool-loader.ts
  │     ├── server/tools/filesystem/index.ts
  │     ├── server/tools/terminal/index.ts
  │     ├── server/tools/verifier/index.ts
  │     ├── server/tools/browser/index.ts
  │     ├── server/tools/coding/index.ts
  │     └── server/tools/registry/tool-registry.ts
  └── server/orchestration/index.ts
        ├── server/orchestration/orchestrator.ts
        └── server/orchestration/monitoring/orchestration-monitor.ts

server/chat/api/chat.routes.ts
  └── server/chat/controllers/chat-controller.ts
        └── server/chat/orchestration/chat-orchestrator.ts          ← CHAT LAYER ENTRY POINT
              ├── server/orchestration/index.ts                      (orchestrate)
              └── server/orchestration/core/run-manager.ts           ← LAYER VIOLATION: core direct import

server/chat/orchestration/chat-orchestrator.ts
  imports from:
    ├── ../../orchestration/index.ts                                  (orchestrate — CORRECT)
    ├── ../../orchestration/core/run-manager.ts                       (runManager — VIOLATION)
    ├── ./conversation-manager.ts
    ├── ./session-manager.ts
    ├── ./turn-manager.ts
    ├── ./stream-manager.ts
    ├── ../messages/message-builder.ts
    ├── ../messages/user-message.ts
    ├── ../messages/assistant-message.ts
    ├── ../messages/system-message.ts
    ├── ../questions/clarification-manager.ts
    ├── ../context/context-loader.ts
    ├── ../context/context-builder.ts
    ├── ../timeline/timeline-manager.ts
    ├── ../timeline/run-timeline.ts
    ├── ../realtime/event-publisher.ts
    └── ../events/run.events.ts

server/orchestration/orchestrator.ts
  imports from:
    ├── ./validation/orchestration-validator.ts
    ├── ./core/orchestration-context.ts
    ├── ./core/orchestration-session.ts
    ├── ./core/orchestration-state.ts
    ├── ./execution/orchestration-loop.ts
    ├── ./telemetry/orchestration-metrics.ts
    ├── ./monitoring/failure-monitor.ts
    ├── ./monitoring/orchestration-monitor.ts
    ├── ./lifecycle/escalation-manager.ts
    └── ./utils/orchestration-utils.ts

server/orchestration/execution/orchestration-loop.ts
  imports from:
    ├── ./planning/execution-plan-builder.ts
    │     └── ./planning/workflow-planner.ts
    │           └── ./planning/phase-planner.ts
    ├── ./routing/workflow-routing.ts
    ├── ./execution/workflow-runner.ts
    │     └── ./execution/phase-runner.ts
    │           └── ./coordination/agent-coordinator.ts              ← AGENT DISPATCH
    └── ./validation/workflow-validator.ts

server/orchestration/coordination/agent-coordinator.ts
  imports from:
    ├── ../../agents/browser/browser-agent.ts
    ├── ../../agents/coderx/coderx-agent.ts
    ├── ../../agents/executor/executor-agent.ts
    ├── ../../agents/filesystem/filesystem-agent.ts
    ├── ../../agents/planner/planner-agent.ts
    ├── ../../agents/supervisor/supervisor-agent.ts
    ├── ../../agents/terminal/terminal-agent.ts
    ├── ../../agents/verifier/verifier-agent.ts
    └── ./dispatcher-client.ts                                       (type import only)
          └── ../../tools/registry/tool-dispatcher.ts

server/orchestration/coordination/dispatcher-client.ts
  imports from:
    └── ../../tools/registry/tool-dispatcher.ts
          └── ../../tools/registry/tool-registry.ts                  (sealed at boot)
```

---

## Who Calls Whom

```
main.ts
  loadAllTools()                  → tool-loader.ts (boot-time, synchronous)
  initOrchestration()             → orchestration/index.ts → orchestrator.ts
  chatOrchestrator.buildChatRouter() → mounts /api/chat/* routes
  createOrchestrationRouter()     → mounts /api/orchestration/* routes

POST /api/chat/run
  chat.routes.ts → chatController.startRun()
  chatController → chatOrchestrator.startRun()
  chatOrchestrator.startRun():
    1. conversationManager.create()
    2. runManager.register(runId, projectId)
    3. sessionManager.open()
    4. turnManager.start()
    5. messageBuilder.buildUser()
    6. eventPublisher.publish(run.started)
    7. messageBuilder.buildSystem()
    8. clarificationManager.maybeAskClarification()
    9. streamManager.open()
    10. contextLoader.loadForRun() + buildContext()
    11. void orchestrate({...}).then(completeRun).catch(failRun)
    → returns ChatRun immediately (HTTP 201)

orchestrate() [async, background]:
  validateRequest()
  buildOrchestrationContext()         → ctx.sessionId = UUID-A
  validateContext()
  initState()
  createSession(..., ctx.sessionId)   → session.sessionId = UUID-A (unified after fix)
  runOrchestrationLoop(req, ctx, ctx.sessionId)

runOrchestrationLoop():
  startPlanning(ctx, sessionId)
  buildExecutionPlan(req)
    → planWorkflows(req)
    → classifyIntent(goal)           → WorkflowIntent
    → primaryAgentForIntent(intent)  → AgentType ('executor' for most)
    → buildPhases(req, intent, primaryAgent)
    → phases: [{planner},{executor},{verifier}]
  validateExecutionPlan()
  registerOrchestration(...)
  startRunning(ctx, sessionId)
  for each wave: runWorkflow()
    for each phase: runPhase()
      toToolContext(ctx)
      dispatchPhaseToAgent(phase, ctx, attempt)

dispatchPhaseToAgent() → invokeAgent(agentType, phase.input, ...):
  case 'planner'    → runPlannerCycle({runId, projectId, goal})
  case 'executor'   → runExecutorAgent({runId, projectId, sandboxRoot, plan: undefined ← BUG})
  case 'verifier'   → runVerification({runId, projectId, sandboxRoot, phases, port, timeoutMs})
  case 'browser'    → runBrowserAgent({url, runId, projectId, ...})
  case 'filesystem' → runFilesystemAgent({context, operations, options})
  case 'terminal'   → executeTerminalSession({runId, projectId, sandboxRoot, steps, signal})
  case 'supervisor' → runSupervisorCycle({runId, projectId, goal})
  case 'coderx'     → runCoderXAgent({request: {userPrompt: '' ← BUG}})
```

---

## Who Owns What

| Concern | Owner | Location |
|---------|-------|----------|
| HTTP routing | Express router | main.ts + chat.routes.ts |
| Request validation | chat-controller.ts | chat layer |
| Chat lifecycle | chat-orchestrator.ts | chat layer |
| Run metadata registry | run-manager.ts | orchestration/core |
| Orchestration bootstrap | orchestrator.ts | orchestration |
| Execution sequencing | orchestration-loop.ts | orchestration |
| Workflow planning | workflow-planner.ts + phase-planner.ts | orchestration/planning |
| Execution plan validation | workflow-validator.ts | orchestration/validation |
| Agent dispatch | agent-coordinator.ts | orchestration/coordination |
| Tool dispatch | dispatcher-client.ts → tool-dispatcher.ts | orchestration/coordination → tools |
| Tool registration | tool-loader.ts → tool-registry.ts | tools/registry |
| Session lifecycle (orchestration) | orchestration-session.ts | orchestration/core |
| Session lifecycle (chat) | session-manager.ts | chat/orchestration |
| Lifecycle transitions | lifecycle-manager.ts | orchestration/lifecycle |
| Agent execution (planner) | planner-agent.ts → planning-loop.ts | agents/planner |
| Agent execution (executor) | executor-agent.ts → execution-loop.ts | agents/executor |
| Agent execution (coderx) | coderx-agent.ts → coding-loop.ts | agents/coderx |
| Agent execution (verifier) | verifier-agent.ts → verification-runner.ts | agents/verifier |
| Agent execution (supervisor) | supervisor-agent.ts → supervision-loop.ts | agents/supervisor |
| Agent execution (browser) | browser-agent.ts → browser-loop.ts | agents/browser |
| Agent execution (filesystem) | filesystem-agent.ts → filesystem-loop.ts | agents/filesystem |
| Agent execution (terminal) | terminal-agent.ts → terminal-runner.ts | agents/terminal |

---

## Actual Architecture (current runtime)

```
Layer 1: HTTP           main.ts → Express routes
Layer 2: Chat           chat-orchestrator.ts (lifecycle, stream, turn)
Layer 3: Orchestration  orchestrator.ts → orchestration-loop.ts → agent-coordinator.ts
Layer 4: Agents         *-agent.ts → *-loop.ts → dispatcher-client.ts
Layer 5: Tools          tool-dispatcher.ts → tool-registry.ts → tool handlers
```

### Layer violations (proven from code):
1. chat-orchestrator.ts imports run-manager.ts from orchestration/core (bypasses public surface)
2. agent-coordinator.ts passes `plan: undefined` to executor — type contract violated at runtime

---

## Orchestration Startup Sequence

```
1. main.ts: loadAllTools()
   → registerFilesystemTools() — 57 tools
   → registerTerminalTools()   — 23 tools
   → registerVerifierTools()   — 28 tools
   → registerBrowserTools()    — 35 tools
   → registerCodingTools()     — 46 tools (may vary)
   → sealRegistry()
   → "[tool-loader] 170 tools registered across 5 categories — registry sealed."

2. main.ts: initOrchestration()
   → initOrchestrator()
   → "[orchestrator] Initialized — orchestration layer ready."
   → "[orchestration] Orchestration layer initialized"

3. main.ts: routes mounted
   → /api/chat → buildChatRouter()
   → /api/orchestration → createOrchestrationRouter()

4. main.ts: chatOrchestrator.attachWebSocket(server)
5. main.ts: chatOrchestrator.startPersistence()
6. server.listen(3001) → "[nura-x] API server running on port 3001"
```
