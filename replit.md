# Nura-X Deployer — Project Report

> Autonomous "Agentic AI Vibe Coder" platform. AI agents collaborate to plan, write, test, and deploy web applications from natural language instructions.

---

## Project Architecture (Top Level)

```
nura-x-deployer/
├── client/          ← React + Vite + TypeScript frontend (port 5000)
├── server/          ← Express + Node.js + TypeScript backend (port 3001)
│   ├── agents/      ← AI agent implementations
│   ├── orchestration/ ← Run lifecycle, queues, retry, telemetry
│   ├── chat/        ← Chat API and run executors
│   └── ...
├── shared/          ← Drizzle ORM schema (shared between client + server)
└── replit.md        ← This file
```

---

## Running the Project

```bash
npm run dev
# → Backend  : http://localhost:3001  (tsx watch main.ts)
# → Frontend : http://localhost:5000  (vite)
```

Workflow `Start application` manages both processes via `concurrently`.

---

## Key Environment Variables

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY` | LLM API key — required for all agent runs |
| `DATABASE_URL` | PostgreSQL (auto-provided by Replit) |
| `LLM_MODEL` | Model to use (default: `openai/gpt-oss-120b:free`) |
| `LLM_BASE_URL` | OpenRouter base URL |
| `AGENT_PROJECT_ROOT` | Sandbox directory (default: `.sandbox`) |

---

## Database

PostgreSQL via Drizzle ORM. Schema: `shared/schema.ts`

```bash
npx drizzle-kit push    # apply schema changes
```

---
---

# Supervisor Agent System — Deep Scan Report

**Location:** `server/agents/supervisor/`
**Total Files:** 31 TypeScript modules
**Purpose:** Top-level orchestration brain that wraps the pipeline with intelligent analysis, routing, retry, monitoring, and fail-closed decision-making.

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
│   ├── event-types.ts                   ← Typed event payloads
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
│   ├── execution-monitor.ts            ← Aggregate health of active runs
│   ├── timeout-monitor.ts              ← Per-phase deadline enforcement
│   └── stuck-task-detector.ts          ← Detect tasks with no activity
│
├── coordination/
│   ├── retry-coordinator.ts            ← executeWithRetry wrapper
│   ├── task-coordinator.ts             ← Enqueue/start/complete/fail tasks
│   └── pipeline-coordinator.ts         ← Phase lifecycle + plan building
│
├── routing/
│   ├── agent-router.ts                 ← Phase → agent mapping + history
│   ├── task-router.ts                  ← Route task by mode + category
│   └── priority-router.ts              ← Resolve task priority score
│
└── core/
    ├── supervisor-state.ts             ← Session state machine
    ├── supervisor-context.ts           ← Immutable per-session context
    ├── execution-controller.ts         ← Single-phase runner with full wiring
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
| `ExecutionHealth` | stuckTasks, timedOutPhases, loopRisk — aggregate health |
| `SupervisorRunResult` | Final result returned to caller |
| `PhaseDispatch` | Phase routing envelope with timeout + priority |
| `SupervisorEventName` | Union of all 8 event names |

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

**Kya karta hai:** Supervisor event system ke liye TypeScript discriminated union — har event ka exact payload define karta hai.

**8 event payloads:**

| Event | Payload Fields |
|---|---|
| `supervisor.started` | sessionId, runId, projectId, mode, category, timestamp |
| `supervisor.cycle.started` | sessionId, runId, phase, success, durationMs, retries, timestamp |
| `supervisor.cycle.completed` | same as above |
| `supervisor.cycle.failed` | same as above |
| `supervisor.decision.made` | sessionId, runId, action, reason, phase, timestamp |
| `supervisor.loop.detected` | sessionId, runId, risk, pattern, occurrences, timestamp |
| `supervisor.escalated` | sessionId, runId, reason, phase, retryCount, timestamp |
| `supervisor.shutdown` | sessionId, status, activeSessions, timestamp |

**`SupervisorEventMap`** — TypeScript map type for fully-typed `.on()` / `.emit()`.

---

### `events/supervisor-events.ts` — Event Bus + Emit Helpers

**Kya karta hai:** Typed `EventEmitter` subclass (`supervisorBus`) + 8 typed emit helper functions.

**Exports:**

| Export | Description |
|---|---|
| `supervisorBus` | `TypedSupervisorEmitter` — typed `.on()` / `.emit()` / `.off()`, maxListeners=30 |
| `emitSupervisorStarted()` | Session start fire karta hai |
| `emitCycleStarted()` | Phase loop shuru hone par |
| `emitCycleCompleted()` | Phase successfully complete hone par |
| `emitCycleFailed()` | Phase fail hone par |
| `emitDecisionMade()` | Koi decision lene par (retry/skip/escalate) |
| `emitLoopDetected()` | Loop risk detect hone par |
| `emitEscalated()` | Escalation trigger hone par |
| `emitSupervisorShutdown()` | System band hone par |

---

### `events/event-handlers.ts` — Bus Listeners

**Kya karta hai:** `supervisorBus` pe sab 8 events ke liye listeners register/unregister karta hai. Har event par logging + metrics dono karta hai.

**Exports:**
| Export | Description |
|---|---|
| `registerSupervisorHandlers()` | Idempotent — double registration rokta hai |
| `unregisterSupervisorHandlers()` | `removeAllListeners()` + `_registered = false` |

**Per-event actions:**
- `started` → info log + `supervisor.sessions.started` counter
- `cycle.completed` → info log + counter + timing metric
- `cycle.failed` → warn log + counter
- `decision.made` → info log + per-action counter
- `loop.detected` → warn log + counter
- `escalated` → error log + counter
- `shutdown` → info log + counter

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

**Metrics tracked across the system:**
```
supervisor.sessions.started
supervisor.cycles.total / completed / failed / requested
supervisor.runs.succeeded / failed
supervisor.phases.<phase>.started / completed / failed
supervisor.cycle.<phase>             (timing)
supervisor.decision.<action>
supervisor.loops.detected
supervisor.escalations
supervisor.shutdowns
supervisor.agent.<role>.routed
supervisor.tasks.enqueued / started / completed / failed / routed.<phase>
supervisor.priority.boosted
```

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
3. Highest score jeet ta hai
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

| Consecutive Failures | Total Failures in Window | Risk Level |
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

**Kya karta hai:** Active runs ka snapshot maintain karta hai. Sub-monitors ko aggregate karke `ExecutionHealth` banata hai.

**Internal state:** `Map<runId, RunSnapshot>` — current phase, start time, retry count.

**`checkHealth(runId)` aggregates:**
- `stuckTaskDetector.getStuckTasks(runId)`
- `timeoutMonitor.isTimedOut(runId, currentPhase)`
- `loopDetector.detectGlobal(runId).risk`
- `retryCount >= 5` → retryExhausted

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

**Kya karta hai:** `retryManager` (orchestration) aur `retryDecision` ko combine karke single `executeWithRetry()` function provide karta hai.

**Flow:**
1. `retryDecision.maxRetries(phase, mode)` se max attempts nikalo
2. `retryManager.withRetry()` se exponential backoff ke saath run karo
3. Har retry par `supervisorLogger.warn()` se log karo
4. Success → `{ ok: true, value }`
5. Failure → `{ ok: false, decision, error }` — decision = retry/escalate

**Exports (`retryCoordinator`):**
- `.executeWithRetry(opts, fn)` → `{ ok, value } | { ok, decision, error }`
- `.isExhausted(taskId)` — kya retries khatam ho gayi
- `.waitBeforeRetry(attempt)` — delay with backoff
- `.clearTask(taskId)` — retry record clean

---

### `coordination/task-coordinator.ts` — Task Lifecycle Manager

**Kya karta hai:** `taskQueue` aur orchestration event emitters ko wrap karke task lifecycle manage karta hai (enqueue → start → complete/fail).

**State:** Uses orchestration's `taskQueue` — no separate state.

**Exports (`taskCoordinator`):**
| Method | Action |
|---|---|
| `.enqueue(spec)` | Queue + `emitTaskQueued` + metrics |
| `.markStarted(task)` | `emitTaskStarted` + counter |
| `.markCompleted(task, result)` | `emitTaskCompleted` + remove + counter |
| `.markFailed(task, error)` | `emitTaskFailed` + remove + error log |
| `.getQueueSize()` | `taskQueue.size()` |
| `.hasTask(taskId)` | Existence check |
| `.cancelRunTasks(runId)` | Sab queued tasks cancel karo |

---

### `coordination/pipeline-coordinator.ts` — Phase Lifecycle Coordination

**Kya karta hai:** Phase start/end lifecycle manage karta hai — timeout timers, loop detection, aur `emitPhaseStarted` sab ek jagah wired.

**`buildPlan(mode)`** — returns `PipelinePlan` with:
- `phases[]` (from `executionModeDetector`)
- `totalTimeoutMs` (mode-based: 60k/120k/200k per phase)

**`startPhase(runId, phase, mode, timeoutMs?)`:**
1. Logger info
2. `timeoutMonitor.startPhase()`
3. `loopDetector.record(phase, true)` — optimistic
4. `emitPhaseStarted(runId, phase)`

**`endPhase(runId, phase, success)`:**
1. `timeoutMonitor.endPhase()`
2. `loopDetector.record(phase, success)` — actual result

**Exports:** `.buildPlan()`, `.startPhase()`, `.endPhase()`, `.shouldSkipPhase()`, `.isPhaseTimedOut()`, `.remainingPhaseTimeMs()`, `.summarize(outcomes[])`

---

### `routing/agent-router.ts` — Phase → Agent Mapper

**Kya karta hai:** `AGENT_REGISTRY` se har phase ke liye correct agent role dhundta hai. Routing history 50 decisions tak maintain karta hai.

**`route(runId, phase, priority)`:**
1. `AGENT_REGISTRY[phase]` se `AgentDescriptor` fetch karo
2. `RoutingDecision` banao with taskId, targetAgent, targetPhase, reason
3. History mein record karo
4. Logger + metrics emit karo

**Exports (`agentRouter`):**
| Method | Description |
|---|---|
| `.route(runId, phase, priority)` | Main routing, returns `RoutingDecision` |
| `.getDescriptor(phase)` | Raw `AgentDescriptor` fetch |
| `.isRetryable(phase)` | Boolean from registry |
| `.timeoutFor(phase)` | Timeout ms from registry |
| `.getHistory(runId)` | Last 50 routing decisions |
| `.clearRun(runId)` | History delete |

---

### `routing/task-router.ts` — Task Mode/Category Router

**Kya karta hai:** Task ki mode aur category ke basis pe route decide karta hai. `priorityRouter` se priority resolve karta hai, `taskCoordinator` se enqueue karta hai.

**`route(spec)` flow:**
1. `priorityRouter.resolve(phase, mode, runId)` → priority
2. `TaskRoute` object banao
3. `taskCoordinator.enqueue()` — actually queue mein daalo
4. History record karo (max 100)
5. Logger + metrics

**Exports (`taskRouter`):** `.route(spec)`, `.getRoutes(runId)`, `.clearRun(runId)`

---

### `routing/priority-router.ts` — Task Priority Resolution

**Kya karta hai:** Har phase + mode combination ke liye `TaskPriority` decide karta hai. Custom rules support karta hai.

**Default phase priorities:**

| Phase | Priority |
|---|---|
| analyze | high |
| planning | high |
| execution | normal (complex mode mein → **high**) |
| verification | high |
| browser | low |
| failed | **critical** |

**Complex mode boost:** `execution` phase complex mode mein `normal` → `high` automatically upgrade hota hai.

**Exports (`priorityRouter`):**
- `.resolve(phase, mode, runId)` → `TaskPriority`
- `.addRule(rule)` / `.removeRule(ruleId)` — custom rules
- `.getStats()` — aggregate routing stats
- `.resetStats()` — stats reset

---

### `core/supervisor-state.ts` — Session State Machine

**Kya karta hai:** In-memory `Map<sessionId, SupervisorSession>` manage karta hai. State transitions enforce karta hai — invalid transitions throw karta hai.

**Valid state machine:**
```
idle → active → paused → active
              ↘          ↘
               shutdown ← shutdown
