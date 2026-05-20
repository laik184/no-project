# Health Check Agent

HVP-compliant production-grade health check system exposing `/health`, `/ready`, and `/live` endpoints.  
No external npm dependencies — uses Node.js built-ins only.

---

## 1. Healthcheck Flow

### Full `/health` check

```
orchestrator.runFullHealthCheck()
  → liveness-check        (process alive, memory, event loop)
  → readiness-check       (uptime, heap, init, config)
  → dependency-check      (external services, DB, cache)
  → status-aggregator     (merge all CheckResults → HealthStatus)
  → healthcheck-endpoint  (build HTTP response with correct status code)
```

### Liveness `/live` check

```
orchestrator.runLivenessOrchestrator()
  → liveness-check
  → status-aggregator.aggregateLivenessStatus()
```

### Readiness `/ready` check

```
orchestrator.runReadinessOrchestrator()
  → readiness-check
  → dependency-check      (lightweight)
  → status-aggregator.aggregateReadinessStatus()
```

---

## 2. Endpoint Roles

| Endpoint | Purpose | HTTP 200 means | HTTP 503 means |
|---|---|---|---|
| `/health` | Full system status for humans and dashboards | All checks passing | One or more critical failures |
| `/ready` | Is the service ready to receive traffic? | Initialized, configured, deps reachable | Not yet ready — don't route traffic here |
| `/live` | Is the process alive? (Kubernetes liveness probe) | Process is running | Process is dead/unresponsive — restart it |

**Status values:**
- `HEALTHY` → all checks pass → HTTP 200
- `DEGRADED` → warnings only (non-critical) → HTTP 200
- `DOWN` → one or more FAIL checks → HTTP 503

---

## 3. File Responsibilities

| File | Layer | Responsibility |
|---|---|---|
| `types.ts` | L0 | HealthStatus, CheckResult, DependencyChecker, HealthResponse, HealthState, etc. |
| `state.ts` | L0 | Immutable state, `transitionState`, `mergeChecks`, `deriveHealthStatus` |
| `orchestrator.ts` | L1 | Sequences agents for `/health`, `/ready`, `/live`; no business logic |
| `agents/liveness-check.agent.ts` | L2 | Checks process uptime, heap memory, and event-loop responsiveness |
| `agents/readiness-check.agent.ts` | L2 | Checks initialization, config loaded, heap available; accepts custom sync checks |
| `agents/dependency-check.agent.ts` | L2 | Runs injected `DependencyChecker` functions concurrently with timeout protection |
| `agents/status-aggregator.agent.ts` | L2 | Merges check lists → `HealthStatus`; builds final `HealthResponse` |
| `agents/healthcheck-endpoint.agent.ts` | L2 | Builds HTTP response envelopes with status codes, headers, optional auth |
| `utils/response-builder.util.ts` | L3 | `buildCheckResult`, `buildHealthResponse`, `checksToHealthStatus`, `httpStatusFromHealth` |
| `utils/timeout.util.ts` | L3 | `withTimeout`, `TimeoutError`, `nowMs`, `elapsedMs` |
| `utils/error-normalizer.util.ts` | L3 | `normalizeError`, `normalizeErrorWithName`, `isCritical` |
| `utils/logger.util.ts` | L3 | `buildLog` / `buildError` string helpers |
| `index.ts` | — | Public API: `getHealth()`, `getReadiness()`, `getLiveness()` + Express helpers |

---

## 4. Import Relationships

```
index.ts
  └── orchestrator.ts (L1)
        ├── agents/liveness-check.agent.ts (L2)
        │     ├── state.ts (L0)
        │     ├── utils/response-builder.util.ts
        │     ├── utils/timeout.util.ts
        │     └── utils/logger.util.ts
        ├── agents/readiness-check.agent.ts (L2)
        │     ├── state.ts (L0)
        │     ├── utils/response-builder.util.ts
        │     ├── utils/timeout.util.ts
        │     └── utils/logger.util.ts
        ├── agents/dependency-check.agent.ts (L2)
        │     ├── state.ts (L0)
        │     ├── utils/response-builder.util.ts
        │     ├── utils/timeout.util.ts
        │     ├── utils/error-normalizer.util.ts
        │     └── utils/logger.util.ts
        ├── agents/status-aggregator.agent.ts (L2)
        │     ├── state.ts (L0)
        │     ├── utils/response-builder.util.ts
        │     └── utils/logger.util.ts
        └── agents/healthcheck-endpoint.agent.ts (L2)
              ├── utils/response-builder.util.ts
              └── utils/logger.util.ts
```

