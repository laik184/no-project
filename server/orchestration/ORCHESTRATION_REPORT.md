# 📁 server/orchestration/ — Refactored Architecture Report

> **Architecture Version:** Simplified Production-Grade (Post-Refactor ✅ LIVE)
> **Updated:** 26 May 2026
> **Server Status:** ✅ Running — Zero import errors
> **Design Philosophy:** Simple > Clever | Stability > Features | Debuggability > AI Magic

---

## 📂 Final Folder Structure (Actual)

```
server/orchestration/
│
├── index.ts                          ← Main entry point (server startup wiring)
│
├── core/
│   ├── orchestrator.ts               ← Master controller (run start/stop)
│   ├── execution-engine.ts           ← Phase-by-phase pipeline executor
│   ├── run-manager.ts                ← ⭐ MERGED: state + lifecycle + transitions
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
│   ├── queue-worker.ts               ← Worker that processes queued tasks
│   └── priority-manager.ts           ← Task priority scoring & ranking
│
├── routing/
│   ├── agent-router.ts               ← Routes tasks to correct agent by phase
│   └── retry-router.ts               ← Routes failed tasks for retry/cooldown
│
├── retry/
│   ├── retry-manager.ts              ← Retry loop with exponential backoff
│   ├── failure-handler.ts            ← Error classifier (network/LLM/build etc.)
│   └── backoff-strategy.ts           ← Exponential backoff delay calculator
│
├── events/
│   ├── event-types.ts                ← All event/payload TypeScript types
│   ├── orchestration-events.ts       ← Typed EventEmitter + emit helpers
│   └── event-handlers.ts             ← Event listeners (logging, metrics)
│
├── telemetry/
│   ├── run-logger.ts                 ← Per-run structured log store
│   ├── metrics.ts                    ← Per-run + global counters + span stubs
│   └── performance-monitor.ts        ← Memory/CPU interval monitor
│
├── utils/
│   ├── orchestration-helpers.ts      ← Pure helpers (IDs, labels, timing)
│   ├── execution-utils.ts            ← Async utils (timeout, retry, concurrency)
│   └── validators.ts                 ← Zod schemas for input validation
│
├── agents/
│   └── verification-bridge.ts        ← [BRIDGE] DAG verify-node interface
│
└── execution/
    └── execution-result-registry.ts  ← [BRIDGE] Run result/stats storage

Total: 30 files
```

---

## ✅ Kya Kiya Gaya (Refactor Summary)

### 🔀 MERGE (3 → 1)

| Purani Files (DELETED) | Naya File |
|---|---|
| `core/state-manager.ts` | → |
| `core/orchestration-state.ts` | → **`core/run-manager.ts`** ✅ |
| `core/lifecycle-manager.ts` | → |

**`run-manager.ts` ab ye sab handle karta hai:**
- Run state (`pending → running → completed/failed/cancelled`)
- Invalid transitions block karna
- Phase history tracking
- Active run IDs
- Duration calculation
- Terminal state detection

---

### 🗑️ DELETED FILES (7 files removed)

| File | Reason |
|---|---|
| `core/state-manager.ts` | `run-manager.ts` mein merge |
| `core/orchestration-state.ts` | `run-manager.ts` mein merge |
| `core/lifecycle-manager.ts` | `run-manager.ts` mein merge |
| `distributed/index.ts` + folder | Single-process architecture kaafi hai |
| `swarm/intent-graph/` + folder | MVP mein instability badhata hai |
| `routing/task-router.ts` | Queue system pehle se ordering handle karta hai |
| `telemetry/orchestration-trace.ts` | MVP stage mein unnecessary |
| `telemetry/orchestration-metrics.ts` | `metrics.ts` mein consolidate kiya |

---

### 🛠️ FIXED IMPORTS (Existing codebase)

Yeh files existing codebase ki thi — inke broken imports fix kiye:

| File | Fix |
|---|---|
| `server/quantum/` (11 files) | `orchestration-metrics.ts` → `metrics.ts` |
| `server/quantum/aggregation/` (2 files) | `orchestration-trace.ts` → `metrics.ts` stubs |
| `server/engine/swarm/swarm-lifecycle-manager.ts` | `orchestration-metrics.ts` → `metrics.ts` |
| `server/infrastructure/memory/run-cleanup-manager.ts` | `clearState()` → `runManager.clear()` |
| `main.ts` | `parallelOrchestrationFabric` import + calls removed |

---

## 📋 File-by-File Report

---

### 🔑 index.ts
**Kya karta hai:**
Server ka main entry point. `main.ts` yahan se sirf do cheezein import karta hai:
- `initOrchestration()` → orchestrator start karta hai, performance monitor shuru karta hai
- `createOrchestrationRouter()` → 6 REST endpoints expose karta hai (`/runs`, `/runs/:id`, `/runs/:id/logs`, `/runs/:id/metrics`, `/active`, `/health`)

