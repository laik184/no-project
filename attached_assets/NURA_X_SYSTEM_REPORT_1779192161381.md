# NURA X — Complete System Report
> AI-Powered IDE | Full Architecture & Data Flow Documentation

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Chat Page — Frontend to Backend](#1-chat-page)
3. [Agent Loop — Core Intelligence](#2-agent-loop)
4. [Real-Time Delivery — Event Bus & SSE](#3-real-time-delivery)
5. [Console Pipeline](#4-console-pipeline)
6. [Preview Pipeline](#5-preview-pipeline)
7. [File Explorer Pipeline](#6-file-explorer-pipeline)
8. [Complete Cycle — Idea to App](#complete-cycle)

---

## System Overview

NURA X is an AI-powered IDE that works like a Replit clone. When a user gives an app idea, the system:
- Runs an autonomous AI agent loop (ReAct pattern)
- Writes files, installs packages, runs code in a sandboxed environment
- Streams everything in real-time to the browser via SSE

**Tech Stack:**
| Layer | Technology |
|---|---|
| Frontend | React + Vite + TypeScript |
| Backend | Node.js + Express |
| Database | PostgreSQL (Drizzle ORM) |
| AI/LLM | OpenRouter (GPT-4o, Claude 3.5) |
| Real-time | SSE (Server-Sent Events) + WebSocket |
| Sandbox | `.data/sandboxes/<projectId>/` |

---

## 1. CHAT PAGE

### Frontend Flow

```
User types idea
      │
      ▼
ChatInput.tsx          ← Captures user message
      │
      ▼
useAgentRunner.ts      ← POST /api/run (goal + projectId)
      │                   Receives unique runId
      ▼
useRealtime.ts         ← Opens SSE: /api/realtime?runId=xxx
      │
      ▼
useTokenStream.ts      ← Buffers LLM tokens via requestAnimationFrame
      │                   (Smooth rendering, no UI jank)
      ▼
AgentActionFeed.tsx    ← Shows thinking, tool calls, diffs live
ChatMessages.tsx       ← Shows conversation messages
```

### Backend Flow

```
POST /api/run
      │
      ▼
RunController          ← Generates runId, saves to DB (agentRuns table)
      │                   Emits run.lifecycle { status: started } to Event Bus
      ▼
ToolLoopExecutor       ← Creates sandbox dir, loads project memory/context
      │
      ▼
MemoryManager          ← Injects: architecture decisions, past run history,
                          project context into the LLM system prompt
```

**Key Files:**
- `server/chat/run/controller.ts` — Run controller
- `server/chat/run/tool-loop.executor.ts` — Tool loop executor
- `client/src/hooks/useAgentRunner.ts` — Frontend agent hook
- `client/src/hooks/useRealtime.ts` — SSE subscription hook

---

## 2. AGENT LOOP

This is the core brain of NURA X. It follows the **ReAct pattern** (Reason → Act → Observe → Repeat).

### One Loop Cycle

```
┌─────────────────────────────────────────────────────┐
│                   AGENT LOOP CYCLE                   │
│                                                       │
│  Step 1: Build System Prompt                         │
│          (includes definitions for 49 tools)         │
│                ↓                                     │
│  Step 2: Call LLM via OpenRouter API                 │
│          (streamChatWithTools)                       │
│                ↓                                     │
│  Step 3: LLM thinks → tokens stream in real-time    │
│                ↓                                     │
│  Step 4: LLM decides to call a tool                  │
│          e.g. write_file("src/App.tsx", "...")       │
│                ↓                                     │
│  Step 5: Tool executes in sandbox                    │
│          (file write / npm install / git / shell)    │
│                ↓                                     │
│  Step 6: Execution Observer creates [OBSERVATION]    │
│          (result + errors + health + next steps)     │
│                ↓                                     │
│  Step 7: Observation fed back to LLM                 │
│                ↓                                     │
│  Step 8: Loop repeats until task_complete called     │
└─────────────────────────────────────────────────────┘
```

### Available Tool Categories (49 total)

| Category | Examples |
|---|---|
| File System | write_file, read_file, delete_file, list_files |
| Shell | run_command, run_script |
| Package Manager | npm_install, pip_install |
| Git | git_clone, git_commit, git_push |
| Browser/Preview | screenshot, get_preview_url |
| Database | query_db, run_migration |
| Search | search_files, grep_codebase |
| Agent Control | task_complete, ask_clarification |

### Special Mechanisms

**Continuation Manager** (`server/agents/core/tool-loop/continuation/continuation-manager.ts`)
- If agent hits max step limit → context is compressed → loop restarts automatically
- Prevents loss of progress on long tasks

**Verification Gate**
- Triggered when agent calls `task_complete`
- Runs: TypeScript checks + linting + preview health check
- If fails → failure report sent back to LLM for self-healing
- If passes → run completes successfully

**Execution Observer**
- After every tool call, injects an `[OBSERVATION]` block
- Contains: success/error status, health indicators, suggested next steps
- Helps LLM make better decisions in next iteration

**Key Files:**
- `server/agents/core/tool-loop/tool-loop.agent.ts` — Main agent loop
- `server/agents/core/tool-loop/continuation/continuation-manager.ts` — Continuation
- `server/llm/` — LLM client (OpenRouter integration)

---

## 3. REAL-TIME DELIVERY

### Event Bus Architecture

```
Agent Loop
    │
    │ bus.emit("agent.token")     ← LLM streaming tokens
    │ bus.emit("agent.event")     ← Tool calls, diffs, status
    │ bus.emit("file.change")     ← File system changes
    │ bus.emit("console.line")    ← Terminal output
    │ bus.emit("preview.ready")   ← App preview ready
    ▼
Internal Event Bus (typed EventEmitter)
    │
    ▼
Subscription Manager             ← Hub Pattern: 1 listener per event type
    │                               (prevents memory leaks)
    ▼
SSE Connection Pool
    │  Filter by: projectId + runId
    ▼
Client SSE Stream (/api/realtime)
    │
    ▼
Frontend UI Updates
```

### Event Types

| Event | What it triggers in UI |
|---|---|
| `agent.token` | Chat message typing animation |
| `agent.event` | Tool call cards in AgentActionFeed |
| `agent.event (diff)` | Code diff viewer popup |
| `file.change` | File explorer tree update |
| `console.line` | Terminal new log line |
| `preview.ready` | iframe auto-reload |
| `run.lifecycle` | Run status badge update |

### Why SSE (not WebSocket)?
- Lighter weight — no handshake overhead
- Perfect for one-way server → browser streaming
- Auto-reconnect built into browser
- WebSocket only used for terminal interactive sessions (`/ws/terminal`)

**Key Files:**
- `server/infrastructure/events/bus.ts` — Event Bus
- `server/infrastructure/events/core/subscription-manager.ts` — Hub pattern
- `server/infrastructure/events/sse/sse-manager.ts` — SSE manager
- `server/infrastructure/events/sse/connection-pool.ts` — Connection pool

---

## 4. CONSOLE PIPELINE

Captures output from all running processes and streams to browser terminal.

### Data Flow

```
Child Process (npm install / node app.js / etc.)
    │
    │ stdout events
    │ stderr events
    ▼
captureService.ts      ← Attaches to process stdio streams
    │
    ▼
filterService.ts       ← Regex-based classification
    │                     stdout / stderr / system / error
    ▼
consoleOrchestrator.ts ← Wiring point — routes to both paths
    │
    ├──────────────────────────────────┐
    ▼                                  ▼
persistService.ts               streamService.ts
    │                                  │
    │ Batch writes every 500ms         │ SSE fan-out
    │ (errors: immediate)              │ filtered by projectId
    ▼                                  ▼
console_logs DB table           Browser Console UI
```

### Pipeline Stages

| Stage | File | Responsibility |
|---|---|---|
| Capture | `capture.service.ts` | Attach to child process stdio |
| Filter | `filter.service.ts` | Classify log lines |
| Persist | `persist.service.ts` | Batch write to DB |
| Stream | `stream.service.ts` | SSE to browser |
| History | `history.service.ts` | Paginated log retrieval |

**Key Files:**
- `server/console/console.orchestrator.ts` — Orchestrator
- `server/console/capture/capture.service.ts` — Capture
- `server/console/stream/stream.service.ts` — SSE streaming

---

## 5. PREVIEW PIPELINE

Manages the lifecycle of the user's running app and makes it accessible in the browser iframe.

### Data Flow

```
Agent runs: npm run dev
    │
    ▼
runtimeManager         ← Registers process, tracks PID
    │
    ▼
tunnelService          ← Detects port the app is running on
    │
    │ Check: REPLIT_DOMAINS env var exists?
    ├── YES → https://xxx.repl.co/preview/<projectId>
    └── NO  → http://localhost:<port>
    │
    ▼
SSE /sse/preview       ← lifecycle event: "preview.ready"
    │
    ▼
Frontend iframe        ← Auto-reloads via "__sse_reload" signal
```

### Pipeline Stages

| Stage | Responsibility |
|---|---|
| **Runtime** | Start / Stop / Restart app process (`POST /api/run-project`) |
| **Files** | Temp file uploads/downloads for preview environment |
| **Tunnel** | Port → Public URL mapping (Replit vs. localhost) |
| **DevTools** | Preview-specific logs + reload signal dispatch |
| **State** | Sync: URL, device frame, grid layout across browser tabs |

### Preview Proxy

```
Browser request: /preview/<projectId>/index.html
      │
      ▼
preview-proxy.ts       ← Reverse proxy to child process port
      │
      ▼
User's running app     ← Served inside iframe
```

**Key Files:**
- `server/preview/tunnel/tunnel.service.ts` — Port/URL detection
- `server/infrastructure/proxy/preview-proxy.ts` — Reverse proxy
- `server/infrastructure/runtime/runtime-manager.ts` — Process management

---

## 6. FILE EXPLORER PIPELINE

Provides a real-time, synchronized view of the project's file system.

### Data Flow

```
Agent writes a file (write_file tool)
    │
    ▼
Filesystem change in .data/sandboxes/<projectId>/
    │
    ▼
watcherService         ← chokidar watches the directory
    │
    ▼
broadcastDebounced     ← Buffers rapid changes
    │                    (prevents flood during npm install)
    ▼
SSE /sse/files         ← WatchEvent: { type: "change", path: "src/App.tsx" }
    │
    ▼
Frontend File Explorer ← Tree updates instantly
```

### SSE Event Protocol

```
id: <uuid>
data: {"type":"change","path":"src/App.tsx","projectId":1}

(20 second heartbeat ping to keep connection alive)
```

### Pipeline Stages

| Stage | Endpoint | Responsibility |
|---|---|---|
| **Tree** | `GET /api/list-files` | Generate file hierarchy |
| **CRUD** | `POST/GET/DELETE /api/file` | Create/Read/Update/Delete |
| **Search** | `GET /api/search-files` | RipGrep full-text search |
| **History** | `GET /api/file-history` | File versioning & diffs |
| **Watcher** | `GET /sse/files` | Real-time change notifications |

**Key Files:**
- `server/file-explorer/watcher/watcher.service.ts` — FS watcher
- `server/file-explorer/watcher/watcher.router.ts` — SSE endpoint

---

## Complete Cycle

### From Idea to Running App

```
👤 User: "Make me a todo app with React"
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                    CHAT PAGE                             │
│  ChatInput → POST /api/run → runId returned             │
│  SSE connection opened for real-time updates            │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                    BACKEND                               │
│  RunController → ToolLoopExecutor → MemoryManager       │
│  Sandbox dir created: .data/sandboxes/1/                │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│                  AGENT LOOP                              │
│                                                          │
│  LLM thinks: "I'll create a React todo app..."          │
│                                                          │
│  → write_file("src/App.tsx", "...")                     │
│    [OBSERVATION: file written ✓]                        │
│                                                          │
│  → write_file("src/components/TodoList.tsx", "...")     │
│    [OBSERVATION: file written ✓]                        │
│                                                          │
│  → run_command("npm install react react-dom")           │
│    [OBSERVATION: packages installed ✓]                  │
│                                                          │
│  → run_project("npm run dev")                           │
│    [OBSERVATION: server running on port 3000 ✓]         │
│                                                          │
│  → task_complete()                                       │
│    [Verification: TS check ✓, preview health ✓]         │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────┐
│              EVENT BUS → SSE → FRONTEND                  │
│                                                          │
│  agent.token     → Chat: code appears word by word      │
│  agent.event     → Tool cards: write_file, npm install  │
│  file.change     → File Explorer: App.tsx appears       │
│  console.line    → Terminal: npm install output         │
│  preview.ready   → Preview iframe: todo app loads       │
└─────────────────────────────────────────────────────────┘
         │
         ▼
✅ Chat mein conversation dikhti hai
✅ File Explorer mein saari files nazar aati hain
✅ Console mein npm output dikhta hai
✅ Preview mein live todo app chal raha hota hai
```

---

## Architecture Principles

| Principle | Implementation |
|---|---|
| **Sandboxed Execution** | All files/processes scoped to `.data/sandboxes/<projectId>/` |
| **Event-Driven** | Central Event Bus — loose coupling between all components |
| **HVP (Hierarchical Vertical Partitioning)** | Agents isolated — no direct agent-to-agent imports |
| **Hub Pattern** | 1 listener per event type — prevents memory leaks |
| **Self-Healing** | Verification gate feeds failures back to LLM automatically |
| **Debouncing** | File watcher buffers rapid changes to avoid UI flooding |

---

*Report generated: May 2026 | NURA X v1.0.0*
