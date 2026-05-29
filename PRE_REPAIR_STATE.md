# PRE_REPAIR_STATE.md
> Snapshot taken before execution chain repair. All facts from actual code only.

---

## Current Import Graph

```
main.ts
  └── import { chatOrchestrator } from './server/chat/index.ts'

server/chat/index.ts
  ├── chatRoutes / runRoutes / historyRoutes / attachmentRoutes / questionRoutes
  ├── heartbeatManager, websocketManager
  ├── infraSseManager
  └── exports: chatOrchestrator (facade: buildChatRouter, buildSseRouter,
                                        attachWebSocket, startPersistence)

server/chat/orchestration/chat-orchestrator.ts
  ├── import { runManager }          from '../../orchestration/core/run-manager.ts'
  ├── import { conversationManager } from './conversation-manager.ts'
  ├── import { sessionManager }      from './session-manager.ts'
  ├── import { turnManager }         from './turn-manager.ts'
  ├── import { streamManager }       from './stream-manager.ts'
  ├── import { messageBuilder }      from '../messages/message-builder.ts'
  ├── import { buildUserPayload }    from '../messages/user-message.ts'
  ├── import { buildAssistantPayload } from '../messages/assistant-message.ts'
  ├── import { buildBaseSystemPayload } from '../messages/system-message.ts'
  ├── import { clarificationManager } from '../questions/clarification-manager.ts'
  ├── import { contextLoader }       from '../context/context-loader.ts'
  ├── import { buildContext }        from '../context/context-builder.ts'
  ├── import { timelineManager }     from '../timeline/timeline-manager.ts'
  ├── import { runTimeline }         from '../timeline/run-timeline.ts'
  ├── import { eventPublisher }      from '../realtime/event-publisher.ts'
  ├── import { make*Event }          from '../events/run.events.ts'
  └── exports: chatOrchestrator (startRun, completeRun, failRun, cancelRun)

server/orchestration/index.ts
  ├── import { orchestrate, initOrchestrator, ... } from './orchestrator.ts'
  ├── import { allSnapshots, ... }  from './monitoring/orchestration-monitor.ts'
  ├── import { globalSummary }      from './telemetry/orchestration-metrics.ts'
  ├── import { newOrchestrationId } from './utils/orchestration-utils.ts'
  └── exports: orchestrate, initOrchestrator, shutdownOrchestrator,
               initOrchestration(), createOrchestrationRouter()

server/tools/registry/tool-loader.ts
  ├── import { registerFilesystemTools } from '../filesystem/index.ts'
  ├── import { registerTerminalTools }   from '../terminal/index.ts'
  ├── import { registerVerifierTools }   from '../verifier/index.ts'
  ├── import { registerBrowserTools }    from '../browser/index.ts'
  ├── import { registerCodingTools }     from '../coding/index.ts'
  ├── import { sealRegistry, toolCount, isSealed } from './tool-registry.ts'
  └── exports: loadAllTools()

server/orchestration/orchestrator.ts
  ├── import { validateRequest, validateContext } from './validation/...'
  ├── import { buildOrchestrationContext }        from './core/...'
  ├── import { createSession, failSession }       from './core/...'
  ├── import { initState, destroyState }          from './core/...'
  ├── import { runOrchestrationLoop }             from './execution/orchestration-loop.ts'
  └── exports: orchestrate(), initOrchestrator(), shutdownOrchestrator(),
               getOrchestratorDiagnostics(), cleanupOrchestrationRun()
```

---

## Current Execution Graph

```
HTTP Request
    ↓
Express (main.ts, port 3001)
    ↓
/api/chat/* → chatOrchestrator.buildChatRouter() [chat/index.ts]
    ↓
routes → controllers → chatOrchestrator.startRun() [chat-orchestrator.ts]
    ↓
1. conversationManager.create()
2. runManager.register(runId, projectId)    ← only state tracking
3. sessionManager.open()
4. turnManager.start()
5. messageBuilder.buildUser()
6. eventPublisher.publish(run.started)
7. messageBuilder.buildSystem()
8. clarificationManager.maybeAskClarification()
9. streamManager.open()
10. contextLoader.loadForRun() + buildContext()
    ↓
return ChatRun { runId, projectId, ... }

⛔ DEAD END — execution terminates here.
   orchestrate() is NEVER called.
   No agent runs. No tool dispatches.
```

---

## Current Ownership Graph

| Concern | Owner | Reachable |
|---------|-------|-----------|
| Conversation lifecycle | chat-orchestrator.ts | ✅ |
| Session lifecycle | chat-orchestrator.ts | ✅ |
| Turn lifecycle | chat-orchestrator.ts | ✅ |
| Stream lifecycle | chat-orchestrator.ts | ✅ |
| Run state registry | run-manager.ts | ✅ |
| Agent routing | agent-coordinator.ts | ❌ |
| Tool dispatch | tool-dispatcher.ts | ❌ |
| Tool registration | tool-loader.ts | ❌ |
| Orchestration loop | orchestration-loop.ts | ❌ |
| Recovery / escalation | recovery-coordinator.ts | ❌ |

---

## Current Dead Ends

1. `startRun()` returns without firing `orchestrate()` — bridge absent
2. `loadAllTools()` — never called, registry has 0 tools
3. `initOrchestration()` — never called, orchestrator uninitialized
4. `/api/orchestration/*` — router not mounted, HTTP route does not exist

---

## Unreachable Modules (not reachable from main.ts at runtime)

- `server/orchestration/**` (all 43 files)
- `server/tools/**` (all 200+ files)
- `server/agents/**` (all 7 agent trees + coderx)

---

## Typo Found

`server/chat/orchestration/chat-orchestrator.ts` line 1: `t/**` — stray `t` character before the JSDoc block opener.