---

### 📂 core/

#### `orchestrator.ts`
**Kya karta hai:**
Poore system ka **master controller** — sirf coordinate karta hai, code generate nahi karta.
- `startRun(input)` → run-manager se run create karta hai, pipeline trigger karta hai
- Success/failure par events emit karta hai
- `getActiveRuns()` / `getRunStatus()` expose karta hai

#### `execution-engine.ts`
**Kya karta hai:**
Pipeline ko **phase-by-phase** execute karta hai.
- Har phase ka timeout handle karta hai
- Agar koi phase fail ho toh baki phases skip karta hai
- Metrics aur logs har phase par emit karta hai

#### `run-manager.ts` ⭐ NEW MERGED FILE
**Kya karta hai:**
**Teen purani files ka ek replacement.** Sab kuch ek jagah:
- `create(runId)` → naya run register karta hai (`pending` state se)
- `transition(runId, status)` → state change karta hai, invalid transitions throw karta hai
- `setPhase(runId, phase)` → current phase aur phase history update karta hai
- `setError()` / `setMeta()` → error aur metadata store karta hai
- `isTerminal()` / `isRunning()` → run status check karta hai
- `getActiveRuns()` → sab non-terminal runs ki list
- `clear(runId)` → run cleanup par memory free karta hai

#### `orchestration-context.ts`
**Kya karta hai:**
Har run ka context (projectId, goal, metadata) memory mein store karta hai.
- `createContext()`, `getContext()`, `clearContext()` provide karta hai

#### `orchestration-replay.ts`
**Kya karta hai:**
Run checkpoints save/restore karta hai.
- `saveCheckpoint()` → phase snapshot save karta hai
- `replayFromCheckpoint()` → crash ke baad specific phase se restart possible
- `clearCheckpoints()` → run cleanup mein use hota hai

---

### 📂 pipeline/

#### `analyze-phase.ts` (Phase 1)
Goal analyze karta hai — complexity score (0–100), execution mode (`simple/standard/complex`), tags extract karta hai.

#### `planning-phase.ts` (Phase 2)
Task plan banata hai — dependencies validate karta hai, `ExecutionPlan` return karta hai.

#### `execution-phase.ts` (Phase 3)
Tasks execute karta hai dependency order mein — progress % track karta hai.

#### `verification-phase.ts` (Phase 4)
Build checks run karta hai — `tsc --noEmit`, `npm run build`. Fail-closed design.

#### `browser-phase.ts` (Phase 5)
Browser se UI validate karta hai — server reachable? screenshot? accessibility?

---

### 📂 queue/

#### `task-queue.ts`
Priority-based task queue — `enqueue()` / `dequeue()` / stats.

#### `queue-worker.ts`
Queue se tasks process karta hai — concurrency limit, graceful shutdown.

#### `priority-manager.ts`
Task priority decide karta hai — type-based scoring, age-based boost.

---

### 📂 routing/

#### `agent-router.ts`
Phase ke basis par sahi agent select karta hai (`analyze` → analyzer, `execution` → executor etc.)

#### `retry-router.ts`
Failed tasks ko retry ke liye route karta hai — max retries check, cooldown support.

---

### 📂 retry/

#### `retry-manager.ts`
Retry loop manage karta hai exponential backoff se. Per-task retry records track karta hai.

#### `failure-handler.ts`
Errors classify karta hai (`timeout`, `network`, `llm`, `build`, `runtime`, `validation`). Recoverable vs non-recoverable decide karta hai.

#### `backoff-strategy.ts`
Retry delay calculate karta hai — `baseDelay × 2^(attempt-1)` + jitter.

---

### 📂 events/

#### `event-types.ts`
Poore system ke TypeScript types — `OrchestrationPhase`, `OrchestrationStatus`, `TaskPriority`, `TaskPayload`, `PhaseResult`.

#### `orchestration-events.ts`
Typed EventEmitter + `emitRunStarted()`, `emitRunFailed()`, `emitPhaseCompleted()` helpers.

#### `event-handlers.ts`
Event listeners — run events → logger, phase events → timing metrics.

---

### 📂 telemetry/

#### `run-logger.ts`
Per-run structured logs (max 1000 entries). `exportLogs()` → plain text export.

#### `metrics.ts` ⭐ ENHANCED
**Ab teen cheezein handle karta hai:**
1. **Per-run metrics** → `metricsCollector.increment(runId, metric)` / `timing()`
2. **Global counters** → `incrementCounter(metric)` — quantum/engine files is se use karte hain
3. **Span stubs** → `recordSpanStart()` / `recordSpanEnd()` / `addSpanEvent()` — quantum aggregation ke liye

