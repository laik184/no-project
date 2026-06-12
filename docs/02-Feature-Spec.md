# Feature Specification
### NURAX — Har Feature Detail Mein

> **Status Labels:**
> ✅ Implemented — Fully working
> ⚠️ Partial — Kuch pieces missing
> ❌ Dead — UI hai, backend nahi

---

## FEATURE 1: Project Management ⚠️ Partial

### Kya Karta Hai
User ke liye ek **workspace / sandbox** create karta hai. Har project ka apna alag folder hota hai filesystem pe jahan agent saari files likhta hai.

### Implemented APIs
| Method | Endpoint | Kaam |
|---|---|---|
| GET | `/api/projects` | Last 50 projects list (updatedAt order) |
| POST | `/api/projects` | Naya project create karo |
| GET | `/api/projects/:id` | Single project fetch |
| PATCH | `/api/projects/:id` | name/description/framework/status update |

### POST /api/projects — Kya Hota Hai
```
Input: { name, description?, framework? }
       ↓
Backend:
  - name required (400 agar missing)
  - sandboxPath generate: AGENT_PROJECT_ROOT + slug + timestamp
  - DB mein insert (status: 'idle')
Output: { ok: true, data: projectRow }
```

### Degraded Mode
Agar `DATABASE_URL` nahi set — in-memory store use hota hai (restart pe data gone)

### Missing Pieces
- ❌ Project delete (`DELETE /api/projects/:id`) — route nahi mounted
- ❌ Sandbox directory guaranteed create nahi hoti on POST
- ⚠️ Project selection partly localStorage based

---

## FEATURE 2: Folder Organization ⚠️ Partial / Risk

### Kya Karta Hai
Apps page pe projects ko folders mein organize karna.

### APIs
| Method | Endpoint | Kaam |
|---|---|---|
| GET | `/api/folders` | Sare folders list |
| POST | `/api/folders` | Naya folder banao |
| PATCH | `/api/folders/:id` | Folder rename |
| DELETE | `/api/folders/:id` | Folder delete |

### Critical Problem
**Folders in-memory hain** — process restart hone pe sab reset ho jaata hai. Koi DB table nahi hai folders ke liye.

---

## FEATURE 3: Chat + Agent Runs ✅ Core Working

### Kya Karta Hai
User ka goal (plain text) leta hai aur AI agents se app banwata hai.

### APIs
| Method | Endpoint | Kaam |
|---|---|---|
| POST | `/api/run` | Naya run start karo |
| GET | `/api/run/active` | Current active run fetch |
| POST | `/api/run/:runId/cancel` | Run cancel karo |
| GET | `/api/runs` | Run history |
| GET | `/api/runs/:runId` | Single run status |
| POST | `/api/chat/messages` | Message store karo |
| POST | `/api/chat/messages/:id/feedback` | 👍/👎 feedback |

### Intent Routing — Kaise Decide Hota Hai
```
User goal → routeIntent()
    ├── "explain karo" / "conversation" → Chat LLM direct streaming
    └── "banao" / "fix karo" / "add karo" → orchestrate() → full agent pipeline
```

### Run Lifecycle States
```
requested → running → completed
                   → failed
                   → cancelled
```

### Run Start Flow (Internally)
```
POST /api/run
    ↓
chatOrchestrator.startRun()
    ├── runId generate
    ├── conversation + session + turn in-memory create
    ├── agent_runs DB mein persist (best-effort)
    ├── runManager.register() → active track
    ├── clarificationManager.run() → koi sawal?
    ├── contextLoader.loadForRun() → project context
    ├── buildMemoryContextString() → past decisions recall
    ├── run_started SSE event publish
    └── routeIntent() → chat ya orchestrate
```

### Failure Handling
- `OPENROUTER_API_KEY` missing → friendly error stream, run fails
- Invalid payload → HTTP 400
- Orchestration crash → run "failed", SSE event
- Cancel → `POST /api/run/:runId/cancel`

---

