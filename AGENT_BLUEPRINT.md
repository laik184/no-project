# NURA-X — Agent System Blueprint Report
> Deep Scan by Intelligence Backend Agent Developer  
> Project: `nura-x-deployer` | Version: 1.0.0  
> Total Agents: **10 Specialized Agents** | Total Tools: **49 Tools** across **15 Categories**

---

## TABLE OF CONTENTS
1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [All 10 Agents — Deep Profile](#3-all-10-agents--deep-profile)
4. [Orchestration Engine — 9 Phase Pipeline](#4-orchestration-engine--9-phase-pipeline)
5. [All 49 Tools — Complete Registry](#5-all-49-tools--complete-registry)
6. [Infrastructure Systems](#6-infrastructure-systems)
7. [File Path Index — Important vs Optional](#7-file-path-index--important-vs-optional)
8. [Data Flow — Request to Response](#8-data-flow--request-to-response)
9. [Environment Variables](#9-environment-variables)

---

## 1. SYSTEM OVERVIEW

NURA-X ek **Autonomous Agentic AI Vibe Coder** hai. Yeh system user ka high-level idea leta hai aur khud se plan karta hai, code likhta hai, debug karta hai, preview karta hai, aur deploy karta hai — sab kuch ek sandboxed environment mein.

```
User Idea
    ↓
Orchestration Engine (9 phases)
    ↓
10 Specialized Agents (collaborate)
    ↓
49 Tools (file, shell, git, browser, db, etc.)
    ↓
Working Application in .sandbox/
```

**Tech Stack:**
- **Frontend:** React 18 + Vite + TypeScript + TailwindCSS + shadcn/ui
- **Backend:** Node.js + Express + TypeScript (tsx)
- **Database:** PostgreSQL via Drizzle ORM (+ SQLite fallback)
- **AI:** OpenRouter API (GPT-4o-mini / gpt-oss-120b)
- **Real-time:** SSE (Server-Sent Events) + WebSockets
- **Queue:** BullMQ + Redis (in-process fallback)
- **Browser Automation:** Playwright

---

## 2. ARCHITECTURE DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NURA-X SYSTEM                                │
│                                                                     │
│  ┌──────────┐    ┌──────────────────────────────────────────────┐  │
│  │  React   │    │          ORCHESTRATION ENGINE                │  │
│  │ Frontend │◄──►│  Observe → Plan → Decompose → Route →        │  │
│  │ (Port    │    │  Execute → Verify → Reflect → Score → Learn  │  │
│  │  5000)   │    └──────────┬───────────────────────────────────┘  │
│  └──────────┘               │                                      │
│                             ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                   10 SPECIALIZED AGENTS                      │  │
│  │                                                              │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │  │
│  │  │Supervisor│  │ Builder  │  │ Planner  │  │  Executor  │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │  │
│  │  │ Browser  │  │Debugger  │  │Reflection│  │  Runtime   │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────────┘  │  │
│  │  ┌──────────┐  ┌──────────┐                                 │  │
│  │  │  Review  │  │ Verifier │                                  │  │
│  │  └──────────┘  └──────────┘                                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                             │                                      │
│                             ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              49 TOOLS (15 Categories)                        │  │
│  │  File(6) Shell(1) Package(4) Server(4) Preview(2) Git(6)    │  │
│  │  DB(3) Deploy(3) Testing(3) Browser(3) Network(3)           │  │
│  │  Auth(2) AgentControl(5) Memory(2) Env(2)                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                             │                                      │
│                             ▼                                      │
│                    .sandbox/ (Project Files)                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. ALL 10 AGENTS — DEEP PROFILE

### AGENT 1: Supervisor Agent
**Role:** Central coordinator, task router, hallucination detector  
**Status:** CRITICAL (system ka brain)  
**Path:** `server/agents/supervisor/supervisor-agent.ts`

| Property | Detail |
|----------|--------|
| Kaam | Goals receive karta hai, complexity analyze karta hai, sahi agent ko task deta hai |
| Sub-files | `agent-router.ts`, `task-coordinator.ts`, `consensus-engine.ts`, `hallucination-detector.ts` |
| Calls | `runAgentLoop` via runner, `routeTask`, consensus checking |
| Connected to | Planner, Builder, Executor, Orchestration Engine |
| Importance | **CRITICAL** — Iske bina koi bhi task route nahi hoga |

```
server/agents/supervisor/
├── supervisor-agent.ts       ← IMPORTANT (main file)
├── agent-router.ts           ← IMPORTANT (routing logic)
├── task-coordinator.ts       ← IMPORTANT (coordination)
├── consensus-engine.ts       ← IMPORTANT (multi-agent consensus)
└── hallucination-detector.ts ← IMPORTANT (AI hallucination prevention)
```

---

### AGENT 2: Planner Agent
**Role:** High-level goal ko ordered TaskGraph mein decompose karta hai  
**Status:** CRITICAL  
**Path:** `server/agents/planner/planner-agent.ts`

| Property | Detail |
|----------|--------|
| Kaam | User ka goal leta hai → classify karta hai (fix/add/refactor) → tasks ka graph banata hai |
| Strategy | Rule-based decomposition, goal classification |
| Output | `TaskGraph` (nodes + edges + dependencies) |
| Connected to | Supervisor (input lena), Builder (TaskGraph dena) |
| Importance | **CRITICAL** — Plan nahi = execution nahi |

```
server/agents/planner/
├── planner-agent.ts    ← IMPORTANT (main file)
└── builder-plan.ts     ← IMPORTANT (plan structure)
```

---

### AGENT 3: Builder Agent
**Role:** Code generation ko parallel DAG waves mein orchestrate karta hai  
**Status:** CRITICAL  
**Path:** `server/agents/builder/builder-agent.ts`

| Property | Detail |
|----------|--------|
| Kaam | Planner ka TaskGraph leta hai → parallel waves mein tasks execute karta hai |
| Engine | `node-executor.ts` ke through sub-agents ko delegate karta hai |
| Parallelism | Multiple tasks ek saath (wave-based execution) |
| Connected to | Planner (input), Executor (delegation), DAG Engine |
| Importance | **CRITICAL** — Code actually yahi generate hota hai |

```
server/agents/builder/
├── builder-agent.ts    ← IMPORTANT (main file)
└── builder-plan.ts     ← IMPORTANT (wave planning)
```

---

### AGENT 4: Executor Agent
**Role:** Ek assigned task ko available tools se execute karta hai  
**Status:** CRITICAL  
**Path:** `server/agents/executor/executor-agent.ts`

| Property | Detail |
|----------|--------|
| Kaam | Single task lena → tools call karna (file write, shell exec, etc.) |
| Engine | `toolOrchestrator` via `server/tools/orchestrator.ts` |
| Pattern | Tool-Loop: Think → Call Tool → Observe → Repeat |
| Connected to | Tool Registry (49 tools), Builder (task input) |
| Importance | **CRITICAL** — Actual file likhna, commands run karna yahi karta hai |

```
server/agents/executor/
└── executor-agent.ts   ← IMPORTANT (main file)
```

---

### AGENT 5: Browser Agent
**Role:** Visual validation — app ka screenshot leta hai, UI check karta hai  
**Status:** IMPORTANT  
**Path:** `server/agents/browser/browser-agent.ts`

| Property | Detail |
|----------|--------|
| Kaam | App URL navigate karta hai, screenshot leta hai, hydration/responsive check karta hai |
| Engine | `runBrowserValidation` from `server/browser/index.ts` (Playwright) |
| Checks | Visual status, hydration errors, responsive layout |
| Connected to | Verifier (results dena), Orchestration (verify phase) |
| Importance | **IMPORTANT** — Verify phase mein use hota hai |

```
server/agents/browser/
└── browser-agent.ts    ← IMPORTANT (main file)

server/browser/
└── index.ts            ← IMPORTANT (Playwright integration)
```

---

### AGENT 6: Debugger Agent
**Role:** Failures diagnose karta hai, recovery strategies generate karta hai  
**Status:** IMPORTANT  
**Path:** `server/agents/debugger/debugger-agent.ts`

| Property | Detail |
|----------|--------|
| Kaam | Error logs analyze karta hai → pattern match karta hai → fix strategy deta hai |
| Patterns | `cannot find module`, `TypeScript type mismatch`, runtime crashes |
| Method | Rule-based diagnosis (pattern matching) |
| Connected to | Reflection Agent, Crash Responder, Recovery Manager |
| Importance | **IMPORTANT** — Error recovery ke liye zaroori |

```
server/agents/debugger/
└── debugger-agent.ts   ← IMPORTANT (main file)

server/agents/recovery/
└── crash-responder.ts  ← IMPORTANT (auto crash recovery)
```

---

### AGENT 7: Reflection Agent
**Role:** Retry loops aur hallucination risks analyze karta hai  
**Status:** IMPORTANT  
**Path:** `server/agents/reflection/reflection-agent.ts`

| Property | Detail |
|----------|--------|
| Kaam | Agent stuck hai ya loop mein hai? → Corrective strategy decide karta hai |
| Engine | `runReflectionEngine` + `runHallucinationGate` |
| Triggers | `process.crashed` + `run.lifecycle failed` bus events |
| Decision | Retry karo / Escalate to swarm / Fail gracefully |
| Connected to | Debugger (input), Orchestration Engine (reflect phase) |
| Importance | **IMPORTANT** — Infinite loops aur hallucinations rok ta hai |

```
server/agents/reflection/
└── reflection-agent.ts         ← IMPORTANT (main file)

server/engine/reflection/
└── index.ts                    ← IMPORTANT (reflection engine)

server/memory/reflection/
└── reflection-memory-bridge.ts ← OPTIONAL (memory persistence)
```

---

### AGENT 8: Runtime Agent
**Role:** Running processes ko observe karta hai, health monitor karta hai  
**Status:** IMPORTANT  
**Path:** `server/agents/runtime/runtime-agent.ts`

| Property | Detail |
|----------|--------|
| Kaam | Dev server health check, port probing, log watching |
| Integration | `runtimeBridge` via Runtime Manager |
| Monitors | Process health, port availability, stdout/stderr logs |
| Connected to | Crash Responder, Runtime Manager, Observation Controller |
| Importance | **IMPORTANT** — Server alive hai ya nahi yahi track karta hai |

```
server/agents/runtime/
└── runtime-agent.ts    ← IMPORTANT (main file)

server/infrastructure/runtime/
├── runtime-manager.ts  ← IMPORTANT (process management)
└── runtime-store/      ← IMPORTANT (state storage)
    └── runtime-store.ts
```

---

### AGENT 9: Review Agent
**Role:** Code quality, architecture, aur security policies validate karta hai  
**Status:** OPTIONAL (quality gating)  
**Path:** `server/agents/review/review-agent.ts`

| Property | Detail |
|----------|--------|
| Kaam | Code review karta hai — architecture patterns, security issues, code quality |
| Integration | `reviewBridge` |
| Connected to | Orchestration Engine (verify/score phase) |
| Importance | **OPTIONAL** — Quality improvement ke liye, core flow mein blocking nahi |

```
server/agents/review/
└── review-agent.ts     ← OPTIONAL (quality review)
```

---

### AGENT 10: Verifier Agent
**Role:** Overall verification coordinate karta hai (build + tests + runtime)  
**Status:** IMPORTANT  
**Path:** `server/agents/verifier/verifier-agent.ts`

| Property | Detail |
|----------|--------|
| Kaam | Build check + TypeScript check + test run + runtime health = pass/fail |
| Integration | `verificationBridge` |
| Fail-Closed | Verification fail hone par code deploy nahi hota |
| Connected to | Browser Agent, Review Agent, Orchestration (verify phase) |
| Importance | **IMPORTANT** — "Fail-Closed Verification" — broken code deploy hone se rokta hai |

```
server/agents/verifier/
└── verifier-agent.ts   ← IMPORTANT (main file)

server/api/
└── fail-closed.routes.ts ← IMPORTANT (verification API)
```

---

## 4. ORCHESTRATION ENGINE — 9 PHASE PIPELINE

**Main File:** `server/orchestration/core/orchestration-engine.ts`

```
Phase 1: OBSERVE/ANALYZE
  → Goal classify karo, complexity measure karo
  → File: orchestration-engine.ts (analyzeGoal)

Phase 2: PLAN
  → Execution strategy select karo (tool-loop / planned / swarm / quantum)
  → File: execution-router.ts

Phase 3: DECOMPOSE
  → DAG mode mein: goal ko task graph mein toddo
  → File: server/orchestration/swarm/intent-graph-analyzer.ts

Phase 4: ROUTE
  → Execution model decide karo:
     - Tool-Loop  → Direct agent execution
     - Planned    → Supervisor coordinates sequential tasks
     - Swarm      → 4-wave autonomous agent swarm
     - Quantum    → Multiple paths in superposition (experimental)
  → File: server/orchestration/execution/execution-router.ts

Phase 5: EXECUTE
  → Actual code generation / file writing / commands
  → Files: builder-agent.ts, executor-agent.ts, tool-loop

Phase 6: VERIFY
  → Build check + TypeScript + tests + browser screenshot
  → Files: verifier-agent.ts, browser-agent.ts

Phase 7: REFLECT
  → Failure analysis, loop detection, hallucination check
  → File: reflection-agent.ts, reflection-engine

Phase 8: SCORE
  → Quality grade A–F based on tool usage + success metrics
  → File: server/engine/scoring/ (runScoringEngine)

Phase 9: LEARN
  → Successful patterns aur failure fixes ko persist karo
  → File: server/engine/learning/ (runLearningEngine)

FINAL: COMPLETION GATE
  → Output vs original goal ka final validation
  → File: server/engine/completion/ (runCompletionGate)
```

### Execution Modes
| Mode | Kab Use Hota Hai | Speed | Complexity |
|------|-----------------|-------|-----------|
| **Tool-Loop** | Simple tasks (1 file fix) | Fast | Low |
| **Planned** | Medium tasks (multi-file feature) | Medium | Medium |
| **Swarm** | Complex apps (full project build) | Slow | High |
| **Quantum** | Experimental (multi-path exploration) | Variable | Very High |

---

## 5. ALL 49 TOOLS — COMPLETE REGISTRY

**Main File:** `server/tools/registry/tool-catalog.ts`  
**Registry Class:** `server/tools/registry/tool-registry.ts`

### Category: FILE (6 tools) — IMPORTANT
| Tool | Path | Kaam |
|------|------|------|
| `file_list` | `server/tools/categories/file-tools.ts` | Sandbox directory tree list karo |
| `file_read` | `server/tools/categories/file-tools.ts` | File content padho (offset/limit support) |
| `file_write` | `server/tools/categories/file-tools.ts` | File banao ya overwrite karo (diff approval gate se) |
| `file_delete` | `server/tools/categories/file-tools.ts` | File ya directory delete karo |
| `file_search` | `server/tools/categories/file-search-tools.ts` | Regex se files search karo |
| `file_replace` | `server/tools/categories/file-search-tools.ts` | Precise string replace (hamesha approval gate se) |

### Category: SHELL (1 tool) — CRITICAL
| Tool | Path | Kaam |
|------|------|------|
| `shell_exec` | `server/tools/categories/shell-tools.ts` | Allow-listed shell commands run karo (live output stream) |

### Category: PACKAGE (4 tools) — IMPORTANT
| Tool | Path | Kaam |
|------|------|------|
| `package_install` | `server/tools/categories/package-tools.ts` | npm packages install karo |
| `package_uninstall` | `server/tools/categories/package-tools.ts` | npm packages uninstall karo |
| `package_audit` | `server/tools/categories/package-tools.ts` | Security vulnerabilities check karo |
| `detect_missing_packages` | `server/tools/categories/package-tools.ts` | "Cannot find module" errors detect karo |

### Category: SERVER LIFECYCLE (4 tools) — IMPORTANT
| Tool | Path | Kaam |
|------|------|------|
| `server_start` | `server/tools/categories/server-lifecycle-tools.ts` | `npm run dev` start karo |
| `server_stop` | `server/tools/categories/server-lifecycle-tools.ts` | Dev server stop karo |
| `server_restart` | `server/tools/categories/server-lifecycle-tools.ts` | Restart + health verify |
| `server_logs` | `server/tools/categories/server-lifecycle-tools.ts` | Recent stdout/stderr logs lo |

### Category: PREVIEW (2 tools) — IMPORTANT
| Tool | Path | Kaam |
|------|------|------|
| `preview_url` | `server/tools/categories/preview-tools.ts` | Public preview URL lo |
| `preview_screenshot` | `server/tools/categories/preview-tools.ts` | App ka screenshot lo (Puppeteer) |

### Category: ENV (2 tools) — IMPORTANT
| Tool | Path | Kaam |
|------|------|------|
| `env_read` | `server/tools/categories/env-tools.ts` | .env keys list karo (values hidden) |
| `env_write` | `server/tools/categories/env-tools.ts` | .env mein key set karo |

### Category: GIT (6 tools) — IMPORTANT
| Tool | Path | Kaam |
|------|------|------|
| `git_status` | `server/tools/categories/git-tools.ts` | Working tree status (auto-init repo) |
| `git_add` | `server/tools/categories/git-tools.ts` | Files stage karo |
| `git_commit` | `server/tools/categories/git-tools.ts` | Commit banao |
| `git_clone` | `server/tools/categories/git-tools.ts` | Remote repo clone karo |
| `git_push` | `server/tools/categories/git-tools.ts` | Remote push karo |
| `git_pull` | `server/tools/categories/git-tools.ts` | Latest changes pull karo |

### Category: DATABASE (3 tools) — IMPORTANT
| Tool | Path | Kaam |
|------|------|------|
| `db_migrate` | `server/tools/categories/db-tools.ts` | Migrations run karo (Prisma/Drizzle auto-detect) |
| `db_seed` | `server/tools/categories/db-tools.ts` | Seed data populate karo |
| `db_query` | `server/tools/categories/db-tools.ts` | Raw SQL queries (PostgreSQL + Drizzle) |

### Category: DEPLOY (3 tools) — IMPORTANT
| Tool | Path | Kaam |
|------|------|------|
| `deploy_build` | `server/tools/categories/deploy-tools.ts` | Production build (`npm run build`) |
| `deploy_status` | `server/tools/categories/deploy-tools.ts` | Runtime status + port uptime |
| `deploy_typecheck` | `server/tools/categories/deploy-tools.ts` | TypeScript check (`tsc --noEmit`) |

### Category: TESTING (3 tools) — IMPORTANT
| Tool | Path | Kaam |
|------|------|------|
| `test_run` | `server/tools/categories/testing-tools.ts` | Test suite run karo |
| `test_lint` | `server/tools/categories/testing-tools.ts` | ESLint run karo |
| `test_coverage` | `server/tools/categories/testing-tools.ts` | Coverage report |

### Category: BROWSER (3 tools) — IMPORTANT
| Tool | Path | Kaam |
|------|------|------|
| `browser_navigate` | `server/tools/categories/browser-tools.ts` | URL navigate karo + content/screenshot |
| `browser_click` | `server/tools/categories/browser-tools.ts` | CSS selector element click karo |
| `browser_fill` | `server/tools/categories/browser-tools.ts` | Input mein text type karo |

### Category: NETWORK (3 tools) — OPTIONAL
| Tool | Path | Kaam |
|------|------|------|
| `network_fetch` | `server/tools/categories/network-tools.ts` | Server-side HTTP requests |
| `network_port_check` | `server/tools/categories/network-tools.ts` | TCP port open hai check karo |
| `network_dns_lookup` | `server/tools/categories/network-tools.ts` | DNS lookup |

### Category: AUTH (2 tools) — OPTIONAL
| Tool | Path | Kaam |
|------|------|------|
| `auth_scaffold` | `server/tools/categories/auth-tools.ts` | Auth helpers generate karo (JWT/Session/Bcrypt) |
| `auth_audit` | `server/tools/categories/auth-tools.ts` | Auth anti-patterns scan karo |

### Category: AGENT CONTROL (5 tools) — IMPORTANT
| Tool | Path | Kaam |
|------|------|------|
| `agent_wait` | `server/tools/categories/agent-control-tools.ts` | Agent loop pause karo |
| `agent_ask_user` | `server/tools/categories/agent-control-tools.ts` | User se question poochho |
| `agent_emit_event` | `server/tools/categories/agent-control-tools.ts` | Internal event bus pe event emit karo |
| `agent_think` | `server/tools/categories/agent-control-tools.ts` | Internal reasoning log karo |
| `agent_fail` | `server/tools/categories/agent-control-tools.ts` | Run failure ke saath terminate karo |

### Category: MEMORY (2 tools) — IMPORTANT
| Tool | Path | Kaam |
|------|------|------|
| `memory_update` | `server/tools/categories/memory-tools.ts` | Notes persist karo (decisions/progress/failures) |
| `memory_read` | `server/tools/categories/memory-tools.ts` | Persisted project memory padho |

---

## 6. INFRASTRUCTURE SYSTEMS

### Event Bus (Backbone)
```
server/infrastructure/events/
├── event-bus.ts          ← CRITICAL (pub/sub backbone — sab agents isse baat karte hain)
└── subscription-manager.ts ← IMPORTANT (event subscription management)
```

### SSE (Server-Sent Events — Real-time Frontend Updates)
```
server/infrastructure/sse/
└── sse-manager.ts        ← IMPORTANT (frontend ko live updates bhejna)

server/coordination/telemetry/
└── coordination-sse-bridge.ts ← IMPORTANT (41 event types track karta hai)
```

### Runtime Manager
```
server/infrastructure/runtime/
├── runtime-manager.ts    ← CRITICAL (child processes manage karta hai)
├── runtime-store/
│   ├── runtime-store.ts  ← IMPORTANT (state single source of truth)
│   └── runtime-sync.ts   ← IMPORTANT (SSE hydration)
└── network/
    └── port-allocation-authority.ts ← IMPORTANT (port conflicts prevent karta hai)
```

### Recovery System
```
server/infrastructure/recovery/
├── recovery-manager.ts         ← IMPORTANT (failure recovery orchestrate karta hai)
└── recovery-restart-bridge.ts  ← IMPORTANT (crash → restart pipeline)

server/agents/recovery/
└── crash-responder.ts          ← IMPORTANT (process.crashed events handle karta hai)
```

### Memory System
```
server/memory/
├── runtime/
│   └── runtime-memory-collector.ts   ← OPTIONAL (crashes → memory entries)
└── reflection/
    └── reflection-memory-bridge.ts   ← OPTIONAL (reflection findings persist karta hai)
```

### Distributed System (Redis-backed)
```
server/distributed/
├── redis/index.ts              ← IMPORTANT (Redis connection + health)
├── queue/                      ← OPTIONAL (BullMQ task queuing)
├── locks/                      ← IMPORTANT (file write conflicts prevent)
├── events/                     ← IMPORTANT (cross-process event sync)
└── workers/                    ← OPTIONAL (parallel worker pool)

server/orchestration/distributed/
├── parallel-orchestration-fabric.ts ← IMPORTANT (multi-run capacity gate)
└── distributed-orchestration-wiring.ts ← IMPORTANT (Redis systems wire karta hai)
```

### Preview Proxy
```
server/infrastructure/proxy/
└── preview-proxy.ts    ← IMPORTANT (/preview/:projectId/* → child port proxy)
```

### Quantum Lock System
```
server/quantum/locks/
└── index.ts            ← IMPORTANT (file lock manager — concurrent writes prevent)
```

---

## 7. FILE PATH INDEX — IMPORTANT vs OPTIONAL

### CRITICAL FILES (System inke bina start nahi hoga)
```
main.ts                                              ← Entry point
server/tools/registry/tool-catalog.ts               ← All 49 tools registered here
server/tools/registry/tool-registry.ts              ← Tool execution engine
server/orchestration/index.ts                        ← Orchestration boot
server/orchestration/core/orchestration-engine.ts   ← 9-phase pipeline
server/orchestration/registry/orchestrator-hub.ts   ← Agent registry
server/infrastructure/events/event-bus.ts           ← Pub/sub backbone
server/infrastructure/runtime/runtime-manager.ts   ← Process management
server/agents/supervisor/supervisor-agent.ts        ← Task coordinator
server/agents/planner/planner-agent.ts             ← Goal decomposition
server/agents/builder/builder-agent.ts             ← Code generation
server/agents/executor/executor-agent.ts           ← Tool execution
shared/schema.ts                                   ← Database schema
```

### IMPORTANT FILES (Core features inke bina kaam nahi karengi)
```
server/agents/browser/browser-agent.ts            ← Visual validation
server/agents/debugger/debugger-agent.ts          ← Error recovery
server/agents/reflection/reflection-agent.ts      ← Loop prevention
server/agents/runtime/runtime-agent.ts            ← Health monitoring
server/agents/verifier/verifier-agent.ts          ← Fail-closed verification
server/agents/recovery/crash-responder.ts         ← Auto crash recovery
server/infrastructure/sse/sse-manager.ts          ← Real-time updates
server/infrastructure/proxy/preview-proxy.ts      ← App preview
server/infrastructure/recovery/recovery-manager.ts ← Failure recovery
server/orchestration/execution/execution-router.ts ← Mode routing
server/orchestration/swarm/                        ← Swarm execution
server/distributed/redis/index.ts                  ← Distributed backend
server/quantum/locks/index.ts                      ← Concurrent file safety
server/tools/categories/file-tools.ts             ← File operations
server/tools/categories/shell-tools.ts            ← Shell execution
server/tools/categories/git-tools.ts              ← Git operations
server/chat/index.ts                              ← Chat orchestrator (WebSocket)
vite.config.ts                                    ← Frontend build config
```

### OPTIONAL FILES (Advanced features — remove karo toh basic system chalega)
```
server/agents/review/review-agent.ts              ← Code quality review
server/memory/runtime/runtime-memory-collector.ts ← Memory persistence
server/memory/reflection/reflection-memory-bridge.ts ← Reflection memory
server/distributed/queue/                         ← BullMQ (Redis fallback hai)
server/distributed/workers/                       ← Worker pool (in-process fallback)
server/telemetry/index.ts                         ← Run telemetry/analytics
server/engine/scoring/                            ← Quality grading
server/engine/learning/                           ← Pattern learning
server/tools/categories/network-tools.ts          ← Network utilities
server/tools/categories/auth-tools.ts             ← Auth scaffolding
server/tools/categories/testing-tools.ts          ← Test runner
```

---

## 8. DATA FLOW — REQUEST TO RESPONSE

```
1. USER INPUT
   └── "Build me a SaaS dashboard with auth and charts"
        ↓
2. CHAT ORCHESTRATOR (server/chat/index.ts)
   └── WebSocket message receive karta hai
        ↓
3. ORCHESTRATION ENGINE — Phase 1: ANALYZE
   └── Goal complexity: HIGH → Mode: SWARM
        ↓
4. PLANNER AGENT — Phase 2-3: PLAN + DECOMPOSE
   └── TaskGraph generate karta hai:
       [auth-setup] → [db-schema] → [api-routes] → [ui-components] → [charts]
        ↓
5. BUILDER AGENT — Phase 5: EXECUTE
   └── Wave 1 (parallel): auth-setup + db-schema
   └── Wave 2 (parallel): api-routes
   └── Wave 3 (parallel): ui-components + charts
        ↓
6. EXECUTOR AGENT (per task)
   └── file_write("src/auth/index.ts", ...)
   └── shell_exec("npm install next-auth")
   └── db_migrate()
        ↓
7. VERIFIER AGENT — Phase 6: VERIFY
   └── deploy_typecheck() → pass
   └── server_start() → health check pass
   └── browser_navigate(preview_url) → screenshot
        ↓
8. REFLECTION AGENT — Phase 7: REFLECT (if errors)
   └── Error pattern detect karo → fix strategy
   └── Executor ko retry karo
        ↓
9. SCORING ENGINE — Phase 8: SCORE
   └── Grade: A (>90% tools successful, no retries)
        ↓
10. LEARNING ENGINE — Phase 9: LEARN
    └── "SaaS + auth pattern" → memory persist
         ↓
11. SSE BROADCAST
    └── Frontend ko real-time updates: progress, files, logs, screenshot
         ↓
12. USER SEES
    └── Live file tree updates + Console logs + App preview
```

---

## 9. ENVIRONMENT VARIABLES

### Required (Without these — agents won't work)
| Variable | Purpose | Status |
|----------|---------|--------|
| `OPENROUTER_API_KEY` | AI model calls | ⚠️ MISSING — Set karo! |
| `DATABASE_URL` | PostgreSQL connection | ✅ Set (Replit managed) |

### Optional (Features degrade gracefully)
| Variable | Purpose | Default |
|----------|---------|---------|
| `REDIS_URL` | Distributed queue + locks | In-process fallback |
| `LLM_MODEL` | AI model selection | `openai/gpt-oss-120b:free` |
| `LLM_BASE_URL` | AI API base URL | `https://openrouter.ai/api/v1` |
| `AGENT_PROJECT_ROOT` | Sandbox directory | `.sandbox` |
| `AGENT_HTTP_ALLOWED_HOSTS` | HTTP whitelist | `openrouter.ai,api.openai.com` |

### Replit Runtime (Auto-managed)
| Variable | Purpose |
|----------|---------|
| `REPLIT_DOMAINS` | Public domain |
| `REPLIT_DEV_DOMAIN` | Dev domain |
| `REPL_ID` | Repl identifier |
| `SESSION_SECRET` | Session signing |

---

## SUMMARY TABLE — QUICK REFERENCE

| # | Agent | Role | Importance | Main File |
|---|-------|------|-----------|-----------|
| 1 | **Supervisor** | Task routing + coordination | 🔴 CRITICAL | `server/agents/supervisor/supervisor-agent.ts` |
| 2 | **Planner** | Goal → TaskGraph decomposition | 🔴 CRITICAL | `server/agents/planner/planner-agent.ts` |
| 3 | **Builder** | Parallel code generation | 🔴 CRITICAL | `server/agents/builder/builder-agent.ts` |
| 4 | **Executor** | Tool-loop task execution | 🔴 CRITICAL | `server/agents/executor/executor-agent.ts` |
| 5 | **Browser** | Visual UI validation | 🟡 IMPORTANT | `server/agents/browser/browser-agent.ts` |
| 6 | **Debugger** | Error diagnosis + recovery | 🟡 IMPORTANT | `server/agents/debugger/debugger-agent.ts` |
| 7 | **Reflection** | Loop detection + hallucination gate | 🟡 IMPORTANT | `server/agents/reflection/reflection-agent.ts` |
| 8 | **Runtime** | Process health monitoring | 🟡 IMPORTANT | `server/agents/runtime/runtime-agent.ts` |
| 9 | **Review** | Code quality gating | 🟢 OPTIONAL | `server/agents/review/review-agent.ts` |
| 10 | **Verifier** | Fail-closed build verification | 🟡 IMPORTANT | `server/agents/verifier/verifier-agent.ts` |

**Tools Total: 49 | Categories: 15 | Agents: 10 | Orchestration Phases: 9**

---

*Report generated by deep scan of nura-x-deployer codebase*  
*Date: 2025*
