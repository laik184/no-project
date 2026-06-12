# System Architecture Document
### NURAX — How The System Is Built

---

## 1. BIG PICTURE — Poora System Ek Nazar Mein

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER BROWSER                             │
│                                                                 │
│   React + Vite Frontend  (port 5000)                           │
│   ├── Chat Panel          ├── File Explorer                    │
│   ├── Monaco Editor       ├── Preview iframe                   │
│   ├── Terminal/Console    └── Project Pages                    │
└──────────────────┬──────────────────────────────────────────────┘
                   │  HTTP / SSE / WebSocket
                   │  (Vite dev proxy → port 3001)
┌──────────────────▼──────────────────────────────────────────────┐
│                   EXPRESS API SERVER  (port 3001)               │
│                       main.ts                                   │
│                                                                 │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────┐               │
│  │  Chat +  │ │ Orchestration│ │  Tool        │               │
│  │  Run     │ │  Engine      │ │  Registry    │               │
│  │  Module  │ │              │ │  (158 tools) │               │
│  └──────────┘ └──────────────┘ └──────────────┘               │
│                                                                 │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────┐               │
│  │  9 AI    │ │  File        │ │  Terminal    │               │
│  │  Agents  │ │  Explorer    │ │  Module      │               │
│  └──────────┘ └──────────────┘ └──────────────┘               │
│                                                                 │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────┐               │
│  │ Preview  │ │   Memory     │ │ Infrastructure│               │
│  │ Runtime  │ │  Platform    │ │ (DB/Bus/SSE) │               │
│  └──────────┘ └──────────────┘ └──────────────┘               │
└──────────────────┬──────────────────────────────────────────────┘
                   │
      ┌────────────┼────────────┐
      ▼            ▼            ▼
 PostgreSQL   Filesystem    Redis/Queue
 (Drizzle)    Sandbox       (optional)
```

---

## 2. STARTUP SEQUENCE — Server Boot Order

`main.ts` ek fixed order mein boot karta hai:

```
Step 1: installGlobalHandlers()
        └── unhandledRejection, uncaughtException handlers

Step 2: runStartupDiagnostics()
        └── OPENROUTER_API_KEY, DATABASE_URL, AGENT_PROJECT_ROOT check

Step 3: Express app create + body parsers (10MB limit)

Step 4: registerInfrastructure()
        └── initBusAdapter()    ← event bus wire
        └── seedDefaultProject() ← DB mein default project

Step 5: registerRepositories()
        └── singletons module-load pe initialize hote hain

Step 6: registerServices()
        └── bootstrapMemory()   ← memory platform
        └── loadAllTools()      ← 158 tools register + seal

Step 7: initPreviewModule()
        └── preview lifecycle, stream broker, recovery agent

Step 8: registerRoutes(app)
        └── sab HTTP routers mount

Step 9: startHttpServer(app)
        └── HTTP server create
        └── chatOrchestrator.bootstrap() ← WebSocket + heartbeat
        └── initOrchestration()
        └── subscribeToAgentFileEvents()
        └── server.listen(3001)
        └── startFileWatcher() + startDirectoryWatcher()
```

---

## 3. FRONTEND ARCHITECTURE

### Technology Stack
| Tool | Version | Kaam |
|---|---|---|
| React | 18.x | UI framework |
| Vite | 5.x | Dev server + bundler |
| TypeScript | 5.x | Type safety |
| Wouter | 3.x | Client-side routing |
| TanStack Query | 5.x | Server state + caching |
| Tailwind CSS | 3.x | Styling |
| Radix UI | Latest | Accessible UI components |
| Monaco Editor | 0.55 | VS Code-based code editor |
| Lucide React | Latest | Icons |

### Provider Hierarchy (App.tsx wrap order)
```
<QueryClientProvider>          ← TanStack Query
  <RealtimeProvider>           ← SSE/WS connections
    <LifecycleProvider>        ← Preview lifecycle state
      <AppStateProvider>       ← Global app state
        <ImportModalProvider>  ← Import modal
          <SidebarDrawerProvider>
            <TooltipProvider>
              <Toaster>
                <AppShell>     ← Sidebar + main area
                  {routes}     ← Wouter pages
```

### Route Table
| Path | Component | Purpose |
|---|---|---|
| `/` | Home | Landing, recent projects, new app |
| `/workspace` | Workspace | Main IDE (chat + editor + preview) |
| `/workspace/:id` | Workspace | Specific project |
| `/apps` | Apps | Project management |
| `/preview` | Preview | Browser-in-browser |
| `/console` | ConsolePage | Terminal output |
| `/import` | ImportPage | External import (UI only) |
| `/publishing` | Publishing | Deployment settings |
| `/integrations` | Integrations | Third-party connections |
| `/usage` | Usage | Analytics |
| `/create` | CreateProject | New project form |

### Vite Proxy Config (dev)
```
/api     → http://localhost:3001
/sse     → http://localhost:3001
/events  → http://localhost:3001
/preview → http://localhost:3001  (ws: true)
/ws      → ws://localhost:3001    (ws: true)
```

---

## 4. BACKEND ARCHITECTURE

### Layering (Dependency Direction)
```
Controllers / Routes
      ↓
Services / Orchestrators
      ↓
Repositories / Runtime Managers
      ↓
