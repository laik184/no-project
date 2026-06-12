# System Architecture

## Architecture overview

**FACT**: The system is split into frontend, API server, shared schema/models, infrastructure, services/repositories, orchestration/agents, tools, memory, preview, terminal, and file explorer modules.

```text
User Browser
  ↓
React/Vite UI
  ├─ Workspace chat
  ├─ File explorer/editor/diff panels
  ├─ Preview iframe
  ├─ Terminal/console surfaces
  └─ Project/import/publishing/settings pages
  ↓ HTTP/SSE/WS
Express API server (main.ts)
  ├─ Infrastructure: db, bus, SSE, runtime manager, redis/queue
  ├─ Chat: run lifecycle, messages, questions, checkpoints, realtime
  ├─ Orchestration: validate → context → session/state → loop → diagnostics
  ├─ Agents: planner/executor/filesystem/terminal/browser/verifier/coderx/supervisor
  ├─ Tools: registry → dispatcher → filesystem/coding/terminal/verifier/git/browser
  ├─ File explorer: sandbox file CRUD/search/history/watchers
  ├─ Terminal: sessions, commands, runtime, streams
  ├─ Preview: runtime lifecycle, frame proxy, devtools, metrics
  └─ Memory: repository, chunking, embedding, vector search, retrieval
  ↓
PostgreSQL + filesystem sandbox + in-memory managers + optional Redis/queue
```

## Startup sequence

**FACT**: `main.ts` startup order is:

1. Install global error handlers.
2. Run startup diagnostics.
3. Create Express app and body parsers.
4. `registerInfrastructure()` initializes bus adapter and seeds default project.
5. `registerRepositories()` documents singleton module-load initialization.
6. `registerServices()` bootstraps memory and loads/seals all tools.
7. `initPreviewModule()` bootstraps preview.
8. `registerRoutes(app)` mounts HTTP routes.
9. `startHttpServer(app)` creates HTTP server, bootstraps chat websocket/heartbeat, initializes orchestration, subscribes file events, listens on `API_PORT` default `3001`, and starts file/directory watchers.

## Frontend architecture

**FACT**: Vite serves the React app from `client` on port `5000` in development.

**FACT**: The app uses:

- `wouter` for routes.
- TanStack Query for data fetching.
- Providers for realtime, lifecycle, app state, import modal, sidebar drawer, tooltips, and toaster.
- A workspace route that removes the normal sidebar shell and renders a full-screen workspace.

**FACT**: Vite proxies `/api`, `/sse`, `/events`, `/preview`, and `/ws` to the API server on port `3001`.

## Backend layering

**INFERRED intended dependency direction**:

```text
Routes/Controllers
  ↓
Services / Orchestrators
  ↓
Repositories / Runtime Managers
  ↓
Infrastructure / DB / Filesystem / Process / Event Bus
```

**FACT**: This direction is followed in many modules: terminal controller delegates to managers/services/repositories; chat controller delegates to services/builders/orchestrator; preview runtime route delegates to runtime manager/lifecycle manager; tools route through registry/dispatcher.

**FACT**: Some bypasses exist: `main.ts` directly performs project CRUD with Drizzle rather than using a project service/repository.

## Execution graph — agent run

```text
ChatPanel.runAgent()
  ↓ submitRun(projectId, goal, mode)
POST /api/run
  ↓ runController.startWrapped()
chatOrchestrator.startRun()
  ├─ create runId/conversation/session/turn
  ├─ persist agent_runs row best-effort
  ├─ register run in runManager
  ├─ clarificationManager.run()
  ├─ contextLoader.loadForRun()
  ├─ buildMemoryContextString()
  ├─ publish run_started
  ├─ store user message best-effort
  ├─ routeIntent(goal)
  │   ├─ conversation/explain → runChatLLM() → streamManager
  │   └─ build/modify → orchestrate()
  ↓
orchestrate()
  ├─ validate request/context
  ├─ build orchestration context
  ├─ create session/state
  ├─ recall memory
  ├─ runOrchestrationLoop()
  ├─ store execution/bug memory
  └─ return result
  ↓
streamRunSummary()
  ↓
_completeRun() or _failRun()
  ├─ update run status
  ├─ publish lifecycle event
  ├─ checkpoint create attempt
  └─ memory store
```

## Data flow

```text
User input / UI state
  → HTTP JSON request
  → Zod/controller validation
  → service/orchestrator runtime objects
  → DB rows (projects, runs, messages, events, uploads, checkpoints, etc.)
  → Event bus / SSE / WS events
  → React realtime subscriptions
  → chat cards, tool groups, lifecycle overlays, preview state
```

## Runtime graph

```text
Project row.sandboxPath
  ↓
Runtime route detects command
  ├─ package.json scripts.dev
  ├─ package.json scripts.start
  ├─ index.js/server.js/main.js/app.js
  └─ otherwise no runnable content
  ↓
previewRuntimeManager starts supervised process
  ↓
runtimeManager stores status/pid/port/logs
  ↓
/preview/frame selects proxyable runtime
  ↓
http-proxy forwards iframe requests to localhost:<runtime-port>
```

## Event graph

```text
Tool/agent/runtime/checkpoint modules
  ↓ bus.emit(...)
Bus adapter / event publisher / SSE manager
  ↓ /api/realtime?projectId=&runId=&lastEventId=
Frontend RealtimeProvider.subscribe(topic, handler)
  ↓
Chat messages, action cards, checkpoint cards, preview lifecycle UI
```

## Memory graph

```text
Store:
  content/category/tags/meta
    → chunking/embedding/repository
    → persistence/vector store

Recall:
  query
    → search/hybrid retrieval/rerank
    → entries
    → memory injection string
    → chat/orchestration/verifier context
```

**FACT**: Knowledge graph functions currently return empty arrays; graph support is stubbed for compatibility.

## Tool graph

```text
loadAllTools()
  ├─ registerFilesystemTools()
  ├─ registerCodingTools()
  ├─ registerTerminalTools()
  ├─ registerVerifierTools()
  ├─ registerGitTools()
  └─ registerBrowserTools()
  ↓
sealRegistry()
  ↓
dispatch(toolName, input, context)
  ├─ resolve tool
  ├─ enforce permissions
  ├─ validate input
  ├─ execute with retry/timeout
  ├─ emit lifecycle/output events
  ├─ perform reality checks
  └─ return typed ToolExecutionResult
```

## Architectural strengths

- **FACT**: Major subsystems are separated into explicit folders.
- **FACT**: Tool registration has a single boot-time owner and sealed registry.
- **FACT**: Preview, terminal, file explorer, memory, and orchestration each expose public barrels.
- **FACT**: Some runtime reality checks exist in tool dispatch.

## Architectural weaknesses

- **FACT**: Some visible frontend APIs are not mounted on the backend.
- **FACT**: TypeScript compilation currently passes, so the primary issues found are integration/product-readiness gaps rather than parse-level blockers.
- **FACT**: Some state is process-local/in-memory only: folders, active sessions, active runs, runtime managers, conversation manager state.
- **FACT**: Project CRUD bypasses a service/repository layer.
- **INFERRED**: There is a gap between the intended enterprise layered architecture and the actually enforced dependency boundaries.
