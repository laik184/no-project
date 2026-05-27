# Supervisor Agent System — Deep Scan Report

**Location:** `server/agents/supervisor/`
**Total Files:** 30 TypeScript modules
**Purpose:** Top-level orchestration brain that wraps the pipeline with intelligent analysis, routing, retry, monitoring, and fail-closed decision-making.

> **Last refactored:** Surgical refactor applied — routing consolidated, events trimmed, metrics reduced, execution-monitor de-godded, context made immutable, controller responsibilities narrowed.

---

## Visual Folder Tree

```
server/agents/supervisor/
│
├── supervisor-agent.ts                  ← [PUBLIC API] Entry point
│
├── types/
│   ├── supervisor.types.ts              ← Core type contracts
│   └── routing.types.ts                 ← Agent registry + routing types
│
├── events/
│   ├── event-types.ts                   ← Typed event payloads (6 events)
│   ├── supervisor-events.ts             ← supervisorBus + emit helpers
│   └── event-handlers.ts               ← Bus listener registration
│
├── utils/
│   ├── supervisor-helpers.ts            ← ID generation, timing, formatting
│   ├── execution-utils.ts              ← Async utilities (timeout, retry, sequence)
│   └── validators.ts                   ← Zod input validation
│
├── telemetry/
│   ├── supervisor-logger.ts             ← Per-run structured logger
│   └── supervisor-metrics.ts           ← Per-run counters + timings
│
├── analysis/
│   ├── complexity-analyzer.ts          ← Goal → complexity score (0–100)
│   ├── goal-classifier.ts              ← Goal → GoalCategory
│   └── execution-mode-detector.ts      ← Category + score → ExecutionMode
│
├── decisions/
│   ├── retry-decision.ts               ← Should retry? max attempts, backoff
│   ├── escalation-decision.ts          ← Should escalate/abort/skip?
│   └── failure-decision.ts             ← Categorize failure + choose action
│
├── monitoring/
│   ├── loop-detector.ts                ← Detect repeated phase failures
│   ├── execution-monitor.ts            ← Aggregate health of active runs (health only)
│   ├── timeout-monitor.ts              ← Per-phase deadline enforcement
│   └── stuck-task-detector.ts          ← Detect tasks with no activity
│
├── coordination/
│   ├── retry-coordinator.ts            ← executeWithRetry wrapper (owns retry exhaustion)
│   ├── task-coordinator.ts             ← Enqueue/start/complete/fail tasks
│   └── pipeline-coordinator.ts         ← Phase lifecycle + plan building
│
├── routing/
│   ├── agent-router.ts                 ← Phase → agent mapping + history
│   └── task-dispatcher.ts              ← Priority resolution + queue dispatch + route history
│                                         (merged from task-router + priority-router)
│
└── core/
    ├── supervisor-state.ts             ← Session state machine (mutable runtime state)
    ├── supervisor-context.ts           ← Immutable per-session context (frozen at creation)
    ├── execution-controller.ts         ← Single-phase runner — execute + retry + monitor + return
    └── supervisor-engine.ts            ← Full pipeline orchestrator
```

---

## File-by-File Deep Scan

---

### `supervisor-agent.ts` — Public Entry Point

**Kya karta hai:** Supervisor system ka single public-facing API. Baaki poora system iske peeche chhupa hai.

**Exports:**
| Export | Type | Description |
|---|---|---|
| `initializeSupervisor()` | `() => void` | Event handlers register karta hai (idempotent) |
| `runSupervisorCycle(ctx)` | `async → SupervisorRunResult` | Poora supervised pipeline chalata hai |
| `shutdownSupervisor()` | `() => void` | Handlers remove, bus flush |

**Internal flow:**
1. `initializeSupervisor()` call karo — ek baar register hota hai
2. `runSupervisorCycle(ctx)` — analyze → plan → execute → verify → browser
3. Har phase ke liye real pipeline functions (`runAnalyzePhase`, `runPlanningPhase`, etc.) inject karta hai as `phaseRunners`
4. `supervisorEngine.run()` ko delegate karta hai

**Dependencies:** `supervisor-engine`, `event-handlers`, `supervisor-logger`, `supervisor-metrics`, sab 5 pipeline phases

---

### `types/supervisor.types.ts` — Core Type Contracts

**Kya karta hai:** System ka type backbone. Har doosri file yahan se import karti hai.

**Key types:**

| Type | Description |
|---|---|
| `SupervisorStatus` | `idle \| active \| paused \| shutdown` — state machine states |
| `ExecutionMode` | `simple \| standard \| complex` — pipeline complexity level |
| `GoalCategory` | `crud \| saas_dashboard \| ai_app \| auth_system \| backend_api \| database_ops \| unknown` |
| `LoopRiskLevel` | `none \| low \| medium \| high \| critical` |
| `EscalationReason` | `max_retries_exceeded \| hard_failure \| loop_detected \| timeout_exceeded \| stuck_task` |
| `SupervisorSession` | Active session ka full snapshot (sessionId, runId, goal, mode, status, etc.) |
| `ComplexityResult` | Score (0–100), mode, task estimate, flags, matched factors |
| `ClassificationResult` | Category, confidence (0–1), tags[], reasoning string |
| `SupervisorDecision` | `{ action: continue\|retry\|escalate\|abort\|skip, reason, metadata }` |
| `ExecutionHealth` | stuckTasks, timedOutPhases, loopRisk — aggregate health (retryExhausted always `[]`, handled in retry-coordinator) |
| `SupervisorRunResult` | Final result returned to caller |
| `PhaseDispatch` | Phase routing envelope with timeout + priority |
| `SupervisorEventName` | Union of 6 kept event names |

---

### `types/routing.types.ts` — Agent Registry + Routing

**Kya karta hai:** Routing system ke type contracts aur `AGENT_REGISTRY` constant.

