# Global Observer Module

**Path:** `server/agents/intelligence/observation/global-observer/`  
**Layer:** L1 Orchestrated Pipeline (HVP-compliant)  
**Purpose:** System-wide behavior analyzer. Ingests raw execution events from any agent domain, detects anomalies, tracks trends, identifies patterns, computes a composite health score, and produces prioritized actionable insights.

---

## 1. Module Purpose

The Global Observer is the system's eyes and ears. It does not modify behavior — it observes, measures, and reports. Any module (recovery, self-improvement, global-governor) can call this module to understand the current state of the system before making decisions.

**Core deliverables per call:**
- `healthScore` (0–100) — overall system health
- `anomalies[]` — spike, burst, dead-agent, surge events with severity
- `trends[]` — per-module latency/successRate/throughput direction
- `patterns[]` — recurring behavioral fingerprints
- `insights[]` — prioritized, actionable recommendations

---

## 2. Full Flow Diagram

```
observe(ObserverInput { events[] })
        │
        ▼
input validation        ─── required fields, status enum, latency ≥ 0
        │
        ▼
signal-aggregator       ─── group events by module → SignalGroup[] (avg/max/min latency, success rate, agents)
        │
        ▼
pattern-detector        ─── scan SignalGroup[] + events → repeated-failure, latency-spike, burst-activity, low-throughput, high-success-streak
        │
        ▼
anomaly-detector        ─── threshold rules → error-rate-surge, latency-spike, failure-burst, dead-agent
        │
        ▼
trend-analyzer          ─── sliding window → slope per metric (latency, successRate, throughput) → improving/degrading/stable
        │
        ▼
health-evaluator        ─── weighted avg module scores − anomaly deductions ± trend modifiers → 0–100
        │
        ▼
insight-generator       ─── anomaly + trend + pattern + health → prioritized Insight[]
        │
        ▼
state.recordObservation ─── persist healthScore + anomalies + trends (capped at 200 each)
        │
        ▼
ObserverOutput { success, logs, data: { anomalies, trends, patterns, healthScore, insights } }
```

---

## 3. Agent Responsibilities

### `signal-aggregator.agent.ts`
**Input:** `ObservationEvent[]`  
**Output:** `SignalGroup[]`  
Groups all events by `module`. For each group computes: `successCount`, `failCount`, `successRate`, `avgLatency`, `maxLatency`, `minLatency`, `timeSpanMs`, unique `agents[]`. Sorts by total event count descending.

---

### `pattern-detector.agent.ts`
**Input:** `SignalGroup[]` + `ObservationEvent[]`  
**Output:** `DetectedPattern[]`  
Identifies 5 pattern types:
- **repeated-failure** — ≥3 fails, successRate < 0.5
- **latency-spike** — max > 3× average AND > 1000ms
- **burst-activity** — event rate > 10/sec within timeSpan
- **low-throughput** — < 3 events over > 60 seconds
- **high-success-streak** — agent with ≥10 consecutive successes

---

### `anomaly-detector.agent.ts`
**Input:** `SignalGroup[]` + `ObservationEvent[]`  
**Output:** `Anomaly[]`  
Applies 4 anomaly detection rules:
- **error-rate-surge** — ≥20% = high, ≥50% = critical
- **latency-spike** — max > 2.5× mean AND > 2000ms
- **failure-burst** — ≥3 fails AND fail% ≥ 50% of window
- **dead-agent** — agent with ≥3 consecutive failures and recent activity

Sorted by severity descending (critical first).

---

### `trend-analyzer.agent.ts`
**Input:** `SignalGroup[]` + `ObservationEvent[]`  
**Output:** `Trend[]`  
Per module, uses 30-second sliding window (5-second steps) to produce time-series values for latency, success rate, and throughput. Computes linear regression slope. Classifies direction:
- `|slope| < 0.05` → stable
- slope > 0 (good direction) → improving
- slope < 0 → degrading

Skips modules with fewer than 3 events.

---

### `health-evaluator.agent.ts`
**Input:** `SignalGroup[]` + `Anomaly[]` + `Trend[]`  
**Output:** `healthScore: number` (0–100)  
Three-phase calculation:
1. **Base score** — weighted avg of per-module (latency 40%, successRate 60%) normalized scores
2. **Anomaly deduction** — critical=−20, high=−10, medium=−4, low=−1 (capped at −50)
3. **Trend modifier** — improving=+2, degrading=−3 per trend (capped at ±10)

Returns 50 if no signals (neutral, not zero).

---