#### `performance-monitor.ts`
Har 15s par memory usage check karta hai. Threshold breach par warning emit karta hai.

---

### 📂 utils/

#### `orchestration-helpers.ts`
Pure helpers — `generateRunId()`, `formatDuration()`, `elapsed()`, `phaseLabel()`.

#### `execution-utils.ts`
Async utilities — `withTimeout()`, `sleep()`, `retryFixed()`, `runConcurrent()`, `timed()`.

#### `validators.ts`
Zod-based input validation — `validateStartRun()`, `validateContext()`, `validateTask()`.

---

### 📂 agents/ (Bridge)

#### `verification-bridge.ts`
DAG verify-node ke liye interface. `VerificationCheck` type + `verificationBridge.verify()` method. `dag-verify-executor.ts` is se connect hai.

### 📂 execution/ (Bridge)

#### `execution-result-registry.ts`
Run stats storage — `storeExecutionStats()`, `getRecentRuns()`, `getSuccessRate()`. `tool-loop.executor.ts` is se connect hai.

---

## 🔄 Clean Execution Flow

```
User Request
     │
     ▼
orchestrator.startRun(input)
     │
     ├── runManager.create(runId)        ← state: pending
     ├── runManager.transition('running') ← state: running
     │
     ▼
execution-engine.execute(ctx)
     │
     ├── analyze-phase.ts   ←── Phase 1: Goal analysis
     ├── planning-phase.ts  ←── Phase 2: Task planning
     ├── execution-phase.ts ←── Phase 3: Code execution
     ├── verification-phase.ts ←── Phase 4: Build check
     └── browser-phase.ts   ←── Phase 5: UI validation
          │
          ▼
     runManager.transition('completed' | 'failed')
          │
          ▼
     events emit → telemetry record → logs flush
```

---

## 📦 Recommended Import Structure

```typescript
// Core
import { orchestrator }  from './core/orchestrator'
import { runManager }    from './core/run-manager'

// Events
import { orchestrationBus, emitRunStarted } from './events/orchestration-events'
import type { OrchestrationPhase, TaskPayload } from './events/event-types'

// Telemetry
import { runLogger }        from './telemetry/run-logger'
import { metricsCollector, incrementCounter } from './telemetry/metrics'

// Utils
import { generateRunId, formatDuration } from './utils/orchestration-helpers'
import { withTimeout, sleep }            from './utils/execution-utils'
import { validateStartRun }              from './utils/validators'
```

---

## 🚀 Future-Safe Scaling Strategy

| Stage | Kya Add Karein |
|---|---|
| **Ab (MVP)** | Current 30-file single-process architecture |
| **Stage 2** | Redis queue — jab concurrent runs 5/min se zyada ho jaayein |
| **Stage 3** | Worker threads — jab single-thread CPU bottleneck bane |
| **Stage 4** | Distributed runs — jab multi-server deployment zaroorat ho |
| **Kabhi Nahi** | Swarm, quantum routing, recursive agents, consensus systems |

---

## ⚠️ Architecture Anti-Patterns (Avoid Karo)

1. **Over-abstraction** — Har kaam ke liye alag class mat banao
2. **Premature distribution** — Redis/workers tabhi add karo jab zaroorat prove ho jaaye
3. **Swarm/recursive agents** — MVP mein instability badhate hain, value nahi
4. **Silent failures** — Har error explicit throw ya emit honi chahiye
5. **God objects** — Orchestrator sirf coordinate kare, code generate nahi kare
6. **Deep import chains** — Circular dependencies avoid karo

---

## 📊 Final Summary

| Folder | Files | Kaam |
|--------|-------|------|
| `core/` | 5 | Run lifecycle, state (merged), context, replay |
| `pipeline/` | 5 | 5 execution phases |
| `telemetry/` | 3 | Logging, metrics (enhanced), monitoring |
| `events/` | 3 | Event types, bus, handlers |
| `retry/` | 3 | Retry logic, failure classification, backoff |
| `queue/` | 3 | Task queue, worker, priority |
| `routing/` | 2 | Agent routing + retry routing |
| `utils/` | 3 | Helpers, async utils, validators |
| `agents/` | 1 | Verification bridge (DAG bridge) |
| `execution/` | 1 | Result registry (tool-loop bridge) |
| Root | 1 | index.ts |
| **Total** | **30** | **Clean, production-ready** |

---

> **Server Status:** ✅ Running with zero errors
> **Files deleted:** 8 (distributed, swarm, 3 state files, task-router, 2 telemetry files)
> **Files merged:** 3 → 1 (run-manager.ts)
> **Import errors fixed:** 15 files across quantum, engine, infrastructure modules
