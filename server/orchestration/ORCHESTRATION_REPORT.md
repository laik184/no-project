# 📁 server/orchestration/ — Full Structure & Report

---

## 📂 Folder Structure

```
server/orchestration/
│
├── index.ts                          ← Main entry point (server startup)
│
├── agents/
│   └── verification-bridge.ts        ← Build/TypeScript verification runner
│
├── core/
│   ├── orchestrator.ts               ← Master controller (run start/stop)
│   ├── execution-engine.ts           ← Pipeline phase executor
│   ├── state-manager.ts              ← Run state tracking (pending/running/done)
│   ├── lifecycle-manager.ts          ← Run lifecycle (idle→running→completed)
│   ├── orchestration-context.ts      ← Per-run context store (projectId, goal)
│   ├── orchestration-state.ts        ← Phase/status key-value state store
│   └── orchestration-replay.ts       ← Checkpoint save/restore for replay
│
├── distributed/
│   └── index.ts                      ← Parallel run fabric (multi-run capacity)
│
├── events/
│   ├── event-types.ts                ← All event/payload TypeScript types
│   ├── orchestration-events.ts       ← Typed EventEmitter + emit helpers
│   └── event-handlers.ts             ← Event listeners (logging, metrics)
│
├── execution/
│   └── execution-result-registry.ts  ← Run result/stats storage
│
├── pipeline/
│   ├── analyze-phase.ts              ← Phase 1: Goal analysis & complexity scoring
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
├── retry/
│   ├── retry-manager.ts              ← Retry loop with backoff
│   ├── failure-handler.ts            ← Error classifier (network/LLM/build etc.)
│   └── backoff-strategy.ts           ← Exponential backoff delay calculator
│
├── routing/
│   ├── agent-router.ts               ← Routes tasks to correct agent by phase
│   ├── task-router.ts                ← Routes tasks into priority queues
│   └── retry-router.ts               ← Routes failed tasks for retry/cooldown
│
├── swarm/
│   └── intent-graph/
│       └── intent-graph-types.ts     ← IntentGraph/IntentNode type definitions
│
├── telemetry/
│   ├── run-logger.ts                 ← Per-run structured log store
│   ├── metrics.ts                    ← Counters, timings, snapshots
│   ├── performance-monitor.ts        ← Memory/CPU interval monitor
│   ├── orchestration-metrics.ts      ← Global incrementCounter/recordDuration
│   └── orchestration-trace.ts        ← Span-based tracing (start/end/events)
│
└── utils/
    ├── orchestration-helpers.ts      ← Pure helpers (IDs, labels, timing)
    ├── execution-utils.ts            ← Async utils (timeout, retry, concurrency)
    └── validators.ts                 ← Zod schemas for input validation
```

---

## 📋 File-by-File Report

---

### 🔑 index.ts
**Kya karta hai:**
Server ka main entry point. `main.ts` yahan se `initOrchestration()` aur `createOrchestrationRouter()` import karta hai.
- `initOrchestration()` → orchestrator, DAG executors, distributed wiring, performance monitor sab start karta hai
- `createOrchestrationRouter()` → `/api/orchestration/` ke REST endpoints banata hai (run start, status, logs, metrics)

---

### 📂 agents/

#### `verification-bridge.ts`
**Kya karta hai:**
TypeScript aur build verification run karta hai shell commands se.
- `verificationBridge.verify()` → `tsc --noEmit` aur `npm run build` run karta hai
- DAG engine ke verify-nodes is se directly connect hain
- Fail-closed: koi bhi check fail ho toh error return karta hai, silent pass nahi

---

### 📂 core/

#### `orchestrator.ts`
**Kya karta hai:**
Poore system ka master controller. Ek run start karne ka single entry point.
- `startRun(input)` → context banata hai, state/lifecycle initialize karta hai, pipeline execute karta hai
- Success/failure par events emit karta hai
- Performance monitor se run count track karta hai

#### `execution-engine.ts`
**Kya karta hai:**
Pipeline ko phase-by-phase execute karta hai.
- Har phase ko register karta hai (analyze → planning → execution → verification)
- Har phase ka timeout handle karta hai
- Agar koi phase fail ho toh baki phases skip karta hai
- Metrics aur logs har phase par emit karta hai