**Key types:**

| Type | Description |
|---|---|
| `AgentRole` | `analyzer \| planner \| executor \| verifier \| browser \| supervisor` |
| `AgentDescriptor` | role, phase, maxConcurrent, timeoutMs, retryable |
| `RoutingDecision` | taskId, runId, targetAgent, targetPhase, priority, reason, scheduledAt |
| `PriorityRule` | Custom rule with condition fn + priority label |
| `TaskRoute` | Full route record stored in history |
| `RouterStats` | Aggregate counters by priority/phase/agent |

**`AGENT_REGISTRY` — Phase → Agent mapping:**

| Phase | Agent Role | Max Concurrent | Timeout | Retryable |
|---|---|---|---|---|
| `analyze` | analyzer | 3 | 15s | Yes |
| `planning` | planner | 2 | 30s | Yes |
| `execution` | executor | 1 | 120s | Yes |
| `verification` | verifier | 2 | 90s | Yes |
| `browser` | browser | 1 | 60s | **No** |
| `complete` | supervisor | 1 | 5s | No |
| `failed` | supervisor | 1 | 5s | No |

---

### `events/event-types.ts` — Typed Event Payloads

**Kya karta hai:** Supervisor event system ke liye TypeScript discriminated union — sirf 6 essential events ke payloads define karta hai.

> **Refactor note:** `supervisor.decision.made` aur `supervisor.escalated` hata diye gaye — ye telemetry noise the aur koi listener inhe consume nahi karta tha.

**6 event payloads:**

| Event | Payload Fields |
|---|---|
| `supervisor.started` | sessionId, runId, projectId, mode, category, timestamp |
| `supervisor.cycle.started` | sessionId, runId, phase, success, durationMs, retries, timestamp |
| `supervisor.cycle.completed` | same as above |
| `supervisor.cycle.failed` | same as above |
| `supervisor.loop.detected` | sessionId, runId, risk, pattern, occurrences, timestamp |
| `supervisor.shutdown` | sessionId, status, activeSessions, timestamp |

**`SupervisorEventMap`** — TypeScript map type for fully-typed `.on()` / `.emit()`.

---

### `events/supervisor-events.ts` — Event Bus + Emit Helpers

**Kya karta hai:** Typed `EventEmitter` subclass (`supervisorBus`) + 6 typed emit helper functions.

> **Refactor note:** `emitDecisionMade()` aur `emitEscalated()` remove kiye — removed events ke liye dead emitters the.

**Exports:**

| Export | Description |
|---|---|
| `supervisorBus` | `TypedSupervisorEmitter` — typed `.on()` / `.emit()` / `.off()`, maxListeners=30 |
| `emitSupervisorStarted()` | Session start fire karta hai |
| `emitCycleStarted()` | Phase loop shuru hone par |
| `emitCycleCompleted()` | Phase successfully complete hone par |
| `emitCycleFailed()` | Phase fail hone par |
| `emitLoopDetected()` | Loop risk detect hone par |
| `emitSupervisorShutdown()` | System band hone par |

---

### `events/event-handlers.ts` — Bus Listeners

**Kya karta hai:** `supervisorBus` pe 6 events ke liye listeners register/unregister karta hai. Sirf approved metrics emit karta hai.

> **Refactor note:** Low-value metrics (`sessions.started`, `cycles.completed` counter, `shutdowns`) hata diye. Sirf signal-dense metrics rakhey gaye.

**Exports:**
| Export | Description |
|---|---|
| `registerSupervisorHandlers()` | Idempotent — double registration rokta hai |
| `unregisterSupervisorHandlers()` | `removeAllListeners()` + `_registered = false` |

**Per-event actions:**
- `started` → info log + `runs.started` counter
- `cycle.started` → info log only
- `cycle.completed` → info log + `phase.duration` timing + `runs.completed` counter
- `cycle.failed` → warn log + `runs.failed` counter + `retry.count` increment
- `loop.detected` → warn log + `loop.detected` counter
- `shutdown` → info log only

---

### `utils/supervisor-helpers.ts` — Pure Helper Functions

**Kya karta hai:** Stateless utility functions — ID generation, timing, formatting, type narrowing.

| Function | Signature | Description |
|---|---|---|
| `generateSessionId()` | `() → string` | `sv_<timestamp>_<4hex>` format |
| `generateTaskId()` | `(runId, phase) → string` | `runId:phase:<3hex>` format |
| `elapsed()` | `(since: Date) → number` | Milliseconds elapsed since date |
| `formatDuration()` | `(ms) → string` | Human-readable: `250ms`, `3.2s`, `2m 15s` |
| `modeLabel()` | `(mode) → string` | `"Simple (1–3 tasks)"` etc. |
| `categoryLabel()` | `(category) → string` | `"SaaS Dashboard"` etc. |
| `phaseTimeout()` | `(phase, mode) → number` | Mode-adjusted timeout (1× / 1.5× / 2×) |
| `isTerminalPhase()` | `(phase) → boolean` | True for `complete` or `failed` |
| `clamp()` | `(val, min, max) → number` | Standard clamp |
| `truncate()` | `(str, maxLen?) → string` | String truncate with `…` |
| `safeJson()` | `(val) → Record` | Cast unknown to safe object |

---

### `utils/execution-utils.ts` — Async Execution Utilities

**Kya karta hai:** Async patterns — timeout, sequence, debounce. Orchestration utils ko re-export karta hai + supervisor-specific additions deta hai.

**Re-exports from orchestration:** `withTimeout`, `sleep`, `timed`, `runConcurrent`, `retryFixed`

**Supervisor-specific additions:**

