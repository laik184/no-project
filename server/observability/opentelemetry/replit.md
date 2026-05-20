# OpenTelemetry Agent

HVP-compliant distributed tracing + metrics observability system.  
No external npm dependencies — built entirely on Node.js built-ins.

---

## 1. Tracing Lifecycle

```
1. extractContext     — read incoming traceparent / baggage headers
2. startTrace         — allocate traceId + rootSpanId, status = RUNNING
3. createSpan         — open root span (child of upstream if context present)
4. injectContext      — write traceparent header for downstream calls
5. trackError         — attach exception event + stack to span (optional)
6. closeSpan          — record endTime, durationMs, resolve SpanStatus
7. collectMetrics     — derive latency / count / error-rate metrics from spans
8. endTrace           — mark trace COMPLETED, detach from activeTraces
9. exportTelemetry    — POST to Jaeger / Zipkin / Prometheus, or write to stdout
```

---

## 2. Span Hierarchy

```
Trace (traceId)
 └── Root Span (rootSpanId)
       ├── Child Span A (parentSpanId = rootSpanId)
       │     └── Grandchild Span (parentSpanId = A.spanId)
       └── Child Span B (parentSpanId = rootSpanId)
```

Parent–child links are carried via `parentSpanId` on each `Span`.  
The W3C `traceparent` header format (`{version}-{traceId}-{spanId}-{flags}`) propagates
the active span to downstream services.

---

## 3. Metrics Flow

```
closeSpan          → span has durationMs
collectMetrics     → reads all spans for a traceId
                   → emits:
                       trace.latency.avg_ms   (gauge)
                       trace.latency.total_ms (counter)
                       trace.span.count       (counter)
                       trace.span.error_count (counter)
                       trace.error_rate.percent (gauge, if provided)
                       trace.request.count    (counter, if provided)
exportTelemetry    → serialises metrics to Prometheus exposition format
                     or includes them in the Jaeger / Zipkin JSON payload
```

---

## 4. File Responsibilities

| File | Layer | Responsibility |
|---|---|---|
| `types.ts` | L0 | All shared types and interfaces |
| `state.ts` | L0 | Immutable state shape + `transitionState` reducer |
| `orchestrator.ts` | L1 | Coordinates all agents, exposes `runTraceSessionOrchestrator` |
| `agents/tracer.agent.ts` | L2 | `startTrace` / `endTrace` lifecycle |
| `agents/span-builder.agent.ts` | L2 | `createSpan` / `closeSpan` with parent-child linking |
| `agents/metrics-collector.agent.ts` | L2 | Derives latency, count, error-rate metrics from spans |
| `agents/exporter.agent.ts` | L2 | HTTP POST to Jaeger / Zipkin / Prometheus; console fallback |
| `agents/context-propagation.agent.ts` | L2 | W3C traceparent inject + extract |
| `agents/error-tracker.agent.ts` | L2 | Attaches exception events + stack traces to spans |
| `utils/trace-id.util.ts` | L3 | `generateTraceId` (32 hex) / `generateSpanId` (16 hex) |
| `utils/span.util.ts` | L3 | Duration calc, SpanStatus resolution, summary helpers |
| `utils/metric.util.ts` | L3 | `buildMetric`, aggregation, Prometheus exposition formatter |
| `utils/time.util.ts` | L3 | `nowMs`, `nowIso`, `hrNowMs`, `msSince` |
| `utils/logger.util.ts` | L3 | `buildLog` / `buildError` string helpers |
| `index.ts` | — | Public API: `startTraceSession`, `endTraceOnly`, `getMetrics` |

---

## 5. Import Relationships

```
index.ts
  └── orchestrator.ts (L1)
        ├── agents/tracer.agent.ts (L2)
        │     ├── utils/trace-id.util.ts
        │     └── utils/logger.util.ts
        ├── agents/span-builder.agent.ts (L2)
        │     ├── utils/trace-id.util.ts
        │     ├── utils/span.util.ts
        │     └── utils/logger.util.ts
        ├── agents/metrics-collector.agent.ts (L2)
        │     ├── utils/metric.util.ts
        │     └── utils/logger.util.ts
        ├── agents/exporter.agent.ts (L2)
        │     ├── utils/metric.util.ts
        │     ├── utils/time.util.ts
        │     └── utils/logger.util.ts
        ├── agents/context-propagation.agent.ts (L2)
        │     ├── utils/trace-id.util.ts
        │     └── utils/logger.util.ts
        └── agents/error-tracker.agent.ts (L2)
              ├── utils/time.util.ts
              └── utils/logger.util.ts
```

**Rules enforced:**
- Orchestrator → Agents only (no Agent → Agent)
- Agents → Utils only (no Agent → Orchestrator)
- No external npm dependencies

---

## 6. Environment Variables (Exporter)

| Variable | Default | Description |
|---|---|---|
| Set via `ExporterConfig.target` | `"console"` | `jaeger` / `zipkin` / `prometheus` / `console` |
| Set via `ExporterConfig.endpoint` | Target defaults | Full URL of the collector |
| Set via `ExporterConfig.timeout` | `5000` | HTTP request timeout in ms |
| Set via `ExporterConfig.serviceName` | Required | Service label on all payloads |

---

## 7. Integration Guide

### Full trace session (recommended)

```typescript
import { startTraceSession } from "./server/agents/observability/opentelemetry/index.js";

const { output } = await startTraceSession("api", "POST /payments", {
  attributes: { "http.method": "POST", "http.route": "/payments" },
  incomingHeaders: req.headers as Record<string, string>,
  exporterConfig: {
    target: "jaeger",
    endpoint: "http://localhost:14268/api/traces",
    serviceName: "api",
    timeout: 3000,
  },
});

console.log(output.traceId, output.spans.length, output.metrics.length);
```

### Manual span control

```typescript
import {
  startTrace,
  createSpan,
  closeSpan,
  endTrace,
} from "./server/agents/observability/opentelemetry/index.js";
import { INITIAL_STATE } from "./server/agents/observability/opentelemetry/state.js";

let state = INITIAL_STATE;

const t = startTrace(state, { service: "worker", rootSpanName: "job.run" });
state = t.nextState;

const s = createSpan(state, { traceId: t.trace.traceId, name: "db.query" });
state = s.nextState;

// ... do work ...

const c = closeSpan(state, { spanId: s.span.spanId, traceId: t.trace.traceId });
state = c.nextState;

endTrace(state, { traceId: t.trace.traceId });
```

### Read current metrics

```typescript
import { getMetrics } from "./server/agents/observability/opentelemetry/index.js";

const metrics = getMetrics();
metrics.forEach(m => console.log(m.name, m.value, m.unit));
```

### Express middleware

```typescript
import { startTraceSession } from "./server/agents/observability/opentelemetry/index.js";

app.use(async (req, res, next) => {
  const { output } = await startTraceSession("api", `${req.method} ${req.path}`, {
    incomingHeaders: req.headers as Record<string, string>,
    attributes: { "http.method": req.method, "http.route": req.path },
  });
  res.setHeader("x-trace-id", output.traceId);
  next();
});
```
