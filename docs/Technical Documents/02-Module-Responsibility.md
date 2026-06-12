# Module Responsibility Document
### NURAX — Har Folder Kya Karta Hai?

---

## PROJECT ROOT STRUCTURE

```
nurax/
├── main.ts                    ← Server entry point
├── vite.config.ts             ← Frontend build config
├── package.json               ← Scripts + dependencies
├── drizzle.config.ts          ← DB migration config
├── tsconfig.json              ← TypeScript config
│
├── client/                    ← React frontend
├── server/                    ← Express backend
├── shared/                    ← Frontend + backend shared code
├── scripts/                   ← Dev utility scripts
├── docs/                      ← Documentation
└── .sandbox/                  ← Agent-generated project files
```

---

## `main.ts` — Server Entry Point

**Single Responsibility:** Poore server ko ek fixed order mein boot karna aur sab modules ko wire karna.

**Kya karta hai:**
- Global error handlers install karna
- Startup diagnostics run karna
- Express app + body parsers create karna
- Infrastructure, repositories, services, preview, routes, HTTP server — ordered sequence mein initialize karna
- Project CRUD routes directly implement karna (gap: should be in a service)
- Folder CRUD in-memory implement karna

**Kya NAHI karta:**
- Business logic
- Database queries (except project CRUD — which is a known gap)
- Tool execution
- Agent logic

---

## `client/` — React Frontend

```
client/
├── index.html
└── src/
    ├── main.tsx               ← React entry point
    ├── App.tsx                ← Providers + Route table
    │
    ├── pages/                 ← Full page components
    │   ├── core/
    │   │   └── workspace.tsx  ← Main IDE page
    │   ├── home/              ← Landing page
    │   ├── apps/              ← Project management
    │   ├── preview/           ← Browser-in-browser
    │   ├── console/           ← Terminal page
    │   ├── import/            ← Import flows
    │   ├── publishing/        ← Deployment settings
    │   └── settings/          ← Integrations, usage
    │
    ├── components/            ← Reusable UI components
    │   ├── chat/              ← Chat panel, messages, run submission
    │   ├── file-explorer/     ← File tree, open editors, history
    │   ├── agent/             ← Action feed, artifacts, goal runner
    │   ├── layout/            ← AppSidebar, CenterPanel, Dashboard
    │   ├── panels/            ← CheckpointPanel, SidebarDrawer
    │   ├── diff/              ← DiffViewer, diff approval modal
    │   ├── console/           ← ConsoleView terminal emulator
    │   ├── publishing/        ← AppSettingsPanel, ResourcesTab
    │   └── ui/                ← Atomic design system (Button, Dialog, etc.)
    │
    ├── context/               ← React context providers
    │   ├── app-state-context  ← Global app state
    │   ├── lifecycle-context  ← Preview lifecycle state
    │   └── import-modal-context
    │
    ├── realtime/              ← SSE + WebSocket handling
    │   └── realtime-provider  ← Topic subscriptions
    │
    ├── hooks/                 ← Custom React hooks
    └── lib/                   ← Utilities, queryClient
```

### `client/src/pages/` — Har Page Kya Karta Hai
| Page | Path | Responsibility |
|---|---|---|
| `home/` | `/` | Landing, recent projects, new app prompt |
| `core/workspace.tsx` | `/workspace/:id` | Main IDE shell — chat + editor + preview panels |
| `apps/` | `/apps` | Project list, folder management |
| `preview/` | `/preview` | Dedicated browser preview with DevTools |
| `console/` | `/console` | Standalone terminal output |
| `import/` | `/import` | Import from GitHub/Figma/ZIP (UI only) |
| `publishing/` | `/publishing` | Deployment config, secrets, domains |
| `settings/` | `/integrations`, `/usage` | Third-party connections, analytics |

### `client/src/components/` — Har Component Group Kya Karta Hai
| Folder | Responsibility |
|---|---|
| `chat/` | Run submit karna, SSE subscribe karna, messages render karna, cancel karna |
| `file-explorer/` | File tree show karna, editors manage karna, conflict warnings |
| `agent/` | Agent action feed, tool execution cards, goal tracking |
| `layout/` | AppSidebar navigation, CenterPanel tabs, workspace shell |
| `diff/` | Side-by-side code diff, agent change approval |
| `console/` | Terminal output render karna |
| `panels/` | Checkpoint panel, sidebar drawer |
| `ui/` | Atomic components: Button, Dialog, Input, Card, Toast, etc. |

---

## `server/` — Express Backend

```
server/
├── agents/                    ← 9 AI agents
├── chat/                      ← Chat + run lifecycle
├── file-explorer/             ← Sandbox file operations
├── infrastructure/            ← DB, bus, SSE, runtime, redis, queue
├── memory/                    ← Vector memory platform
├── orchestration/             ← Multi-step agent coordination
├── preview/                   ← Runtime lifecycle + frame proxy
├── repositories/              ← Data access layer
├── services/                  ← Business logic layer
├── shared/                    ← Errors, events, utilities
├── startup/                   ← Health diagnostics
├── terminal/                  ← Terminal sessions + commands
└── tools/                     ← Tool registry + 158 tools
```

