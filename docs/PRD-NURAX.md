# NURAX — Product Requirements Document (PRD)

> **Deep scan basis:** 13 existing docs files + full codebase traversal (client, server, agents, tools, shared schema, infrastructure)
> **Status labels:** ✅ Implemented | ⚠️ Partial | ❌ Dead/Unwired | 🔮 Planned

---

## 1. PRODUCT OVERVIEW — App Kya Hai?

**NURAX** ek **browser-based, AI-powered Full-Stack Application Builder** hai.

Seedha samajhne ke liye: NURAX ek aisa platform hai jahan aap apni app ka idea likhte ho — normal language mein — aur NURAX ke autonomous AI agents milke woh app banate hain. Code likhna, files banana, terminal chalaana, bugs fix karna, preview dikhana — sab kuch automatically.

### Tagline (Inferred)
> *"Describe what you want to build. NURAX builds it."*

### Category
Replit / Bolt.new / Cursor jaise platforms ki category mein aata hai — lekin iska architecture zyada layered aur enterprise-grade hai.

### Package Name
`nura-x-deployer` (lekin capabilities sirf deployment se kaafi zyada hain)

### Tech Stack (As-Built)
| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, TanStack Query, Wouter, Tailwind CSS, Radix UI |
| Backend | Node.js, Express, TypeScript, tsx runtime |
| Database | PostgreSQL + Drizzle ORM |
| AI/LLM | OpenRouter API (configurable model, default: `openai/gpt-oss-120b:free`) |
| Realtime | SSE (Server-Sent Events) + WebSocket |
| Editor | Monaco Editor (VS Code engine) |
| Memory | Vector DB abstraction (chunking + embedding + retrieval) |
| Queue | BullMQ (Redis-backed, optional — null queue fallback exists) |
| Process Mgmt | Custom RuntimeManager + child_process |

---

## 2. PROBLEM STATEMENT — Kis Problem Ko Solve Karta Hai?

### Core Problem
Ek product idea se working web application tak pohonchne mein bohot zyada waqt, skill, aur context-switching lagti hai:

- Developer ko planning, coding, testing, debugging, preview — sab manually karna padta hai
- Non-technical founders ko developers hire karne padte hain sirf ek prototype ke liye
- Existing AI tools (Copilot, ChatGPT) sirf code suggest karte hain — poora flow handle nahi karte

### NURAX Ka Solution
```
User ka idea (plain text)
        ↓
NURAX Planner Agent → execution plan banata hai
        ↓
NURAX CoderX Agent → code likhta hai
        ↓
NURAX Verifier Agent → type-check + build verify karta hai
        ↓
NURAX Terminal Agent → commands run karta hai
        ↓
NURAX Preview System → live app dikhata hai browser mein
        ↓
User ko milta hai: Working Application
```

### Problems Solved
1. **Idea-to-code gap** — Natural language se directly runnable app
2. **Context loss** — Memory system past decisions/bugs yaad rakhta hai
3. **Manual verification** — Verifier agent automatically type-check aur build karta hai
4. **No DevOps knowledge needed** — Terminal, runtime, preview sab automated
5. **File management** — Sandbox filesystem with conflict detection, history, rollback

---

## 3. TARGET USERS — User Kaun Hai? Kya Karega?

### User Type 1: Product Founder / Non-Technical Builder
**Kya karega:** App idea describe karega, agent se banwayega, preview dekhega
**Pain point:** Code nahi aata, developer chahiye prototype ke liye
**NURAX value:** Bina code likhe working prototype

### User Type 2: Developer (AI-Assisted)
**Kya karega:** Chat se features add karega, files directly edit karega, terminal use karega, checkpoints lega
**Pain point:** Repetitive boilerplate, context management
**NURAX value:** Agent se 80% kaam, developer 20% review/refinement

### User Type 3: Technical Lead / Operator
**Kya karega:** Usage dashboard dekhega, integrations manage karega, deployment settings configure karega
**Pain point:** Team productivity, resource tracking
**NURAX value:** Centralized workspace with metrics and publishing

