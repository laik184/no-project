# 📁 server/orchestration/ — Refactored Architecture Report

> **Architecture Version:** Simplified Production-Grade (Post-Refactor)
> **Updated:** 26 May 2026
> **Design Philosophy:** Simple > Clever | Stability > Features | Debuggability > AI Magic

---

## 📂 Target Folder Structure (Simplified)

```
server/orchestration/
│
├── index.ts                          ← Main entry point (server startup wiring)
│
├── core/
│   ├── orchestrator.ts               ← Master controller (run start/stop)
│   ├── execution-engine.ts           ← Phase-by-phase pipeline executor
│   ├── run-manager.ts                ← Run state + lifecycle + transitions (MERGED)
│   ├── orchestration-context.ts      ← Per-run context store (projectId, goal)
│   └── orchestration-replay.ts       ← Checkpoint save/restore for replay
│
├── pipeline/
│   ├── analyze-phase.ts              ← Phase 1: Goal analysis & complexity
│   ├── planning-phase.ts             ← Phase 2: Task plan generation
│   ├── execution-phase.ts            ← Phase 3: Task execution loop
│   ├── verification-phase.ts         ← Phase 4: TypeScript + build checks
│   └── browser-phase.ts             ← Phase 5: Browser/UI validation
│
├── queue/
│   ├── task-queue.ts                 ← Priority task queue (enqueue/dequeue)
│   └── queue-worker.ts               ← Worker that processes queued tasks
│
├── routing/
│   ├── agent-router.ts               ← Routes tasks to correct agent by phase
│   └── retry-router.ts               ← Routes failed tasks for retry/cooldown
│
├── retry/
│   ├── retry-manager.ts              ← Retry loop with backoff
│   ├── failure-handler.ts            ← Error classifier (network/LLM/build etc.)
│   └── backoff-strategy.ts           ← Exponential backoff delay calculator
│
├── telemetry/
│   ├── run-logger.ts                 ← Per-run structured log store
│   ├── metrics.ts                    ← Counters, timings, snapshots
│   └── performance-monitor.ts        ← Memory/CPU interval monitor
│
├── events/
│   ├── event-types.ts                ← All event/payload TypeScript types
│   ├── orchestration-events.ts       ← Typed EventEmitter + emit helpers
│   └── event-handlers.ts             ← Event listeners (logging, metrics)
│
└── utils/
    ├── orchestration-helpers.ts      ← Pure helpers (IDs, labels, timing)
    ├── execution-utils.ts            ← Async utils (timeout, retry, concurrency)
    └── validators.ts                 ← Zod schemas for input validation
```

**Total: 28 files** (clean, lean, production-ready)

---

## 📋 File-by-File Report (Hindi)

---

### 🔑 index.ts
**Kya karta hai:**
Server ka main entry point. `main.ts` yahan se sirf do cheezein import karta hai:
- `initOrchestration()` → sab kuch start karta hai (orchestrator, queue, events, monitor)
- `createOrchestrationRouter()` → `/api/orchestration/` ke REST endpoints expose karta hai

---

### 📂 core/

#### `orchestrator.ts`
**Kya karta hai:**
Poore system ka **master controller**. Ek run start karne ka single entry point.
- `startRun(input)` → context banata hai, run-manager initialize karta hai, pipeline trigger karta hai
- Success/failure par events emit karta hai
- Code generate nahi karta, business logic nahi rakhta — sirf coordinate karta hai

#### `execution-engine.ts`
**Kya karta hai:**
Pipeline ko **phase-by-phase** execute karta hai (analyze → plan → execute → verify → browser).
- Har phase ka timeout handle karta hai
- Agar koi phase fail ho toh baki phases skip karta hai
- Metrics aur logs har phase par emit karta hai

#### `run-manager.ts` ⭐ MERGED FILE
**Kya karta hai:**
Teen purani files (`state-manager.ts`, `orchestration-state.ts`, `lifecycle-manager.ts`) ko **ek jagah merge** kiya gaya hai.

Responsibilities:
- Run ki current state track karna (`pending → running → completed/failed`)
- Invalid transitions block karna (e.g. `completed → running` possible nahi)
- Phase history store karna
- Active run IDs expose karna
- Run duration calculate karna
- Terminal states detect karna (`completed`, `failed`, `cancelled`)

**Kyun merge kiya:**
Teeno files ek hi kaam kar rahi thi — overlapping responsibility system ko complex bana rahi thi. Ek file mein consolidate karne se debugging simple ho gayi.

#### `orchestration-context.ts`
**Kya karta hai:**
Har run ka context (projectId, goal, metadata) memory mein store karta hai.
- `createContext()`, `getContext()`, `clearContext()` provide karta hai
- Run khatam hone par context cleanup karta hai

#### `orchestration-replay.ts`
**Kya karta hai:**
Run checkpoints save/restore karta hai.
- `saveCheckpoint()` → phase snapshot save karta hai
- `replayFromCheckpoint()` → crash ke baad specific phase se restart possible
- `clearCheckpoints()` → run cleanup mein use hota hai

