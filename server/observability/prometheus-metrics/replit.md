# Prometheus Metrics Agent

HVP-compliant Prometheus metrics module for system observability.  
Generates valid Prometheus exposition format with no external npm dependencies.

---

## 1. Metrics Flow

```
orchestrator
  → initRegistry          (status: IDLE → RUNNING)
  → collectSystemMetrics  (memory, uptime, heap, event-loop lag)
  → [HTTP metrics]        (populated on each request via recordHttpRequest)
  → [Custom metrics]      (populated on demand via custom-metrics agent)
  → registerMetric        (declare descriptors in registry)
  → aggregateMetrics      (collect + render all from state)
  → renderExpositon       (status: RUNNING → READY)
  → expose /metrics       (returns exposition text)
```

On each subsequent `/metrics` scrape:
```
scrapeMetricsOrchestrator
  → collectSystemMetrics  (refresh live system values)
  → renderExpositon       (re-render full exposition text)
```

---

## 2. File Responsibilities

| File | Layer | Responsibility |
|---|---|---|
| `types.ts` | L0 | All shared types: Metric, MetricConfig, HistogramData, PrometheusOutput, etc. |
| `state.ts` | L0 | Immutable state, `transitionState`, `upsertMetricToState`, `lookupMetricInState` |
| `orchestrator.ts` | L1 | 7-step init flow; re-exports all public agent functions |
| `agents/registry-manager.agent.ts` | L2 | `initRegistry`, `registerMetric`, `renderExpositon`, `removeMetric` |
| `agents/metrics-collector.agent.ts` | L2 | `aggregateMetrics` — reads all metrics from state, returns count + exposition |
| `agents/system-metrics.agent.ts` | L2 | Collects memory, uptime, heap, event-loop lag from Node.js built-ins |
| `agents/http-metrics.agent.ts` | L2 | `recordHttpRequest` (counter + histogram), `incrementInFlight` (gauge) |
| `agents/custom-metrics.agent.ts` | L2 | `incrementCustomCounter`, `setCustomGauge`, `observeCustomHistogram`, `defineCustomMetric` |
| `utils/metric-builder.util.ts` | L3 | `buildMetric`, `updateMetricSamples`, bucket defaults, HELP/TYPE line builders |
| `utils/label-normalizer.util.ts` | L3 | Sanitize label names/values, block sensitive keys, `labelsToString` |
| `utils/histogram.util.ts` | L3 | `initBuckets`, `recordObservation`, `buildEmptyHistogram`, `histogramToLines` |
| `utils/counter.util.ts` | L3 | `incrementCounter`, `setGauge`, `findSample` |
| `utils/renderer.util.ts` | L3 | `renderMetricToLines`, `renderAllMetrics` — generates Prometheus exposition text |
| `utils/logger.util.ts` | L3 | `buildLog` / `buildError` string helpers |
| `index.ts` | — | Public API: `initMetrics`, `getMetrics`, `recordRequest`, `incrementCounter`, etc. |

---

## 3. Import Relationships

```
index.ts
  └── orchestrator.ts (L1)
        ├── agents/registry-manager.agent.ts (L2)
        │     ├── state.ts (L0)
        │     ├── utils/metric-builder.util.ts
        │     ├── utils/renderer.util.ts
        │     └── utils/logger.util.ts
        ├── agents/metrics-collector.agent.ts (L2)
        │     ├── state.ts (L0)
        │     ├── utils/renderer.util.ts
        │     └── utils/logger.util.ts
        ├── agents/system-metrics.agent.ts (L2)
        │     ├── state.ts (L0)
        │     ├── utils/metric-builder.util.ts
        │     └── utils/logger.util.ts
        ├── agents/http-metrics.agent.ts (L2)
        │     ├── state.ts (L0)
        │     ├── utils/metric-builder.util.ts
        │     ├── utils/counter.util.ts
        │     ├── utils/histogram.util.ts
        │     ├── utils/label-normalizer.util.ts
        │     └── utils/logger.util.ts
        └── agents/custom-metrics.agent.ts (L2)
              ├── state.ts (L0)
              ├── utils/metric-builder.util.ts
              ├── utils/counter.util.ts
              ├── utils/histogram.util.ts
              ├── utils/label-normalizer.util.ts
              └── utils/logger.util.ts
```