### User Type 4: Automation/API Consumer
**Kya karega:** HTTP/SSE API se directly runs trigger karega, tool calls monitor karega
**Pain point:** Programmatic app generation
**NURAX value:** Stable API contracts for agent runs, tools, and status

---

## 4. CORE FEATURES — Feature Specification

---

### FEATURE 1: Project Management ⚠️ Partial

**Purpose:** Workspaces (sandboxes) create aur manage karna

**Implemented:**
- `GET /api/projects` → last 50 projects list (updatedAt descending)
- `POST /api/projects` → create project (name required, description + framework optional)
  - Auto-generates `sandboxPath` from `AGENT_PROJECT_ROOT` + slug + timestamp
  - DB mein status `idle` ke saath save hota hai
- `GET /api/projects/:id` → single project fetch
- `PATCH /api/projects/:id` → name, description, framework, status update
- Degraded mode: `DATABASE_URL` nahi hai toh in-memory store use hota hai

**Missing:**
- Project deletion (DELETE /api/projects/:id) — schema cascade ready hai, route nahi
- Sandbox directory auto-creation on POST
- Project selection partial local-storage based hai

**Data Model:**
```
projects: id, name, description, framework, sandboxPath, status, createdAt, updatedAt
```

---

### FEATURE 2: Folder Organization ⚠️ Partial / Risk

**Purpose:** Apps page mein projects ko folders mein organize karna

**Implemented:**
- `GET/POST /api/folders` — in-memory array
- `PATCH/DELETE /api/folders/:id` — in-memory CRUD

**Critical Gap:**
- **Folders process restart pe reset ho jaate hain** (in-memory, no DB table)
- Folder membership persist nahi hoti

---

### FEATURE 3: Chat + Agent Runs ✅ Implemented / ⚠️ Partial

**Purpose:** User ka goal leke AI agents se app banwana

**Implemented:**
- `POST /api/run` → run start karo (runId return hota hai)
- `POST /api/run/start` → legacy alias
- `GET /api/run/active` → current active run fetch
- `POST /api/run/:runId/cancel` → run cancel karo
- `GET /api/runs` + `GET /api/runs/:runId` → history
- `POST /api/chat/messages` → messages store karo
- `POST /api/chat/messages/:id/feedback` → 👍/👎 feedback

**Intent Routing (How it works):**
```
User goal → routeIntent()
  ├── "conversation" / "explain" → Chat LLM direct streaming
  └── "build" / "modify" → orchestrate() → agent pipeline
```

**Run States:**
```
requested → running → completed | failed | cancelled
```

**Dependencies:**
- `OPENROUTER_API_KEY` — bina key ke simple file-write goals ke alawa sab fail
- Memory system, checkpoint service, event publisher

---

### FEATURE 4: Realtime Event Streaming ✅ Implemented

**Purpose:** Agent actions, tool calls, lifecycle events — sab UI mein live dikhaana

**Implemented:**
- `GET /api/realtime?projectId=&runId=&lastEventId=` — SSE stream
- Topics: `agent`, `checkpoint`, `lifecycle`, `terminal`, `file-change`, etc.
- WebSocket: chat heartbeat manager
- Frontend: `RealtimeProvider` → topic subscriptions → chat cards, tool groups, preview state

**Event Flow:**
```
Agent/Tool/Runtime → bus.emit() → SSE Manager → /api/realtime → Frontend subscriber
```

---

### FEATURE 5: Orchestration Engine ✅ Implemented / ⚠️ Partial

**Purpose:** Multi-step agent workflow coordinate karna

**Implemented:**
- `POST /api/orchestration/run` → orchestrate ek goal
- Diagnostics: active runs, stuck runs, metrics, per-run diagnostics, cleanup
- `orchestrate()` flow:
  1. Request validate
  2. Context build
  3. State/session initialize
  4. Memory recall
  5. Orchestration loop run
  6. Result store → memory
  7. Return structured result

**Orchestration Loop (runOrchestrationLoop):**
- Supervisor → Planner → CoderX/Executor → Verifier cycle
- Stuck detection, escalation manager
- In-memory state (crash recovery limited)

