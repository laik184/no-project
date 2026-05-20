# optimization-intelligence

## Purpose

A pure analysis engine that ingests structured runtime metrics and code structure
profiles and produces a fully immutable, ranked `OptimizationReport` — with zero
side effects, no code modification, and no runtime access.

---

## What It Handles

- CPU usage pattern analysis (hot functions, high system usage)
- Memory pressure analysis (heap utilization, RSS overhead, external memory)
- Endpoint latency pattern analysis (avg, P99, threshold breaches)
- Async refactor suggestions (sync functions with I/O calls)
- Sync blocking detection (sync FS, loops in non-async context, error correlation)
- Worker thread recommendations (heavy compute, loop-intensive functions)
- Caching opportunity detection (low hit rates, uncached GET endpoints)
- Payload optimization suggestions (large responses, missing compression, no field filtering)
- Impact-ranked suggestion list (CRITICAL → HIGH → MEDIUM → LOW)
- Aggregate `OptimizationSummary` with dominant category and priority focus text

## What It Does NOT Handle

- Does NOT modify any code (no patching — use `patch-engine` for that)
- Does NOT execute code or spawn processes
- Does NOT access the filesystem
- Does NOT call git, deployment, or runtime layers
- Does NOT detect hardcoded secrets (see `hardcoded-secret-detection`)
- Does NOT compare env configs (see `dev-prod-config-diff`)
- Does NOT apply any changes — only produces suggestions

---

## File-by-File Responsibility

| File | Responsibility |
|---|---|
| `types.ts` | All shared types, interfaces, thresholds, scoring constants |
| `state.ts` | In-memory session lifecycle; tracks stage + findings; no agent imports |
| `utils/scoring.util.ts` | Pure scoring functions: impact↔score conversion, clamp, blend, count, top-finding |
| `performance/cpu-pattern.agent.ts` | CPU usage + hot-loop function analysis |
| `performance/memory-pattern.agent.ts` | Heap pressure, RSS overhead, external memory analysis |
| `performance/latency-pattern.agent.ts` | Endpoint latency + runtime metric threshold breach detection |
| `code-optimization/async-suggestion.agent.ts` | Suggests async refactoring for sync I/O functions |
| `code-optimization/sync-blocking.agent.ts` | Detects sync blocking in functions and correlated endpoints |
| `code-optimization/worker-thread.agent.ts` | Recommends Worker Thread offload for heavy compute functions |
| `code-optimization/caching-opportunity.agent.ts` | Detects low cache hit rates and uncached high-frequency GET routes |
| `payload/payload-optimizer.agent.ts` | Identifies oversized payloads, missing compression, absent field filtering |
| `ranking/impact-ranker.ts` | Sorts findings by impact+score, assigns rank+effort, builds OptimizationSummary |
| `orchestrator.ts` | Level 1 coordinator — calls all agents, manages session, returns frozen report |
| `index.ts` | Public API surface — re-exports types and orchestrator functions only |

---

## HVP Layer Diagram

```
Level 1 — Orchestration
└── orchestrator.ts

Level 2 — Domain Agents
├── performance/
│   ├── cpu-pattern.agent.ts
│   ├── memory-pattern.agent.ts
│   └── latency-pattern.agent.ts
├── code-optimization/
│   ├── async-suggestion.agent.ts
│   ├── sync-blocking.agent.ts
│   ├── worker-thread.agent.ts
│   └── caching-opportunity.agent.ts
└── payload/
    └── payload-optimizer.agent.ts

Level 3 — Cross-cutting support
├── ranking/
│   └── impact-ranker.ts
└── utils/
    └── scoring.util.ts
```

---

## Call Flow Diagram