---

## `server/agents/` — 9 AI Agents

```
server/agents/
├── browser/                   ← Web automation agent
├── chat/                      ← Conversational agent
├── coderx/                    ← Code generation agent
├── executor/                  ← Task execution agent
├── filesystem/                ← I/O management agent
├── planner/                   ← Strategic planning agent
├── supervisor/                ← Top-level oversight agent
├── terminal/                  ← Shell execution agent
└── verifier/                  ← Quality assurance agent
```

**Shared Responsibility (sab agents mein):**
- Memory recall karna before run start
- Session open → transition → close lifecycle maintain karna
- Tool dispatch ke through ONLY side effects karna (no direct fs/shell)
- Dedicated logger + metrics module rakhna
- Typed input/output contracts

| Agent Folder | Single Responsibility |
|---|---|
| `supervisor/` | Top-level orchestration oversight, session lifecycle, memory reflection |
| `planner/` | High-level goal → ExecutionPlan decomposition |
| `coderx/` | Engineering code generation via coding-loop |
| `executor/` | Task validation + tool dispatch + retry management |
| `filesystem/` | Filesystem I/O orchestration via filesystem-loop |
| `terminal/` | Shell command security check + execution |
| `browser/` | Browser automation: navigate, click, screenshot, test |
| `verifier/` | Type-check, build verify, runtime diagnostics |
| `chat/` | Conversational LLM streaming, explain intents |

---

## `server/chat/` — Chat + Run Lifecycle

```
server/chat/
├── routes/                    ← HTTP route handlers
├── controllers/               ← Request/response logic
├── orchestration/
│   └── chat-orchestrator.ts  ← MAIN: run start, intent routing
├── services/
│   ├── run-writer.ts          ← DB run persistence
│   ├── message-service.ts     ← Chat message CRUD
│   ├── checkpoint.service.ts  ← Post-run snapshot
│   └── stream-manager.ts      ← SSE token streaming
├── conversation/
│   └── conversation-manager.ts← In-memory conversation state
├── session/                   ← Session + turn management
└── llm/
    └── chat-llm.ts            ← Direct LLM streaming path
```

**Single Responsibility:** HTTP run requests ko orchestrated AI work mein convert karna aur chat state manage karna.

**Kya karta hai:**
- `POST /api/run` → run start, runId return
- Intent route: conversation vs build
- Chat history persist karna
- SSE token streaming manage karna
- Checkpoint create karna after completion
- Clarification questions manage karna

---

## `server/orchestration/` — Multi-Step Coordination

```
server/orchestration/
├── api/                       ← HTTP routes (/api/orchestration/*)
├── execution/
│   └── orchestration-loop.ts  ← Main agent loop
├── context/                   ← Orchestration context builder
├── session/                   ← Orchestration session
├── state/                     ← Run state management
├── monitor/                   ← Stuck detection
├── metrics/                   ← Performance tracking
├── escalation/                ← Escalation manager
└── index.ts                   ← Public barrel
```

**Single Responsibility:** Complex multi-agent workflows coordinate karna — validate → context → agents → result.

**Kya karta hai:**
- `orchestrate()` function: validate → context → session → memory recall → loop → result
- Stuck run detection aur escalation
- Orchestration metrics expose karna
- In-memory run state manage karna

---

## `server/tools/` — Tool Registry

```
server/tools/
├── registry/
│   ├── tool-registry.ts       ← Singleton registry (sealed after boot)
│   ├── tool-loader.ts         ← loadAllTools() — boot-time registration
│   └── tool-dispatcher.ts     ← dispatch() — execution pipeline
├── implementations/
│   ├── browser/               ← 27 browser tools
│   ├── coding/                ← 47 coding tools
│   ├── filesystem/            ← ~20 filesystem tools
│   ├── git/                   ← 5 git tools
│   ├── terminal/              ← 27 terminal tools
│   └── verifier/              ← 12 verifier tools
├── security/                  ← Permission policies
└── metrics/                   ← Tool execution metrics
```

**Single Responsibility:** Agents ke liye executable tools ka sealed, validated, observable registry provide karna.

---

## `server/file-explorer/` — Sandbox File Operations

```
server/file-explorer/
├── api/                       ← HTTP routes (/api/file-explorer/*)
├── controllers/               ← Request handlers
├── orchestrator/
│   └── explorer.orchestrator.ts ← File operation coordination
├── services/
│   ├── read.service.ts
│   ├── write.service.ts
│   ├── tree.service.ts
│   └── rename.service.ts
├── validators/                ← Path + content validation
├── guards/                    ← Sandbox boundary enforcement
├── watchers/                  ← Chokidar file + dir watchers
└── index.ts                   ← Public barrel
```

**Single Responsibility:** Sandbox filesystem ka interactive CRUD + real-time change notifications.

---

## `server/terminal/` — Terminal Sessions