## FEATURE 4: Realtime Event Streaming ✅ Implemented

### Kya Karta Hai
Agent actions, tool calls, file changes, lifecycle events — sab UI mein **live** dikhata hai bina page refresh ke.

### Technology
- **SSE (Server-Sent Events)** — server se browser ko one-way stream
- **WebSocket** — chat ke liye bidirectional

### Main Endpoint
```
GET /api/realtime?projectId=N&runId=X&lastEventId=Y
```

### Event Topics
| Topic | Kya Deliver Hota Hai |
|---|---|
| `agent` | Tool calls, agent actions, progress |
| `checkpoint` | Checkpoint create/complete events |
| `lifecycle` | Run start/complete/failed |
| `terminal` | Terminal output |
| `file-change` | Filesystem change notifications |

### Event Flow
```
Agent / Tool / Runtime
    ↓ bus.emit()
Event Bus → SSE Manager
    ↓ /api/realtime stream
Frontend RealtimeProvider
    ↓ topic subscriptions
Chat cards, tool groups, preview state, lifecycle overlay
```

---

## FEATURE 5: Orchestration Engine ✅ Implemented

### Kya Karta Hai
Multi-step agent workflow coordinate karta hai — ek complex goal ko steps mein todta hai aur agents ko assign karta hai.

### API
```
POST /api/orchestration/run
{ runId, projectId, sandboxRoot, goal, context?, options? }
```

### Diagnostics Endpoints
| Endpoint | Kaam |
|---|---|
| `GET /api/orchestration/active` | Active runs |
| `GET /api/orchestration/stuck` | Stuck runs detect |
| `GET /api/orchestration/metrics` | Performance metrics |
| `GET /api/orchestration/runs/:id` | Per-run diagnostics |
| `POST /api/orchestration/cleanup` | Stale state cleanup |

### orchestrate() Internal Pipeline
```
orchestrate()
    ├── 1. Request validate
    ├── 2. Orchestration context build
    ├── 3. State initialize
    ├── 4. Session create
    ├── 5. Memory recall (past decisions, bugs, learnings)
    ├── 6. runOrchestrationLoop()
    │       └── Supervisor → Planner → CoderX/Executor → Verifier
    ├── 7. Execution memory store (async)
    └── 8. Structured result return
```

---

## FEATURE 6: Multi-Agent System ✅ Implemented

### Kya Hai
9 specialized AI agents hain — har ek ek specific kaam ke liye responsible hai.

### 9 Agents Detail

#### 1. Supervisor Agent
- **Role:** Top-level oversight aur coordination
- **Kya karta hai:** Supervision requests validate karta hai, session lifecycle manage karta hai, supervision loop drive karta hai, decisions memory mein reflect karta hai

#### 2. Planner Agent
- **Role:** Strategic decomposition
- **Kya karta hai:** High-level goal leta hai → `ExecutionPlan` banata hai → tasks mein todta hai
- **Memory use:** Past decisions + failures recall karta hai planning inform karne ke liye

#### 3. CoderX Agent
- **Role:** Code generation specialist
- **Kya karta hai:** Engineering tasks handle karta hai, coding-loop run karta hai
- **Memory use:** Working memory + execution history — past mistakes repeat nahi karta

#### 4. Executor Agent
- **Role:** Task execution manager
- **Kya karta hai:** Task inputs validate karta hai, tool dispatch karta hai, execution health monitor karta hai, retries manage karta hai

#### 5. Browser Agent
- **Role:** Web automation + testing
- **Kya karta hai:** Browser automation lifecycle manage karta hai, navigation steps execute karta hai, UI integrity + state validate karta hai
- **Use cases:** Flow testing, responsive testing (mobile/desktop)

#### 6. Filesystem Agent
- **Role:** I/O management
- **Kya karta hai:** Read/write/create/delete operations orchestrate karta hai, filesystem-loop run karta hai
- **Rule:** Direct I/O nahi karta — dispatcher ke through jaata hai