---

### FEATURE 6: Multi-Agent System ✅ Implemented

**9 specialized agents:**

| Agent | Role | Key Capability |
|---|---|---|
| **Supervisor** | Top-level oversight | Supervision loop, session lifecycle, memory reflection |
| **Planner** | Strategic decomposition | Goal → ExecutionPlan, memory-informed decisions |
| **CoderX** | Code generation | Engineering tasks, coding-loop, avoids past mistakes via memory |
| **Executor** | Task execution | Tool dispatch, health monitoring, retry management |
| **Browser** | Web automation | Navigation, responsive testing, UI integrity checks |
| **Filesystem** | I/O management | Read/write/create/delete orchestration via filesystem-loop |
| **Verifier** | Quality assurance | Type-check, build verify, runtime diagnostics, bug pattern recall |
| **Terminal** | Shell execution | Command security pre-check, sandbox validation, shell runner |
| **Chat** | Conversational UI | Token streaming, explain intents, LLM fallback |

**Shared Architecture Rules (All Agents):**
- Memory integration: recall `decisions`, `bugs`, `learning`, `reflection` before every run
- Strict orchestration: NO direct `child_process`, `fs`, `fetch` — only through dispatcher
- Session lifecycle: open → transition → close (telemetry captured)
- Dedicated logger + metrics per agent

---

### FEATURE 7: Tool Registry + Dispatch ✅ Implemented

**Purpose:** Agents ke liye executable tools ka sealed registry

**158 tools registered at boot:**

| Category | Count | Examples |
|---|---|---|
| Filesystem | ~20 | read_file, write_file, create_dir, delete_file, list_dir |
| Coding | 47 | code_edit, code_search, refactor, snippet_insert |
| Terminal | 27 | run_command, check_exit, stream_output |
| Verifier | 12 | type_check, build_verify, test_run |
| Git | 5 | git_status, git_commit, git_diff |
| Browser | 27 | navigate, click, screenshot, form_fill |

**Dispatch Pipeline:**
```
dispatch(toolName, input, context)
  → resolve tool
  → enforce permissions
  → validate input
  → execute (retry + timeout policy)
  → record metrics/audit
  → emit lifecycle/output events
  → reality check (terminal exit + filesystem side effects)
  → return ToolExecutionResult (never throws)
```

---

### FEATURE 8: File Explorer ✅ Implemented

**Purpose:** Sandbox files UI aur agents ke liye accessible banana

**Endpoints (all under /api/file-explorer/):**
- `tree` — directory tree
- `read` — file content
- `write` — file save (with conflict detection, HTTP 409 on conflict)
- `create` — new file/dir
- `rename` / `delete` / `duplicate`
- `upload` — multer, up to 50 files
- `download`
- `search` — file search
- `metadata` / `history` / `git-status`
- `insights` / `health` / `undo`
- `conflict-check`

**UI Components:**
- File tree panel (FileExplorer.tsx)
- Open editors management
- Pinned/recent/history panels
- Context menus + rename
- Git status indicators
- Agent file activity indicators (real-time)

---

### FEATURE 9: Monaco Code Editor ✅ Implemented

**Purpose:** VS Code jesa editor browser mein

**Capabilities:**
- Syntax highlighting (all major languages)
- Multi-tab editing (CenterPanel tabs)
- Diff viewer (DiffViewer.tsx — side-by-side)
- Agent-suggested diff approval modal
- File pinning, recent files

---

### FEATURE 10: Terminal ✅ Implemented / ⚠️ Partial

**Purpose:** Shell commands run karna aur session manage karna

**Endpoints:**
- `POST /api/terminal/sessions` — new session (projectId + cwd required)
- `POST /api/terminal/sessions/:id/run` — command execute
- `GET /api/terminal/sessions/:id/stream` — SSE output stream
- Session runtime: start/stop/restart
- Logs + history per session

**Security:** Command aur cwd sandbox path validation pe depend karta hai

---

### FEATURE 11: Preview / Runtime Lifecycle ✅ Implemented / ⚠️ Partial

