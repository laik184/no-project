# NURA-X — Agents Report
**Generated:** 2025-05-27  
**Location:** `server/agents/`  
**Total Agents:** 6

---

## Quick Reference Table

| # | Agent | Folder | Role | Status |
|---|-------|--------|------|--------|
| 1 | Planner | `server/agents/planner/` | Sochta hai — goal ko tasks mein todhta hai | ✅ Active |
| 2 | Executor | `server/agents/executor/` | Karta hai — tasks step-by-step execute karta hai | ✅ Active |
| 3 | CoderX | `server/agents/coderx/` | Likhta hai — AI se actual code generate karta hai | ✅ Active |
| 4 | Filesystem | `server/agents/filesystem/` | Files/folders manage karta hai sandbox mein | ✅ Active |
| 5 | Supervisor | `server/agents/supervisor/` | Dekhta hai — poori pipeline monitor karta hai | ✅ Active |
| 6 | Terminal | `server/agents/terminal/` | Shell commands, npm, ports, process lifecycle | ✅ Active (Naya) |

---

## Agent 1 — Planner (`server/agents/planner/`)

### Role
User ka high-level goal leta hai aur use structured execution plan mein convert karta hai.

### Kya karta hai
- User ka goal analyze karta hai
- App classify karta hai (frontend-only / fullstack / API-only)
- Architecture plan banata hai (frontend, backend, database, deployment)
- Milestones aur phases mein todta hai
- Complexity estimate karta hai
- Dependency graph banata hai tasks ke beech

### Folder Structure
```
planner/
├── core/
│   ├── planner-engine.ts       ← Main planning logic
│   ├── planning-context.ts     ← Planning ke liye context holder
│   ├── planning-session.ts     ← Session lifecycle manage karta hai
│   └── planning-state.ts       ← Planning state machine
├── analysis/
│   ├── goal-analyzer.ts        ← User ka goal samajhta hai
│   ├── app-classifier.ts       ← App type classify karta hai
│   ├── complexity-estimator.ts ← Kitna kaam lagega estimate karta hai
│   └── requirement-extractor.ts← Requirements nikalta hai goal se
├── architecture/
│   ├── frontend-planner.ts     ← Frontend architecture plan
│   ├── backend-planner.ts      ← Backend architecture plan
│   ├── api-planner.ts          ← API routes plan
│   ├── database-planner.ts     ← Database schema plan
│   └── deployment-planner.ts   ← Deployment plan
├── decomposition/
│   ├── task-breakdown.ts       ← Tasks mein todhna
│   ├── phase-builder.ts        ← Phases banana (init/build/verify)
│   ├── milestone-generator.ts  ← Milestones set karna
│   └── dependency-graph.ts     ← Task dependencies map karna
└── events/
    ├── planner-events.ts       ← Events emit karta hai
    ├── event-types.ts          ← Event type definitions
    └── event-handlers.ts       ← Incoming events handle karta hai
```

### Input / Output
- **Input:** User goal string (e.g. "ek todo app banao with auth")
- **Output:** Structured plan — phases, tasks, dependencies, milestones

### Key Events Emit karta hai
- `planning.started`
- `planning.completed`
- `planning.failed`

---

## Agent 2 — Executor (`server/agents/executor/`)

### Role
Planner ka plan leta hai aur har step ko ek-ek karke execute karta hai.

### Kya karta hai
- Execution queue maintain karta hai
- Har step run karta hai (file write, command run, verify)
- Execution state track karta hai (running/paused/completed/failed)
- Multiple sessions parallel manage karta hai
- Step results collect karta hai

### Folder Structure
```
executor/
├── core/
│   ├── executor-engine.ts      ← Main execution engine
│   ├── execution-context.ts    ← Execution ke liye context
│   ├── execution-session.ts    ← Session lifecycle
│   └── execution-state.ts      ← State machine
├── execution/
│   ├── task-executor.ts        ← Ek task execute karta hai
│   ├── step-runner.ts          ← Ek step run karta hai
│   ├── execution-queue.ts      ← Queue of pending steps
│   └── execution-history.ts    ← Past executions ka record
├── events/
│   ├── executor-events.ts      ← Typed event bus
│   ├── event-types.ts          ← Event definitions
│   └── event-handlers.ts       ← Events handle karna
└── telemetry/
    ├── executor-logger.ts      ← Run-scoped logging
    └── executor-metrics.ts     ← Performance metrics
```

