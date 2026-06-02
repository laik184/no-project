# Nura-X Deployer — System Report

**Date:** 2 June 2025  
**Project:** Nura-X Deployer (Agentic AI Vibe Coder)  
**Status:** Running ✅

---

## 1. AI Ne Kya Kiya (What AI Did)

### 1.1 Replit Migration
- Replit Agent se Replit environment mein project migrate kiya
- `npm install` run karke saari dependencies install ki
- Workflow configure kiya: `npm run dev` — port 5000 par webview ke saath
- Database schema push kiya (`drizzle-kit push`) — PostgreSQL tables create hue
- `OPENROUTER_API_KEY` secret request ki taaki AI features kaam kar sakein

### 1.2 Repository Barrel Update
- `server/repositories/file-system/index.ts` mein `server/services/filesystem/` ki saari **16 services** import/re-export ki:

| Service | Export |
|---|---|
| clipboard | `clipboardService` |
| create | `createService` |
| delete | `deleteService` |
| dependency-analysis | `dependencyAnalysisService` + 4 types |
| download | `downloadService` |
| duplicate | `duplicateService` |
| git-status | `gitStatusService` + `GitStatusCode` type |
| history | `historyService` |
| insights | `insightsService` |
| metadata | `metadataService` |
| open-editors | `openEditorsService` |
| pinned | `pinnedService` |
| read | `readService` |
| recent | `recentService` |
| rename | `renameService` |
| scanner | `scannerService` + 4 types |
| search | `searchService` |
| tree | `treeService` |
| upload | `uploadService` |
| write | `writeService` |

---

## 2. Workflow Runtime Kaise Kaam Karta Hai

### 2.1 Overview

```
User Request
     │
     ▼
┌─────────────────────┐
│   Orchestrator      │  ← main.ts → /api/orchestration/run
│   (Brain)           │
└─────────┬───────────┘
          │
     ┌────▼─────────────────────────────────┐
     │   11-Phase Execution Pipeline         │
     │  Think → Plan → Execute → Verify     │
     └────┬─────────────────────────────────┘
          │
    ┌─────┴─────────────────────────┐
    │         Agents                │
    │  Planner, CoderX, Executor    │
    │  Browser, Terminal, Verifier  │
    └─────┬─────────────────────────┘
          │
    ┌─────┴──────────┐
    │  Tools (40+)   │
    │  Filesystem,   │
    │  Shell, Browser│
    └────────────────┘
          │
    ┌─────┴──────────┐
    │  SSE / WS      │  ← Real-time UI updates
    └────────────────┘
```

---

### 2.2 Execution Pipeline — 11 Phases

| # | Phase | Kaam |
|---|---|---|
| 1 | **Thinking** | User goal analyze karna, UI ko turant feedback dena |
| 2 | **Planning** | `WorkflowPlan` banana — tasks aur unke dependencies |
| 3 | **Wave Execution** | Parallel workflows ko waves mein run karna |
| 4 | **Workflow Run** | Ek workflow ke andar phases order karna |
| 5 | **Phase Run** | Specific agent ko dispatch karna |
| 6 | **Tool Call** | Agent ka tool use karna (file, shell, browser) |
| 7 | **Result Capture** | Tool output collect karna |
| 8 | **Reflection** | Errors detect karna, retry ya escalate |
| 9 | **Verification** | Build check, tests, runtime health |
| 10 | **Supervisor Review** | Goal complete hua ya nahi check karna |
| 11 | **Completion** | Result user ko deliver karna via SSE |

---

### 2.3 Agents aur Unke Roles

#### 🧠 Supervisor Agent
- Poore run ko oversee karta hai
- Goal completion validate karta hai
- High-level routing manage karta hai

#### 📋 Planner Agent
- User goal ko structured `ExecutionPlan` mein todta hai
- Dependencies define karta hai tasks ke beech

#### ⚙️ Executor Agent
- Plan consume karta hai
- Sub-agents aur tools select karta hai
- Primary worker agent hai