**Purpose:** Generated app ko live run karna aur iframe mein dikhana

**Runtime Control:**
- `POST /api/runtime/:projectId/start|restart|stop`
- Auto-detects start command:
  - `package.json` scripts.dev → scripts.start
  - `index.js` / `server.js` / `main.js` / `app.js`
  - Kuch nahi mila → `{ ok: false, empty: true }` → lifecycle crashed

**Preview Proxy:**
- `/preview/frame` → running runtime port pe proxy
- Agar runtime nahi chal raha → idle HTML return

**Lifecycle States:**
```
idle → starting → running → stopped | crashed
```

**UI:**
- Browser Bar (address, back/forward)
- Device frames (mobile/desktop)
- DevTools panel (console/network)
- Runtime health widget

---

### FEATURE 12: Checkpoints + Rollback ⚠️ Partial

**Purpose:** Run ke baad file state capture karna aur rollback karna

**Implemented:**
- Schema: `checkpoints` + `rollback_history` tables
- Auto-checkpoint on run completion
- Routes: list, create, get, delete, rollback, diff
- CheckpointPanel UI

**Schema Captures:**
- createdFiles, modifiedFiles, deletedFiles
- fileSnapshots (content)
- gitCommitSha, trigger, label

**Gaps:**
- Checkpoint creation non-blocking (run fail nahi hota agar checkpoint fail ho)
- Rollback safety filesystem utilities pe depend karti hai

---

### FEATURE 13: Memory Platform ✅ Implemented / ⚠️ Partial

**Purpose:** Long-term context — past decisions, bugs, learnings — agents ke liye

**Store Flow:**
```
content + category + tags + meta
  → chunker
  → embedding
  → repository
  → persistence/vector store
```

**Recall Flow:**
```
query
  → search/hybrid retrieval/rerank
  → entries
  → memory injection string
  → chat/orchestration/verifier context
```

**Memory Categories:**
- `decisions` — architectural choices
- `bugs` — known issues + fixes
- `learning` — discovered patterns
- `reflection` — agent self-assessment

**Gaps:**
- Knowledge graph APIs — compatibility stubs, return empty arrays
- Hydration failure non-fatal (logged only)

---

### FEATURE 14: Import Flows ❌ Dead/Unwired

**Purpose:** External sources se project import karna

**UI Exists For:**
- GitHub (Git URL)
- Figma (design import)
- Lovable / Bolt / Vercel (migration)
- Base44
- ZIP upload

**Status:** Frontend pages exist, `/api/import/*` routes **mounted nahi hain** main.ts mein → sab 404 return karte hain

---

### FEATURE 15: Publishing / Deployment ⚠️ Partial/Planned

**Purpose:** App publish karna aur deployment manage karna

**Implemented (DB Level):**
```
deployments: status, url, region, environment, steps, error
deployment_domains: custom domains
deployment_secrets: encrypted key-value pairs
deployment_settings: app name, environment, region, isPublic, dbUrl
deployment_auth_config: providers, email verification, session expiry
```

**UI Exists:** Publishing page, AppSettingsPanel, ResourcesTab

**Missing:** Mounted deployment API routes not found in main.ts

---

### FEATURE 16: Usage Dashboard ❌ Dead/Unwired

**Status:** UI calls `/api/agents/metrics` → route mounted nahi → 404

---

## 5. USER FLOW DOCUMENT

---

### FLOW 1: Naya Project Banana

```
1. User opens NURAX → "/" ya "/apps" page
2. "Hi [Name], what do you want to make?" prompt dikhta hai
3. User project describe karta hai (text input)
   OR "+ New Project" button click karta hai → /create page
4. POST /api/projects { name, description, framework }
5. Backend:
   - DB mein projects row insert hota hai (status: 'idle')
   - sandboxPath generate hota hai: AGENT_PROJECT_ROOT/slug-timestamp
6. User ko /workspace/:id pe redirect kiya jaata hai
7. Default Project already seeded hota hai (seedDefaultProject on boot)

FAIL STATES:
- name missing → HTTP 400
- DB down → degraded mode (in-memory store)
- project id nahi → HTTP 404
```

