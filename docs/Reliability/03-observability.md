# Observability Doc

> How NURAX tracks, measures, and surfaces what is happening inside a running agent — from a single tool call to a full multi-wave execution — in real time.

---

## Overview

Observability in NURAX is built on four pillars:

| Pillar | Mechanism | Visible where |
|---|---|---|
| **Events** | TypedEventBus → SSE bridge | Frontend Agent Action Feed |
| **Metrics** | In-memory counters + spans | API endpoints, logs |
| **Structured logging** | Prefixed logger per module | Server console / workflow logs |
| **Health monitoring** | Periodic sweeps + HTTP checks | Startup diagnostics, UI status |

---

## 1. EventBus

**File:** `server/infrastructure/events/bus.ts`

A central, typed, in-process event bus backed by Node.js `EventEmitter`. Every significant action inside the system emits an event here. No module talks directly to another — they publish and subscribe through the bus.

### Event Topics (`TOPIC` constants)

| Topic | What it carries |
|---|---|
| `agent.event` | Individual agent step (tool called, file written, LLM invoked) |
| `run.lifecycle` | Run state transitions (started → running → completed / failed / escalated) |
| `checkpoint` | Snapshot created or rollback executed |
| `console.log_line` | Stdout/stderr from sandbox processes, forwarded to UI console |
| `preview.reload` | Preview iframe should refresh |
| `terminal.output` | Terminal session line-by-line output |

### Event shape

```typescript
interface BusEvent<T = unknown> {
  topic: string;        // e.g. "agent.event"
  projectId: number;
  runId?: string;
  timestamp: string;    // ISO 8601
  payload: T;           // topic-specific data
}
```

### Bus Adapter

**File:** `server/shared/events/bus-adapter.ts`  
**Initialised by:** `initBusAdapter(bus)` — Phase 1 of startup, before any module loads

The bus adapter is the bridge that normalises events from the typed internal bus into the string-keyed format the SSE Manager expects. This decouples the type system from the transport layer.

---

## 2. SSE Manager

**File:** `server/infrastructure/events/sse/sse-manager.ts`

Manages all active Server-Sent Events connections from the frontend. When the EventBus emits, the SSE Manager fans out to the relevant clients.

### Connection lifecycle

```
Client opens GET /api/realtime?projectId=1&runId=abc
    │
    ▼
sseManager.register(res, topics, projectId, runId, lastEventId)
    │
    ├── Replays up to 1,000 buffered events (for reconnection)
    ├── Registers client in internal pool
    └── Subscribes to matching topic+projectId+runId filter

EventBus emits → sseManager fans out → matching clients receive event

Client disconnects → req.on('close') → cleanup() removes from pool
```

### Heartbeat

The SSE Manager sends a `ping` comment every **30 seconds** to all connections:
```
: ping
```
This keeps the connection alive through proxies and load balancers that would otherwise time out idle connections.

### History buffer

Up to **1,000 events** are buffered in memory per `projectId`. When a client reconnects with a `Last-Event-ID` header, it receives all missed events since that ID — preventing gaps in the Agent Action Feed after a brief disconnect.

---

## 3. Telemetry & Metrics

### Orchestration Metrics

**File:** `server/orchestration/telemetry/metrics.ts`

An in-memory store tracking the health of the orchestration layer:

| Metric | Type | Description |
|---|---|---|
| `runs.total` | Counter | Total agent runs started |
| `runs.succeeded` | Counter | Runs completed successfully |
| `runs.failed` | Counter | Runs that ended in FAILED state |
| `runs.escalated` | Counter | Runs that required human intervention |
| `wave.duration_ms` | Histogram | Time taken per execution wave |
| `plan.task_count` | Histogram | Number of tasks per execution plan |

### Tool Metrics

**File:** `server/tools/registry/tool-metrics.ts`

Tracks performance data for every tool call through the dispatcher:

| Metric | Description |
|---|---|
| `invocations` | Total calls per tool name |
| `failures` | Failed calls (handler threw or timed out) |
| `retries` | Retry attempts triggered |
| `timeouts` | Calls that hit the timeout limit |
| `avg_duration_ms` | Rolling average call duration |

Every `dispatch()` call updates these metrics automatically — no manual instrumentation needed in tool handlers.

### Agent Metrics

Tracked per agent session:

| Metric | Description |
|---|---|
| `step_count` | Number of steps/tool calls in the run |
| `failure_rate` | `failures / step_count` ratio |
| `token_usage` | LLM tokens consumed (input + output) |
| `heal_cycles` | Number of self-healing attempts |
| `duration_ms` | Total run wall-clock time |

---

## 4. Structured Logging

Every module uses a **prefixed logger** that writes structured, machine-parseable lines to stdout:

```
[executor:run_abc123] Step 3/7 — writeFile → client/src/pages/Home.tsx (204 lines)
[orchestration] Wave 2 of 3 started — 2 tasks (api, auth)
[verifier:run_abc123] typecheck PASSED (0 errors)
[recovery] Heal cycle 1/3 — strategy: patch-recovery
[sse-manager] Client disconnected (projectId=1) — pool size: 3
```

### Log levels

| Level | Used for |
|---|---|
| `INFO` | Normal lifecycle events (started, completed, registered) |
| `WARN` | Recoverable issues, degraded modes (Redis not set, API key missing) |
| `ERROR` | Failures that require attention |
| `DEBUG` | High-frequency internal state (tool args, vector scores) — off in production |

### Lifecycle logging

Every state transition emits a log line at `INFO`:

```
[run.lifecycle] run_abc123 → RUNNING   (projectId=1, goal="add login page")
[run.lifecycle] run_abc123 → COMPLETED (duration=47.2s, steps=12)
[run.lifecycle] run_abc123 → ESCALATED (after 3 heal cycles, lastError=BuildError)
```

---

## 5. Execution Timeline

**File:** `server/agents/executor/telemetry/execution-timeline.ts`

An **append-only** record of every significant event in an agent run. Acts as an audit log and replay source.

```typescript
interface TimelineEntry {
  id: string;
  runId: string;
  type: 'step.started' | 'step.completed' | 'tool.called' | 'tool.returned'
      | 'validation.failed' | 'recovery.started' | 'recovery.completed'
      | 'checkpoint.created' | 'rollback.executed';
  timestamp: string;
  data: Record<string, unknown>;   // tool name, args, result, error, etc.
}
```

The timeline is queryable via the API and replayed in the frontend's **Agent Action Feed** panel.

---

## 6. Health Monitoring

### Startup Diagnostics

**File:** `server/startup/health-diagnostics.ts`  
**Called by:** `runStartupDiagnostics()` — first thing in `bootstrap()`

Checks environment on every server start:

```
✓  LLM key found (OPENROUTER_API_KEY)
✓  DATABASE_URL configured
✓  AGENT_PROJECT_ROOT=/home/runner/workspace/.sandbox
✓  LLM model: openai/gpt-oss-120b:free
⚠  REDIS_URL not set — using null client (caching disabled)
```

Warnings are printed but do not block startup. Only truly fatal conditions (no database, bad port) exit the process.

### Runtime Health Monitor

**File:** `server/agents/terminal/monitoring/runtime-health-monitor.ts`

Runs periodic sweeps every **60 seconds**:

- **Stuck session detection** — any session with no activity for >10 minutes is flagged and a `WARN` log + bus event is emitted for recovery orchestration
- **Failure rate tracking** — if `failure_rate > 0.5` for a session, a health warning is emitted
- **HTTP health check** — polls `/health` on running sandbox processes to confirm they are responsive

### Health API

```
GET /health
→ { ok: true, uptime: 3847.2 }

GET /api/project-status
→ {
    ok: true,
    running: [{ projectId, pid, port, status, startedAt, restartCount }],
    entries: [...]
  }
```

---

## 7. Frontend Integration

The React frontend subscribes to SSE events and renders them live.

### Components consuming SSE

| Component | Topics subscribed | What it renders |
|---|---|---|
| **AgentActionFeed** | `AGENT`, `LIFECYCLE` | Live step feed — tool calls, file writes, LLM calls |
| **LogsPanel** | `CONSOLE` | Sandbox process stdout/stderr line by line |
| **PreviewPane** | `PREVIEW_RELOAD` | Refreshes iframe when agent writes frontend files |
| **StatusBar** | `LIFECYCLE` | Run state badge (Idle / Running / Completed / Failed) |

### SSE subscription hook

```typescript
// client/src/hooks/useRealtimeFeed.ts
const { events } = useRealtimeFeed({
  projectId,
  runId,
  topics: ['agent.event', 'run.lifecycle']
});
```

The hook handles:
- Automatic reconnection with `Last-Event-ID` (no missed events)
- Exponential back-off on connection failure
- Cleanup on component unmount

---

## Key Files Reference

| File | Role |
|---|---|
| `server/infrastructure/events/bus.ts` | Central typed EventBus |
| `server/shared/events/bus-adapter.ts` | Normalises events for SSE transport |
| `server/infrastructure/events/sse/sse-manager.ts` | SSE connection pool + fan-out |
| `server/orchestration/telemetry/metrics.ts` | Orchestration counters and histograms |
| `server/tools/registry/tool-metrics.ts` | Per-tool performance tracking |
| `server/agents/executor/telemetry/execution-timeline.ts` | Append-only audit log per run |
| `server/startup/health-diagnostics.ts` | Boot-time environment checks |
| `server/agents/terminal/monitoring/runtime-health-monitor.ts` | Periodic stuck-session sweeps |