| Function | Description |
|---|---|
| `withTimeoutOrNull(fn, ms)` | Timeout pe throw nahi karta, `null` return karta hai |
| `runWithResult(fn, ms?)` | `{ ok, value, error, durationMs }` — exception-free wrapper |
| `runSequential(tasks[])` | First failure par stop, `{ results, failedAt }` return |
| `debounce(fn, ms)` | Standard debounce — timer reset on each call |

---

### `utils/validators.ts` — Zod Input Validation

**Kya karta hai:** Supervisor inputs ke liye Zod schemas aur type-safe validation functions.

**Schemas:**

| Schema | Validates |
|---|---|
| `supervisorInputSchema` | runId, projectId, goal (max 10k), timeoutMs (5s–10m), metadata |
| `executionModeSchema` | `simple \| standard \| complex` |
| `goalCategorySchema` | All 7 goal categories |
| `complexityScoreSchema` | Number 0–100 |
| `retryConfigSchema` | maxAttempts (1–10), baseDelayMs, maxDelayMs, jitter |

**Functions:**

| Function | Description |
|---|---|
| `validateSupervisorInput(raw)` | Parse karo, throw on invalid |
| `validateExecutionMode(raw)` | Parse karo, throw on invalid |
| `validateGoalCategory(raw)` | Parse karo, throw on invalid |
| `safeValidateSupervisorInput(raw)` | `{ ok: true, data }` ya `{ ok: false, error }` |
| `isValidSessionId(val)` | Regex check: `sv_<digits>_<hex>` |
| `isValidScore(val)` | Number 0–100 check |

---

### `telemetry/supervisor-logger.ts` — Per-Run Structured Logger

**Kya karta hai:** `runLogger` (orchestration) ko wrap karta hai + in-memory ring buffer (200 entries/run) maintain karta hai.

**Exports (`supervisorLogger`):**

| Method | Description |
|---|---|
| `.info(runId, msg, meta?)` | runLogger + buffer |
| `.warn(runId, msg, meta?)` | runLogger + buffer |
| `.error(runId, msg, meta?)` | runLogger + buffer |
| `.debug(runId, msg, meta?)` | dev-only — prefix `[debug]` |
| `.getLogs(runId, level?)` | Buffer se logs fetch (optional filter) |
| `.clearRun(runId)` | Run ka buffer delete |
| `.getRunIds()` | Sab tracked runIds list |

**Design:** Ring buffer max 200 per run — oldest entry shift hoti hai jab full ho.

---

### `telemetry/supervisor-metrics.ts` — Per-Run Metrics

**Kya karta hai:** `metricsCollector` (orchestration) ko thin wrapper. Har run ke liye counters aur timings track karta hai.

**Exports (`supervisorMetrics`):**

| Method | Description |
|---|---|
| `.increment(runId, metric, by?)` | Counter badhao |
| `.timing(runId, metric, ms)` | Duration record karo |
| `.record(runId, metric, value, unit?)` | Arbitrary gauge |
| `.snapshot(runId)` | `{ counters, timings, capturedAt }` |
| `.getCounter(runId, metric)` | Single counter value |
| `.clearRun(runId)` | Run ka sab data delete |

**Approved metrics — sirf ye 6 emit hote hain:**
```
runs.started          ← session bootstrap pe
runs.completed        ← phase successfully complete hone par
runs.failed           ← phase fail hone par
phase.duration        ← phase ke durationMs timing
retry.count           ← retry count on failure
loop.detected         ← loop risk detect hone par
```

> **Refactor note:** Pehle 25+ metrics the — routing counters, priority boost counters, per-phase started/completed/failed metrics, decision per-action counters, escalation counters, shutdown counters. Sab hata diye. Sirf signal-dense 6 rakhey.

---

### `analysis/complexity-analyzer.ts` — Goal Complexity Scoring

**Kya karta hai:** Goal string ko scan karta hai regex patterns se aur `0–100` complexity score produce karta hai.

**12 complexity factors:**

| Factor Label | Keyword Pattern | Points |
|---|---|---|
| `ai_integration` | ai, llm, openai, embedding, vector, rag | 20 |
| `multi_tenant` | multi-tenant, saas, team, organization | 20 |
| `payments` | payment, stripe, billing, subscription | 18 |
| `auth` | auth, authentication, oauth, jwt, session | 15 |
| `realtime` | realtime, websocket, sse, socket.io | 15 |
| `devops` | deploy, ci, cd, docker, kubernetes | 15 |
| `database` | database, postgres, mysql, mongodb, redis | 12 |
| `search` | search, elasticsearch, full-text | 12 |
| `analytics` | dashboard, chart, graph, analytics | 10 |
| `file_storage` | file, upload, storage, s3, cdn | 10 |
| `notifications` | email, sms, twilio, sendgrid | 10 |
| `api` | api, rest, graphql, endpoint | 8 |

**Score → Mode mapping:**
- `0–30` → `simple` (1–3 tasks)
- `31–65` → `standard` (4–8 tasks)
- `66–100` → `complex` (9–20 tasks)

**Exports (`complexityAnalyzer`):** `.analyze(goal)`, `.scoreFromFactors(factors[])`, `.isCriticalComplexity(score)`

---

### `analysis/goal-classifier.ts` — Goal Category Classification

**Kya karta hai:** Goal string ko `GoalCategory` mein classify karta hai regex pattern matching se.

**6 categories with priority weights:**

| Category | Weight | Key Patterns |
|---|---|---|
| `ai_app` | 10 | ai, llm, openai, gpt, embedding, chatbot, RAG |
| `auth_system` | 9 | login, signup, jwt, oauth, session, roles, SSO |
| `saas_dashboard` | 8 | saas, dashboard, analytics, multi-tenant, billing |
| `backend_api` | 7 | api, rest, graphql, webhook, redis, queue |
| `database_ops` | 7 | database, migration, schema, drizzle, postgres |
| `crud` | 5 | crud, create, delete, form, list, todo, blog |