#### 7. Verifier Agent
- **Role:** Quality assurance
- **Kya karta hai:** Type-check karta hai, build verify karta hai, runtime diagnostics karta hai, expected file state check karta hai
- **Memory use:** Prior bug patterns recall — known issues dobara discover nahi karta

#### 8. Terminal Agent
- **Role:** Shell execution
- **Kya karta hai:** Shell commands manage karta hai, environment setup karta hai
- **Security:** Command + sandbox path security pre-check pehle karta hai

#### 9. Chat Agent
- **Role:** Conversational interface
- **Kya karta hai:** "Explain" aur "conversation" intents handle karta hai, LLM tokens directly stream karta hai
- **Fallback:** LLM key missing hone pe graceful fallback

### Shared Architecture (Sab Agents Mein Common)
- **Memory integration** — Har agent (Chat ke alawa) `memoryEngine` se past `decisions`, `bugs`, `learning`, `reflection` recall karta hai
- **Strict orchestration rule** — Koi bhi agent directly `child_process`, `fs`, ya `fetch` nahi use karta. Sab dispatcher ke through jaate hain
- **Session lifecycle** — Open → transition → close (telemetry har step pe)
- **Dedicated logger + metrics** — Har agent ka apna logger aur metrics module

---

## FEATURE 7: Tool Registry + Dispatch ✅ Implemented

### Kya Hai
Agents ke liye **158 executable tools** ka sealed registry. Boot time pe register hote hain, runtime pe modify nahi ho sakte.

### Tools By Category

| Category | Count | Example Tools |
|---|---|---|
| **Filesystem** | ~20 | `read_file`, `write_file`, `create_dir`, `delete_file`, `list_dir`, `copy_file` |
| **Coding** | 47 | `code_edit`, `code_search`, `refactor`, `snippet_insert`, `generate_component` |
| **Terminal** | 27 | `run_command`, `check_exit_code`, `stream_output`, `install_package` |
| **Verifier** | 12 | `type_check`, `build_verify`, `test_run`, `lint_check` |
| **Git** | 5 | `git_status`, `git_commit`, `git_diff`, `git_log`, `git_add` |
| **Browser** | 27 | `navigate`, `click`, `screenshot`, `fill_form`, `scroll`, `evaluate_js` |

### Dispatch Pipeline (Har Tool Call)
```
dispatch(toolName, input, context)
    ↓
1. Tool resolve (registry se)
    ↓
2. Permission enforce (security policy)
    ↓
3. Input validate (Zod schema)
    ↓
4. Execute (retry + timeout policy)
    ↓
5. Metrics + audit record
    ↓
6. Shell output / file write events emit
    ↓
7. Reality check:
   - Terminal: exit code verify
   - Filesystem: actual file write confirm
    ↓
8. ToolExecutionResult return (never throws)
```

### Tool Execution DB Record
Har tool call `tool_executions` table mein store hoti hai:
- executionId, runId, projectId, toolName, toolCategory
- argsJson, resultJson, errorText
- durationMs, retryCount, replaySafe
- startedAt, endedAt

---

## FEATURE 8: File Explorer ✅ Implemented

### Kya Karta Hai
Sandbox filesystem ka interactive UI — files dekho, edit karo, upload karo, history dekho.

### All Endpoints

| Endpoint | Kaam |
|---|---|
| `GET /api/file-explorer/tree` | Directory tree |
| `GET /api/file-explorer/read` | File content read |
| `POST /api/file-explorer/write` | File save (conflict detection) |
| `POST /api/file-explorer/create` | Naya file/folder |
| `POST /api/file-explorer/rename` | Rename |
| `DELETE /api/file-explorer/delete` | Delete |
| `POST /api/file-explorer/duplicate` | Duplicate |
| `POST /api/file-explorer/upload` | Upload (max 50 files, multer) |
| `GET /api/file-explorer/download` | Download |
| `GET /api/file-explorer/search` | File search |
| `GET /api/file-explorer/metadata` | File metadata |
| `GET /api/file-explorer/history` | File change history |
| `GET /api/file-explorer/git-status` | Git status overlay |
| `GET /api/file-explorer/insights` | File insights |
| `GET /api/file-explorer/health` | Filesystem health |
| `POST /api/file-explorer/undo` | Last change undo |
| `POST /api/file-explorer/conflict-check` | Conflict detect |

