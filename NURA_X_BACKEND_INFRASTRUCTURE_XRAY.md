# NURA X — Backend Infrastructure X-Ray Report

> **Generated:** 2026-05-20  
> **Scope:** `server/` (all folders, all nested files)  
> **Method:** Evidence-based — actual file reads, import traces, event flow analysis  
> **Analyst:** Principal Autonomous Systems Architect

---

## 1. Full Backend Folder Tree

```
server/
├── agents/
│   ├── core/                          ← Agent primitives (LLM-driven)
│   │   ├── context/                   ← Codebase indexing + context building
│   │   │   ├── indexing/codebase-indexer/
│   │   │   ├── indexing/context-builder/
│   │   │   └── review/diff-reviewer/
│   │   ├── execution/
│   │   │   ├── code-ops/code-fixer/
│   │   │   ├── code-ops/diff-proposer/
│   │   │   ├── code-ops/patch-engine/
│   │   │   ├── debug-ops/debug-agent/
│   │   │   └── debug-ops/error-fixer/
│   │   ├── llm/                       ← LLM utility agents
│   │   │   ├── context/
│   │   │   ├── embeddings/
│   │   │   ├── parser/llm-response-parser/
│   │   │   ├── prompt-builder/
│   │   │   └── router/
│   │   ├── memory/                    ← Agent memory (DUPLICATE — see §22)
│   │   ├── pipeline/                  ← Agent pipeline orchestrator
│   │   ├── recovery/                  ← Recovery agents (DUPLICATE — see §22)
│   │   ├── router/                    ← Intent router agents
│   │   └── tool-loop/                 ← ⭐ MAIN AI execution loop
│   ├── data/
│   │   ├── query-optimizer/           ← SQL optimization agents
│   │   └── redis/                     ← ❌ DEAD — adapter never registered
│   ├── deployer/
│   │   ├── infra/infrastructure/      ← ❌ DEAD STUBS — returns UNSUPPORTED
│   │   └── runtime/execution/         ← ❌ DEAD STUBS — returns UNSUPPORTED
│   ├── devops/
│   │   ├── docker-compose-generator/
│   │   ├── env-pipeline-validator/
│   │   └── github-actions-generator/
│   ├── generation/                    ← Code generation agents (large)
│   │   ├── backend-gen/
│   │   ├── code-gen/
│   │   ├── database/
│   │   ├── frontend-gen/
│   │   ├── graphql/
│   │   ├── mobile/
│   │   ├── pwa-gen/
│   │   └── routing-generator/
│   ├── governance/rollback/           ← ⚠️ MISPLACED — single utility fn
│   ├── infra/file-writer/             ← ⚠️ MISPLACED — should be service
│   ├── infrastructure/                ← ⚠️ MISPLACED — infra inside agents/
│   │   ├── deploy/
│   │   ├── events/
│   │   └── git/
│   ├── memory/                        ← ✅ ACTIVE real memory (MemoryManager)
│   ├── planning/                      ← Phase-based planner
│   ├── recovery/crash-responder.ts    ← Recovery (DUPLICATE — see §22)
│   └── supervisor/                    ← Multi-agent coordinator
├── api/                               ← Express route handlers
│   ├── agents.routes.ts
│   ├── artifacts.routes.ts
│   ├── checkpoints.routes.ts
│   ├── compat.routes.ts
│   ├── diff-approval.routes.ts
│   ├── diff.routes.ts
│   ├── folders.routes.ts
│   ├── fs.routes.ts
│   ├── import/
│   ├── intent.routes.ts
│   ├── inventory.routes.ts
│   ├── legacy-aliases.routes.ts
│   ├── observation.routes.ts
│   ├── preview.routes.ts
│   ├── projects.routes.ts
│   ├── publishing.routes.ts
│   ├── recovery.routes.ts
│   ├── run.routes.ts
│   ├── solo-pilot.routes.ts
│   ├── timeline.routes.ts
│   └── tools.routes.ts
├── approvals/                         ← Diff approval workflow
├── chat/                              ← Platform gateway
│   ├── events/
│   ├── orchestrator.ts                ← ChatOrchestrator (main entry point)
│   ├── routes/
│   ├── run/                           ← Run controller + executors
│   │   ├── controller.ts
│   │   ├── planned.executor.ts
│   │   ├── tool-loop.executor.ts
│   │   └── tool-reference.ts
│   └── streams/ws-server.ts
├── collaboration/                     ← Collaboration stubs
├── console/                           ← Process output pipeline
│   ├── capture/
│   ├── filter/
│   ├── history/
│   ├── intelligence/
│   ├── persist/
│   ├── runtime/
│   └── stream/
├── debug/                             ← Debug orchestrator + patchers
│   ├── analyzers/
│   ├── core/debug-orchestrator.ts
│   ├── events/
│   ├── memory/
│   ├── patchers/
│   ├── types/
│   └── verification/
├── engine/                            ← DAG execution engine
│   ├── graph/
│   ├── intelligence/
│   └── planning/
├── execution-history/                 ← Tool execution audit log
│   ├── api/
│   ├── core/
│   ├── hooks/
│   ├── metrics/
│   ├── replay/
│   ├── schema/
│   └── timeline/
├── file-explorer/                     ← File tree + CRUD + watcher pipeline
│   ├── crud/
│   ├── history/
│   ├── search/
│   ├── tree/
│   └── watcher/
├── infrastructure/                    ← Core infra (CORRECT placement)
│   ├── checkpoints/
│   ├── db/
│   ├── events/
│   │   ├── bus.ts                     ← ⭐ Central typed event emitter
│   │   ├── channels/
│   │   ├── core/subscription-manager.ts
│   │   ├── sse/
│   │   └── types/
│   ├── filesystem/watcher/
│   ├── process/
│   │   ├── process-health.ts
│   │   ├── process-persistence.ts
│   │   ├── process-registry.ts        ← Low-level process lifecycle
│   │   └── port-manager.ts
│   ├── proxy/preview-proxy.ts
│   ├── realtime/
│   ├── recovery/recovery-manager.ts   ← Infrastructure recovery
│   ├── runtime/
│   │   ├── runtime-manager.ts         ← ⭐ Public process API
│   │   └── runtime-store/runtime-store.ts ← Frontend state aggregator
│   ├── sandbox/
│   └── snapshots/
├── intelligence/                      ← High-order reasoning agents
├── observability/                     ← Logging, metrics, telemetry
├── orchestration/                     ← Master orchestration hub
│   ├── agents/                        ← Bridges (planner, supervisor)
│   ├── core/
│   ├── execution/
│   ├── registry/orchestrator-hub.ts   ← ⭐ Master Orchestrator Registry
│   ├── runtime/
│   └── telemetry/
├── preview/                           ← Preview lifecycle pipeline
│   ├── devtools/
│   ├── files/
│   ├── lifecycle/preview-lifecycle.manager.ts
│   ├── metrics/
│   ├── runtime/runtime.service.ts
│   ├── state/
│   └── tunnel/
├── publishing/                        ← Deployment pipeline
│   ├── events/
│   └── services/
├── realtime/                          ← ⚠️ MISPLACED agent generators
│   └── realtime/                      ← ❌ DOUBLE NESTING
│       ├── chat-feature-generator/    ← Should be agents/generation/
│       └── websocket-server-generator/← Should be agents/generation/
├── replit_integrations/               ← OpenRouter AI integration
├── runtime/                           ← Runtime observation system
│   ├── controllers/
│   ├── feedback/
│   ├── health/
│   ├── observer/
│   └── verification/
├── security/
│   └── security/                      ← ❌ DOUBLE NESTING
│       ├── api-key-manager/
│       ├── global-safety/
│       ├── input-sanitizer/
│       ├── mfa/
│       ├── oauth2-provider/
│       └── rate-limiter/
├── services/                          ← ✅ Infrastructure services
│   ├── index.ts                       ← FileSystem + Secrets services
│   ├── migration-runner/
│   ├── shared/
│   ├── shell/
│   │   └── package-installer/
│   └── test-ops/
├── tools/                             ← Tool registry + execution (49 tools)
│   ├── categories/
│   ├── core/
│   ├── observation/
│   ├── registry/
│   └── runtime/
└── verification/                      ← Verification engine
    ├── browser/browser-verifier.ts
    ├── engine/verification-engine.ts
    ├── events/
    ├── preview/
    ├── retry/
    └── runtime/runtime-checker.ts
```