### `insight-generator.agent.ts`
**Input:** `Anomaly[]` + `Trend[]` + `DetectedPattern[]` + `SignalGroup[]` + `healthScore`  
**Output:** `Insight[]`  
Generates insights from 4 sources:
1. **Per anomaly** — specific action recommendation mapped to anomaly type
2. **Per degrading trend** — metric-specific optimization advice (> 10% change threshold)
3. **Repeated-failure patterns** — retry policy and recovery agent recommendation
4. **System health** — critical insight if score < 40, high insight if score < 60

Sorted by priority descending (critical first).

---

## 4. Who Calls This Module

```typescript
import { observe } from "server/agents/intelligence/observation/global-observer";

const result = observe({
  events: [...executionEvents]
});
```

Intended callers:
- `core/orchestration/global-governor/` — before arbitration to get current health context
- `intelligence/self-improvement/` — to validate improvement impact
- `intelligence/feedback-loop/` — to check system state before retry decisions
- Any domain wanting a system-wide health snapshot

---

## 5. What It Returns

```typescript
{
  success: true,
  logs: string[],           // full audit trail
  data: {
    anomalies: Anomaly[],   // sorted critical-first
    trends: Trend[],        // per module, per metric
    patterns: DetectedPattern[],
    healthScore: number,    // 0–100
    insights: Insight[]     // sorted critical-first, with recommendedAction
  }
}
```

On failure:
```typescript
{ success: false, logs: string[], error: string }
```

---

## 6. Example Input / Output

### Input
```typescript
observe({
  events: [
    { module: "auth-service", agent: "token-issuer", status: "fail", latency: 3200, timestamp: Date.now() - 5000 },
    { module: "auth-service", agent: "token-issuer", status: "fail", latency: 2900, timestamp: Date.now() - 3000 },
    { module: "auth-service", agent: "token-issuer", status: "fail", latency: 3100, timestamp: Date.now() - 1000 },
    { module: "router", agent: "intent-detector", status: "success", latency: 45, timestamp: Date.now() - 4000 },
    { module: "router", agent: "intent-detector", status: "success", latency: 52, timestamp: Date.now() - 2000 },
  ]
});
```

### Output
```typescript
{
  success: true,
  logs: [...],
  data: {
    healthScore: 38,
    anomalies: [
      { type: "dead-agent", module: "auth-service", agent: "token-issuer", severity: "critical", ... },
      { type: "failure-burst", module: "auth-service", severity: "high", ... },
      { type: "error-rate-surge", module: "auth-service", severity: "critical", currentValue: 1.0, ... }
    ],
    patterns: [
      { type: "repeated-failure", module: "auth-service", occurrences: 3, confidence: 0.3 }
    ],
    trends: [
      { module: "auth-service", metric: "successRate", direction: "degrading", changePercent: -100 },
      { module: "router", metric: "successRate", direction: "stable", changePercent: 0 }
    ],
    insights: [
      { priority: "critical", title: "Dead Agent in auth-service", recommendedAction: "Restart or redeploy agent 'token-issuer'..." },
      { priority: "critical", title: "System health critically low", recommendedAction: "Trigger global-governor..." },
      ...
    ]
  }
}
```

---

## 7. Performance Notes

- **Synchronous** — no async/await, no I/O. Typical wall-clock < 5ms for 100 events across 10 modules.
- **Signal aggregation** — O(n) where n = event count; one pass with Map accumulation.
- **Pattern detection** — O(m) where m = module count, plus O(a) for per-agent streak scan.
- **Anomaly detection** — O(m) module rules + O(a) per-agent scan; O(n²) worst case avoided by using Maps.
- **Trend analysis** — sliding window: O(w × n) where w = window count (typically 6) per module.
- **State persistence** — anomaly + trend history capped at 200 entries each; no unbounded growth.
- **Insight generation** — O(anomalies + trends + patterns), bounded.

---

## 8. Failure Handling

| Failure Condition | Behavior |
|-------------------|----------|
| Empty events array | `{ success: false, error: "events array is empty" }` |
| Missing required fields | `{ success: false, error: "event missing module field" }` |
| Invalid status value | `{ success: false, error: "event status must be 'success' or 'fail', got '...'" }` |
| Negative latency | Clamped to 0 during normalization |
| Any agent throws | Caught by orchestrator try/catch, pipeline aborts with `success: false` |
| Zero signals from aggregation | health-evaluator returns 50 (neutral), pipeline continues |
| Fewer than 3 events per module | Trend analysis skipped for that module, noted in logs |