**Algorithm:**
1. Har category ke patterns match karo
2. `matchCount × weight` se score nikalo
3. Highest score jeetta hai
4. Confidence = `best.score / maxPossibleScore` (0–1)

**Exports (`goalClassifier`):** `.classify(goal)` → `ClassificationResult`, `.isKnownCategory(str)`

---

### `analysis/execution-mode-detector.ts` — Mode Selection

**Kya karta hai:** Complexity score + goal category ko combine karke `ExecutionMode` decide karta hai. Rule-based priority system.

**7 priority rules (first match wins):**

| Rule ID | Condition | Mode |
|---|---|---|
| `ai_always_complex` | category = ai_app | complex |
| `saas_high_complexity` | saas_dashboard + score ≥ 40 | complex |
| `auth_standard` | category = auth_system | standard |
| `backend_api_standard` | backend_api + score ≥ 30 | standard |
| `crud_simple` | crud + score < 35 | simple |
| `score_drives_complex` | score ≥ 70 | complex |
| `score_drives_simple` | score < 25 | simple |
| `default` | — | complexity.mode (score-based) |

**Phase lists per mode:**
```
simple:   analyze → execution → verification
standard: analyze → planning → execution → verification
complex:  analyze → planning → execution → verification → browser
```

**Exports (`executionModeDetector`):** `.detect(complexity, classification)` → `{ mode, reason, ruleId }`, `.phasesForMode(mode)`, `.taskCountEstimate(mode, category)`

---

### `decisions/retry-decision.ts` — Retry Logic

**Kya karta hai:** Kisi phase failure ke baad retry karna chahiye ya nahi — ye decide karta hai.

**Per-phase max retries:**

| Phase | Base | Complex mode |
|---|---|---|
| analyze | 2 | 3 |
| planning | 2 | 3 |
| execution | 3 | 4 |
| verification | 3 | 4 |
| browser | 1 | 2 |

**Non-retryable errors (immediate escalate):**
`unauthorized`, `forbidden`, `401`, `403`, `quota exceeded`, `rate limit`, `invalid api key`

**Retry delay:** Exponential backoff — `min(1000 × 2^attempt + jitter, 30000)ms`

**Exports (`retryDecision`):** `.shouldRetry(phase, error, currentRetry, mode)` → `SupervisorDecision`, `.maxRetries(phase, mode)`, `.retryDelay(attempt)`

---

### `decisions/escalation-decision.ts` — Escalation Logic

**Kya karta hai:** High-level failure context lekar decide karta hai — escalate karo, abort karo, ya skip karo.

> **Refactor note:** Retry exhaustion logic yahan nahi hai — wo `retry-coordinator.ts` mein hai. Ye sirf loop/stuck/timeout-based escalation decisions leta hai.

**Escalation reason priority:**
1. `loop_detected` — agar loopRisk `critical` ya `high` ho
2. `stuck_task` — agar `stuckMs > 120_000`
3. `timeout_exceeded` — agar error mein "timeout" ho
4. `max_retries_exceeded` — default

**Decision logic:**
| Loop Risk | Phase Type | Action |
|---|---|---|
| `critical` | any | **abort** |
| `high` | non-critical (e.g. browser) | **skip** |
| `high` | critical (execution/verification) | **escalate** |
| any | — | **escalate** |

**Exports (`escalationDecision`):** `.shouldEscalate(ctx)` → `SupervisorDecision`, `.isCritical(ctx)`, `.getEscalationReason(ctx)`

---

### `decisions/failure-decision.ts` — Failure Categorization

**Kya karta hai:** Error string se failure type detect karta hai, aur action decide karta hai.

**Failure categories:**

| Category | Error patterns | Recoverable |
|---|---|---|
| `network` | econnrefused, enotfound, network | Yes (≤3 retries) |
| `timeout` | timeout, timed out | Yes (≤3 retries) |
| `llm` | llm, openrouter, openai, model | Yes (≤1 retry) |
| `build` | tsc, build, compile | **No** |
| `validation` | zod, validation, invalid | **No** |
| `unknown` | — | Yes (≤0 retries) |

**Optional phases** (`browser`): Always `skip` — pipeline nahi rokta.

**Exports (`failureDecision`):** `.decide(ctx)` → `SupervisorDecision & { category, recoverable }`, `.categorize(error)`, `.isOptionalPhase(phase)`

---

### `monitoring/loop-detector.ts` — Loop Detection

**Kya karta hai:** Per-run phase failure history track karta hai (5-minute rolling window) aur loop risk calculate karta hai.

**Risk thresholds:**

| Consecutive Failures | Total in Window | Risk Level |
|---|---|---|
| ≥5 | ≥8 | `critical` |
| ≥3 | ≥5 | `high` |
| ≥2 | ≥3 | `medium` |
| ≥1 | ≥2 | `low` |
| 0 | 0 | `none` |

**Exports (`loopDetector`):**
- `.record(runId, phase, success)` — ek phase event record karo
- `.detect(runId, phase)` → `LoopDetectionResult` — specific phase ke liye
- `.detectGlobal(runId)` → `LoopDetectionResult` — poori run ke liye
- `.clearRun(runId)` — cleanup

---

### `monitoring/execution-monitor.ts` — Aggregate Run Health

**Kya karta hai:** Active runs ka snapshot maintain karta hai. Sub-monitors ko aggregate karke `ExecutionHealth` banata hai. **Sirf health aggregation — koi decision logic nahi.**

> **Refactor note (Fix 4 — God Object prevention):** Pehle `retryCount >= 5 → retryExhausted` check yahan tha. Ye hata diya gaya — retry exhaustion logic `retry-coordinator.ts` mein sahi jagah hai. Monitor sirf observe karta hai, decide nahi karta.