Infrastructure (DB, Bus, Filesystem, Process, SSE)
```

### Port Configuration
| Service | Port | Config |
|---|---|---|
| API Server | 3001 | `API_PORT` env ya default |
| Vite Frontend | 5000 | hardcoded dev config |
| Sandbox Runtime | dynamic | process port auto-detect |

---

## 5. AGENT EXECUTION GRAPH

```
User types goal in ChatPanel
        ↓
POST /api/run { projectId, goal }
        ↓
chatOrchestrator.startRun()
        ├── runId generate
        ├── DB persist (agent_runs)
        ├── SSE: run_started event
        └── routeIntent(goal)
                ├── "explain/chat" → runChatLLM() → token stream
                └── "build/modify" → orchestrate()
                                          ↓
                                   Supervisor Agent
                                          ↓
                                   Planner Agent
                                   (ExecutionPlan)
                                          ↓
                              ┌───────────────────────┐
                              │   CoderX Agent         │
                              │   + Executor Agent     │
                              │   + Filesystem Agent   │
                              │   + Terminal Agent     │
                              └───────────┬───────────┘
                                          ↓
                                   Verifier Agent
                                  (type-check + build)
                                          ↓
                                   Result / Loop again
                                          ↓
                              _completeRun() / _failRun()
                              ├── DB status update
                              ├── SSE: lifecycle event
                              ├── Checkpoint create
                              └── Memory store
```

---

## 6. REALTIME EVENT ARCHITECTURE

```
Tool / Agent / Runtime Module
        ↓ bus.emit(topic, payload)
EventBus (TypedEventBus)
        ↓ busAdapter bridge
SSE Manager (sseManager)
        ↓ /api/realtime endpoint
Frontend RealtimeProvider
        ↓ subscribe(topic, handler)
UI Components (chat cards, tool groups, preview state)
```

### SSE Topics
| Topic | Who Emits | Frontend Handler |
|---|---|---|
| `agent` | Tool dispatcher, agents | Tool cards, action feed |
| `checkpoint` | CheckpointService | Checkpoint card |
| `lifecycle` | Run complete/fail/cancel | Preview state, chat status |
| `terminal` | Terminal stream broker | Console output |
| `file-change` | File watcher | File explorer refresh |

---

## 7. PREVIEW RUNTIME ARCHITECTURE

```
POST /api/runtime/:projectId/start
        ↓
Project fetch → sandboxPath
        ↓
Command auto-detect:
    package.json → dev → start → index.js → server.js
        ↓
previewRuntimeManager.start()
    └── child_process.spawn(command, { cwd: sandboxPath })
        ↓
runtimeManager.register(entry)
    └── { projectId, pid, port, status, command }
        ↓
Port detection (stdout log parsing)
        ↓
/preview/frame requests
    └── http-proxy → localhost:{detectedPort}
```

---

## 8. MEMORY ARCHITECTURE

```
STORE:
content + category + tags + meta
        ↓
Chunker (splits large content)
        ↓
Embedding (vector representation)
        ↓
MemoryRepository
        ↓
Persistence + Vector Store

RECALL:
query string
        ↓
Hybrid retrieval (semantic + keyword)
        ↓
Rerank (relevance scoring)
        ↓
Top-N entries
        ↓
buildMemoryContextString()
        ↓
Injected into: chat context / orchestration context / verifier context
```

---

## 9. TOOL DISPATCH ARCHITECTURE

```
loadAllTools() [boot time, once]
    ├── registerFilesystemTools()   (~20 tools)
    ├── registerCodingTools()       (47 tools)
    ├── registerTerminalTools()     (27 tools)
    ├── registerVerifierTools()     (12 tools)
    ├── registerGitTools()          (5 tools)
    └── registerBrowserTools()      (27 tools)
            ↓
    sealRegistry() [immutable after boot]

Agent calls dispatch(toolName, input, context)
        ↓
    ToolDispatcher:
    1. resolve(toolName)
    2. enforcePermissions(context)
    3. validateInput(schema)
    4. execute(handler, timeout, retryPolicy)
    5. recordMetrics() + audit()
    6. emitEvents(bus)
    7. realityCheck(result)
    8. return ToolExecutionResult  ← never throws
```

---

## 10. INFRASTRUCTURE SINGLETONS

| Singleton | Module | Kya Hai |
|---|---|---|
| `db` | `infrastructure/db` | Drizzle ORM + pg Pool |
| `bus` | `infrastructure/events/bus` | TypedEventBus |
| `sseManager` | `infrastructure/events/sse` | SSE connection pool |
| `runtimeManager` | `infrastructure/runtime` | Process registry |
| `redis` | `infrastructure/redis` | Null client (no REDIS_URL) |
| `queue` | `infrastructure/queue` | Null queue (no REDIS_URL) |
| `processRegistry` | `infrastructure/process` | Read-only process facade |

---

## 11. ENVIRONMENT CONFIG

| Variable | Default | Kaam |
|---|---|---|
| `API_PORT` | `3001` | Backend server port |
| `DATABASE_URL` | — | PostgreSQL connection |
| `OPENROUTER_API_KEY` | — | LLM API access |
| `LLM_MODEL` | `openai/gpt-oss-120b:free` | Model selection |
| `LLM_BASE_URL` | `https://openrouter.ai/api/v1` | LLM endpoint |
| `AGENT_PROJECT_ROOT` | `.sandbox` | Sandbox root path |
| `REDIS_URL` | — | Queue/cache (optional) |
| `REPLIT_DEV_DOMAIN` | managed | Public tunnel URL |