---

## 2. Full Service Discovery Map

| # | Name | Path | Type | Status |
|---|------|------|------|--------|
| 1 | ChatOrchestrator | `server/chat/orchestrator.ts` | Orchestrator | ✅ Active |
| 2 | RunController | `server/chat/run/controller.ts` | Controller | ✅ Active |
| 3 | ToolLoopAgent | `server/agents/core/tool-loop/tool-loop.agent.ts` | Agent/Engine | ✅ Active |
| 4 | ContinuationManager | `server/agents/core/tool-loop/continuation/` | Manager | ✅ Active |
| 5 | OrchestratorHub | `server/orchestration/registry/orchestrator-hub.ts` | Registry | ✅ Active |
| 6 | RuntimeManager | `server/infrastructure/runtime/runtime-manager.ts` | Manager | ✅ Active |
| 7 | ProcessRegistry | `server/infrastructure/process/process-registry.ts` | Registry | ✅ Active |
| 8 | RuntimeStore | `server/infrastructure/runtime/runtime-store/runtime-store.ts` | Store | ✅ Active |
| 9 | EventBus | `server/infrastructure/events/bus.ts` | Event System | ✅ Active |
| 10 | SubscriptionManager | `server/infrastructure/events/core/subscription-manager.ts` | Manager | ✅ Active |
| 11 | SSEManager | `server/infrastructure/events/sse/sse-manager.ts` | Gateway | ✅ Active |
| 12 | ConnectionPool | `server/infrastructure/events/sse/connection-pool.ts` | Pool | ✅ Active |
| 13 | WebSocketServer | `server/chat/streams/ws-server.ts` | Gateway | ✅ Active |
| 14 | VerificationEngine | `server/verification/engine/verification-engine.ts` | Engine | ✅ Active |
| 15 | BrowserVerifier | `server/verification/browser/browser-verifier.ts` | Service | ✅ Active |
| 16 | RuntimeChecker | `server/verification/runtime/runtime-checker.ts` | Service | ✅ Active |
| 17 | DebugOrchestrator | `server/debug/core/debug-orchestrator.ts` | Orchestrator | ✅ Active |
| 18 | CrashResponder | `server/agents/recovery/crash-responder.ts` | Agent | ✅ Active |
| 19 | RecoveryManager | `server/infrastructure/recovery/recovery-manager.ts` | Manager | ✅ Active |
| 20 | PreviewOrchestrator | `server/preview/` | Orchestrator | ✅ Active |
| 21 | PreviewLifecycleManager | `server/preview/lifecycle/preview-lifecycle.manager.ts` | Manager | ✅ Active |
| 22 | PreviewProxy | `server/infrastructure/proxy/preview-proxy.ts` | Gateway | ✅ Active |
| 23 | CheckpointService | `server/infrastructure/checkpoints/checkpoint.service.ts` | Service | ✅ Active |
| 24 | ConsolePipeline | `server/console/` | Pipeline | ✅ Active |
| 25 | FileExplorerPipeline | `server/file-explorer/` | Pipeline | ✅ Active |
| 26 | MemoryManager | `server/agents/memory/manager/memory-manager.ts` | Manager | ✅ Active |
| 27 | PlannerService | `server/agents/planning/planner.service.ts` | Service | ✅ Active |
| 28 | SupervisorAgent | `server/agents/supervisor/supervisor-agent.ts` | Agent | ✅ Active |
| 29 | ToolRegistry | `server/tools/registry/` | Registry | ✅ Active |
| 30 | ExecutionHistorySystem | `server/execution-history/` | Service | ✅ Active |
| 31 | FileWriterService | `server/agents/infra/file-writer/index.ts` | Service | ✅ Active (⚠️ misplaced) |
| 32 | FileSystemService | `server/services/index.ts` | Service | ✅ Active |
| 33 | SecretsService | `server/services/index.ts` | Service | ✅ Active |
| 34 | ShellService | `server/services/shell/` | Service | ✅ Active |
| 35 | PackageInstaller | `server/services/shell/package-installer/` | Service | ✅ Active |
| 36 | MigrationRunner | `server/services/migration-runner/` | Service | ✅ Active |
| 37 | TestOpsService | `server/services/test-ops/` | Service | ✅ Active |
| 38 | PublishingPipeline | `server/publishing/` | Pipeline | ✅ Active |
| 39 | SecurityLayer | `server/security/security/` | Infrastructure | ✅ Active (⚠️ double-nested) |
| 40 | ObservabilitySystem | `server/observability/` | Infrastructure | ✅ Active |
| 41 | DAGEngine | `server/engine/` | Engine | ⚠️ Partial |
| 42 | IntelligenceLayer | `server/intelligence/` | Agent System | ⚠️ Partial |
| 43 | ObservationController | `server/runtime/` | Controller | ✅ Active |
| 44 | WatcherRegistry | `server/infrastructure/filesystem/watcher/` | Service | ✅ Active |
| 45 | PortManager | `server/infrastructure/process/port-manager.ts` | Utility | ✅ Active |
| 46 | **RedisModule** | `server/agents/data/redis/` | Agent | ❌ DEAD |
| 47 | **DeployerInfra** | `server/agents/deployer/infra/` | Stub | ❌ DEAD |
| 48 | **DeployerRuntime** | `server/agents/deployer/runtime/` | Stub | ❌ DEAD |
| 49 | RollbackPlanner | `server/agents/governance/rollback/` | Utility | ⚠️ Orphaned |