**Internal state:** `Map<runId, RunSnapshot>` — current phase, start time. (`retryCount` field removed.)

**`checkHealth(runId)` aggregates:**
- `stuckTaskDetector.getStuckTasks(runId)`
- `timeoutMonitor.isTimedOut(runId, currentPhase)`
- `loopDetector.detectGlobal(runId).risk`
- `retryExhausted` → always `[]` (handled in retry-coordinator)

**Exports (`executionMonitor`):** `.track()`, `.update()`, `.checkHealth()`, `.getLoopRisk()`, `.untrack()`, `.activeRunCount()`

---

### `monitoring/timeout-monitor.ts` — Phase Deadline Enforcement

**Kya karta hai:** Har phase ke liye individual deadline timer manage karta hai. `phaseTimeout()` helper se mode-adjusted deadline calculate karta hai.

**State:** `Map<runId, Map<phase, PhaseTimer>>` — startedAt + deadlineMs per phase.

**Exports (`timeoutMonitor`):**
| Method | Description |
|---|---|
| `.startPhase(runId, phase, mode, overrideMs?)` | Timer start |
| `.endPhase(runId, phase)` | Timer delete |
| `.isTimedOut(runId, phase)` | `elapsed > deadline` check |
| `.remainingMs(runId, phase)` | Kitna time baki |
| `.elapsedMs(runId, phase)` | Kitna time hua |
| `.getTimedOutPhases(runId)` | All timed-out phases list |
| `.clearRun(runId)` | Sab timers delete |

---

### `monitoring/stuck-task-detector.ts` — Stuck Task Detection

**Kya karta hai:** Individual tasks ko track karta hai. Agar kisi task ki `lastActivityAt` 60 seconds se zyada purani ho — stuck maana jaata hai.

**State:** `Map<runId, Map<taskId, TaskRecord>>` — startedAt, lastActivityAt, stuckThresholdMs.

**Exports (`stuckTaskDetector`):**
| Method | Description |
|---|---|
| `.register(runId, taskId, phase, thresholdMs?)` | Task register karo |
| `.heartbeat(runId, taskId)` | `lastActivityAt = now` update karo |
| `.complete(runId, taskId)` | Task hata do |
| `.isStuck(runId, taskId)` | Boolean stuck check |
| `.getStuckTasks(runId)` | Stuck task IDs list |
| `.stuckDurationMs(runId, taskId)` | Kitni der se stuck |
| `.allTasks(runId)` | All task records |
| `.clearRun(runId)` | Cleanup |

---

### `coordination/retry-coordinator.ts` — Retry Execution Wrapper

**Kya karta hai:** `retryManager` (orchestration) aur `retryDecision` ko combine karke single `executeWithRetry()` function provide karta hai. **Retry exhaustion ka single source of truth.**

> **Refactor note (Fix 4):** `isExhausted()` check yahan hi rahega. `execution-monitor.ts` se retryCount tracking hata di gayi — monitor sirf health aggregate karta hai, retry state nahi.

**Flow:**
1. `retryDecision.maxRetries(phase, mode)` se max attempts nikalo
2. `retryManager.withRetry()` se exponential backoff ke saath run karo
3. Har retry par `supervisorLogger.warn()` se log karo
4. Success → `{ ok: true, value }`
5. Failure → `{ ok: false, decision, error }` — decision = retry/escalate

**Exports (`retryCoordinator`):**
- `.executeWithRetry(opts, fn)` → `{ ok, value } | { ok, decision, error }`
- `.isExhausted(taskId)` — kya retries khatam ho gayi (**owns this check**)
- `.waitBeforeRetry(attempt)` — delay with backoff
- `.clearTask(taskId)` — retry record clean

---

### `coordination/task-coordinator.ts` — Task Lifecycle Manager

**Kya karta hai:** `taskQueue` aur orchestration event emitters ko wrap karke task lifecycle manage karta hai (enqueue → start → complete/fail).

**Exports (`taskCoordinator`):**
| Method | Description |
|---|---|
| `.enqueue(task)` | Queue mein daalo + `emitTaskQueued` fire karo |
| `.markStarted(taskId)` | Status update + `emitTaskStarted` |
| `.markCompleted(taskId, result)` | Status update + `emitTaskCompleted` |
| `.markFailed(taskId, error)` | Status update + `emitTaskFailed` |
| `.getTask(taskId)` | Current task record |
| `.clearRun(runId)` | Cleanup |

---

### `coordination/pipeline-coordinator.ts` — Phase Lifecycle

**Kya karta hai:** Phase transitions manage karta hai — start/end/complete/fail — aur orchestration bus pe events fire karta hai.

**Exports (`pipelineCoordinator`):**
| Method | Description |
|---|---|
| `.startPhase(runId, phase, mode, timeoutMs?)` | Phase shuru, timeout register, event emit |
| `.endPhase(runId, phase, success)` | Phase khatam, timer clear, event emit |
| `.buildPlan(runId, mode)` | Phase sequence plan banao |
| `.getPhaseStatus(runId, phase)` | Current phase status |

---

### `routing/agent-router.ts` — Phase → Agent Mapping

**Kya karta hai:** Phase ke liye correct agent decide karta hai, routing history maintain karta hai.

> **Refactor note:** `supervisorMetrics.increment(runId, 'supervisor.agent.<role>.routed')` call remove kiya — ye low-value routing counter tha. Sirf logging raha.

**Exports (`agentRouter`):**
| Method | Description |
|---|---|
| `.route(runId, phase, priority)` → `RoutingDecision` | Agent decide karo + history mein record |
| `.getDescriptor(phase)` → `AgentDescriptor` | Phase ka agent descriptor lo |
| `.isRetryable(phase)` | Boolean retryable check |
| `.timeoutFor(phase)` | Phase ka configured timeout |
| `.getHistory(runId)` | Routing decisions history (max 50) |
| `.clearRun(runId)` | Cleanup |