---

### FLOW 2: Chat Se App Banwana (Main Flow)

```
1. User workspace mein chat input mein goal type karta hai
   Example: "Build me a todo app with React and local storage"

2. ChatPanel.submitRun() → POST /api/run
   { projectId, goal, mode: "build" }

3. Backend (chatOrchestrator.startRun()):
   a. runId generate hota hai
   b. conversation/session/turn in-memory create hota hai
   c. agent_runs DB mein persist hota hai (best-effort)
   d. runManager.register() → active run track hota hai
   e. clarificationManager.run() → koi sawal?
   f. contextLoader.loadForRun() → project context load
   g. buildMemoryContextString() → past decisions/bugs recall
   h. run_started SSE event publish hota hai

4. Intent routing:
   ├── "explain" / "conversation" → Chat LLM direct stream → tokens UI mein
   └── "build" / "modify" → orchestrate() call

5. orchestrate() pipeline:
   Supervisor → validates supervision request
      ↓
   Planner → goal ko tasks mein tod ta hai
      ↓
   CoderX → code generate karta hai (coding-loop)
      ↓
   Executor → tools dispatch karta hai
      ↓
   Filesystem Agent → files likhta hai
      ↓
   Terminal Agent → commands run karta hai (npm install, etc.)
      ↓
   Verifier → type-check + build verify karta hai
      ↓
   (loop continues until goal achieved or error)

6. Frontend (RealtimeProvider SSE subscription):
   - agent topic events → tool cards, action feed
   - checkpoint topic → checkpoint card
   - lifecycle topic → preview state update

7. Run completion:
   a. run status DB mein "completed" update hota hai
   b. lifecycle completion SSE event
   c. Checkpoint create attempt (non-blocking)
   d. Memory entry store (decisions, learnings)
   e. streamRunSummary() → final message

8. Preview auto-updates → user sees live app

FAIL STATES:
- OPENROUTER_API_KEY missing → friendly error streamed
- Invalid payload → HTTP 400
- Orchestration crash → run "failed", SSE event
- Cancel → POST /api/run/:runId/cancel → cancelled state
```

---

### FLOW 3: Code Editor Mein File Edit Karna

```
1. User file explorer mein file click karta hai
2. GET /api/file-explorer/read?filePath=... → content load
3. Monaco Editor mein file open hoti hai (CenterPanel tab)
4. User code edit karta hai
5. Save:
   POST /api/file-explorer/write
   { filePath, content, clientMtime }

6. Conflict check:
   - clientMtime server mtime se match nahi → HTTP 409 CONFLICT
   - User ko conflict warning dikhta hai
   - Match → file save hoti hai

7. File change event SSE pe broadcast hota hai
   → File explorer tree update
   → Agent ko file change ka pata chalta hai

8. Diff view:
   - Agent changes propose karta hai → DiffViewer.tsx mein dikhta hai
   - User approve/reject kar sakta hai
```

---

### FLOW 4: Preview Dekhna + Runtime Control

```
1. Agent run complete hota hai / user "Run" button click karta hai
2. POST /api/runtime/:projectId/start

3. Backend:
   a. Project fetch (DB se sandboxPath)
   b. Command auto-detect:
      - package.json → scripts.dev → scripts.start
      - index.js / server.js / main.js / app.js
      - Nothing found → { ok: false, empty: true } → lifecycle: crashed
   c. previewRuntimeManager.start() → child process spawn
   d. runtimeManager: status=starting → running, port detected

4. /preview/frame iframe proxy:
   - Runtime running + port known → http-proxy → localhost:PORT
   - Otherwise → idle HTML page

5. Frontend Preview page:
   - BrowserBar: URL, back/forward, refresh
   - Device frames: mobile (375px) / desktop
   - DevTools panel: console logs, network events
   - Lifecycle orb: idle/starting/running/crashed indicator

6. Runtime controls:
   - Restart: POST /api/runtime/:projectId/restart
   - Stop: POST /api/runtime/:projectId/stop

FAIL STATES:
- Invalid projectId → HTTP 400
- Project not found → HTTP 404
- No runnable content → { ok: false, empty: true }
- Process crash → lifecycle state: crashed
```