**HVP rules enforced:**
- No agent → agent imports
- No direct DB / infra calls — dependencies injected via `DependencyChecker` interface
- No external npm dependencies

---

## 5. Integration Guide

### Mount health endpoints in Express

```typescript
import express from "express";
import { getHealth, getReadiness, getLiveness, buildHealthEndpointResponse, buildLivenessEndpointResponse, buildReadinessEndpointResponse } from "./server/agents/observability/health/index.js";

const app = express();

// /live — Kubernetes liveness probe (fast, no deps)
app.get("/live", async (req, res) => {
  const { output } = await getLiveness();
  const response = buildLivenessEndpointResponse(
    { path: req.path, headers: req.headers as Record<string, string>, ip: req.ip },
    output.status === "HEALTHY",
  );
  res.status(response.statusCode).set(response.headers).json(response.body);
});

// /ready — Kubernetes readiness probe
app.get("/ready", async (req, res) => {
  const { output } = await getReadiness({
    isInitialized: true,
    configLoaded: true,
    dependencies: myDependencies,
  });
  const response = buildReadinessEndpointResponse(
    { path: req.path, headers: req.headers as Record<string, string>, ip: req.ip },
    output,
  );
  res.status(response.statusCode).set(response.headers).json(response.body);
});

// /health — Full status dashboard
app.get("/health", async (req, res) => {
  const { output } = await getHealth({ dependencies: myDependencies });
  const response = buildHealthEndpointResponse(
    { path: req.path, headers: req.headers as Record<string, string>, ip: req.ip },
    output,
    { authToken: process.env.HEALTH_TOKEN },
  );
  res.status(response.statusCode).set(response.headers).json(response.body);
});
```

### Register custom dependency checkers

```typescript
import type { DependencyChecker } from "./server/agents/observability/health/index.js";

const dbChecker: DependencyChecker = {
  name: "postgres",
  check: async () => {
    const start = Date.now();
    try {
      await db.query("SELECT 1");
      return { name: "postgres", healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { name: "postgres", healthy: false, latencyMs: Date.now() - start, error: String(err) };
    }
  },
};

const redisChecker: DependencyChecker = {
  name: "redis",
  check: async () => {
    const start = Date.now();
    try {
      await redisClient.ping();
      return { name: "redis", healthy: true, latencyMs: Date.now() - start };
    } catch (err) {
      return { name: "redis", healthy: false, latencyMs: Date.now() - start, error: String(err) };
    }
  },
};

const myDependencies = [dbChecker, redisChecker];
```

### Example `/health` response

```json
{
  "success": true,
  "status": "HEALTHY",
  "uptime": 3612.4,
  "timestamp": "2026-04-16T12:00:00.000Z",
  "checks": [
    { "name": "process.uptime", "status": "PASS", "message": "Process alive: uptime=3612.4s", "durationMs": 0 },
    { "name": "process.memory", "status": "PASS", "message": "Memory OK: heap=45.2MB rss=112.0MB", "durationMs": 1, "metadata": { "heapUsedMb": 45.2, "rssMb": 112.0 } },
    { "name": "readiness.initialized", "status": "PASS", "message": "Application initialized", "durationMs": 0 },
    { "name": "dependency.postgres", "status": "PASS", "message": "postgres healthy (3ms)", "durationMs": 3, "metadata": { "latencyMs": 3 } }
  ],
  "logs": []
}
```

### Example degraded response (HTTP 200 but status=DEGRADED)

```json
{
  "success": true,
  "status": "DEGRADED",
  "checks": [
    { "name": "process.memory", "status": "WARN", "message": "High memory: heap=920.0MB rss=1200.0MB" }
  ]
}
```

### Example DOWN response (HTTP 503)

```json
{
  "success": false,
  "status": "DOWN",
  "checks": [
    { "name": "dependency.postgres", "status": "FAIL", "message": "postgres unhealthy: ECONNREFUSED", "error": "ECONNREFUSED" }
  ]
}
```

---

## 6. Security

- The `/health` endpoint accepts an optional `authToken` — requests must supply `Authorization: Bearer <token>`
- IP allowlisting is also supported via `allowedIps` in `EndpointOptions`
- All responses carry `Cache-Control: no-store` to prevent caching of stale status
- No sensitive data (passwords, tokens, secrets) is ever included in check results