### Input / Output
- **Input:** Execution plan (phases + tasks from Planner)
- **Output:** Step-by-step results, logs, final run status

### Key Events Emit karta hai
- `execution.step.started`
- `execution.step.completed`
- `execution.failed`

---

## Agent 3 — CoderX (`server/agents/coderx/`)

### Role
AI (OpenRouter/GPT) se actual source code generate karta hai.

### Kya karta hai
- LLM ke saath tool-use loop chalata hai
- Frontend, backend, API, auth code generate karta hai
- Code templates use karta hai boilerplate ke liye
- AI ke tool calls dispatch karta hai
- Generated code parse aur validate karta hai

### Folder Structure
```
coderx/
├── llm-loop/
│   ├── tool-loop.ts            ← LLM ↔ Tool loop (prompt → response → tool → repeat)
│   ├── prompt-builder.ts       ← AI ke liye prompt banata hai
│   ├── response-parser.ts      ← AI response parse karta hai
│   ├── tool-dispatcher.ts      ← Tool calls execute karta hai
│   └── tool-registry.ts        ← Available tools register karta hai
├── generators/
│   ├── frontend-generator.ts   ← React components generate karta hai
│   ├── backend-generator.ts    ← Express server generate karta hai
│   ├── api-generator.ts        ← REST API routes generate karta hai
│   └── auth-generator.ts       ← Auth logic generate karta hai
├── templates/
│   ├── react-template.ts       ← React component/page/hook templates
│   ├── express-template.ts     ← Express server/router/middleware templates
│   └── api-template.ts         ← API router/type templates
└── utils/
    └── code-utils.ts           ← Helper functions (toPascalCase, indent, etc.)
```

### Input / Output
- **Input:** Step type (generate_frontend / generate_backend / etc.) + requirements
- **Output:** Generated source code strings

### LLM Connection
- **Provider:** OpenRouter (`https://openrouter.ai/api/v1`)
- **Key:** `OPENROUTER_API_KEY`
- **Model:** `openai/gpt-oss-120b:free` (configurable via `LLM_MODEL`)

---

## Agent 4 — Filesystem (`server/agents/filesystem/`)

### Role
Sandbox ke andar files aur folders ke saare operations safely handle karta hai.

### Kya karta hai
- Files read/write/edit/delete/move/rename/clone karta hai
- Folders create/delete/scan/move/rename karta hai
- File content search karta hai (text, regex, dependency)
- Project scaffold generate karta hai
- Permission check karta hai har operation se pehle
- Path validation — sandbox se bahar jaane se rokta hai

### Folder Structure
```
filesystem/
├── files/
│   ├── file-reader.ts          ← File padhna
│   ├── file-writer.ts          ← File likhna
│   ├── file-editor.ts          ← File edit karna (partial)
│   ├── file-deleter.ts         ← File delete karna
│   ├── file-mover.ts           ← File move karna
│   ├── file-renamer.ts         ← File rename karna
│   ├── file-cloner.ts          ← File copy karna
│   └── patch-file.ts           ← Diff/patch apply karna
├── folders/
│   ├── folder-creator.ts       ← Folder banana
│   ├── folder-reader.ts        ← Folder contents padhna
│   ├── folder-scanner.ts       ← Deep scan karna
│   ├── folder-deleter.ts       ← Folder delete karna
│   ├── folder-mover.ts         ← Folder move karna
│   ├── folder-renamer.ts       ← Folder rename karna
│   ├── folder-cloner.ts        ← Folder copy karna
│   └── folder-structure.ts     ← Tree structure banana
├── search/
│   ├── file-search.ts          ← File naam se search
│   ├── text-search.ts          ← Content text search
│   ├── regex-search.ts         ← Regex pattern search
│   └── dependency-search.ts    ← Import/require search
├── structure/
│   ├── scaffold-generator.ts   ← Project scaffold banana
│   ├── structure-builder.ts    ← Directory structure banana
│   ├── structure-reader.ts     ← Structure padhna
│   ├── structure-patcher.ts    ← Structure update karna
│   └── structure-validator.ts  ← Structure valid hai?
├── permissions/
│   ├── permission-manager.ts   ← Access control
│   ├── access-policy.ts        ← Policy definitions
│   ├── operation-guard.ts      ← Operation block karna
│   └── command-safety.ts       ← Command safety check
└── workspace/
    ├── workspace-manager.ts    ← Workspace root manage karna
    └── isolation-manager.ts    ← RunId ↔ workspace isolation
```