```
server/terminal/
├── api/                       ← HTTP routes (/api/terminal/*)
├── controllers/
├── session/
│   └── session-manager.ts     ← Per-project terminal sessions
├── command/
│   └── command-service.ts     ← Sandboxed command execution
├── lifecycle/                 ← Terminal runtime start/stop/restart
├── stream/
│   └── stream-broker.ts       ← SSE terminal output
├── repositories/              ← Log + history persistence
└── parsers/                   ← Output parsing
```

**Single Responsibility:** Browser se shell sessions manage karna aur sandboxed commands run karna.

---

## `server/preview/` — Runtime + Preview

```
server/preview/
├── api/
│   ├── runtime-routes.ts      ← /api/runtime/:id/start|restart|stop
│   └── index.ts               ← Lifecycle state shortcuts
├── runtime/
│   └── preview-runtime-manager.ts ← Child process spawn + monitor
├── lifecycle/
│   └── lifecycle-service.ts   ← idle → starting → running → crashed
├── proxy/                     ← /preview/frame http-proxy
├── devtools/                  ← DevTools events + metrics
├── recovery/                  ← Auto-recovery agent
├── stream/                    ← Preview SSE stream broker
└── index.ts                   ← initPreviewModule() + buildPreviewRouter()
```

**Single Responsibility:** Generated app ko spawn karna, health monitor karna, aur browser mein proxy karna.

---

## `server/memory/` — Memory Platform

```
server/memory/
├── index.ts                   ← bootstrapMemory()
├── repository/
│   └── memory-repository.ts   ← Store + retrieve memory entries
├── chunker/                   ← Large content splitting
├── embedding/                 ← Vector embedding
├── persistence/               ← Durable storage
├── retrieval/                 ← Hybrid search + rerank
└── context/
    └── memory-context.ts      ← buildMemoryContextString()
```

**Single Responsibility:** Agents ke liye long-term context persist karna aur relevant context inject karna.

---

## `server/infrastructure/` — Core Singletons

```
server/infrastructure/
├── db/
│   └── index.ts               ← Drizzle ORM + pg Pool singleton
├── events/
│   ├── bus.ts                 ← TypedEventBus singleton
│   ├── bus-adapter.ts         ← Bus ↔ SSE bridge
│   ├── sse/
│   │   └── sse-manager.ts     ← SSE connection pool
│   └── file-change-emitter.ts
├── runtime/
│   └── runtime-manager.ts     ← Process registry (read/write)
├── process/
│   └── process-registry.ts    ← Read-only process facade
├── redis/
│   └── index.ts               ← Redis client (null fallback)
├── queue/
│   └── index.ts               ← BullMQ queue (null fallback)
├── sandbox/
│   └── sandbox.util.ts        ← getProjectDir(), getNuraDir()
├── config/
│   └── sandbox.config.ts      ← SANDBOX_ROOT constant
├── checkpoints/
│   ├── safe-fs.util.ts        ← safeWriteFile, safeDeleteFile
│   └── git-runner.ts          ← captureGitSha()
├── projects/
│   └── degraded-project-store.ts ← In-memory fallback store
├── realtime/
│   └── stream-topics.ts       ← TOPIC constants
└── seed.ts                    ← seedDefaultProject()
```

**Single Responsibility:** Low-level shared runtime primitives — koi business logic nahi, sirf infra.

---

## `server/repositories/` — Data Access Layer

```
server/repositories/
├── chat/                      ← ChatMessage, ChatUpload CRUD
├── run/                       ← AgentRun CRUD
├── checkpoint/                ← Checkpoint CRUD
├── session/                   ← Session persistence
└── log/                       ← Console log persistence
```

**Single Responsibility:** DB queries encapsulate karna — controllers inhe call karte hain, direct DB access nahi karte.

---

## `server/services/` — Business Logic Layer

```
server/services/
├── chat/                      ← Chat business logic
├── preview/                   ← Preview business logic
├── filesystem/                ← Filesystem utilities
└── terminal/                  ← Terminal business logic
```

---

## `server/shared/` — Cross-Cutting Concerns

```
server/shared/
├── errors/
│   ├── index.ts               ← installGlobalHandlers()
│   └── express-middleware.ts  ← expressErrorMiddleware
└── events/
    └── bus-adapter.ts         ← initBusAdapter()
```

---

## `shared/` — Frontend + Backend Shared

```
shared/
└── schema.ts                  ← Drizzle DB schema + TypeScript types
```

**Single Responsibility:** Single source of truth for data model — frontend aur backend dono yahan se import karte hain.

---

## `scripts/` — Dev Utilities

```
scripts/
├── kill-port.mjs              ← Port 3001/5000 clear karo (predev hook)
├── governance-check.mjs       ← Architecture rules check
├── tool-pipeline-audit.mjs    ← Tool registration audit
└── tool-audit.ts              ← Tool inventory
```

---

## `.sandbox/` — Generated Project Files

```
.sandbox/
└── {project-slug}-{timestamp}/  ← Har project ka alag folder
    ├── src/
    ├── package.json
    └── ... (agent-generated files)
```

**Single Responsibility:** AI agents ke generated application code ke liye isolated filesystem sandbox.
