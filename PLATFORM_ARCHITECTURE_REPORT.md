# NURA-X Platform — Complete Architecture & Lifecycle Report

> **Platform:** AI-Assisted Cloud Software Engineering Platform  
> **Stack:** Node.js 20 · TypeScript · Express · React · Vite · PostgreSQL · Redis · Playwright  
> **Version:** 1.0.0  

---

## TABLE OF CONTENTS

1. [Platform Overview](#1-platform-overview)
2. [Complete Lifecycle: Idea → Production](#2-complete-lifecycle-idea--production)
3. [Phase-by-Phase System Analysis](#3-phase-by-phase-system-analysis)
   - 3.1 Chat System
   - 3.2 AI Agent System
   - 3.3 Orchestration System
   - 3.4 Runtime System
   - 3.5 Filesystem System
   - 3.6 Terminal System
   - 3.7 Preview System
   - 3.8 Database System
   - 3.9 Git System
   - 3.10 Deployment System
   - 3.11 Verification Pipeline
   - 3.12 Recovery Pipeline
   - 3.13 Memory System
   - 3.14 Observability System
4. [Subsystem Ownership Map](#4-subsystem-ownership-map)
5. [Control Flow Report](#5-control-flow-report)
6. [Folder Structure](#6-folder-structure)
7. [Scaling Architecture (100k Users)](#7-scaling-architecture-100k-users)
8. [Final Platform Blueprint](#8-final-platform-blueprint)
9. [Progress Tracker Status](#9-progress-tracker-status)

---

## 1. PLATFORM OVERVIEW

NURA-X ek **Autonomous Agentic AI Vibe Coder** hai jo Replit environment ke andar kaam karta hai. Iska kaam hai — user ka idea lena aur ek working application banake deploy karna — bina user ke direct intervention ke.

### Core Capabilities

| Capability | Description |
|---|---|
| **Autonomous Coding** | AI agents khud code likhte, fix karte, aur deploy karte hain |
| **Multi-Agent Swarm** | Planner, Executor, Verifier, Browser, Supervisor agents ek saath kaam karte hain |
| **Self-Healing** | Crashes detect hote hain, automatically fix hote hain |
| **Fail-Closed Verification** | Code tab tak deploy nahi hota jab tak verify na ho |
| **Real-time Streaming** | Har action SSE/WebSocket se user ko live dikhta hai |

### Tech Stack

```
Frontend    : React 18 + Vite 5 + Tailwind CSS + Radix UI + Monaco Editor
Backend     : Node.js 20 + Express 4 + TypeScript (tsx runtime)
Database    : PostgreSQL (Drizzle ORM) + Redis (BullMQ)
AI/LLM      : OpenAI SDK → OpenRouter API
Automation  : Playwright (browser testing)
Real-time   : WebSocket (ws) + Server-Sent Events (SSE)
```

---

## 2. COMPLETE LIFECYCLE: IDEA → PRODUCTION

```
User ka Idea: "Build a food delivery app"
                        │
                        ▼
        ┌───────────────────────────────┐
        │        PROJECT CREATION       │
        │                               │
        │  • Workspace allocate hota    │
        │  • Git repo initialize        │
        │  • PostgreSQL DB provision    │
        │  • .sandbox/<id>/ FS create   │
        │  • Session + RunID generate   │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │          PLANNING             │
        │                               │
        │  Planner Agent:               │
        │  • Goal ko analyze karta hai  │
        │  • Files identify karta hai   │
        │  • Dependencies list karta    │
        │  • DB schema plan karta       │
        │  • DAG (Task Graph) banata    │
        │    (40 tasks, 12 parallel)    │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │         IMPLEMENTATION        │
        │                               │
        │  Executor Agent (wave 1):     │
        │  • schema.ts, package.json    │
        │  • tailwind.config, tsconfig  │
        │  • vite.config setup          │
        │                               │
        │  Executor Agent (wave 2):     │
        │  • DB migrations run          │
        │  • Express routes write       │
        │  • React pages create         │
        │                               │
        │  Executor Agent (wave 3):     │
        │  • Auth integration           │
        │  • Payment hooks              │
        │  • Map embed                  │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │         VERIFICATION          │
        │                               │
        │  Layer 1: tsc --noEmit        │
        │  Layer 2: npm run build       │
        │  Layer 3: /health probe       │
        │  Layer 4: Playwright browser  │
        │           smoke test          │
        │                               │
        │  Pass → Deploy                │
        │  Fail → Recovery Pipeline     │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │          DEPLOYMENT           │
        │                               │
        │  • vite build → /dist         │
        │  • node bundle (index.cjs)    │
        │  • Container image build      │
        │  • Registry push              │
        │  • Infra schedule             │
        │  • Health check               │
        │  • DNS + TLS activate         │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │        LIVE PRODUCTION        │
        │                               │
        │  URL: https://app.platform    │
        │  Monitoring: active           │
        │  Metrics: streaming           │
        │  Alerts: configured           │
        │  Rollback: ready              │
        └───────────────────────────────┘
```

---

## 3. PHASE-BY-PHASE SYSTEM ANALYSIS

### 3.1 CHAT SYSTEM

User ka message lena se lekar agent ko task dene tak ka full flow.

```
User Message (text / files / screenshots)
              │
              ▼
    ┌─────────────────────────────────────┐
    │         CHAT ORCHESTRATOR           │
    │                                     │
    │  ┌──────────────┐                  │
    │  │Context        │ ← Recent turns   │
    │  │Hydrator       │ ← Project state  │
    │  │               │ ← Memory entries │
    │  │               │ ← Error logs     │
    │  └──────┬────────┘                  │
    │         │                           │
    │  ┌──────▼────────┐                  │
    │  │Intent         │ ← LLM classify   │
    │  │Classifier     │   "build" /      │
    │  │               │   "fix" / "chat" │
    │  └──────┬────────┘                  │
    │         │                           │
    │  ┌──────▼────────┐                  │
    │  │Agent Router   │ → Planner /      │
    │  │               │   Executor /     │
    │  │               │   Direct LLM     │
    │  └───────────────┘                  │
    └─────────────────────────────────────┘
              │
              ▼
    Response streamed via SSE → Browser
```

**State Management:**
- In-process message buffer (per session)
- DB mein conversation persist
- Run-scoped SSE channel per session

**Tool Usage in Chat:**
LLM mid-conversation structured tool calls emit karta hai:
`read_file` → `run_command` → `search_code`
Results context window mein feed hote hain.

---

### 3.2 AI AGENT SYSTEM

```
GOAL RECEIVED
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│  PLANNER AGENT                                           │
│                                                         │
│  1. Existing project state analyze                      │
│  2. Files to create/modify identify                     │
│  3. Dependencies list                                   │
│  4. DB schema changes plan                              │
│  5. DAG build (Directed Acyclic Graph)                  │
│     → Task nodes + dependency edges                     │
└──────────────────────────┬──────────────────────────────┘
                           │ plan.completed event emit
                           ▼
┌─────────────────────────────────────────────────────────┐
│  EXECUTOR AGENT                                          │
│                                                         │
│  DAG ke har task ke liye (dependency order mein):       │
│  → Context load (related files + schema + error history)│
│  → Tool select from registry (170 tools available)      │
│  → Tool invoke in sandbox                               │
│  → Result + side effects capture                        │
│  → FS/DB changes commit                                 │
│  → task.completed emit, dependents unblock              │
└──────────────────────────┬──────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│  VERIFIER AGENT                                          │
│                                                         │
│  1. tsc --noEmit (type check)                           │
│  2. npm run build                                       │
│  3. /health endpoint probe                              │
│  4. Playwright browser automation                       │
│  5. verification.passed OR verification.failed emit     │
└──────────────────────────┬──────────────────────────────┘
                           │ (agar fail)
                           ▼
┌─────────────────────────────────────────────────────────┐
│  RECOVERY AGENT                                          │
│                                                         │
│  1. Failure classify (build/runtime/logic/infra)        │
│  2. Memory retrieve (similar past failures)             │
│  3. Repair plan generate (targeted patch)               │
│  4. Affected tasks re-execute                           │
│  5. Re-verify — max N retries, phir escalate            │
└─────────────────────────────────────────────────────────┘
```

**Tool Registry Categories (170 total tools):**
| Category | Count | Examples |
|---|---|---|
| Terminal Tools | 23 | `run_command`, `kill_process`, `get_output` |
| Coding Tools | 46 | `read_file`, `write_file`, `patch_file`, `search_code` |
| Verifier Tools | 28 | `build_project`, `health_probe`, `playwright_test` |
| Git Tools | ~10 | `git_status`, `git_commit`, `git_push` |
| Deployment Tools | ~10 | `build_artifact`, `deploy_container` |

**Parallelism:** DAG nodes jinka koi dependency edge nahi hai wo concurrently execute hote hain. p-limit gate (3–5 parallel) resource exhaustion prevent karta hai.

---

### 3.3 ORCHESTRATION SYSTEM

```
                ┌──────────────────────────┐
                │    ORCHESTRATION CORE     │
                │                          │
                │  ┌────────────────────┐  │
                │  │    EVENT BUS       │  │ ← Central nervous system
                │  │  (typed pub/sub)   │  │   Har agent isse baat karta
                │  └─────────┬──────────┘  │
                │            │             │
    ┌───────────┼────────────┼─────────────┼───────────┐
    │           │            │             │           │
Planner    Executor    Verifier       Recovery   Coordination
Agent      Agent       Agent          Manager    Registry
    │           │            │             │           │
    └───────────┴────────────┴─────────────┴───────────┘
                             │
                   ┌─────────▼──────────┐
                   │  RUN LIFECYCLE     │
                   │  STATE MACHINE     │
                   │                   │
                   │  idle             │
                   │   → planning      │
                   │   → executing     │
                   │   → verifying     │
                   │   → recovering    │
                   │   → completed     │
                   │   → failed        │
                   └───────────────────┘
```

**Important Systems:**

| System | Function |
|---|---|
| **Event Bus** | Typed pub/sub, sabka communication isse hota |
| **Coordination Registry** | Active agent contexts track karta, sweeper stale evict karta (60s) |
| **Run Cleanup Manager** | TTL-based eviction of per-run data after terminal state |
| **DAG Engine** | Task graph execution, dependency ordering, parallelism |

---

### 3.4 RUNTIME SYSTEM

```
SERVER START → main.ts
      │
      ▼  [INIT SEQUENCE — order matters]
      │
      ├─ runtimeManager.init()          → PIDs load, /proc reconcile
      ├─ runtimeStore.init()            → Aggregated state ready
      ├─ initMemory()                   → Debug memory disk se load
      ├─ observationController.start()  → Logs watch + port probe
      ├─ initExecutionHistory()         → Tool audit log ready
      ├─ startRecoveryManager()         → run.lifecycle failed listen
      ├─ initOrchestration()            → All agent systems wire
      ├─ initRuntimeEvents()            → Telemetry bus wire
      ├─ initRunCleanupManager()        → TTL eviction start
      ├─ initRecoveryRestartBridge()    → Crash → restart bridge
      ├─ startReflectionEngine()        → Failure pattern analysis
      ├─ fileLockManager.startCleaner() → Stale lock sweep (10s)
      ├─ startPortSweeper(300_000)      → Port sweep (5min)
      ├─ contextRegistry.startSweeper() → Coordination cleanup (60s)
      ├─ loadAllTools()                 → 170 tools register, seal
      ├─ initializePlanner()            → Planner event handlers
      ├─ initializeExecutor()           → Executor event handlers
      └─ initBrowserBusBridge()         → Browser events → infra bus

STEADY STATE:
  • Health monitor: har PID ko 30s mein probe
  • Console log persister: 500ms batch flush
  • Port sweeper: 5 min interval
  • Lock sweeper: 10s interval
  • Coordination sweeper: 60s interval
  • SSE channels: har active session ke liye open
```

**Process Isolation:**
- Har project ka apna OS namespace
- CPU + memory limits cgroup level par
- Network egress: allowlist filter (`openrouter.ai, api.openai.com`)
- FS access: project root tak confined

---

### 3.5 FILESYSTEM SYSTEM

| Operation | Implementation | Safety |
|---|---|---|
| **Read** | Direct disk read | In-memory cache optional |
| **Write** | Atomic: temp file → rename | Never partial write |
| **Patch** | Unified diff apply | Validate before commit |
| **Delete** | Soft delete → `.trash/` → hard delete (TTL) | Recoverable |
| **Rename** | `rename()` syscall | Atomic, open handles update |

```
File Write Flow:
  Agent → File Lock Manager (acquire) → Atomic Write → Chokidar Watcher
                                                            │
                    ┌───────────────────────────────────────┘
                    │
                    ├── Runtime notified (HMR / rebuild)
                    ├── Git diff tracker updated
                    └── Preview pipeline notified

File Lock Manager:
  • Per-file pessimistic locks
  • Lock TTL: ~30 seconds
  • Stale lock sweeper: 10s interval
  • Deadlock prevention guaranteed
```

**Checkpoints (Snapshots):**
- Full FS copy → `.zip` artifact
- Created: before agent edits, before deploy, on user request
- Rollback: decompress → apply over current FS → rebuild trigger

---

### 3.6 TERMINAL SYSTEM

```
Command Input (User / Agent)
          │
          ▼
  Terminal Router
    → Safety check (rm -rf /, network exfil block)
    → Project sandbox assign
          │
          ▼
  Sandbox Process Manager
    → spawn(cmd, { cwd: project_root, env: filtered_env })
    → stdout/stderr streams attach
    → PID register in process registry
          │
          ▼
  Output Streamer
    → 500ms batch buffer
    → Console log store persist
    → SSE se frontend stream
          │
          ▼
  Process Monitor
    → Exit code capture
    → Non-zero → failure event emit
    → Recovery Manager may trigger restart
```

**Security:**
- Secrets env vars output mein kabhi visible nahi
- Working dir: project root confined
- Network: allowlist only

---

### 3.7 PREVIEW SYSTEM

```
Code Change Saved
      │
      ▼
Chokidar Watcher
      │
      ├── Server file change?
      │     → TSX watch restarts API
      │     → Port probe until healthy
      │
      └── Client file change?
            → Vite HMR patch via WebSocket
            → Browser hot update (no full reload)
      │
      ▼
IQ2000 Preview Pipeline (6 stages):
  [1] runtime   → process health + open port check
  [2] files     → file watcher state
  [3] tunnel    → preview URL assign
  [4] devtools  → browser devtools bridge inject
  [5] state     → current preview snapshot
  [6] metrics   → build time, reload latency record
      │
      ▼
Frontend receives preview URL
Iframe src update → User sees live app
```

**Failure Handling:**
- Build fail → error overlay in preview iframe
- Recovery agent ko `build.failed` event milta hai
- Auto-repair attempt shuru

---

### 3.8 DATABASE SYSTEM

```
Schema Definition (shared/schema.ts — Drizzle ORM)
          │
          ▼
drizzle-kit generates migration SQL
          │
          ▼
db:push applies migration
  → Schema diff compute
  → ALTER / CREATE run
  → _drizzle_migrations table update
          │
          ▼
Connection Pool (pg.Pool)
  → Max connections per project
  → Pool health monitored continuously
          │
          ▼
Application Queries (ORM layer)
  → Prepared statements (SQL injection prevent)
  → Transaction wrappers for multi-step ops
          │
          ▼
Backups
  → WAL streaming (point-in-time recovery)
  → pg_dump scheduled
  → Backup restore probe (automated test)
```

**Security:** DB credentials sirf server-side env vars mein. `VITE_*` se kabhi expose nahi. Koi client-to-DB direct access nahi.

---

### 3.9 GIT SYSTEM

```
FS Changes Accumulated
      │
      ▼
git status → changed file list
      │
      ▼
git diff → unified diff per file
      │
      ▼
Staging: git add <files>
      │
      ▼
Commit: git commit -m "<message>"
  → SHA recorded
  → Checkpoint snapshot SHA se link
      │
      ▼
Push: git push origin <branch>
  → Remote authenticated
  → Result recorded
      │
      ▼
Optional: PR creation via remote API
```

**Branching Strategy:**
- Agent runs: feature branch `agent/run-<id>`
- Main branch protected
- Conflict resolution: LLM dono sides padha kar merge produce karta hai

---

### 3.10 DEPLOYMENT SYSTEM

```
Source Code (deploy trigger par freeze)
      │
      ▼
BUILD PHASE
  → npm run build
  → /dist artifacts produce
  → Build logs capture
      │
      ▼
ARTIFACT PHASE
  → artifacts + package.json + lock file bundle
  → node ./dist/index.cjs server entry
      │
      ▼
CONTAINER PHASE
  → Dockerfile generate
  → docker build → image tag (SHA)
  → Container registry push
      │
      ▼
INFRASTRUCTURE PHASE
  → Autoscale platform container schedule
  → Env vars inject (secret store se)
  → /health probe
  → Readiness confirm
      │
      ▼
TRAFFIC ROUTING
  → DNS / proxy update
  → TLS certificate provision
  → *.platform.app domain activate
      │
      ▼
LIVE — Monitoring begins
```

**Rollback:** Previous image registry mein retain. Rollback = previous image tag re-deploy (~30 seconds).

---

### 3.11 VERIFICATION PIPELINE

```
Code Written
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ LAYER 1: STATIC ANALYSIS                            │
│  Tool: TypeScript compiler + ESLint                 │
│  Catches: Type errors, undefined vars, bad imports  │
│  Cost: Near-zero. ~40% bugs catch.                  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ LAYER 2: BUILD VALIDATION                           │
│  Tool: npm run build (full Vite compilation)        │
│  Catches: Unresolved imports, circular deps,        │
│           tree-shaking failures                     │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ LAYER 3: RUNTIME VALIDATION                         │
│  Tool: Start server → probe /health endpoint        │
│  Catches: Boot failures, env var missing,           │
│           DB connection failure                     │
│  Static analysis ye nahi pakad sakta               │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│ LAYER 4: BROWSER VALIDATION                         │
│  Tool: Playwright — navigate, interact, screenshot  │
│  Catches: UI render failures, broken flows,         │
│           white-screen-of-death post-deploy         │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
                PASS / FAIL GATE
                (Fail → Recovery Pipeline)
```

---

### 3.12 RECOVERY PIPELINE

```
FAILURE DETECTED
      │
      ▼
FAILURE CLASSIFIER
  BUILD_ERROR   → lint/compile issue
  RUNTIME_CRASH → process issue
  LOGIC_ERROR   → wrong output
  INFRA_ERROR   → port/network
  TIMEOUT       → hung process
      │
      ▼
MEMORY RETRIEVAL
  → Similar past failures search
  → Successful repair pattern retrieve
      │
      ▼
REPAIR PLAN GENERATION (LLM)
  → Targeted patch (full rewrite nahi)
  → Specific files + specific fix
      │
      ▼
REPAIR EXECUTION
  → Tool calls with patches
  → Side effects commit
      │
      ▼
RE-VERIFICATION (full pipeline)
  → Pass → resolved mark
  → Fail → retry count increment
  → Max retries hit → User escalate
```

**Ownership:**
- **Recovery Manager:** Retry state machine
- **Reflection Engine:** Failure pattern analysis
- **Recovery Restart Bridge:** Supervised process restart

---

### 3.13 MEMORY SYSTEM

```
┌─────────────────────────────────────────────────────────┐
│  TIER 1: SHORT-TERM (In-Process)                         │
│  Contents: Current run tool results, agent context,     │
│            SSE event buffer                              │
│  TTL: Duration of single run                            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  TIER 2: EXECUTION MEMORY (Run-Scoped, Persisted)        │
│  Contents: All tool calls + results, agent decisions,   │
│            timeline of state transitions                 │
│  TTL: 30 days (configurable)                            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  TIER 3: FAILURE MEMORY (Cross-Run)                      │
│  Contents: Error signature → successful repair map,     │
│            crash patterns + what fixed them              │
│  Influence: Recovery plan generation                    │
│  TTL: Permanent (explicit eviction tak)                 │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  TIER 4: PROJECT MEMORY (Long-Term)                      │
│  Contents: Architecture decisions, user preferences,    │
│            past approaches success/failure               │
│  Influence: Future planner decisions                    │
│  TTL: Life of project                                   │
└─────────────────────────────────────────────────────────┘
```

**Memory Influence Chain:**
```
New task arrive
  → Planner: Project Memory query ("auth ke baare mein kya decide tha?")
  → Executor: Failure Memory query ("ye error pehle aaya tha?")
  → Recovery: Failure Memory query ("is error ko kaise fix kiya tha?")
  → Reflection Engine: Naye findings Failure Memory mein write
```

---

### 3.14 OBSERVABILITY SYSTEM

**Logs:**
```json
{
  "timestamp": "2025-01-01T00:00:00Z",
  "level": "info",
  "subsystem": "executor-agent",
  "runId": "run-abc123",
  "message": "Task completed: write schema.ts",
  "metadata": { "duration_ms": 342, "tool": "write_file" }
}
```

**Metrics:**
| Category | Metrics |
|---|---|
| Runtime | CPU%, Memory MB, Open FDs per process |
| Agent | Task completion rate, Tool call latency P50/P99 |
| API | Request rate, Error rate, Latency histograms |
| Build | Build time, HMR latency, Verification pass rate |

**Traces:**
- Har run ko `runId` milta hai
- Sare events tagged: agent thoughts, tool calls, FS writes, process events
- End-to-end trace: `run.started → task.started → tool.invoked → ... → run.completed`

**Health Endpoints:**
```
GET /health              → Server alive check
GET /api/health/redis    → Queue system health + latency
GET /api/health/llm      → AI key validity + model info
GET /api/status          → Runtime info + uptime
GET /api/runtime/:id     → Per-project process health + ports
GET /api/telemetry/:runId/summary    → Run summary
GET /api/telemetry/:runId/violations → Violation list
```

---

## 4. SUBSYSTEM OWNERSHIP MAP

| Subsystem | Owner | Called By | Consumes | Runs When |
|---|---|---|---|---|
| Chat Orchestrator | Platform Core | User (HTTP/WS) | Memory, LLM, Context | Every user message |
| Planner Agent | Orchestration | Chat, Orchestration init | LLM, Project memory | New goal / task |
| Executor Agent | Orchestration | Planner (DAG events) | Tool registry, FS, Terminal | DAG task available |
| Verifier Agent | Orchestration | Executor post-completion | Build, Health, Playwright | After each run phase |
| Recovery Manager | Infrastructure | Run lifecycle events | Failure memory, Reflection | `run.lifecycle failed` |
| Reflection Engine | AI Platform | Verifier + Recovery | Run logs, Failure patterns | Post-run analysis |
| Tool Registry | Executor | All agents | Tool implementations | Sealed at startup |
| Runtime Manager | Infrastructure | main.ts, Process events | OS process table, Port allocator | Continuously |
| Event Bus | Platform Core | Every subsystem | Subscriber callbacks | Always (central nervous system) |
| File Lock Manager | Quantum Layer | FS tools, Executor | In-process lock table | Every FS write |
| DAG Engine | Orchestration | Planner, Executor | Task queue, Dependency graph | Active runs |
| Preview Pipeline | Preview Platform | FS watcher events | Vite, Process health | File changes |
| Deployment Pipeline | Deployment | User / CI trigger | Build tools, Container, Infra | Deploy command |
| Observability | Platform Core | All subsystems (write) | Log store, Metrics | Always |
| Coordination Registry | Orchestration | All agents | Context table | Active runs, 60s sweep |

---

## 5. CONTROL FLOW REPORT

```
USER
  │ HTTP POST /api/chat/message
  ▼
CHAT ORCHESTRATOR
  │ Context hydrate: memory + project state + recent turns
  │ Intent classify
  ▼
PLANNER AGENT
  │ LLM call: goal → task list → DAG
  │ Emit: plan.completed { dag }
  ▼
EVENT BUS
  │ plan.completed subscribers notify
  ▼
EXECUTOR AGENT
  │ First wave tasks dequeue (no blocked dependencies)
  │ For each task:
  │   → LLM: tool + args select
  │   → TOOL REGISTRY: tool resolve
  │   → SANDBOX: tool execute
  │   → FILE LOCK MANAGER: acquire (FS write hogi to)
  │   → FILESYSTEM: atomic write
  │   → FILE LOCK MANAGER: release
  │   → Emit: task.completed
  ▼
DAG SCHEDULER
  │ Next wave unblock
  ▼
EXECUTOR AGENT (agle wave)
  ... DAG complete hone tak repeat ...
  │ Emit: run.lifecycle { phase: 'verification' }
  ▼
VERIFIER AGENT
  │ Static → Build tools
  │ Runtime → Runtime Manager
  │ Browser → Playwright → Browser Agent
  │ Emit: verification.passed OR verification.failed
  ▼
[FAIL] RECOVERY MANAGER     [PASS] DEPLOYMENT PIPELINE
  │                               │
  │ Classify + Repair             │ Build → Container → Infra
  │ Re-verify                     │ DNS → URL activate
  └──────────────────────────────┘
                    │
                    ▼
            CHAT ORCHESTRATOR
              │ Final response stream to user
              │ Live URL include
              ▼
            USER: Live app dekh raha hai
```

---

## 6. FOLDER STRUCTURE

```
platform/
│
├── server/                          # Backend — sab server-side logic
│   ├── agents/                      # AI agent implementations
│   │   ├── planner/                 # Goal → DAG decomposition
│   │   ├── executor/                # DAG task execution
│   │   ├── verifier/
│   │   │   ├── static/              # TS/lint checks
│   │   │   ├── runtime/             # Health probes
│   │   │   └── browser/             # Playwright tests
│   │   ├── browser/                 # Browser automation agent
│   │   └── supervisor/              # Agent health + escalation
│   │
│   ├── orchestration/               # Multi-agent coordination
│   │   ├── index.ts
│   │   ├── dag/                     # DAG engine + scheduler
│   │   ├── run-lifecycle/           # State machine per run
│   │   └── coordination/            # Context registry + sweeper
│   │
│   ├── infrastructure/              # Core platform systems
│   │   ├── runtime/
│   │   │   ├── runtime-manager.ts
│   │   │   ├── runtime-store/
│   │   │   └── port-allocation/
│   │   ├── proxy/                   # Preview reverse proxy
│   │   ├── memory/                  # Run cleanup + eviction
│   │   └── recovery/                # Crash recovery + restart
│   │
│   ├── tools/                       # Agent tool registry (170 tools)
│   │   ├── registry/tool-loader.ts
│   │   ├── terminal/                # 23 tools
│   │   ├── coding/                  # 46 tools
│   │   ├── verifier/                # 28 tools
│   │   ├── git/
│   │   └── deployment/
│   │
│   ├── api/                         # HTTP route handlers (20+ routers)
│   │   ├── agents.routes.ts
│   │   ├── projects.routes.ts
│   │   ├── fs.routes.ts
│   │   ├── run.routes.ts
│   │   ├── dag.routes.ts
│   │   ├── orchestration.routes.ts
│   │   └── ...
│   │
│   ├── chat/                        # Chat orchestrator
│   │   ├── index.ts
│   │   ├── context/
│   │   └── persistence/
│   │
│   ├── preview/                     # IQ2000 Preview Pipeline (6 stages)
│   │   ├── runtime/
│   │   ├── files/
│   │   ├── tunnel/
│   │   ├── devtools/
│   │   └── state/
│   │
│   ├── file-explorer/               # File tree pipeline (5 stages)
│   ├── console/                     # Console capture pipeline (3 stages)
│   ├── database/                    # DB provisioning + access
│   ├── git/                         # Git operations
│   ├── deployment/                  # Build, container, infra, health
│   ├── security/                    # Sandbox policy, secret filter
│   ├── memory/                      # Memory collectors + bridges
│   │   ├── runtime/
│   │   └── reflection/
│   ├── engine/
│   │   ├── reflection/              # Post-run failure analysis
│   │   └── telemetry/               # DAG metrics
│   ├── quantum/                     # Advanced state management
│   │   ├── locks/                   # File lock manager
│   │   ├── superposition/
│   │   └── reconciliation/
│   ├── distributed/redis/           # Redis health + availability
│   ├── telemetry/                   # Run telemetry API
│   ├── execution-history/           # Tool call audit log
│   └── runtime/network/             # Port allocation authority
│
├── client/                          # Frontend (React + Vite)
│   └── src/
│       ├── components/
│       │   ├── agent/               # Agent thought/action UI
│       │   ├── editor/              # Monaco editor wrapper
│       │   ├── terminal/            # Terminal UI
│       │   ├── preview/             # Preview iframe
│       │   └── ui/                  # Radix/shadcn components
│       └── features/
│           ├── chat/
│           ├── swarm/               # Multi-agent swarm visualization
│           ├── filesystem/
│           ├── database/
│           └── deployment/
│
├── shared/                          # Server + Client shared types
│   ├── schema.ts                    # Drizzle ORM schema
│   └── types/
│
├── .sandbox/                        # Agent-managed project workspaces
│   └── <project-id>/                # Isolated per-project FS root
│
├── .runtime/                        # Runtime state persistence
│   └── state.json                   # Process registry snapshot
│
├── main.ts                          # Application entry point
├── vite.config.ts                   # Frontend build config
├── drizzle.config.ts                # DB config
└── package.json                     # Dependencies + scripts
```

---

## 7. SCALING ARCHITECTURE (100,000 CONCURRENT USERS)

### Problem Areas at Scale

| Area | Single Node Problem | Solution at Scale |
|---|---|---|
| **Orchestration** | In-process event bus | Redis pub/sub ya Kafka cross-node |
| **Run Queue** | In-process BullMQ | BullMQ on Redis cluster, N workers |
| **Runtime** | Local child processes | K8s pods per project, autoscaler |
| **Preview** | Local Vite + proxy | CDN statics + per-pod proxy |
| **Database** | 1 Postgres instance | Per-project Postgres, PgBouncer pools |
| **WebSocket** | 1 WS server | N gateway nodes (sticky sessions), Redis state |
| **File Storage** | Local disk | NFS/S3-backed distributed volumes |
| **Memory Store** | In-process Maps | Redis cluster (sharded by project ID) |
| **Telemetry** | In-process buffer | Kafka → ClickHouse pipeline |

### Scale Numbers

```
100,000 concurrent users
      │
      ├── ~10,000–30,000 active projects (3:1 idle ratio)
      │         → ~10,000–30,000 K8s pods
      │
      ├── ~100,000 WebSocket connections
      │         → ~10 WS gateway nodes (10k connections/node)
      │
      ├── ~1,000 Postgres instances
      │         → PgBouncer middleware pooling
      │
      ├── ~50–100 Orchestration nodes
      │         → Redis queue shared
      │
      └── ~10 Redis cluster nodes
                → Sharded by project ID
```

### Key Scaling Insight

> Platform architecture mein sahi abstractions already hain — event bus, stateless orchestration, in-process stores jo Redis se swap ho sakti hain. Single-node se distributed mostly configuration change hai, rewrite nahi.

---

## 8. FINAL PLATFORM BLUEPRINT

```
╔══════════════════════════════════════════════════════════════════════╗
║                      NURA-X PLATFORM BLUEPRINT                       ║
╚══════════════════════════════════════════════════════════════════════╝

┌──────────────────────────────────────────────────────────────────────┐
│                           USER LAYER                                  │
│                                                                      │
│   Browser  ←  Monaco Editor  ←  React Dashboard  ←  WebSocket/SSE  │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │ HTTP / WebSocket / SSE
┌────────────────────────────────▼─────────────────────────────────────┐
│                          GATEWAY LAYER                                │
│                                                                      │
│   Express API (20+ routers)  │  Vite Proxy (dev)  │  Edge (prod)   │
│   Port 3001                  │  Port 5000          │                 │
└──────────────┬───────────────────────────┬───────────────────────────┘
               │                           │
┌──────────────▼──────────┐   ┌────────────▼──────────────────────────┐
│      CHAT SYSTEM        │   │           AI AGENT SYSTEM              │
│                         │   │                                        │
│  Context Hydrator       │   │  Planner Agent  → DAG Engine          │
│  Intent Classifier      │   │  Executor Agent → Tool Registry (170) │
│  Conversation Store     │   │  Verifier Agent → Playwright          │
│  SSE Broadcaster        │   │  Browser Agent  → Chromium            │
│                         │   │  Supervisor     → Escalation          │
└──────────────┬──────────┘   └───────────────────┬────────────────────┘
               │                                   │
┌──────────────▼───────────────────────────────────▼────────────────────┐
│                       ORCHESTRATION LAYER                              │
│                                                                       │
│  Event Bus (typed pub/sub)    ←→  Run Lifecycle State Machine        │
│  Coordination Registry        ←→  Context Sweeper (60s)              │
│  Recovery Manager             ←→  Reflection Engine                  │
│  Run Cleanup Manager          ←→  Memory Pipeline                    │
│  DAG Scheduler                ←→  Parallel Execution Gate            │
└───────────────────────────┬───────────────────────────────────────────┘
                            │
┌───────────────────────────▼───────────────────────────────────────────┐
│                        EXECUTION LAYER                                 │
│                                                                       │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────────────┐ │
│  │  FILESYSTEM  │   │   TERMINAL   │   │   PREVIEW PIPELINE       │ │
│  │              │   │              │   │                          │ │
│  │ Atomic R/W   │   │ Sandboxed    │   │ [runtime] → [files]      │ │
│  │ File Locks   │   │ Process Exec │   │ [tunnel]  → [devtools]   │ │
│  │ Chokidar     │   │ PID Registry │   │ [state]   → [metrics]    │ │
│  │ Checkpoints  │   │ Log Capture  │   │ HMR / Vite               │ │
│  └──────┬───────┘   └──────┬───────┘   └─────────────┬────────────┘ │
└─────────┼──────────────────┼────────────────────────┼───────────────┘
          │                  │                         │
┌─────────▼──────────────────▼─────────────────────────▼───────────────┐
│                      INFRASTRUCTURE LAYER                              │
│                                                                       │
│  Runtime Manager  → Process health, PID ownership, port authority   │
│  Runtime Store    → Aggregated single-source-of-truth               │
│  Recovery Bridge  → Crash → supervised restart                      │
│  Port Sweeper     → Stale reservation cleanup (5min)                │
└──────────────────────────────┬────────────────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────────────────┐
│                       PERSISTENCE LAYER                                │
│                                                                       │
│  PostgreSQL (Drizzle ORM)  │  Redis (BullMQ + distributed state)    │
│  File System (.sandbox/)   │  Execution History (tool audit log)    │
│  Memory Store (4 tiers)    │  Git Repository (versioned source)      │
└──────────────────────────────┬────────────────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────────────────┐
│                      DEPLOYMENT LAYER                                  │
│                                                                       │
│  Build (vite build)  →  Artifact  →  Container Image  →  Registry  │
│  Infra Scheduler     →  Container Runtime  →  Health Check  →  DNS  │
│  TLS Certificate     →  Live URL Activated                          │
└──────────────────────────────┬────────────────────────────────────────┘
                               │
┌──────────────────────────────▼────────────────────────────────────────┐
│                     OBSERVABILITY LAYER                                │
│                                                                       │
│  Structured Logs  │  Metrics  │  Traces (runId)  │  Violations      │
│  /api/health/*    │  /api/telemetry/:runId/*      │  Alerts          │
└──────────────────────────────┬────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        LIVE PRODUCTION                                │
│                                                                       │
│  https://your-app.replit.app                                         │
│  TLS ✓   Autoscale ✓   Monitoring ✓   Rollback Ready ✓             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 9. PROGRESS TRACKER STATUS

Neeche migration ke sab steps complete kiye gaye hain:

| Step | Status | Details |
|---|---|---|
| Packages install | ✅ Done | npm install — 679 packages |
| Workflow configure | ✅ Done | npm run dev, port 5000 (webview) |
| DB schema push | ✅ Done | drizzle-kit push successful |
| App running check | ✅ Done | Port 3001 (API) + Port 5000 (Frontend) active |
| Auth review | ✅ Done | Koi external auth nahi — skip |
| Integrations review | ✅ Done | OpenRouter key request bheja |
| Report file create | ✅ Done | Ye file (PLATFORM_ARCHITECTURE_REPORT.md) |

### Current Server Status

```
API Server:    http://localhost:3001  ✅ Running
Frontend:      http://localhost:5000  ✅ Running
Database:      PostgreSQL             ✅ Connected (DATABASE_URL set)
Redis:         Optional               ⚠  Not connected (in-process fallback active)
OpenRouter:    Required for agents    ⚠  Key needed (request sent to user)
```

### Next Steps for Full Functionality

1. **OpenRouter API Key** — AI agents ke liye zaroori. `OPENROUTER_API_KEY` secret add karein.
2. **Redis (Optional)** — Distributed queue ke liye. `REDIS_URL` add karein (Upstash free tier available).
3. **App Access** — Preview pane mein app already live hai.

---

*Report generated by NURA-X Migration Analysis*  
*Platform: Replit Environment*  
*Date: 2025*