### Conflict Detection
```
Write request mein clientMtime (last known modified time) bhejo
    ↓
Server: clientMtime vs actual mtime compare
    ├── Match → file save hoti hai
    └── Mismatch → HTTP 409 CONFLICT → user ko warning
```

### UI Components
- **FileExplorer.tsx** — Tree panel, context menus, rename
- **Open editors** — Multi-file tabs
- **Pinned / Recent / History** panels
- **Git status indicators** — Modified/new/deleted file overlay
- **Agent activity indicators** — Real-time "agent is editing this file"

---

## FEATURE 9: Monaco Code Editor ✅ Implemented

### Kya Karta Hai
Browser mein VS Code jesa full-featured code editor.

### Capabilities
- Syntax highlighting — sab major languages
- Multi-tab editing (CenterPanel mein managed)
- IntelliSense / autocomplete
- **DiffViewer** — side-by-side agent changes review
- **Diff approval modal** — agent ke suggested changes approve/reject
- File pinning, recently opened files

---

## FEATURE 10: Terminal ✅ Implemented

### Kya Karta Hai
Browser se directly shell commands run karna, terminal sessions manage karna.

### APIs
| Method | Endpoint | Kaam |
|---|---|---|
| POST | `/api/terminal/sessions` | Naya session (projectId + cwd required) |
| POST | `/api/terminal/sessions/:id/run` | Command execute |
| GET | `/api/terminal/sessions/:id/stream` | SSE output stream |
| POST | `/api/terminal/sessions/:id/runtime/start` | Session runtime start |
| POST | `/api/terminal/sessions/:id/runtime/stop` | Session runtime stop |
| GET | `/api/terminal/sessions/:id/logs` | Command logs |
| GET | `/api/terminal/sessions/:id/history` | Session history |
| DELETE | `/api/terminal/sessions/:id` | Session destroy |

### Security
Commands aur cwd `SANDBOX_ROOT` ke andar validate hoti hai. Dangerous commands pre-check pe block ho jaate hain.

---

## FEATURE 11: Preview / Runtime Lifecycle ✅ Implemented

### Kya Karta Hai
Generated app ko live run karta hai aur browser mein iframe mein dikhata hai.

### Runtime Control APIs
| Method | Endpoint | Kaam |
|---|---|---|
| POST | `/api/runtime/:projectId/start` | App start |
| POST | `/api/runtime/:projectId/restart` | App restart |
| POST | `/api/runtime/:projectId/stop` | App stop |
| GET | `/api/lifecycle-state/:projectId` | Current lifecycle state |

### Start Command Auto-Detection
```
Project sandboxPath
    ↓
package.json check:
    ├── scripts.dev → use karo
    ├── scripts.start → use karo
    └── Common entrypoints check:
        ├── index.js / server.js / main.js / app.js
        └── Kuch nahi mila → { ok: false, empty: true } → lifecycle: crashed
```

### Preview Frame Proxy
```
GET /preview/frame
    ├── Runtime running + port known → http-proxy → localhost:PORT
    └── Runtime nahi → idle HTML page return
```

### Lifecycle States
```
idle → starting → running → stopped
                          → crashed
```

### Preview UI Components
- **BrowserBar** — URL address bar, back/forward/refresh
- **Device Frames** — Mobile (375px), Tablet, Desktop
- **DevTools Panel** — Console logs, network events, runtime snapshots
- **Lifecycle Orb** — Visual status indicator (idle/starting/running/crashed)
- **Health Widget** — Runtime health monitoring

---

## FEATURE 12: Checkpoints + Rollback ⚠️ Partial