#### 💻 CoderX Agent
- Complex coding aur refactoring karta hai
- Autonomous coding loop: **Think → Code → Test → Fix**
- File patches apply karta hai

#### 🌐 Browser Agent
- UI automation karta hai
- Screenshots leta hai
- Web-based verification karta hai

#### 📁 Filesystem Agent
- Safe aur atomic file operations
- Read / Write / Patch files

#### 🖥️ Terminal Agent
- Shell commands execute karta hai
- Command validation karta hai
- Runtime environment manage karta hai

#### ✅ Verifier Agent
- Build checks
- Test execution
- Runtime health monitoring

---

### 2.4 Tools Registry

**Location:** `server/tools/registry/tool-registry.ts`

```
Tool Registration
      │
      ▼
┌─────────────────────────────┐
│  Singleton Map              │
│  name → { schema,           │
│           permissions,      │
│           handler }         │
└─────────┬───────────────────┘
          │
    ┌─────▼──────────────────┐
    │   Tool Dispatcher       │
    │   - Permission check    │
    │   - Timeout wrapper     │
    │   - Retry (backoff)     │
    │   - Audit logging       │
    └────────────────────────┘
```

- **40+ tools** registered hain
- Categories: Filesystem, Shell, Browser, HTTP, Git, Analysis
- Har tool call audit aur metrics mein log hota hai

---

### 2.5 Real-time Communication (SSE + WebSocket)

#### Server-Sent Events (SSE)
```
Agent/Tool Event
      │
      ▼
AppEventBus (internal EventEmitter)
      │
      ▼
SSE Manager
      │
      ├── Topic: agent    → Agent actions/logs
      ├── Topic: lifecycle → Run start/stop/error
      └── Topic: checkpoint → Save points
      │
      ▼
Client Browser (EventSource)
/api/realtime?projectId=X&runId=Y
```

#### WebSocket
- Chat messages ke liye use hota hai
- Heartbeat mechanism included hai
- `server/chat/index.ts` mein bootstrap hota hai

#### Stream Manager
- AI response tokens ko ek-ek karke stream karta hai
- "Typing effect" create karta hai UI mein
- `stream.token` events emit karta hai

---

### 2.6 Memory System

**Location:** `server/memory/`

- **11 stores** registered hain
- Conversation history, architectural patterns, execution context store hota hai
- **Eviction:** Har 60 seconds mein
- **Reflection:** Har 300 seconds mein
- Cold start par hydration hoti hai

---

### 2.7 Sandbox Architecture

```
Project Root: /tmp/nurax-sandbox/
      │
      ├── AI-generated project files
      ├── Shell execution environment
      └── Browser preview server
```

- Har project ka apna isolated sandbox hota hai
- File watcher changes detect karta hai aur SSE se UI update karta hai

---

## 3. Tech Stack Summary

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| UI Components | Radix UI, Monaco Editor, Lucide React |
| Backend | Node.js, Express, TypeScript, tsx |
| Database | PostgreSQL + Drizzle ORM |
| AI/LLM | OpenRouter API (via openai SDK) |
| Real-time | SSE + WebSocket |
| Task Queue | BullMQ + Redis |
| Browser | Playwright |
| File Watch | Chokidar |

---

## 4. API Endpoints

| Endpoint | Kaam |
|---|---|
| `GET /api/realtime` | SSE stream — saare topics |
| `POST /api/orchestration/run` | AI agent workflow start karo |
| `GET/POST /api/chat/*` | Chat messages |
| `GET /api/projects/*` | Projects CRUD |
| `GET /api/file-explorer/*` | File browser |
| `GET /api/console/*` | Console logs |
| `GET /api/preview/*` | Project preview |
| `GET /health` | Server health check |

---

## 5. Server Ports

| Port | Service |
|---|---|
| **5000** | Vite Dev Server (Frontend) — User-facing |
| **3001** | Express API Server (Backend) |

Vite port 5000 se `/api`, `/sse`, `/ws`, `/preview` sab 3001 par proxy hote hain.

---

*Report generated by Replit AI Agent*