---

### `routing/task-dispatcher.ts` — Priority + Queue Dispatch *(merged)*

**Kya karta hai:** `task-router.ts` + `priority-router.ts` ka merged replacement. Priority resolve karta hai, queue mein dispatch karta hai, route history maintain karta hai.

> **Refactor note (Fix 1):** Pehle do alag files the (`task-router.ts` → dispatch, `priority-router.ts` → priority) jo heavily overlap karti thi aur unnecessary orchestration depth banati thi. Ab ek hi cohesive module hai.

**Priority resolution rules (first match wins):**

| Condition | Priority |
|---|---|
| Custom `PriorityRule` condition match | Rule ki priority |
| `mode === 'complex'` AND `phase === 'execution'` | `high` |
| `phase === 'analyze'` or `planning` or `verification` | `high` |
| `phase === 'failed'` | `critical` |
| `phase === 'browser'` | `low` |
| Default | `normal` |

**Exports (`taskDispatcher`):**
| Method | Description |
|---|---|
| `.dispatch(spec)` → `TaskRoute` | Priority resolve + enqueue + history record |
| `.addRule(rule)` | Custom priority rule add karo |
| `.removeRule(ruleId)` | Custom rule remove karo |
| `.getRoutes(runId)` | Route history (max 100) |
| `.clearRun(runId)` | Cleanup |

**`DispatchSpec` shape:**
```typescript
{
  runId:    string;
  phase:    OrchestrationPhase;
  type:     string;
  mode:     ExecutionMode;
  category: GoalCategory;
  input?:   Record<string, unknown>;
}
```

---

### `core/supervisor-state.ts` — Session State Machine *(mutable runtime state)*

**Kya karta hai:** Active supervisor sessions ka lifecycle manage karta hai. Valid transitions enforce karta hai. **Mutable runtime state ka single owner.**

> **Refactor note (Fix 5):** State aur context mein responsibility overlap thi. Ab `supervisor-state.ts` = lifecycle + runtime state (status, currentPhase, retryCount, metadata mutations). `supervisor-context.ts` = immutable execution context.

**State machine transitions:**
```
idle → active → paused → shutdown
            ↘──────────↗
```

**Exports (`supervisorState`):**
| Method | Description |
|---|---|
| `.create(...)` | Naya session banao |
| `.transition(sessionId, status)` | Valid transition enforce karo |
| `.setPhase(sessionId, phase)` | Current phase update |
| `.incrementRetry(sessionId)` | Retry counter badhao |
| `.setMeta(sessionId, key, value)` | Runtime metadata set karo |
| `.get(sessionId)` | Session snapshot lo |
| `.getByRunId(runId)` | runId se session dhundo |
| `.isActive(sessionId)` | Boolean active check |
| `.activeSessions()` | Sab active sessions list |
| `.clear(sessionId)` | Session delete karo |

---

### `core/supervisor-context.ts` — Immutable Execution Context

**Kya karta hai:** Session ke liye read-only execution context store karta hai. Goal, mode, category, complexity, classification — sab create hone ke baad freeze ho jaate hain.

> **Refactor note (Fix 5):** `updateMeta()` method hata diya — context mein mutable metadata nahi hona chahiye. Mutable runtime metadata `supervisor-state.ts` mein hai. `Object.freeze()` lagaya gaya context aur metadata dono pe.

**Interface `SupervisorContext` (all fields `readonly`):**
```typescript
{
  readonly sessionId:      string;
  readonly runId:          string;
  readonly projectId:      string;
  readonly goal:           string;
  readonly timeoutMs:      number;
  readonly mode:           ExecutionMode;
  readonly category:       GoalCategory;
  readonly complexity:     ComplexityResult;
  readonly classification: ClassificationResult;
  readonly startedAt:      Date;
  readonly metadata:       Readonly<Record<string, unknown>>;
}
```

**Exports (`supervisorContext`):**
| Method | Description |
|---|---|
| `.create(...)` | Context banao + `Object.freeze()` lagao |
| `.get(sessionId)` | Context lo (already frozen) |
| `.getByRunId(runId)` | runId se context dhundo |
| `.toOrchestrationContext(sessionId)` | Orchestration format mein convert karo |
| `.clear(sessionId)` | Context delete karo |

---

### `core/execution-controller.ts` — Phase Execution Coordinator

**Kya karta hai:** Ek phase ko retry wrapper ke saath chalata hai, monitoring update karta hai, aur typed result return karta hai.

> **Refactor note (Fix 6):** Pehle per-phase metric noise tha (`phases.X.started`, `phases.X.completed`, `phases.X.failed`). Sab hata diye. Controller ab sirf: dispatch → retry → monitor update → delegate decisions → return result.

**Responsibilities (sirf ye 4):**
1. Task dispatch (`agentRouter` + `taskDispatcher`)
2. Phase execution via `retryCoordinator.executeWithRetry()`
3. Monitoring state update (`executionMonitor.update`)
4. Return `PhaseExecutionResult` — decisions `decisions/` ko delegate

**`PhaseExecutionResult` shape:**
```typescript
{
  phase:      OrchestrationPhase;
  success:    boolean;
  durationMs: number;
  skipped:    boolean;
  decision?:  SupervisorDecision;
  error?:     string;
}
```

**Exports (`executionController`):**
- `.runPhase(opts, phase, phaseRunner)` → `PhaseExecutionResult`
- `.decideContinue(results[])` → `boolean` — sab results pass/skip hain?

---

### `core/supervisor-engine.ts` — Full Pipeline Orchestrator

**Kya karta hai:** Pura supervised pipeline chalata hai — analyze → plan → execute → verify → browser. Session lifecycle manage karta hai start se end tak.