---

## 3. All Orchestrators

| Orchestrator | Path | Responsibility | Status |
|-------------|------|---------------|--------|
| **OrchestratorHub** (Master) | `server/orchestration/registry/orchestrator-hub.ts` | Registers all orchestrators; categorizes into WORKER/PHASE/PLATFORM/SERVICE | ✅ Active |
| **ChatOrchestrator** (Gateway) | `server/chat/orchestrator.ts` | Primary HTTP/WS entry; manages run lifecycle; WebSocket attach | ✅ Active |
| **RunController** | `server/chat/run/controller.ts` | Mode dispatch (tool-loop / planned / pipeline); DB writes; lifecycle events | ✅ Active |
| **DebugOrchestrator** | `server/debug/core/debug-orchestrator.ts` | Manages crash→analyze→patch→verify debug sessions | ✅ Active |
| **PreviewOrchestrator** | `server/preview/` | Coordinates runtime + tunnel + devtools sub-modules | ✅ Active |
| **PipelineOrchestrator** (core) | `server/agents/core/pipeline/orchestrator.ts` | Sequences agent phases; safety gates; result collection | ✅ Active |

---

## 4. All Runtime Systems

| System | Path | Responsibility |
|--------|------|---------------|
| **ProcessRegistry** | `server/infrastructure/process/process-registry.ts` | Spawns child processes; port allocation; health monitoring every 3s; PID persistence |
| **RuntimeManager** | `server/infrastructure/runtime/runtime-manager.ts` | Public API for start/stop/restart; sandbox path resolution; delegates to ProcessRegistry |
| **RuntimeStore** | `server/infrastructure/runtime/runtime-store/runtime-store.ts` | Single Source of Truth for frontend — aggregates process + preview + recovery into RuntimeSnapshot |
| **ObservationController** | `server/runtime/` | Watches live logs + probes ports for all project servers; emits runtime.observation events |
| **PreviewLifecycleManager** | `server/preview/lifecycle/preview-lifecycle.manager.ts` | State machine: idle→starting→running→crashed; emits SSE events to frontend |
| **ProcessPersistence** | `server/infrastructure/process/process-persistence.ts` | Saves PID metadata to disk; enables recovery after dev-server restart |
| **ProcessHealth** | `server/infrastructure/process/process-health.ts` | 3s interval check; marks crashed processes; triggers `process.crashed` event |
| **PortManager** | `server/infrastructure/process/port-manager.ts` | Dynamic free port allocation |