---

### FLOW 5: Terminal Use Karna

```
1. User Console page (/console) ya workspace terminal panel open karta hai
2. POST /api/terminal/sessions { projectId, cwd }
   → sessionId return hota hai

3. Command run:
   POST /api/terminal/sessions/:sessionId/run
   { command: "npm install" }

4. Backend:
   a. Security pre-check (command + cwd validation)
   b. Terminal agent → terminal runner
   c. Output stream: GET /api/terminal/sessions/:id/stream (SSE)

5. Terminal output UI mein real-time dikhta hai (ConsoleView.tsx)

6. Session destroy:
   - Runtime stop + session close
   - Logs + history persist hoti hai
```

---

### FLOW 6: Checkpoint + Rollback

```
1. Run complete hone pe auto-checkpoint create hota hai:
   - createdFiles, modifiedFiles, deletedFiles capture
   - fileSnapshots (full content) store
   - gitCommitSha record

2. CheckpointPanel user ko list dikhata hai

3. Rollback:
   POST /api/checkpoints/:checkpointId/rollback
   a. fileSnapshots se files restore hoti hain
   b. rollback_history mein entry store hoti hai
   c. SSE event broadcast hota hai
   d. File explorer update hota hai

4. Diff view:
   GET /api/checkpoints/:id/diff
   → DiffViewer mein before/after dikhta hai
```

---

### FLOW 7: Run Se Reattach Hona (Tab/Browser reload pe)

```
1. User page reload karta hai
2. Frontend: GET /api/run/active?projectId=N
3. Backend: latest 5 runs mein pehla "running" status wala
4. Frontend reattaches: SSE subscription with lastEventId
5. Missed events replay (agar SSE manager ne retain kiye hain)
6. UI current run state pe sync ho jaati hai

FAIL STATES:
- No projectId → { ok: true, run: null }
- Process crash → in-memory session state lost (recovery limited)
```

---

### FLOW 8: Import Karna (PLANNED — NOT WORKING)

```
Status: UI exist karta hai, backend routes nahi mounted

Intended Sources:
- GitHub → /api/import/git { repoUrl }
- Figma → /api/import/figma
- ZIP → /api/import/zip
- Base44 / Bolt / Lovable / Vercel → /api/import/base44 etc.

Status polling: GET /api/import/status/:importId

CURRENT REALITY: Sab 404 return karte hain
```

---

## 6. SYSTEM ARCHITECTURE (Quick Reference)

```
User Browser
  ↓
React/Vite UI (port 5000)
  ├─ Wouter routes
  ├─ TanStack Query (data fetch)
  ├─ RealtimeProvider (SSE/WS)
  ├─ LifecycleProvider
  └─ AppStateProvider
  ↓ HTTP/SSE/WS (Vite proxy → port 3001)
Express API Server (main.ts, port 3001)
  ├─ Infrastructure: PostgreSQL, EventBus, SSE Manager, RuntimeManager
  ├─ Chat: run lifecycle, messages, checkpoints, streaming
  ├─ Orchestration: validate → context → agents → diagnostics
  ├─ Agents (9): Supervisor, Planner, CoderX, Executor, Browser,
  │             Filesystem, Verifier, Terminal, Chat
  ├─ Tools (158): filesystem, coding, terminal, verifier, git, browser
  ├─ File Explorer: sandbox CRUD, watchers, conflict detection
  ├─ Terminal: sessions, commands, streams, history
  ├─ Preview: runtime lifecycle, frame proxy, devtools, metrics
  └─ Memory: repository, chunking, embedding, vector search
  ↓
PostgreSQL + Filesystem Sandbox + Optional Redis/Queue
```

---

## 7. DATABASE SCHEMA SUMMARY

