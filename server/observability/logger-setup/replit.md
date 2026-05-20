# Logger Setup Agent

HVP-compliant structured logging system for backend observability.

---

## 1. Logging Flow

```
orchestrator
  → log-level-manager   (resolves LogLevel from env)
  → transport-builder   (builds console / file transports)
  → logger-config       (assembles full LoggerConfig)
  → format-builder      (creates serializer fn for LogEntry)
  → request-logger      (produces request LogEntry on demand)
  → error-logger        (produces error LogEntry on demand)
  → LoggerInstance      (frozen object, ready to use)
```

---

## 2. File Responsibilities

| File | Layer | Responsibility |
|---|---|---|
| `types.ts` | L0 | All shared types and interfaces |
| `state.ts` | L0 | Immutable state shape + `transitionState` reducer |
| `orchestrator.ts` | L1 | Coordinates all agents, returns frozen `AgentResult` |
| `agents/log-level-manager.agent.ts` | L2 | Resolves `LogLevel` from `LOG_LEVEL` env var |
| `agents/logger-config.agent.ts` | L2 | Builds `LoggerConfig` from resolved level + transports |
| `agents/transport-builder.agent.ts` | L2 | Builds console and/or file `TransportConfig[]` |
| `agents/format-builder.agent.ts` | L2 | Configures `serialize(entry)` function for chosen format |
| `agents/request-logger.agent.ts` | L2 | Creates a `LogEntry` for an incoming HTTP request |
| `agents/error-logger.agent.ts` | L2 | Creates a `LogEntry` for an error with full stack trace |
| `utils/timestamp.util.ts` | L3 | ISO timestamp and epoch helpers |
| `utils/formatter.util.ts` | L3 | Formats `LogEntry` as JSON string or pretty string |
| `utils/sanitizer.util.ts` | L3 | Redacts sensitive fields from meta objects |
| `utils/env.util.ts` | L3 | Safe reads of `process.env` with typed fallbacks |
| `utils/logger.util.ts` | L3 | `buildLog` / `buildError` string helpers |
| `index.ts` | — | Public API: `initLogger`, `getLogger`, `log` |

---

## 3. Import Relationships

```
index.ts
  └── orchestrator.ts (L1)
        ├── agents/log-level-manager.agent.ts (L2)
        │     └── utils/env.util.ts (L3)
        │     └── utils/logger.util.ts (L3)
        ├── agents/transport-builder.agent.ts (L2)
        │     └── utils/env.util.ts (L3)
        │     └── utils/logger.util.ts (L3)
        ├── agents/logger-config.agent.ts (L2)
        │     └── utils/env.util.ts (L3)
        │     └── utils/logger.util.ts (L3)
        ├── agents/format-builder.agent.ts (L2)
        │     └── utils/formatter.util.ts (L3)
        │     └── utils/logger.util.ts (L3)
        ├── agents/request-logger.agent.ts (L2)
        │     └── utils/sanitizer.util.ts (L3)
        │     └── utils/timestamp.util.ts (L3)
        │     └── utils/logger.util.ts (L3)
        └── agents/error-logger.agent.ts (L2)
              └── utils/sanitizer.util.ts (L3)
              └── utils/timestamp.util.ts (L3)
              └── utils/logger.util.ts (L3)
```

**Rules enforced:**
- Orchestrator → Agents only (never Agent → Agent)
- Agents → Utils only (never Agent → Orchestrator)
- No external npm module dependencies

---

## 4. Example Log Output

### JSON format (default)

```json
{
  "timestamp": "2026-04-16T12:00:00.000Z",
  "level": "info",
  "message": "GET /api/users 200 34ms",
  "requestId": "req-abc-123",
  "service": "api",
  "environment": "production",
  "meta": { "userId": "u-99" }
}
```

### Error log

```json
{
  "timestamp": "2026-04-16T12:00:01.000Z",
  "level": "error",
  "message": "Database connection refused",
  "requestId": "req-abc-456",
  "service": "api",
  "environment": "production",
  "error": {
    "name": "Error",
    "message": "Database connection refused",
    "stack": "Error: Database connection refused\n    at ..."
  }
}
```

### Pretty format

```
[2026-04-16T12:00:00.000Z] [INFO] GET /api/users 200 34ms | requestId=req-abc-123 | service=api | env=production
```

---

## 5. Environment Variables

| Variable | Default | Description |
|---|---|---|
| `LOG_LEVEL` | `info` | One of: `debug`, `info`, `warn`, `error` |
| `LOG_FORMAT` | `json` | One of: `json`, `pretty` |
| `LOG_CONSOLE` | `true` | Enable stdout transport |
| `LOG_COLORIZE` | `false` | Colorize console output |
| `LOG_FILE` | `false` | Enable file transport |
| `LOG_FILE_PATH` | `logs/app.log` | File path for file transport |
| `SERVICE_NAME` | `app` | Service identifier in log entries |
| `NODE_ENV` | `development` | Environment identifier in log entries |

---

## 6. Integration Guide

### Basic setup

```typescript
import { initLogger, getLogger, log } from "./server/agents/logger-setup/index.js";

// Initialize once at application startup
const { output } = initLogger();
const logger = output.logger;

// Use anywhere
logger.info("Server started", { port: 3000 }, "req-001");
logger.warn("High memory usage", { heapUsed: "450MB" });
logger.error("Unhandled exception", new Error("something failed"));
logger.debug("Parsed config", { config: { timeout: 5000 } });
```

### Module-level singleton

```typescript
import { getLogger } from "./server/agents/logger-setup/index.js";

const logger = getLogger();
logger.info("Module loaded");
```

### Convenience wrapper

```typescript
import { log } from "./server/agents/logger-setup/index.js";

log("info", "Payment processed", { amount: 99.99 }, "req-xyz");
```

### Express middleware (request logging)

```typescript
import { getLogger } from "./server/agents/logger-setup/index.js";

const logger = getLogger();

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    logger.info(`${req.method} ${req.url}`, {
      status: res.statusCode,
      durationMs: Date.now() - start,
    }, req.headers["x-request-id"] as string);
  });
  next();
});
```

### Express error handler (error logging)

```typescript
import { getLogger } from "./server/agents/logger-setup/index.js";

const logger = getLogger();

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.message, err, {}, req.headers["x-request-id"] as string);
  res.status(500).json({ error: "Internal server error" });
});
```