---

## 5. All Pipelines

| Pipeline | Path | Stages |
|----------|------|--------|
| **ConsolePipeline** | `server/console/` | capture → filter (ANSI strip) → intelligence (error detect) → persist → stream (SSE) |
| **FileExplorerPipeline** | `server/file-explorer/` | tree → crud → search → history → watcher |
| **PreviewPipeline** | `server/preview/` | runtime → files → tunnel → devtools → state → metrics |
| **PublishingPipeline** | `server/publishing/` | builder → bundler → provisioner → promoter → security-scan |
| **AgentPipeline** (core) | `server/agents/core/pipeline/` | phase-runner → safety-gate → result-collector |
| **ToolLoopPipeline** | `server/agents/core/tool-loop/` | prompt → LLM stream → tool-exec → verify → loop/exit |
| **CheckpointPipeline** | `server/infrastructure/checkpoints/` | git-commit → file-snapshot → DB-persist |

---

## 6. All Registries

| Registry | Path | What it Tracks |
|----------|------|----------------|
| **OrchestratorHub** | `server/orchestration/registry/orchestrator-hub.ts` | 8 orchestrators (WORKER/PHASE/PLATFORM/SERVICE categories) |
| **ToolRegistry** | `server/tools/registry/` | 49 tools across 15 categories |
| **ProcessRegistry** | `server/infrastructure/process/process-registry.ts` | All child processes (PID, port, status, command) |
| **WatcherRegistry** | `server/infrastructure/filesystem/watcher/watcher-registry.ts` | Active chokidar file watchers per project |
| **SSEConnectionPool** | `server/infrastructure/events/sse/connection-pool.ts` | Active SSE clients with topic + projectId filters |
| **PipelineRegistry** | `server/agents/core/pipeline/registry/orchestrator.registry.ts` | Agent pipeline orchestrators |
| **RunRegistry** | `server/chat/run/controller.ts` (in-memory) | Active agent runs (runId → status) |

---

## 7. All Managers

| Manager | Path | Owns |
|---------|------|------|
| RuntimeManager | `server/infrastructure/runtime/runtime-manager.ts` | Process lifecycle (public API) |
| RuntimeStore | `server/infrastructure/runtime/runtime-store/runtime-store.ts` | Frontend state aggregation |
| SubscriptionManager | `server/infrastructure/events/core/subscription-manager.ts` | Event fan-out (1 listener per event type) |
| SSEManager | `server/infrastructure/events/sse/sse-manager.ts` | SSE connection lifecycle + heartbeats |
| RecoveryManager | `server/infrastructure/recovery/recovery-manager.ts` | Crash recovery + lock + circuit-breaker |
| MemoryManager | `server/agents/memory/manager/memory-manager.ts` | Project memory (.nura/ + pgvector + DB) |
| ContinuationManager | `server/agents/core/tool-loop/continuation/continuation-manager.ts` | Long-run context compression + loop restart |
| PreviewLifecycleManager | `server/preview/lifecycle/preview-lifecycle.manager.ts` | Preview state machine |
| CheckpointService | `server/infrastructure/checkpoints/checkpoint.service.ts` | git + file + DB snapshots |

---

## 8. All Controllers

| Controller | Path | Responsibility |
|-----------|------|---------------|
| RunController | `server/chat/run/controller.ts` | Run lifecycle: init → dispatch → finalize |
| ObservationController | `server/runtime/observer/` | Live log + port health watcher |
| RuntimeController | `server/runtime/controllers/` | Runtime state transitions |
| FeedbackController | `server/runtime/feedback/` | Post-run feedback collection |

---

## 9. All Event Systems

### Event Bus Architecture

```
TypedEventEmitter (bus.ts)
         │
         ▼
SubscriptionManager (1 listener per event type)
    ├── ReplayCache (last N events per topic)
    └── SSEConnectionPool.fanOut()
         ├── Client A (topics: agent, console)
         ├── Client B (topics: runtime, file)
         └── Client C (all topics)
```

### Event Types