### Security
- Har path check hota hai sandbox ke andar hona chahiye
- Directory traversal (`../../../etc/passwd`) blocked hai
- Permission policies — kaunsa operation allowed hai

---

## Agent 5 — Supervisor (`server/agents/supervisor/`)

### Role
Poori agent pipeline ko upar se monitor karta hai — stuck tasks detect karta hai, retry decisions leta hai, infinite loops rokta hai.

### Kya karta hai
- Running tasks monitor karta hai (timeout, stuck, loop)
- Retry/escalation/failure decisions leta hai
- Goal classify karta hai — simple/complex/parallel execution decide karta hai
- Task coordination handle karta hai (kis agent ko kya dena hai)
- Pipeline phases coordinate karta hai (analyze → plan → execute → verify → browser)

### Folder Structure
```
supervisor/
├── core/
│   ├── supervisor-engine.ts    ← Main supervisor logic
│   ├── supervisor-context.ts   ← Supervisor ka context
│   ├── supervisor-state.ts     ← State machine
│   └── execution-controller.ts ← Phase execution control
├── analysis/
│   ├── goal-classifier.ts      ← Simple/complex/parallel classify karna
│   ├── complexity-analyzer.ts  ← Complexity analyze karna
│   └── execution-mode-detector.ts ← Execution mode detect karna
├── monitoring/
│   ├── execution-monitor.ts    ← Execution health monitor
│   ├── stuck-task-detector.ts  ← Stuck tasks detect karna
│   ├── loop-detector.ts        ← Infinite loop detect karna
│   └── timeout-monitor.ts      ← Timeout check karna
├── decisions/
│   ├── retry-decision.ts       ← Retry karna chahiye?
│   ├── failure-decision.ts     ← Fail karna chahiye?
│   └── escalation-decision.ts  ← Escalate karna chahiye?
├── coordination/
│   ├── task-coordinator.ts     ← Tasks distribute karna
│   ├── pipeline-coordinator.ts ← Pipeline phases coordinate karna
│   └── retry-coordinator.ts    ← Retry logic coordinate karna
└── events/
    ├── supervisor-events.ts    ← Events emit karna
    ├── event-types.ts          ← Event definitions
    └── event-handlers.ts       ← Events handle karna
```

### Pipeline Phases Jo Coordinate Karta Hai
1. Analyze Phase
2. Planning Phase
3. Execution Phase
4. Verification Phase
5. Browser Phase

---

## Agent 6 — Terminal (`server/agents/terminal/`) ← NAYA

### Role
Shell command execution, npm operations, process lifecycle, port management, aur runtime recovery handle karta hai.

### Kya karta hai
- Shell commands safely execute karta hai (whitelist-based, fail-closed)
- Real-time output stream karta hai frontend tak (SSE/event bus)
- npm install / run / build operations handle karta hai
- Processes register, monitor aur kill karta hai
- Ports dynamically allocate aur release karta hai
- Process crashes detect karke auto-recovery karta hai
- Resource usage monitor karta hai (memory, process count)
- Checkpoints create karta hai recovery ke liye