```
index.ts
   │  (re-exports only)
   ▼
orchestrator.ts
   │
   ├─ PERFORMANCE stage
   │   ├── analyzeCpuPatterns(cpu, functions)       ← cpu-pattern.agent.ts
   │   ├── analyzeMemoryPatterns(memory)             ← memory-pattern.agent.ts
   │   └── analyzeLatencyPatterns(endpoints,metrics) ← latency-pattern.agent.ts
   │
   ├─ CODE_OPTIMIZATION stage
   │   ├── suggestAsyncRefactors(functions)          ← async-suggestion.agent.ts
   │   ├── detectSyncBlocking(functions, endpoints)  ← sync-blocking.agent.ts
   │   ├── recommendWorkerThreads(functions, cpu)    ← worker-thread.agent.ts
   │   └── detectCachingOpportunities(caches, eps)   ← caching-opportunity.agent.ts
   │
   ├─ PAYLOAD stage
   │   └── analyzePayloadOptimization(responses)     ← payload-optimizer.agent.ts
   │
   ├─ RANKING stage
   │   ├── rankSuggestions(allFindings)              ← ranking/impact-ranker.ts
   │   └── buildSummary(allFindings)                 ← ranking/impact-ranker.ts
   │
   └─ return deepFrozen OptimizationReport
```

---

## Import Direction Rules

```
ALLOWED:
index                → orchestrator, types
orchestrator         → all agents, state, ranking/impact-ranker, utils/scoring.util, types
agents               → types, utils/scoring.util
ranking/impact-ranker → types, utils/scoring.util

FORBIDDEN:
agents    → agents          (no cross-agent imports)
state     → agents          (state imports only types)
utils     → agents          (leaf nodes — pure functions)
any file  → orchestrator    (only index may reference orchestrator)
```

---

## Example Input

```typescript
import { analyze } from "./optimization-intelligence/index.js";

const report = analyze(
  {
    memory: { heapUsedMb: 420, heapTotalMb: 512, externalMb: 80, rssMb: 700 },
    cpu:    { usagePercent: 88, userMs: 2400, systemMs: 600 },
    endpoints: [
      { route: "/api/users", method: "GET", avgLatencyMs: 1800, p99LatencyMs: 3200,
        callCount: 5000, errorRate: 0.12 },
      { route: "/api/search", method: "GET", avgLatencyMs: 600, p99LatencyMs: 900,
        callCount: 2000, errorRate: 0.01 },
    ],
    metrics: [
      { name: "db.query", valueMs: 1500, threshold: 300 },
    ],
  },
  {
    functions: [
      { name: "loadUsers",     isAsync: false, hasSyncIoCalls: true,
        hasLoops: false, lineCount: 35, callFrequency: 80 },
      { name: "processMatrix", isAsync: false, hasSyncIoCalls: false,
        hasLoops: true,  lineCount: 120, callFrequency: 25 },
    ],
    responses: [
      { route: "/api/users", avgPayloadBytes: 620_000, hasCompression: false, hasFieldFilter: false },
    ],
    caches: [
      { route: "/api/search", cacheHitRate: 0.12, avgComputeMs: 280, callFrequency: 200 },
    ],
  },
);
```

## Example Output (abbreviated)