```

**Exports (`supervisorState`):**
| Method | Description |
|---|---|
| `.create(...)` | Naya session banao, `idle` status se start |
| `.transition(sessionId, status)` | Validated state change — invalid pe throw |
| `.setPhase(sessionId, phase)` | `currentPhase` update |
| `.incrementRetry(sessionId)` | `retryCount++`, returns new count |
| `.setMeta(sessionId, key, value)` | Metadata update |
| `.get(sessionId)` | Frozen copy return |
| `.getByRunId(runId)` | runId se session dhundo |
| `.isActive(sessionId)` | Boolean active check |
| `.activeSessions()` | All active + paused sessions |
| `.clear(sessionId)` | Session delete |

---

### `core/supervisor-context.ts` — Immutable Session Context

**Kya karta hai:** `OrchestrationContext` se supervisor-specific context banata hai aur in-memory store karta hai. Session ke analysis results (complexity, classification) access deta hai.

**`SupervisorContext` interface:**
```typescript
{ sessionId, runId, projectId, goal, timeoutMs,
  mode, category, complexity, classification,
  startedAt, metadata }
```

**Exports (`supervisorContext`):**
| Method | Description |
|---|---|
| `.create(sessionId, orchCtx, mode, category, complexity, classification)` | Context store karo |
| `.get(sessionId)` | Frozen copy |
| `.getByRunId(runId)` | runId se dhundo |
| `.updateMeta(sessionId, key, value)` | Metadata update |
| `.toOrchestrationContext(sessionId)` | Back-convert to `OrchestrationContext` |
| `.clear(sessionId)` | Cleanup |

---

### `core/execution-controller.ts` — Single Phase Runner

**Kya karta hai:** Ek phase ko run karne ka poora logic — routing, monitoring, retry, failure handling sab wire karta hai.

**`runPhase(opts, phase, phaseRunner)` full flow:**
```
1. agentRouter.route()          → RoutingDecision
2. taskRouter.route()           → TaskRoute + enqueue
3. pipelineCoordinator.startPhase()  → timeout timer start
4. executionMonitor.update()    → currentPhase update
5. retryCoordinator.executeWithRetry()  → actual runner
6. SUCCESS:
   pipelineCoordinator.endPhase(true)
   → PhaseExecutionResult { success: true }