### Kya Karta Hai
Har run ke baad file state capture karta hai. Kisi bhi purani state pe wapas ja sakte hain.

### APIs
| Method | Endpoint | Kaam |
|---|---|---|
| GET | `/api/checkpoints` | Checkpoint list |
| POST | `/api/checkpoints` | Manual checkpoint |
| GET | `/api/checkpoints/:id` | Single checkpoint |
| DELETE | `/api/checkpoints/:id` | Checkpoint delete |
| POST | `/api/checkpoints/:id/rollback` | Rollback to this checkpoint |
| GET | `/api/checkpoints/:id/diff` | Before/after diff |

### Checkpoint Schema (Kya Capture Hota Hai)
```
checkpointId, projectId, runId
trigger (auto/manual)
status (stable/rolled-back)
gitCommitSha
fileCount
label, description
createdFiles[]    ← naye files
modifiedFiles[]   ← changed files
deletedFiles[]    ← delete hue files
fileSnapshots{}   ← complete file contents
```

### Auto-Checkpoint Flow
```
Run complete hota hai
    ↓
CheckpointService.create() (non-blocking — run fail nahi hota agar checkpoint fail ho)
    ↓
scanWorkspace() → sare sandbox files scan
    ↓
fileSnapshots mein store
    ↓
checkpoint_created SSE event broadcast
    ↓
CheckpointPanel UI update
```

### Rollback Flow
```
User checkpoint select karta hai → Rollback click
    ↓
POST /api/checkpoints/:id/rollback
    ↓
fileSnapshots se sare files restore
    ↓
rollback_history mein entry
    ↓
SSE event → File Explorer refresh
```

---

## FEATURE 13: Memory Platform ⚠️ Partial

### Kya Karta Hai
AI agents ke liye long-term context yaad rakhta hai — past decisions, bugs, learnings.

### Memory Categories
| Category | Kya Store Hota Hai |
|---|---|
| `decisions` | Architecture choices, technology selections |
| `bugs` | Known issues + unke fixes |
| `learning` | Discovered patterns, best practices |
| `reflection` | Agent self-assessment, improvement notes |

### Store Flow
```
content + category + tags + meta
    ↓
Chunker (bade content ko chunks mein todte)
    ↓
Embedding (vector representation)
    ↓
Repository (store)
    ↓
Persistence / Vector Store
```

### Recall Flow
```
Query (e.g., "React authentication")
    ↓
Hybrid retrieval + rerank
    ↓
Relevant memory entries
    ↓
Memory injection string build
    ↓
Chat / Orchestration / Verifier context mein inject
```

### Current Gaps
- Knowledge Graph APIs — compatibility stubs hain, empty arrays return karte hain
- Hydration failure non-fatal (sirf log hota hai)

---

## FEATURE 14: Import Flows ❌ Dead/Unwired

### Kya Hona Chahiye
External sources se existing projects import karna.

### UI Exist Karta Hai Inke Liye
- **GitHub** — Git URL se import
- **Figma** — Design import
- **Bolt.new / Lovable / Vercel** — Migration import
- **Base44** — Base44 project import
- **ZIP Upload** — ZIP file se import

### Current Reality
```
Frontend import pages → call /api/import/git, /api/import/figma etc.
                                    ↓
                            main.ts mein route MOUNTED NAHI hai
                                    ↓
                                HTTP 404 ← sab fail
```

---

## FEATURE 15: Publishing / Deployment ⚠️ Planned

### Kya Hona Chahiye
App ko live deploy karna aur deployment manage karna.

### DB Tables Ready Hain
- `deployments` — status, url, region, environment, steps, error
- `deployment_domains` — custom domains
- `deployment_secrets` — encrypted key-value secrets
- `deployment_settings` — app name, environment, region, isPublic
- `deployment_auth_config` — auth providers, email verification, session expiry

### Current Reality
Publishing UI pages exist hain, API routes mounted nahi hain main.ts mein.