| Event | Emitted By | Consumed By |
|-------|-----------|-------------|
| `run.lifecycle` | RunController | ExecutionHistory, SSE clients, RecoveryManager |
| `process.crashed` | ProcessHealth | CrashResponder, RecoveryManager |
| `console.log` | CaptureService | ConsolePipeline→SSE (throttled ≤20/s) |
| `file.change` | WatcherRegistry | FileExplorer SSE |
| `runtime.verified` | VerificationEngine | PreviewOrchestrator |
| `runtime.observation` | ObservationController | SSE clients (throttled ≤1/2s) |
| `runtime.sync` | RuntimeStore | SSE clients |
| `diff` | DiffProposer | Approvals UI |
| `checkpoint` | CheckpointService | SSE clients |
| `preview.lifecycle` | PreviewLifecycleManager | SSE clients |
| `debug.lifecycle` | DebugOrchestrator | SSE clients |
| `tool.execution` | ToolRegistry | ExecutionHistory, SSE clients |
| `phase.started/completed` | ToolLoopExecutor | Orchestration telemetry |

---

## 10. All SSE / WebSocket Systems

| System | Path | Protocol | Topics |
|--------|------|----------|--------|
| **SSEManager** | `server/infrastructure/events/sse/sse-manager.ts` | SSE | All 12 topics |
| **ConnectionPool** | `server/infrastructure/events/sse/connection-pool.ts` | SSE | Per-client topic filtering |
| **WebSocketServer** | `server/chat/streams/ws-server.ts` | WS `/ws/terminal` | Chat + tool-loop bi-directional |
| **ConsolePipeline Stream** | `server/console/stream/stream.service.ts` | SSE | `console.log` events |
| **ReplayCache** | `server/infrastructure/realtime/` | In-memory | Hydrates new SSE connections |

**Throttling Rules:**
- `console.log` events: ≤ 20/second
- `runtime.observation` events: ≤ 1 per 500ms

---

## 11. All Verification Systems

| System | Path | What it Checks |
|--------|------|---------------|
| **VerificationEngine** | `server/verification/engine/verification-engine.ts` | Orchestrates all checks in parallel |
| **BrowserVerifier** | `server/verification/browser/browser-verifier.ts` | HTTP fetch OR Playwright; white-screen detect, React error boundaries, console errors |
| **RuntimeChecker** | `server/verification/runtime/runtime-checker.ts` | Process alive + log scan for fatal errors |
| **TypeScript Validator** | `server/verification/` | TypeScript compilation errors |
| **Package Validator** | `server/verification/` | Missing dependencies |
| **LogAnalyzer** | `server/debug/analyzers/` | Error pattern detection in process logs |

**Trigger:** Agent calls `task_complete` tool → VerificationEngine runs → if FAIL, appends feedback to LLM messages → agent self-heals → loop continues.

---

## 12. All Recovery Systems

> ⚠️ **THREE separate recovery systems exist — overlap/conflict risk**

| System | Path | Trigger | Mechanism |
|--------|------|---------|-----------|
| **CrashResponder** (Agent) | `server/agents/recovery/crash-responder.ts` | `process.crashed` bus event | Invokes DebugOrchestrator for LLM-driven fix |
| **RecoveryManager** (Infra) | `server/infrastructure/recovery/recovery-manager.ts` | `run.lifecycle` failed events | Lock → circuit-breaker → filesystem rollback to last checkpoint |
| **CoreRecovery** (Agent Primitive) | `server/agents/core/recovery/` | Internal agent pipeline failures | Backoff + retry-strategy + safety-guard |
| **DebugOrchestrator** | `server/debug/core/debug-orchestrator.ts` | Called by CrashResponder | Analyze logs → generate patch → verify → rollback if fail |

---

## 13. All Memory Systems

> ⚠️ **TWO memory systems exist — one active, one duplicate**

### Active Memory (`server/agents/memory/`) ✅
```
MemoryManager (project-scoped singleton)
├── persistence/        ← .nura/ markdown files (architecture, progress, failures)
├── conversation/       ← Chat message history (DB)
├── context/           ← Run summarizer + project-context-builder
├── task-memory/       ← tasks.md tracking
├── storage/           ← Memory indexer + cleaner
└── vector/            ← pgvector semantic search + temporal weighting
```

### Duplicate Memory (`server/agents/core/memory/`) ⚠️
- Contains 8 memory agent files (classifier, cleaner, deduplicator, filter, etc.)
- **No active callers found** — orphaned from main memory system
- Likely aspirational/unused implementation

---

## 14. All Preview Systems

| Component | Path | Role |
|-----------|------|------|
| PreviewOrchestrator | `server/preview/` | Coordinates all sub-modules |
| PreviewLifecycleManager | `server/preview/lifecycle/preview-lifecycle.manager.ts` | State machine (idle→starting→running→crashed) |
| RuntimeService | `server/preview/runtime/runtime.service.ts` | Thin adapter over RuntimeManager |
| PreviewProxy | `server/infrastructure/proxy/preview-proxy.ts` | Maps `/preview/:projectId/*` → live port; 503 on starting |
| TunnelModule | `server/preview/tunnel/` | External URL tunneling |
| DevtoolsModule | `server/preview/devtools/` | Browser devtools integration |
| MetricsModule | `server/preview/metrics/` | Preview performance metrics |

---

## 15. Complete HTTP → Agent → Response Flow