7. FAILURE:
   pipelineCoordinator.endPhase(false)
   executionMonitor.checkHealth()  → health check
   failureDecision.decide()        → skip ya continue
   IF not skip: escalationDecision.shouldEscalate()
   → PhaseExecutionResult { success: false, decision, error }
```

**`decideContinue(results[])`** — true agar sab phases ya to succeed ya skip hui hain.

---

### `core/supervisor-engine.ts` — Full Pipeline Orchestrator

**Kya karta hai:** Supervisor system ka dil. `run()` method poori pipeline chalata hai — analysis se lekar final result tak.

**`run(ctx, phaseRunners)` complete flow:**
```
1. complexityAnalyzer.analyze(ctx.goal)       → ComplexityResult
2. goalClassifier.classify(ctx.goal)           → ClassificationResult
3. executionModeDetector.detect(...)           → mode + category
4. supervisorState.create() + transition(active)
5. supervisorContext.create()
6. executionMonitor.track()
7. emitSupervisorStarted()
8. phasesForMode(mode) → phases[]
9. For each phase:
   a. supervisorState.setPhase()
   b. emitCycleStarted()
   c. executionController.runPhase()
   d. SUCCESS → emitCycleCompleted()
   e. FAILURE → emitCycleFailed() + BREAK
10. supervisorState.transition(shutdown)
11. executionMonitor.untrack()
12. Metrics increment
13. Return SupervisorRunResult
```

**Exports:** `SupervisorEngine` class + `supervisorEngine` singleton instance.

---

## Cross-File Dependency Map

```
supervisor-agent.ts
  └── supervisor-engine.ts
        ├── supervisor-state.ts          (session state machine)
        ├── supervisor-context.ts        (immutable context store)
        ├── execution-controller.ts      (phase runner)
        │     ├── retry-coordinator.ts   ← retryManager (orchestration)
        │     ├── pipeline-coordinator.ts ← timeoutMonitor + loopDetector
        │     ├── agent-router.ts        ← AGENT_REGISTRY
        │     ├── task-router.ts         ← priorityRouter + taskCoordinator
        │     ├── escalation-decision.ts
        │     ├── failure-decision.ts
        │     └── execution-monitor.ts
        ├── complexity-analyzer.ts       (goal → score)
        ├── goal-classifier.ts           (goal → category)
        ├── execution-mode-detector.ts   (score+cat → mode+phases)
        ├── execution-monitor.ts
        │     ├── loop-detector.ts
        │     ├── stuck-task-detector.ts
        │     └── timeout-monitor.ts
        ├── supervisor-events.ts         (supervisorBus + emit helpers)
        ├── supervisor-logger.ts         ← runLogger (orchestration)
        └── supervisor-metrics.ts        ← metricsCollector (orchestration)