| Table | Purpose |
|---|---|
| `projects` | Workspaces/sandboxes |
| `agent_runs` | Run lifecycle tracking |
| `chat_messages` | Chat history (user + agent + tool) |
| `chat_uploads` | Attached files |
| `agent_events` | Flat event log |
| `artifacts` | Generated artifacts |
| `diff_queue` | Pending file diffs |
| `tool_executions` | Structured tool invocation history (indexed) |
| `console_logs` | Runtime/terminal output |
| `deployments` | Deployment lifecycle |
| `deployment_domains` | Custom domains |
| `deployment_secrets` | Encrypted key-value secrets |
| `deployment_settings` | App config (region, environment) |
| `deployment_auth_config` | Auth providers config |
| `checkpoints` | File state snapshots |
| `rollback_history` | Rollback audit trail |

**Missing DB Tables (Gap):**
- `folders` — in-memory only (reset on restart)
- `import_jobs` — import status polling has no DB backing

---

## 8. ENVIRONMENT VARIABLES

| Variable | Required | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | ✅ For AI | LLM API key (OpenRouter) |
| `DATABASE_URL` | ✅ For persistence | PostgreSQL connection string |
| `AGENT_PROJECT_ROOT` | Recommended | Sandbox root path (default: `.sandbox`) |
| `LLM_MODEL` | Optional | Model override (default: `openai/gpt-oss-120b:free`) |
| `LLM_BASE_URL` | Optional | LLM API base (default: `https://openrouter.ai/api/v1`) |
| `REDIS_URL` | Optional | Redis for BullMQ queue (null fallback active) |
| `API_PORT` | Optional | API server port (default: 3001) |
| `REPLIT_DEV_DOMAIN` | Replit managed | Tunnel URL for preview |

---

## 9. FEATURE STATUS SUMMARY TABLE

| # | Feature | Status | API Ready | UI Ready |
|---|---|---|---|---|
| 1 | Project Management | ⚠️ Partial | ✅ CRUD (no delete) | ✅ |
| 2 | Folder Organization | ⚠️ Risk | ⚠️ In-memory | ✅ |
| 3 | Chat + Agent Runs | ✅ Core works | ✅ | ✅ |
| 4 | Realtime SSE Streaming | ✅ | ✅ | ✅ |
| 5 | Orchestration Engine | ✅ | ✅ | ✅ |
| 6 | Multi-Agent System (9 agents) | ✅ | internal | — |
| 7 | Tool Registry (158 tools) | ✅ | internal | ✅ feed |
| 8 | File Explorer | ✅ | ✅ | ✅ |
| 9 | Monaco Code Editor | ✅ | ✅ | ✅ |
| 10 | Terminal | ✅ | ✅ | ✅ |
| 11 | Preview / Runtime | ✅ | ✅ | ✅ |
| 12 | Checkpoints + Rollback | ⚠️ Partial | ✅ routes | ✅ |
| 13 | Memory Platform | ⚠️ Partial | internal | — |
| 14 | Import Flows | ❌ Dead | ❌ 404 | ✅ UI |
| 15 | Publishing / Deployment | ⚠️ Planned | ❌ no routes | ✅ UI |
| 16 | Usage Dashboard | ❌ Dead | ❌ 404 | ✅ UI |

---

## 10. TOP PRIORITY GAPS (Recommended Next Steps)

| Priority | Gap | Impact |
|---|---|---|
| P0 | `OPENROUTER_API_KEY` add karo | AI features completely disabled without it |
| P0 | Import routes mount karo | Core import flow 404 hai |
| P1 | Folders DB table add karo | Data resets on every restart |
| P1 | Deployment API routes mount karo | Publishing page dead |
| P1 | Usage/metrics endpoint mount karo | Dashboard dead |
| P2 | Project delete endpoint add karo | No way to remove projects |
| P2 | Graceful shutdown (SIGTERM cleanup) | Child processes, DB pool, sessions |
| P3 | Knowledge graph implement karo | Memory stubs return empty |
| P3 | Import job table schema add karo | Status polling has no persistence |

---

*Document generated via deep scan of: 13 docs files, client/src (pages + components), server (agents, tools, orchestration, infrastructure, chat, terminal, preview, memory, file-explorer), shared/schema.ts, main.ts, package.json, vite.config.ts*