```
1. HTTP POST /api/run
   └─► run.routes.ts
       └─► chatOrchestrator.run.runGoal()
           └─► RunController.executeAsync()
               │
               ├─[mode: tool-loop]─► tool-loop.executor.ts
               │   ├─► MemoryManager.loadContext()
               │   ├─► runAgentLoopWithContinuation()
               │   │   └─► ContinuationManager
               │   │       └─► runAgentLoop() [up to 5× restarts]
               │   │           └─► tool-loop.agent.ts
               │   │               ├─► llm.streamChatWithTools() [OpenRouter]
               │   │               │   └─► SSE tokens → client via bus
               │   │               ├─► executeToolCall() [49 tools]
               │   │               └─► if task_complete:
               │   │                   └─► VerificationEngine
               │   │                       ├─► BrowserVerifier
               │   │                       ├─► RuntimeChecker
               │   │                       └─► if FAIL: append feedback → loop
               │   └─► Finalize: save summary + persist messages + update tasks.md
               │
               └─[mode: planned]─► planned.executor.ts
                   └─► PlannerAgent → phases → phase.executor.ts
                       └─► runAgentLoop() (per phase)

2. HTTP 202 Accepted (immediate)
   └─► {runId, status: "started"}

3. Real-time updates via SSE
   └─► /sse endpoint → ConnectionPool → topics: [agent, console, tool.execution...]
```

---

## 16. Architecture Classification Table

| System | Classification | Cohesion | Coupling | Status |
|--------|---------------|----------|----------|--------|
| ChatOrchestrator | Orchestrator | HIGH | LOW | ✅ Correct |
| RunController | Controller | HIGH | MED | ✅ Correct |
| ToolLoopAgent | Agent/Engine | HIGH | LOW | ✅ Correct |
| EventBus | Infrastructure | HIGH | NONE | ✅ Correct |
| SubscriptionManager | Manager | HIGH | LOW | ✅ Correct |
| ProcessRegistry | Registry | HIGH | LOW | ✅ Correct |
| RuntimeManager | Manager | HIGH | LOW | ✅ Correct |
| RuntimeStore | Store | HIGH | MED | ✅ Correct |
| VerificationEngine | Engine | HIGH | LOW | ✅ Correct |
| RecoveryManager | Manager | HIGH | MED | ✅ Correct |
| CrashResponder | Agent | MED | MED | ⚠️ Overlaps RecoveryManager |
| MemoryManager | Manager | HIGH | LOW | ✅ Correct |
| SupervisorAgent | Agent | HIGH | MED | ✅ Correct |
| ToolRegistry | Registry | HIGH | LOW | ✅ Correct |
| RedisModule | Agent | HIGH | NONE | ❌ Dead (no adapter) |
| DeployerInfra | Stub | — | NONE | ❌ Dead (UNSUPPORTED) |
| DeployerRuntime | Stub | — | NONE | ❌ Dead (UNSUPPORTED) |
| FileWriterService | Service | HIGH | MED | ⚠️ Misplaced in agents/ |
| CoreRecovery agents | Agent | MED | LOW | ⚠️ Orphaned |
| CoreMemory agents | Agent | MED | LOW | ⚠️ Orphaned/duplicate |
| realtime/realtime/ | Agent (Generator) | HIGH | LOW | ❌ Wrong folder |
| security/security/ | Infrastructure | HIGH | MED | ⚠️ Double-nested |
| DAGEngine | Engine | HIGH | MED | ⚠️ Partially integrated |

---

## 17. Wrong Folder Placement Report

| # | Current Path | Problem | Correct Path |
|---|-------------|---------|-------------|
| 1 | `server/realtime/realtime/chat-feature-generator/` | Code GENERATOR agent double-nested inside realtime/ | `server/agents/generation/realtime/chat-feature-generator/` |
| 2 | `server/realtime/realtime/websocket-server-generator/` | Code GENERATOR agent double-nested inside realtime/ | `server/agents/generation/realtime/websocket-server-generator/` |
| 3 | `server/security/security/` | Double nesting — security inside security | `server/security/` (flatten one level) |
| 4 | `server/agents/infra/file-writer/` | Active SERVICE inside agents/ | `server/services/file-writer/` |
| 5 | `server/agents/governance/rollback/` | Single utility function inside agents/governance | `server/infrastructure/checkpoints/rollback/` |
| 6 | `server/agents/infrastructure/` | Infrastructure code (deploy, git, events) inside agents/ | `server/infrastructure/deploy/`, `server/infrastructure/git/` |
| 7 | `server/agents/deployer/` | Dead deployment stubs inside agents/ | Remove entirely |
| 8 | `server/agents/data/redis/` | Dead Redis module inside agents/ | Remove entirely |
| 9 | `server/agents/core/memory/` | Duplicate/orphaned memory agents inside core | Remove or merge into `server/agents/memory/` |
| 10 | `server/agents/core/recovery/` | Orphaned recovery agents (not called by active systems) | Evaluate: merge into RecoveryManager or remove |

---

## 18. Duplicate Systems Report