---

### 📂 pipeline/

#### `analyze-phase.ts` (Phase 1)
**Kya karta hai:**
User ke goal ko analyze karta hai.
- Complexity score (0–100) calculate karta hai
- Execution mode decide karta hai: `simple` / `standard` / `complex`
- Tags extract karta hai (auth, database, crud etc.)

#### `planning-phase.ts` (Phase 2)
**Kya karta hai:**
Execution plan banata hai.
- Analysis result se tasks generate karta hai
- Task dependencies validate karta hai (circular dependency check)
- `ExecutionPlan` return karta hai estimated duration ke saath

#### `execution-phase.ts` (Phase 3)
**Kya karta hai:**
Tasks execute karta hai dependency order mein.
- Har task ke liye events emit karta hai (started/completed/failed)
- Progress percentage track karta hai
- Failed task count return karta hai

#### `verification-phase.ts` (Phase 4)
**Kya karta hai:**
Build verification run karta hai.
- TypeScript check: `tsc --noEmit`
- Build check: `npm run build`
- Fail-closed: koi bhi check fail → phase failed mark hota hai

#### `browser-phase.ts` (Phase 5)
**Kya karta hai:**
Browser se UI validate karta hai.
- Preview URL probe karta hai (server reachable?)
- Screenshot aur accessibility checks report karta hai

---

### 📂 queue/

#### `task-queue.ts`
**Kya karta hai:**
Priority-based task queue.
- `enqueue()` → task add, priority weight se sort
- `dequeue()` → highest priority task nikalta hai
- Stats expose karta hai (total enqueued/dequeued)

#### `queue-worker.ts`
**Kya karta hai:**
Queue se tasks process karta hai.
- Task type ke basis par registered handler call karta hai
- Concurrency limit enforce karta hai
- Graceful shutdown support karta hai

---

### 📂 routing/

#### `agent-router.ts`
**Kya karta hai:**
Phase ke basis par sahi agent select karta hai.
- `analyze` → analyzer agent
- `planning` → planner agent
- `execution` → executor agent
- `verification` → verifier agent
- `browser` → browser agent

#### `retry-router.ts`
**Kya karta hai:**
Failed tasks ko retry ke liye route karta hai.
- Max retries (5) check karta hai
- Hard failures (401/403/404) skip karta hai
- Cooldown period support karta hai

---

### 📂 retry/

#### `retry-manager.ts`
**Kya karta hai:**
Retry loop manage karta hai.
- Max attempts tak retry karta hai exponential backoff se
- Per-task retry records track karta hai

#### `failure-handler.ts`
**Kya karta hai:**
Errors classify karta hai.
- Categories: `timeout`, `network`, `llm`, `build`, `runtime`, `validation`, `unknown`
- Recoverable vs non-recoverable decide karta hai

#### `backoff-strategy.ts`
**Kya karta hai:**
Retry delay calculate karta hai.
- Exponential backoff: `baseDelay × 2^(attempt-1)`
- Jitter support: random delay flood prevent karta hai

---

### 📂 telemetry/

#### `run-logger.ts`
**Kya karta hai:**
Per-run structured logs store karta hai.
- `log(runId, level, message, meta)` → log entry add karta hai
- Max 1000 entries per run
- `exportLogs()` → plain text log file export

#### `metrics.ts`
**Kya karta hai:**
Per-run metrics collect karta hai.
- Counters: `increment(runId, metric)`
- Timings: `timing(runId, metric, ms)`
- `getSnapshot()` → poori run ki metrics summary

#### `performance-monitor.ts`
**Kya karta hai:**
System-level resource monitor.
- Har 15s par memory usage check karta hai
- Threshold breach par warning emit karta hai
- Active run count track karta hai

---

### 📂 events/

#### `event-types.ts`
**Kya karta hai:**
Poore orchestration system ke TypeScript types define karta hai.
- `OrchestrationPhase`, `OrchestrationStatus`, `TaskPriority` enums
- `TaskPayload`, `PhaseResult`, `FailurePayload` interfaces

#### `orchestration-events.ts`
**Kya karta hai:**
Typed EventEmitter + convenience emit functions.
- `orchestrationBus` → global event bus
- `emitRunStarted()`, `emitRunFailed()`, `emitPhaseCompleted()` helpers
- Max 50 listeners (memory leak prevention)

#### `event-handlers.ts`
**Kya karta hai:**
Event listeners register karta hai orchestration bus par.
- Run started/completed/failed → logger mein entry
- Phase completed → timing metrics record
- Task failed → warn log + counter increment

---

### 📂 utils/

#### `orchestration-helpers.ts`
**Kya karta hai:**
Pure helper functions.
- `generateRunId()` / `generateTaskId()` → unique IDs
- `formatDuration()` → ms → "2m 30s"
- `isTimedOut()`, `elapsed()`, `phaseLabel()`, `runTag()`