#### `state-manager.ts`
**Kya karta hai:**
Har run ki state track karta hai (pending/running/completed/failed/cancelled).
- Invalid transitions block karta hai (e.g. completed → running possible nahi)
- Phase history store karta hai
- State snapshots expose karta hai

#### `lifecycle-manager.ts`
**Kya karta hai:**
Run ka lifecycle manage karta hai enum states se (idle → starting → running → completing → completed/failed).
- Run duration calculate karta hai
- Terminal states (completed/failed/cancelled) detect karta hai
- Active run IDs expose karta hai

#### `orchestration-context.ts`
**Kya karta hai:**
Har run ka context (projectId, goal, metadata) memory mein store karta hai.
- `createContext()`, `getContext()`, `clearContext()` provide karta hai
- Cleanup manager is se context delete karta hai run khatam hone par

#### `orchestration-state.ts`
**Kya karta hai:**
Simple key-value state store har run ke liye.
- Phase aur status string store karta hai
- `clearState()` run cleanup mein use hota hai

#### `orchestration-replay.ts`
**Kya karta hai:**
Run checkpoints save/restore karta hai.
- `saveCheckpoint()` → phase snapshot save karta hai
- `replayFromCheckpoint()` → agar run crash ho toh specific phase se restart possible
- `clearCheckpoints()` → run cleanup mein use hota hai

---

### 📂 distributed/

#### `index.ts`
**Kya karta hai:**
Parallel run capacity manage karta hai.
- Max concurrent runs limit enforce karta hai (default: 3)
- `start()` / `stop()` → `main.ts` se call hota hai server startup/shutdown par
- Memory pressure monitor karta hai interval se

---

### 📂 events/

#### `event-types.ts`
**Kya karta hai:**
Poore orchestration system ke TypeScript types define karta hai.
- `OrchestrationPhase`, `OrchestrationStatus`, `TaskPriority` enums
- `TaskPayload`, `PhaseResult`, `FailurePayload` interfaces
- `OrchestrationEventMap` → typed event contracts

#### `orchestration-events.ts`
**Kya karta hai:**
Typed EventEmitter + convenience emit functions.
- `orchestrationBus` → global event bus
- `emitRunStarted()`, `emitRunFailed()`, `emitPhaseCompleted()` etc. helper functions
- Max 50 listeners set hai memory leak prevent karne ke liye

#### `event-handlers.ts`
**Kya karta hai:**
Event listeners register karta hai orchestration bus par.
- Run started/completed/failed → logger mein entry
- Phase completed → timing metrics record
- Task failed → warn log + counter increment
- `registerEventHandlers()` / `unregisterEventHandlers()` → clean setup/teardown

---

### 📂 execution/

#### `execution-result-registry.ts`
**Kya karta hai:**
Completed runs ka stats store karta hai memory mein.
- `storeExecutionStats()` → run ke baad stats save
- `getRecentRuns()` → dashboard ke liye recent runs
- `getSuccessRate()` → success % calculate karta hai

---

### 📂 pipeline/

#### `analyze-phase.ts`
**Kya karta hai:**
User ke goal ko analyze karta hai (Phase 1).
- Goal ke keywords dekh ke complexity score (0–100) calculate karta hai
- Score ke basis par execution mode decide karta hai: `simple` / `standard` / `complex`
- Tags extract karta hai (auth, database, crud etc.)

#### `planning-phase.ts`
**Kya karta hai:**
Execution plan banata hai (Phase 2).
- Analysis result se tasks generate karta hai
- Task dependencies validate karta hai (circular dependency check)
- `ExecutionPlan` object return karta hai with estimated duration

#### `execution-phase.ts`
**Kya karta hai:**
Tasks execute karta hai (Phase 3).
- Plan ke tasks ko dependency order mein sort karta hai
- Har task ke liye events emit karta hai (started/completed/failed)
- Progress percentage track karta hai
- Failed task count return karta hai

#### `verification-phase.ts`
**Kya karta hai:**
Build verification run karta hai (Phase 4).
- TypeScript check: `tsc --noEmit`
- Build check: `npm run build`
- Fail-closed: koi bhi check fail → phase failed mark hota hai