### Folder Structure (14 modules, 65 files)
```
terminal/
├── execution/      ← Shell spawn, command run, timeout, terminate
├── streaming/      ← Real-time output, line parsing, sanitization
├── npm/            ← Install, run scripts, package.json write
├── process/        ← Registry, manager, monitor, history, lifecycle
├── monitoring/     ← Runtime health, failure monitor, resource monitor
├── ports/          ← Port allocation, scanning, release
├── recovery/       ← Crash handling, auto-restart, checkpoints
├── security/       ← Command whitelist, sandbox guard, resource limits
├── validation/     ← Output, execution, exit code validation
├── workspace/      ← Sandbox context, execution context
├── events/         ← Typed event bus (5 event types)
├── telemetry/      ← Logger, metrics, traces, perf tracker
├── types/          ← TypeScript type definitions
└── utils/          ← Helper functions
```

### Security Rules
| Rule | Detail |
|------|--------|
| Command whitelist | npm, npx, node, tsx, tsc, git (read-only), ls, mkdir, echo, cat |
| Blocked patterns | `rm -rf`, `sudo`, `reboot`, `curl\|sh`, `wget\|bash`, `chmod 777`, `eval` |
| Blocked packages | `child_process`, `fs`, `vm`, `cluster`, `worker_threads` |
| Sandbox guard | Har cwd/path sandbox ke andar hona chahiye |
| Shell injection | `shell: false` — koi `/bin/sh -c` nahi |
| Default behavior | BLOCK — sirf explicitly allowed cheezein hi chalti hain |

---

## Pipeline Flow — Sab Saath

```
USER GOAL (string)
        │
        ▼
┌─────────────────┐
│  🧠  PLANNER    │  ← Goal analyze, architecture design, tasks todna
│  (planner/)     │
└────────┬────────┘
         │  planning.completed event
         ▼
┌─────────────────┐
│  👁️  SUPERVISOR │  ← Monitor karo, stuck detect karo, retry decide karo
│  (supervisor/)  │
└────────┬────────┘
         │  task.queued events
         ▼
┌─────────────────┐
│  ⚙️  EXECUTOR   │  ← Step-by-step tasks execute karo
│  (executor/)    │
└────────┬────────┘
         │
    ┌────┴─────────────────────────────┐
    │            │                     │
    ▼            ▼                     ▼
┌────────┐  ┌──────────┐  ┌───────────────────┐
│✍️ CDRX │  │📁 FILESYS│  │ 💻 TERMINAL       │
│CoderX  │  │Filesystem│  │ Shell/npm/Ports    │
│AI code │  │File ops  │  │ Process lifecycle  │
└────────┘  └──────────┘  └───────────────────┘
    │            │                     │
    └────────────┴─────────────────────┘
                 │
                 ▼
          Run Result + Logs
          (SSE → Frontend)
```

---

## Event Bus Communication

Saare agents ek shared **event bus** (`server/infrastructure/events/bus.ts`) use karte hain communicate karne ke liye. Koi bhi agent dusre agent ko directly call nahi karta — events ke zariye baat hoti hai.

| Event | Kaun emit karta hai | Kaun sunta hai |
|-------|---------------------|----------------|
| `planning.started` | Planner | Supervisor |
| `planning.completed` | Planner | Executor, Supervisor |
| `task.queued` | Supervisor | Executor |
| `execution.step.started` | Executor | Terminal, Frontend (SSE) |
| `execution.step.completed` | Executor | Supervisor |
| `execution.failed` | Executor | Supervisor, Recovery |
| `terminal.execution.started` | Terminal | Telemetry |
| `terminal.stream.chunk` | Terminal | Frontend (SSE) |
| `process.crashed` | Terminal | Recovery, Supervisor |

---

## Statistics

| Metric | Value |
|--------|-------|
| Total Agents | 6 |
| Total Files (all agents) | ~180+ |
| Lines of Code (approx) | ~8,000+ |
| Event Types | 20+ |
| Newest Agent | Terminal (65 files, 14 modules) |
| Most Complex | Filesystem (30+ files, 5 sub-systems) |
| AI-Powered | CoderX (LLM tool loop) |