```json
{
  "reportId": "opt-1740700800000-0001",
  "findings": [
    { "findingId": "cpu-0001", "category": "CPU_PATTERN",      "impact": "CRITICAL", "score": 100 },
    { "findingId": "lat-0002", "category": "LATENCY_PATTERN",  "impact": "CRITICAL", "score": 100 },
    { "findingId": "async-003","category": "ASYNC_SUGGESTION",  "impact": "CRITICAL", "score": 100 },
    { "findingId": "cache-004","category": "CACHING_OPPORTUNITY","impact": "CRITICAL","score": 100 },
    { "findingId": "payload-5","category": "PAYLOAD_OPTIMIZATION","impact":"CRITICAL","score": 100 }
  ],
  "rankedSuggestions": [
    { "rank": 1, "impact": "CRITICAL", "effort": "HIGH",   "category": "CPU_PATTERN",
      "suggestion": "CPU usage is critically high. Offload compute to worker threads..." },
    { "rank": 2, "impact": "CRITICAL", "effort": "MEDIUM", "category": "LATENCY_PATTERN",
      "suggestion": "Critical latency on GET /api/users (3200ms)..." },
    { "rank": 3, "impact": "CRITICAL", "effort": "MEDIUM", "category": "ASYNC_SUGGESTION",
      "suggestion": "Function \"loadUsers\" performs synchronous I/O..." }
  ],
  "summary": {
    "totalFindings": 9,
    "criticalCount": 5,
    "highCount": 3,
    "mediumCount": 1,
    "lowCount": 0,
    "topCategory": "CPU_PATTERN",
    "overallScore": 760,
    "priorityFocus": "Address 5 critical finding(s) immediately — especially: runtime.cpu"
  },
  "analyzedAt": 1740700800000
}
```

---

## Ranking Explanation

Findings are sorted by a two-key sort:
1. `impact` level: `CRITICAL (0) → HIGH (1) → MEDIUM (2) → LOW (3)`
2. `score` descending (within same impact level)

Each `RankedSuggestion` also carries an `effort` field:

| Category | Effort |
|---|---|
| `CPU_PATTERN` | HIGH |
| `MEMORY_PATTERN` | HIGH |
| `WORKER_THREAD` | HIGH |
| `LATENCY_PATTERN` | MEDIUM |
| `ASYNC_SUGGESTION` | MEDIUM |
| `SYNC_BLOCKING` | MEDIUM |
| `CACHING_OPPORTUNITY` | LOW |
| `PAYLOAD_OPTIMIZATION` | LOW |

**Quick wins** = HIGH impact + LOW effort (e.g., caching, compression).
**Strategic** = HIGH impact + HIGH effort (e.g., worker threads, CPU profiling).

---

## Scoring Model

| Impact Level | Score |
|---|---|
| `CRITICAL` | 100 |
| `HIGH` | 60 |
| `MEDIUM` | 30 |
| `LOW` | 10 |

Thresholds in `types.ts`:

| Constant | Value |
|---|---|
| `LATENCY_HIGH_MS` | 500ms |
| `LATENCY_CRITICAL_MS` | 2000ms |
| `MEMORY_HIGH_PCT` | 80% |
| `MEMORY_CRITICAL_PCT` | 95% |
| `CPU_HIGH_PCT` | 75% |
| `CPU_CRITICAL_PCT` | 90% |
| `PAYLOAD_HIGH_BYTES` | 100KB |
| `PAYLOAD_CRITICAL_BYTES` | 500KB |
| `CACHE_HIT_LOW` | 40% |

---

## Integration Guidance

### With Planner

```typescript
import { analyze } from "./optimization-intelligence/index.js";

const report = analyze(runtimeInput, codeInput);

// Gate on critical findings
if (report.summary.criticalCount > 0) {
  plannerAgent.prioritize(report.rankedSuggestions.slice(0, 3));
}

// Pass top suggestion to patch-engine
const top = report.rankedSuggestions[0];
if (top?.category === "ASYNC_SUGGESTION") {
  patchEngine.applyPatch({ patchType: "ASYNC_REFACTOR", code: targetCode });
}
```

### With Runtime Monitor

```typescript
// Runtime monitor feeds live metrics → optimization-intelligence analyzes them
const runtimeInput = runtimeMonitor.snapshot();
const report       = analyzeRuntime(runtimeInput);

if (report.summary.overallScore > 300) {
  alerting.notify("High optimization pressure detected", report.summary);
}
```

### Call variants

```typescript
// Full analysis (both inputs)
analyze(runtimeInput, codeInput);

// Runtime-only analysis (no code structure needed)
analyzeRuntime(runtimeInput);

// Code-only analysis (static code structure)
analyzeCode(codeInput);
```