#### `browser-phase.ts`
**Kya karta hai:**
Browser se UI validate karta hai (Phase 5).
- Preview URL probe karta hai (server reachable?)
- Playwright se screenshot leta hai
- Accessibility aur visual checks report karta hai

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

#### `priority-manager.ts`
**Kya karta hai:**
Task priority decide karta hai.
- Task type se priority resolve karta hai (fix/crash → critical, verify → high etc.)
- Age-based scoring: purane tasks ko priority boost milti hai
- Custom rules add/remove kar sakte hain

---

### 📂 retry/

#### `retry-manager.ts`
**Kya karta hai:**
Retry loop manage karta hai.
- Max attempts tak retry karta hai exponential backoff se
- Hard failures (401/403/404) immediately throw karta hai
- Per-task retry records track karta hai

#### `failure-handler.ts`
**Kya karta hai:**
Errors classify karta hai.
- Categories: `timeout`, `network`, `llm`, `build`, `runtime`, `validation`, `unknown`
- Recoverable vs non-recoverable decide karta hai
- Recovery action suggest karta hai (e.g. "Retry LLM call with reduced prompt")

#### `backoff-strategy.ts`
**Kya karta hai:**
Retry delay calculate karta hai.
- Exponential backoff: `baseDelay × 2^(attempt-1)`
- Jitter support: random delay flood prevent karta hai
- Hard failure detection: 401/403/404 → retry mat karo

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

#### `task-router.ts`
**Kya karta hai:**
Tasks ko priority queue mein route karta hai.
- Task type se priority auto-resolve karta hai
- Queue mein enqueue karta hai
- Override priority support karta hai

#### `retry-router.ts`
**Kya karta hai:**
Failed tasks ko retry ke liye route karta hai.
- Max retries (5) check karta hai
- Hard failures skip karta hai
- Cooldown period support karta hai (same task baar baar retry na ho)

---

### 📂 swarm/intent-graph/

#### `intent-graph-types.ts`
**Kya karta hai:**
Intent graph ke TypeScript types define karta hai.
- `IntentNode` → graph ka ek node (analyze/plan/execute/verify etc.)
- `IntentGraph` → poora execution graph
- `getReadyNodes()` → dependency-free nodes find karta hai

---

### 📂 telemetry/

#### `run-logger.ts`
**Kya karta hai:**
Per-run structured logs store karta hai.
- `log(runId, level, message, meta)` → log entry add karta hai
- Max 1000 entries per run (old entries drop ho jaate hain)
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

#### `orchestration-metrics.ts`
**Kya karta hai:**
Global (run-agnostic) metric counters.
- `incrementCounter(metric)` → quantum/engine files is use karte hain
- `recordDuration(metric, ms)` → timing track
- 10+ existing server files is se import karte hain

#### `orchestration-trace.ts`
**Kya karta hai:**
Span-based distributed tracing.
- `recordSpanStart()` / `recordSpanEnd()` → operation timing
- `addSpanEvent()` → span ke andar events add karna
- Quantum aggregation files is use karti hain

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

## 📊 Summary Table

| Folder | Files | Kaam |
|--------|-------|------|
| `core/` | 7 | Run lifecycle, state, context, replay |
| `pipeline/` | 5 | 5 execution phases (analyze → browser) |
| `telemetry/` | 5 | Logging, metrics, tracing, monitoring |
| `events/` | 3 | Event types, bus, handlers |
| `retry/` | 3 | Retry logic, failure classification, backoff |
| `queue/` | 3 | Task queue, worker, priority |
| `routing/` | 3 | Agent, task, retry routing |
| `utils/` | 3 | Helpers, async utils, validators |
| `agents/` | 1 | Verification bridge (existing code stub) |
| `execution/` | 1 | Result registry (existing code stub) |
| `distributed/` | 1 | Parallel run fabric (main.ts stub) |
| `swarm/intent-graph/` | 1 | Intent graph types (existing code stub) |
| Root | 1 | index.ts (entry point) |
| **Total** | **37** | **Complete orchestration system** |

---

> **Note:** `agents/`, `execution/`, `distributed/`, `swarm/` folders ke files **aapne request nahi kiye the** —
> yeh existing `main.ts` aur server files ke broken imports fix karne ke liye banaye gaye the.
> Inhe hata dein toh server start nahi hoga.