#### `execution-utils.ts`
**Kya karta hai:**
Async execution utilities.
- `withTimeout(fn, ms)` → timeout wala promise wrapper
- `sleep(ms)` → async delay
- `retryFixed()` → simple fixed-delay retry
- `runConcurrent()` → concurrency-limited parallel execution
- `timed()` → execution time measure karta hai

#### `validators.ts`
**Kya karta hai:**
Zod-based input validation.
- `validateStartRun()` → API input validate karta hai
- `validateContext()` / `validateTask()` → runtime type safety
- `isValidRunId()` → run ID format check

---

## 🗑️ Files to Delete (Refactor Mein Remove Karne Wale)

| File | Reason |
|------|--------|
| `core/state-manager.ts` | `run-manager.ts` mein merge ho gaya |
| `core/orchestration-state.ts` | `run-manager.ts` mein merge ho gaya |
| `core/lifecycle-manager.ts` | `run-manager.ts` mein merge ho gaya |
| `distributed/index.ts` | Single-process architecture mein zaroorat nahi |
| `agents/verification-bridge.ts` | `verification-phase.ts` directly handle karta hai |
| `execution/execution-result-registry.ts` | Run state + logs kaafi hain |
| `routing/task-router.ts` | Queue system pehle se handle karta hai |
| `telemetry/orchestration-trace.ts` | MVP stage mein unnecessary complexity |
| `telemetry/orchestration-metrics.ts` | `metrics.ts` kaafi hai |
| `swarm/intent-graph/intent-graph-types.ts` | Swarm system remove ho raha hai |

**Total removed: 10 files**

---

## 🔗 Merge Summary

| Purane Files (3) | Naya File (1) |
|---|---|
| `state-manager.ts` | → `run-manager.ts` |
| `orchestration-state.ts` | → `run-manager.ts` |
| `lifecycle-manager.ts` | → `run-manager.ts` |

---

## 🔄 Clean Execution Flow

```
User Request
     │
     ▼
orchestrator.startRun(input)
     │
     ▼
run-manager.createRun()     ←── state: pending
     │
     ▼
execution-engine.execute()
     │
     ├── analyze-phase.ts   ←── Phase 1: Goal analysis
     ├── planning-phase.ts  ←── Phase 2: Task planning
     ├── execution-phase.ts ←── Phase 3: Code execution
     ├── verification-phase.ts ←── Phase 4: Build check
     └── browser-phase.ts   ←── Phase 5: UI validation
          │
          ▼
     run-manager.completeRun()  ←── state: completed/failed
          │
          ▼
     events emit → telemetry record → logs flush
```

---

## 📦 Recommended Import Structure

```typescript
// Core
import { orchestrator } from './core/orchestrator'
import { executionEngine } from './core/execution-engine'
import { runManager } from './core/run-manager'

// Events
import { orchestrationBus, emitRunStarted } from './events/orchestration-events'
import type { OrchestrationPhase, TaskPayload } from './events/event-types'

// Telemetry
import { runLogger } from './telemetry/run-logger'
import { metrics } from './telemetry/metrics'

// Utils
import { generateRunId, formatDuration } from './utils/orchestration-helpers'
import { withTimeout, sleep } from './utils/execution-utils'
import { validateStartRun } from './utils/validators'
```

---

## 🚀 Future-Safe Scaling Strategy

| Stage | What to Add |
|---|---|
| **Now (MVP)** | Current 28-file single-process architecture |
| **Stage 2** | Add Redis queue when concurrent runs exceed 5/min |
| **Stage 3** | Add worker threads when single-thread CPU becomes bottleneck |
| **Stage 4** | Add distributed runs when multi-server deployment needed |
| **Never** | Swarm, quantum routing, recursive agents, consensus systems |

---

## ⚠️ Architecture Anti-Patterns to Avoid

1. **Over-abstraction** — Har kaam ke liye alag class mat banao
2. **Premature distribution** — Redis/workers tabhi add karo jab zaroorat prove ho jaaye
3. **Swarm/recursive agents** — MVP mein instability badhate hain, value nahi
4. **Silent failures** — Har error explicit throw ya emit honi chahiye
5. **God objects** — Orchestrator sirf coordinate kare, code generate nahi kare
6. **Deep import chains** — Circular dependencies avoid karo

---

## 📊 Final Summary Table

| Folder | Files | Kaam |
|--------|-------|------|
| `core/` | 5 | Run lifecycle, state, context, replay |
| `pipeline/` | 5 | 5 execution phases |
| `telemetry/` | 3 | Logging, metrics, monitoring |
| `events/` | 3 | Event types, bus, handlers |
| `retry/` | 3 | Retry logic, failure classification, backoff |
| `queue/` | 2 | Task queue + worker |
| `routing/` | 2 | Agent routing + retry routing |
| `utils/` | 3 | Helpers, async utils, validators |
| Root | 1 | index.ts (entry point) |
| **Total** | **27 files** | **Lean, production-ready orchestration** |

---

> **Design Principle:**
> Is architecture ka goal hai: ek developer 10 minute mein poora system samajh sake.
> Jab bhi koi naya feature add karna ho — pehle socho: "Kya yeh SIMPLE rakhega ya complex?"