| Duplication | Systems Involved | Recommended Action |
|------------|-----------------|-------------------|
| **Recovery (3×)** | `agents/recovery/crash-responder.ts` + `infrastructure/recovery/recovery-manager.ts` + `agents/core/recovery/` | Keep CrashResponder + RecoveryManager; remove/merge core/recovery/ |
| **Memory (2×)** | `agents/memory/` (active) + `agents/core/memory/` (orphaned) | Keep `agents/memory/`; remove `agents/core/memory/` |
| **Router (2×)** | `agents/core/router/` (LLM intent) + `agents/supervisor/agent-router.ts` (task routing) | Different concerns — document clearly; no merge |
| **File Writer (2×)** | `agents/infra/file-writer/` (atomic write service) + `services/index.ts` (simple fs helpers) | Move file-writer to `services/file-writer/` |

---

## 19. Dead / Unused Systems Report

| System | Path | Evidence | Action |
|--------|------|---------|--------|
| **Redis Module** | `server/agents/data/redis/` | `registerAdapter()` is NEVER called anywhere outside the module. All 6 agents throw "No Redis adapter registered" on use. | **REMOVE** |
| **DeployerInfra** | `server/agents/deployer/infra/infrastructure/index.ts` | File explicitly states: "returns UNSUPPORTED — no infrastructure provider configured." All 3 functions return `success: false`. | **REMOVE** |
| **DeployerRuntime** | `server/agents/deployer/runtime/execution/index.ts` | File explicitly states: "returns UNSUPPORTED — no deployment provider configured." All functions throw or return failure. | **REMOVE** |
| **CoreMemory Agents** | `server/agents/core/memory/` | 8 agent files with no callers in active execution paths. The active `MemoryManager` (`agents/memory/`) has its own implementation. | **REMOVE or MERGE** |
| **RollbackPlanner** | `server/agents/governance/rollback/index.ts` | Single `buildRollbackPlan()` function — no callers found. The real rollback lives in `infrastructure/checkpoints/`. | **MERGE** into checkpoints |

---

## 20. Tight Coupling Report

| Coupling | Between | Severity | Fix |
|---------|---------|----------|-----|
| CrashResponder ↔ DebugOrchestrator | Direct import, tightly coupled | MED | Route via bus event instead |
| tool-loop.executor.ts ↔ MemoryManager | Direct instantiation | LOW | Already project-scoped; OK |
| PreviewProxy ↔ RuntimeManager | Direct import (singleton) | LOW | OK — infrastructure boundary |
| RunController ↔ DB (drizzle) | Direct DB calls in controller | MED | Should use storage layer |
| VerificationEngine ↔ Playwright | Direct dependency | MED | Should be behind adapter |

---

## 21. Cross-Domain Pollution Report

| Pollution | Description | Fix |
|-----------|------------|-----|
| `server/realtime/` contains GENERATOR agents | `chat-feature-generator` and `websocket-server-generator` are code generation agents placed in the realtime/ infrastructure folder | Move to `agents/generation/realtime/` |
| `server/agents/infrastructure/` | Infrastructure systems (deploy, git, events) living inside the agents/ domain | Move to `server/infrastructure/` |
| `server/agents/data/redis/` | Data infrastructure module inside AI agents domain | Remove (dead) |
| `server/agents/deployer/` | Deployment infrastructure inside AI agents | Remove (dead stubs) |
| `server/agents/infra/file-writer/` | Pure file I/O service inside AI agents | Move to `server/services/` |

---

## 22. Root Folder Refactor Recommendations

```
BEFORE (current):                    AFTER (recommended):
─────────────────────────────────    ─────────────────────────────────
server/
├── agents/
│   ├── data/redis/              ──► REMOVE (dead)
│   ├── deployer/                ──► REMOVE (dead stubs)
│   ├── governance/rollback/     ──► MERGE → infrastructure/checkpoints/
│   ├── infra/file-writer/       ──► MOVE → services/file-writer/
│   ├── infrastructure/          ──► MOVE → infrastructure/deploy/, infrastructure/git/
│   ├── core/memory/             ──► REMOVE (duplicate)
│   └── core/recovery/           ──► EVALUATE/MERGE
├── realtime/
│   └── realtime/                ──► MOVE agents to agents/generation/realtime/
│       ├── chat-feature-generator/     (folder can then become infrastructure/realtime/)
│       └── websocket-server-generator/
└── security/
    └── security/                ──► FLATTEN to security/
```

---

## 23. Exact Files To Remove

```
server/agents/data/redis/                         ← Dead module (Redis never connected)
server/agents/deployer/                           ← Dead stubs (UNSUPPORTED returns)
server/agents/core/memory/                        ← Duplicate memory system (orphaned)
server/agents/governance/                         ← Orphaned rollback utility
```

## 24. Exact Files / Folders To Move

```
server/agents/infra/file-writer/
  → server/services/file-writer/

server/agents/infrastructure/deploy/
  → server/infrastructure/deploy/

server/agents/infrastructure/git/
  → server/infrastructure/git/

server/agents/infrastructure/events/
  → server/infrastructure/events/ (merge)

server/realtime/realtime/chat-feature-generator/
  → server/agents/generation/realtime/chat-feature-generator/

server/realtime/realtime/websocket-server-generator/
  → server/agents/generation/realtime/websocket-server-generator/

server/security/security/  (flatten double nesting)
  → server/security/api-key-manager/
  → server/security/global-safety/
  → server/security/input-sanitizer/
  ... etc.
```

## 25. Exact Services To Merge