**HVP rules enforced:**
- No agent → agent imports (cross-agent state helpers live in state.ts L0)
- No agent → orchestrator imports
- No external npm dependencies

---

## 4. Endpoint Usage

### Mount the `/metrics` endpoint in Express

```typescript
import express from "express";
import { initMetrics, getMetrics } from "./server/agents/observability/prometheus-metrics/index.js";

const app = express();

// Initialize once at startup
await initMetrics({ prefix: "myapp", collectDefaultMetrics: true });

// Expose the /metrics endpoint for Prometheus scraping
app.get("/metrics", async (req, res) => {
  // Restrict access in production (e.g. check bearer token or source IP)
  const token = req.headers.authorization;
  if (process.env.METRICS_TOKEN && token !== `Bearer ${process.env.METRICS_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const exposition = await getMetrics();
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  res.send(exposition);
});
```

### Record HTTP requests (Express middleware)

```typescript
import { recordRequest } from "./server/agents/observability/prometheus-metrics/index.js";

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    recordRequest({
      method: req.method,
      route: req.route?.path ?? req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
    });
  });
  next();
});
```

### Custom business metrics

```typescript
import {
  incrementCounter,
  setGauge,
  observeHistogram,
} from "./server/agents/observability/prometheus-metrics/index.js";

// Count a business event
incrementCounter("payments_processed_total", { currency: "usd", status: "success" });

// Set a live gauge
setGauge("active_user_sessions", 142, { region: "us-east" });

// Record a latency observation
observeHistogram("db_query_duration_seconds", 0.034, { table: "users", op: "select" });
```

---

## 5. Example Metrics Output

```
# HELP process_memory_bytes Node.js process memory usage in bytes by type
# TYPE process_memory_bytes gauge
process_memory_bytes{type="rss"} 52428800 1713254400000
process_memory_bytes{type="heap_used"} 24117248 1713254400000
process_memory_bytes{type="heap_total"} 33554432 1713254400000
process_memory_bytes{type="external"} 1048576 1713254400000

# HELP process_uptime_seconds Total process uptime in seconds
# TYPE process_uptime_seconds counter
process_uptime_seconds 3600 1713254400000

# HELP nodejs_eventloop_lag_seconds Approximated Node.js event loop lag in seconds
# TYPE nodejs_eventloop_lag_seconds gauge
nodejs_eventloop_lag_seconds 0.0012 1713254400000

# HELP http_requests_total Total HTTP requests, by method, route, and status
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/users",status="200",status_class="2xx"} 1024

# HELP http_request_duration_seconds HTTP request duration in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/api/users",le="0.005"} 512
http_request_duration_seconds_bucket{method="GET",route="/api/users",le="0.01"} 768
http_request_duration_seconds_bucket{method="GET",route="/api/users",le="+Inf"} 1024
http_request_duration_seconds_sum{method="GET",route="/api/users"} 42.1
http_request_duration_seconds_count{method="GET",route="/api/users"} 1024

# HELP payments_processed_total Custom counter: payments_processed_total
# TYPE payments_processed_total counter
payments_processed_total{currency="usd",status="success"} 99
```

---

## 6. Security

- Label keys containing `password`, `token`, `secret`, `authorization`, `apikey`, `ssn`, etc. are **silently dropped** by `label-normalizer.util.ts`
- Label values are escaped (backslash, quote, newline) per the Prometheus exposition spec
- The `/metrics` endpoint should be gated behind a `METRICS_TOKEN` bearer check or network-level IP allowlist in production