**Flow:**
```
OrchestrationContext
    │
    ├── complexityAnalyzer.analyze(goal)
    ├── goalClassifier.classify(goal)
    ├── executionModeDetector.detect(complexity, classification)
    │
    ├── supervisorState.create() + supervisorContext.create()
    ├── supervisorState.transition('active')
    ├── executionMonitor.track()
    ├── emitSupervisorStarted()
    │
    ├── for each phase in phasesForMode(mode):
    │       supervisorState.setPhase(sessionId, phase)
    │       emitCycleStarted()
    │       executionController.runPhase(opts, phase, runner)
    │       ├── success → emitCycleCompleted()
    │       └── failure → emitCycleFailed() + break
    │
    ├── supervisorState.transition('shutdown')
    ├── executionMonitor.untrack()
    │
    └── return SupervisorRunResult
```

**Exports:** `supervisorEngine` (singleton instance of `SupervisorEngine`)

---

## Complete Execution Flow

```
[caller]
    │
    ▼
supervisor-agent.ts → supervisorEngine.run(ctx, phaseRunners)
    │
    ├── [BOOTSTRAP]
    │   complexityAnalyzer.analyze(goal)           → ComplexityResult
    │   goalClassifier.classify(goal)              → ClassificationResult
    │   executionModeDetector.detect(c, cl)        → { mode, reason }
    │   supervisorState.create(sessionId, ...)     → SupervisorSession
    │   supervisorContext.create(sessionId, ...)   → SupervisorContext (frozen)
    │   supervisorState.transition('active')
    │   executionMonitor.track(runId, ...)
    │   emitSupervisorStarted()
    │
    ├── [PHASE LOOP — for each phase]
    │   supervisorState.setPhase(sessionId, phase)
    │   emitCycleStarted()
    │   │
    │   └── executionController.runPhase()
    │           │
    │           ├── agentRouter.route(runId, phase, 'normal')
    │           ├── taskDispatcher.dispatch({ runId, phase, mode, category })
    │           │       └── resolvePriority() → TaskPriority
    │           │           taskCoordinator.enqueue(...)
    │           ├── pipelineCoordinator.startPhase(runId, phase, mode)
    │           ├── executionMonitor.update(runId, { currentPhase: phase })
    │           │
    │           └── retryCoordinator.executeWithRetry({ phase, runId, taskId, mode }, fn)
    │                   │
    │                   ├── [SUCCESS]
    │                   │   pipelineCoordinator.endPhase(runId, phase, true)
    │                   │   return { phase, success: true, durationMs, skipped: false }
    │                   │
    │                   └── [FAILURE]
    │                       pipelineCoordinator.endPhase(runId, phase, false)
    │                       failureDecision.decide({ phase, error, ... })
    │                       ├── action === 'skip' → return skipped=true (optional phase)
    │                       └── escalationDecision.shouldEscalate({ phase, loopRisk, ... })
    │                           return { phase, success: false, decision, error }
    │
    ├── [POST-PHASE]
    │   success → emitCycleCompleted()
    │   failure → emitCycleFailed() + break loop
    │
    └── [TEARDOWN]
        supervisorState.transition('shutdown')
        executionMonitor.untrack(runId)
        return SupervisorRunResult
```

---

## Monitoring Flow

```
executionMonitor.track(runId, { startedAt, currentPhase: null })
    │
    ├── timeoutMonitor.startPhase(runId, phase, mode)
    │       deadlineMs = phaseTimeout(phase, mode)
    │       ├── analyze:      15s × mode_multiplier
    │       ├── planning:     30s × mode_multiplier
    │       ├── execution:   120s × mode_multiplier
    │       ├── verification: 90s × mode_multiplier
    │       └── browser:      60s × mode_multiplier
    │       (simple=1×, standard=1.5×, complex=2×)
    │
    ├── stuckTaskDetector.register(runId, taskId, phase)
    │   └── stuckThreshold = 60_000ms (1 minute no activity)
    │
    └── [during execution]
            stuckTaskDetector.heartbeat(runId, taskId)  ← activity pulse
                    │
                    ▼
    executionMonitor.checkHealth(runId)
        ├── stuckTaskDetector.getStuckTasks(runId)
        │   └── tasks where (now - lastActivityAt) > 60s
        ├── timeoutMonitor.isTimedOut(runId, currentPhase)
        │   └── (now - startedAt) > deadlineMs
        ├── loopDetector.detectGlobal(runId)
        │   └── rolling 5-min window failure pattern
        │       none/low/medium/high/critical
        └── retryExhausted: []  ← always empty here
            (retry exhaustion owned by retry-coordinator)
                    │
                    ▼
            ExecutionHealth {
                healthy,
                stuckTasks[],
                timedOutPhases[],
                loopRisk,
                retryExhausted: []
            }
                    │
                    feeds into → escalationDecision.shouldEscalate()
    │
    ▼
executionMonitor.untrack(runId)                ← run end
    ├── stuckTaskDetector.clearRun(runId)
    ├── timeoutMonitor.clearRun(runId)
    └── loopDetector.clearRun(runId)
```

**Loop detection rolling window (5 minutes):**
```
Consecutive failures │ Total failures │ Risk Level
─────────────────────┼────────────────┼────────────
        ≥ 5          │      ≥ 8       │  critical
        ≥ 3          │      ≥ 5       │  high
        ≥ 2          │      ≥ 3       │  medium
        ≥ 1          │      ≥ 2       │  low
         0           │       0        │  none
```

---

## Event Lifecycle

6 supervisor events — when emitted, who listens, what happens:

```
EVENT: supervisor.started
  Emitted by:  emitSupervisorStarted() in supervisor-engine.ts
  When:        Session bootstrap complete, pipeline about to start
  Payload:     { sessionId, runId, projectId, mode, category, timestamp }
  Handler:     info log + runs.started counter

EVENT: supervisor.cycle.started
  Emitted by:  emitCycleStarted() in supervisor-engine.ts
  When:        Each phase loop iteration begins
  Payload:     { sessionId, runId, phase, durationMs=0, retries, timestamp }
  Handler:     info log only

EVENT: supervisor.cycle.completed
  Emitted by:  emitCycleCompleted() in supervisor-engine.ts
  When:        Phase passed successfully
  Payload:     { sessionId, runId, phase, durationMs, retries, timestamp }
  Handler:     info log + phase.duration timing + runs.completed counter

EVENT: supervisor.cycle.failed
  Emitted by:  emitCycleFailed() in supervisor-engine.ts
  When:        Phase failed (after all retries)
  Payload:     { sessionId, runId, phase, durationMs, retries, timestamp }
  Handler:     warn log + runs.failed counter + retry.count increment

EVENT: supervisor.loop.detected
  Emitted by:  emitLoopDetected() in monitoring/
  When:        loopDetector reports risk ≥ low
  Payload:     { sessionId, runId, risk, pattern, occurrences, timestamp }
  Handler:     warn log + loop.detected counter

EVENT: supervisor.shutdown
  Emitted by:  emitSupervisorShutdown() in supervisor-agent.ts
  When:        shutdownSupervisor() called
  Payload:     { sessionId, status, activeSessions, timestamp }
  Handler:     info log only
```

> **Removed events:** `supervisor.decision.made` aur `supervisor.escalated` — ye telemetry noise the. Koi listener inhe meaningful way mein consume nahi karta tha. Escalation behavior `decisions/escalation-decision.ts` se directly traceable hai.

**Event bus wiring:**
```
supervisorBus (TypedSupervisorEmitter — extends EventEmitter)
    │
    ├── event-handlers.ts registers 6 listeners on init
    ├── max 30 listeners (setMaxListeners(30))
    └── fully typed — .on<K>() / .emit<K>() enforce payload shape
```

**Orchestration event bridge (supervisor → orchestration bus):**
```
pipelineCoordinator.startPhase()
    └── emitPhaseStarted(runId, phase)   → orchestrationBus

taskCoordinator.enqueue()
    └── emitTaskQueued(task)             → orchestrationBus

taskCoordinator.markStarted()
    └── emitTaskStarted(task)            → orchestrationBus

taskCoordinator.markCompleted()
    └── emitTaskCompleted(task, result)  → orchestrationBus

taskCoordinator.markFailed()
    └── emitTaskFailed(task, error)      → orchestrationBus
```

---

## Design Philosophy

The Supervisor Agent is built around five explicit principles drawn from the specification:

### 1. Simple > Clever
Every module solves ONE problem in the most direct way possible. No lambda calculus, no meta-programming, no "smart" inference — just `if error → retry`, `if loop → escalate`, `if timeout → abort`. A new engineer should read any file and understand it in under 5 minutes.

### 2. Stable > Complex
The system prefers predictable execution over optimal execution. Exponential backoff with known bounds, fixed state machine transitions, explicit phase ordering — nothing is dynamic that doesn't need to be. Stability under failure is more valuable than throughput under ideal conditions.

### 3. Explicit > Magical
Every decision is logged with a `reason` string. Every routing choice is recorded in history. Every state transition is validated against a whitelist. Nothing happens implicitly — if it happened, it was logged and the relevant counter incremented.

### 4. Observable > Hidden
The entire system is wired to `supervisorBus` + `orchestrationBus`. Every phase transition, every retry, every loop detection fires an event. `supervisorMetrics` captures 6 signal-dense counters and timings — no noise, all signal. `supervisorLogger` keeps a 200-entry ring buffer per run. You can reconstruct exactly what happened from the telemetry alone.

### 5. Modular > Monolithic
Each folder has a single axis of concern:
- `analysis/` — input understanding only
- `decisions/` — decision logic only, no side effects
- `monitoring/` — observation only, no modification
- `coordination/` — lifecycle management only
- `routing/` — dispatch only
- `core/` — orchestration only
- `events/` — communication only
- `telemetry/` — recording only
- `utils/` — pure functions only

No module reaches into another module's domain. Cross-cutting concerns (logging, metrics) are injected via the telemetry layer, not scattered through business logic.

### What the Supervisor NEVER does
Per the specification — hard constraints, not guidelines:
- Does NOT generate application code
- Does NOT read or write files directly
- Does NOT execute shell commands
- Does NOT implement swarm/recursive/quantum orchestration
- Does NOT contain business logic (that lives in pipeline phases)
- Does NOT hold global mutable state beyond session maps (which are cleared on shutdown)

---

## Refactor Changelog

| Fix | What changed | Files affected |
|---|---|---|
| Fix 1 — Routing merge | `task-router.ts` + `priority-router.ts` → `task-dispatcher.ts` | `routing/task-dispatcher.ts` (new), two files deleted, `execution-controller.ts` import updated |
| Fix 2 — Metrics reduction | 25+ metrics → 6 approved metrics only | `event-handlers.ts`, `execution-controller.ts`, `agent-router.ts` |
| Fix 3 — Event simplification | 8 events → 6 events (`decision.made` + `escalated` removed) | `event-types.ts`, `supervisor-events.ts`, `event-handlers.ts`, `supervisor.types.ts` |
| Fix 4 — God object prevention | `retryCount >= 5` check moved out of execution-monitor | `execution-monitor.ts`, `retry-coordinator.ts` |
| Fix 5 — State/context separation | `supervisor-context.ts` fully immutable, `updateMeta` removed | `supervisor-context.ts`, `supervisor-state.ts` |
| Fix 6 — Controller clarity | Per-phase metric noise removed, 4 responsibilities only | `execution-controller.ts` |