```
server/agents/core/recovery/ → merge relevant patterns into server/infrastructure/recovery/recovery-manager.ts
server/agents/governance/rollback/ → merge buildRollbackPlan() into server/infrastructure/checkpoints/checkpoint.service.ts
server/agents/infra/file-writer/ → server/services/file-writer/ (already active, just move)
```

---

## 26. Safe Migration Strategy

### Phase 1 — Remove Dead Code (Zero Risk)
```
rm -rf server/agents/data/redis/
rm -rf server/agents/deployer/
rm -rf server/agents/core/memory/     # Verify no callers first
```

### Phase 2 — Flatten Double-Nested Folders (Low Risk)
```
# security/security/ → security/
# Update all imports (grep for "security/security/")
```

### Phase 3 — Move Misplaced Services (Medium Risk)
```
# file-writer: agents/infra/ → services/
# infrastructure/* out of agents/
# Update 5-10 import paths
```

### Phase 4 — Fix Generator Agent Placement (Low Risk)
```
# realtime/realtime/*-generator → agents/generation/realtime/
# No callers outside the generators themselves
```

### Phase 5 — Document + Verify
```
# Run app, check all routes
# Verify SSE still connects
# Verify agent runs work end-to-end
```

---

## 27. Production-Grade Target Architecture

```
server/
├── agents/              ← ONLY AI/LLM systems
│   ├── core/            ← Agent primitives
│   ├── generation/      ← Code generators (all types)
│   ├── memory/          ← Single memory system
│   ├── planning/        ← Phase planner
│   ├── recovery/        ← Single recovery agent
│   └── supervisor/      ← Multi-agent coordinator
├── api/                 ← Route handlers (thin)
├── chat/                ← Platform gateway
├── console/             ← Output pipeline
├── debug/               ← Debug orchestrator
├── execution-history/   ← Audit log
├── file-explorer/       ← File ops pipeline
├── infrastructure/      ← ALL infrastructure
│   ├── checkpoints/     ← (includes rollback)
│   ├── db/
│   ├── deploy/          ← (from agents/infrastructure/)
│   ├── events/
│   ├── filesystem/
│   ├── git/             ← (from agents/infrastructure/)
│   ├── process/
│   ├── proxy/
│   ├── realtime/
│   ├── recovery/
│   ├── runtime/
│   └── sandbox/
├── intelligence/        ← Reasoning agents
├── observability/       ← Telemetry
├── orchestration/       ← Orchestrator hub
├── preview/             ← Preview pipeline
├── publishing/          ← Deployment pipeline
├── runtime/             ← Observation controller
├── security/            ← (FLATTENED — no double nesting)
├── services/            ← Infrastructure services
│   ├── file-writer/     ← (from agents/infra/)
│   ├── migration-runner/
│   ├── package-installer/
│   ├── shell/
│   └── test-ops/
├── tools/               ← Tool registry + execution
└── verification/        ← Verification engine
```

---

## 28. Scores

### Infrastructure Stability Score: **72 / 100**
- ✅ Strong event-driven core (+20)
- ✅ Clean SSE fan-out with throttling (+10)
- ✅ Solid checkpoint + recovery system (+10)
- ✅ Typed event bus (+10)
- ❌ 3 dead modules (-10)
- ❌ 3 duplicate systems (-8)
- ❌ Multiple misplaced folders (-10)

### Architecture Quality Score: **68 / 100**
- ✅ Clear orchestration hierarchy (+15)
- ✅ Service/Agent separation (mostly) (+10)
- ✅ Single Source of Truth (RuntimeStore) (+10)
- ❌ Double-nested folders (realtime, security) (-8)
- ❌ Infrastructure inside agents/ (-9)
- ❌ Dead code not cleaned up (-10)
- ❌ 3 recovery systems — unclear authority (-10)

### Replit Architecture Similarity: **~71%**
- Event bus ✅, SSE pipeline ✅, recovery ✅, tool-loop ✅
- Missing: true bounded contexts, clean monorepo separation, unified auth layer

---

## 29. Summary: Priority Action List

| Priority | Action | Risk | Impact |
|---------|--------|------|--------|
| 🔴 P0 | Remove `redis/`, `deployer/` dead modules | ZERO | Clean build, no confusion |
| 🔴 P0 | Remove `agents/core/memory/` duplicate | LOW | Eliminate memory confusion |
| 🟠 P1 | Move `agents/infra/file-writer/` → `services/file-writer/` | LOW | Correct domain |
| 🟠 P1 | Move `agents/infrastructure/*` → `infrastructure/` | LOW | Fix cross-domain pollution |
| 🟠 P1 | Flatten `security/security/` double nesting | LOW | Clean imports |
| 🟡 P2 | Move `realtime/realtime/*-generator` → `agents/generation/realtime/` | MED | Correct agent placement |
| 🟡 P2 | Consolidate 3 recovery systems → 2 (CrashResponder + RecoveryManager) | MED | Clear ownership |
| 🟢 P3 | Evaluate `agents/core/recovery/` — merge patterns or remove | MED | Reduce agent surface |
| 🟢 P3 | DAGEngine (`server/engine/`) — document usage or mark aspirational | LOW | Clarity |