event-handlers.ts
  └── supervisorBus             (registers all 8 listeners)
       └── supervisor-logger + supervisor-metrics

validators.ts                   (standalone Zod — no internal deps)
supervisor-helpers.ts           (standalone pure functions)
execution-utils.ts              ← withTimeout (orchestration)
```

---

## Orchestration Layer Integration Points

| Supervisor Import | From | Used For |
|---|---|---|
| `orchestrationBus` | `orchestration/events/orchestration-events.ts` | Phase events emit |
| `retryManager` | `orchestration/retry/retry-manager.ts` | Actual retry execution |
| `taskQueue` | `orchestration/queue/task-queue.ts` | Task enqueue/dequeue |
| `runManager` | `orchestration/core/run-manager.ts` | Run lifecycle (create/start/complete) |
| `runLogger` | `orchestration/telemetry/run-logger.ts` | Structured logging |
| `metricsCollector` | `orchestration/telemetry/metrics.ts` | Counters + timings |
| `withTimeout`, `sleep` | `orchestration/utils/execution-utils.ts` | Async utilities |

---

## Execution Mode Summary

| Mode | Phases | Task Count | Use Case |
|---|---|---|---|
| `simple` | analyze → execution → verification | 1–3 | CRUD, simple forms |
| `standard` | analyze → planning → execution → verification | 4–8 | Auth, backend API |
| `complex` | analyze → planning → execution → verification → browser | 9–20 | AI app, SaaS, payments |

---

## Metrics Reference

```
supervisor.sessions.started          ← har naye session par
supervisor.cycles.total              ← har completed cycle par
supervisor.cycles.completed          ← cycle success
supervisor.cycles.failed             ← cycle failure
supervisor.cycles.requested          ← runSupervisorCycle() call par
supervisor.runs.succeeded            ← poori run complete
supervisor.runs.failed               ← poori run fail
supervisor.phases.<phase>.started    ← phase begin
supervisor.phases.<phase>.completed  ← phase pass
supervisor.phases.<phase>.failed     ← phase fail
supervisor.cycle.<phase>             ← phase duration (timing)
supervisor.decision.<action>         ← retry/skip/escalate/abort counter
supervisor.loops.detected            ← loop detection trigger
supervisor.escalations               ← escalation trigger
supervisor.shutdowns                 ← shutdown call
supervisor.agent.<role>.routed       ← agent routing counter
supervisor.tasks.enqueued            ← task queue entry
supervisor.tasks.started             ← task execution start
supervisor.tasks.completed           ← task success
supervisor.tasks.failed              ← task failure
supervisor.tasks.routed.<phase>      ← routing per phase
supervisor.priority.boosted          ← complex execution upgrade
```

---

## User Preferences

- Files under **250 LOC** — split intelligently
- High cohesion, low coupling — single responsibility per module
- **Fail-closed** — no silent failures, no swallowed errors
- Telemetry on all significant operations via the EventBus
- Typed contracts everywhere — no `any` unless unavoidable
