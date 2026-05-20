# Self-Improvement Module

**Path:** `server/agents/intelligence/self-improvement/`  
**Layer:** L1 Orchestrated Pipeline (HVP-compliant)  
**Purpose:** Continuously analyze system behavior from live metrics, validation results, and recovery history — then generate a prioritized, scored, actionable improvement plan.

---

## 1. Module Overview

The self-improvement module is the system's introspective core. It accepts raw operational data (latency, error rates, memory, CPU, validation scores, recovery outcomes) and produces a ranked list of concrete improvement actions with strategy selection and optimization scoring. It does not apply changes — it plans them with full rationale.

**Key outputs:**
- Efficiency, latency, reliability, and resource scores (0–100)
- Detected bottlenecks with severity and impact scores
- Improvement actions with estimated impact, effort, and optimization score
- Best strategy selection (optimize / refactor / cache / parallelize / retry-tune)
- Final prioritized action plan with estimated system gain %

---

## 2. Folder Structure

```
self-improvement/
├── orchestrator.ts                  (L1) Coordination pipeline only
├── types.ts                         (L0) All contracts and interfaces
├── state.ts                         (L0) Immutable analysis history
├── index.ts                         Public API — exports orchestrator only
├── agents/                          (L2) Single-responsibility agents
│   ├── performance-analyzer.agent.ts
│   ├── bottleneck-detector.agent.ts
│   ├── improvement-planner.agent.ts
│   ├── strategy-selector.agent.ts
│   ├── optimization-scorer.agent.ts
│   └── improvement-prioritizer.agent.ts
├── utils/                           (L3) Pure functions, no state
│   ├── scoring.util.ts
│   ├── trend-analysis.util.ts
│   └── normalization.util.ts
└── replit.md
```

---

## 3. Agent Responsibilities

### `performance-analyzer.agent.ts`
**Input:** `SelfImprovementInput`  
**Output:** `PerformanceAnalysis`  
Computes 5 independent scores from raw metrics:
- `latencyScore` — normalized from 50ms (100) to 5000ms (0)
- `reliabilityScore` — derived from errorRate (0%=100, 100%=0)
- `resourceScore` — weighted average of normalized memory + CPU
- `efficiencyScore` — weighted blend of latency, successRate, errorRate
- `overallScore` — weighted blend of all four axes (35/30/20/15%)

Emits warnings for threshold breaches (latency > 1s, error > 5%, etc.).

---

### `bottleneck-detector.agent.ts`
**Input:** `SelfImprovementInput` + `PerformanceAnalysis`  
**Output:** `Bottleneck[]`  
Applies 5 threshold rules (latency, error-rate, success-rate, memory, CPU) plus optionally checks validation score and recovery failure count. Each bottleneck carries: area, severity (critical/high/medium/low), current value, threshold, and impact score. Results sorted by impact descending.

---

### `improvement-planner.agent.ts`
**Input:** `Bottleneck[]`  
**Output:** `ImprovementAction[]`  
Maps each bottleneck area to a catalog of 1–3 pre-defined action templates. Applies severity boost (+5 for high, +10 for critical) to estimatedImpact. Deduplicates identical actions. Returns raw actions with `optimizationScore=0` and `priority=0` (set by downstream agents).

---

### `strategy-selector.agent.ts`
**Input:** `ImprovementAction[]`  
**Output:** `StrategyType`  
Scores each strategy type by: frequency across actions × 10, total impact × 0.5, inherent priority × 5. Selects highest composite scorer. Default fallback: `"optimize"`. Provides text rationale.

Strategy priority order: `cache > parallelize > retry-tune > optimize > refactor`

---

### `optimization-scorer.agent.ts`
**Input:** `ImprovementAction[]` + `StrategyType`  
**Output:** `ImprovementAction[]` (with `optimizationScore` set)  
Scores each action via impact-to-effort ratio, then applies bonuses:
- +STRATEGY_BOOST if action matches selected strategy (cache=8, parallelize=6, retry-tune=5, optimize=4, refactor=2)
- +5 if estimatedImpact ≥ 70
- +4 if estimatedEffort ≤ 25

---

### `improvement-prioritizer.agent.ts`
**Input:** `ImprovementAction[]` + `Bottleneck[]`  
**Output:** `ImprovementAction[]` (with `priority` set to rank 1=highest)  
Computes a composite rank score:
```
rank = optimizationScore×0.5 + estimatedImpact×0.3 + severityWeight×0.2 − effortPenalty
```
Severity weights: critical=40, high=25, medium=12, low=5.  
Sorts descending, assigns `priority` as ordinal rank (1 = top action).

---

## 4. Call Flow Diagram

```
runSelfImprovement(input)
        │
        ▼
performance-analyzer ──────────── metrics → scores (0-100)
        │
        ▼
bottleneck-detector ─────────────  scores + raw metrics → Bottleneck[]
        │
        ▼
improvement-planner ─────────────  Bottleneck[] → ImprovementAction[] (raw)
        │
        ▼
strategy-selector ───────────────  actions[] → StrategyType
        │
        ▼
optimization-scorer ─────────────  actions[] + strategy → actions[] (scored)
        │
        ▼
improvement-prioritizer ─────────  scored actions + bottlenecks → ranked actions
        │
        ▼
orchestrator assembles ImprovementPlan → state.recordAnalysis → ModuleOutput
```

---

## 5. Import Graph

```
orchestrator.ts
  ├── agents/performance-analyzer.agent.ts
  │     └── utils/normalization.util.ts
  │     └── utils/scoring.util.ts
  ├── agents/bottleneck-detector.agent.ts
  │     └── utils/scoring.util.ts
  ├── agents/improvement-planner.agent.ts          (no utils needed)
  ├── agents/strategy-selector.agent.ts            (no utils needed)
  ├── agents/optimization-scorer.agent.ts
  │     └── utils/scoring.util.ts
  ├── agents/improvement-prioritizer.agent.ts      (no utils needed)
  ├── state.ts
  └── utils/scoring.util.ts (estimatedGain)

types.ts         ← imported by all files (type-only, no runtime cost)
state.ts         ← imports types.ts only
utils/*.util.ts  ← no imports (pure functions)
```

No agent imports another agent. No circular dependencies.

---

## 6. Example Input / Output

### Input
```typescript
const input: SelfImprovementInput = {
  sessionId: "sess-42",
  metrics: {
    latencyMs: 850,
    errorRate: 0.08,
    successRate: 0.88,
    throughput: 120,
    memoryUsageMb: 680,
    cpuPercent: 72,
    timestamp: Date.now(),
  },
  validationResult: {
    passed: false,
    score: 54,
    issueCount: 6,
    severityCounts: { critical: 1, high: 2, medium: 2, low: 1 },
  },
  recoveryHistory: [
    { failureType: "network", resolved: false, attemptCount: 3, durationMs: 1200, timestamp: Date.now() },
  ],
};
```

### Output (abbreviated)
```typescript
{
  success: true,
  logs: [...],
  plan: {
    sessionId: "sess-42",
    generatedAt: 1713398400000,
    performanceAnalysis: {
      overallScore: 58,
      latencyScore: 70,
      reliabilityScore: 40,
      resourceScore: 63,
      efficiencyScore: 66,
      warnings: ["Error rate above 5%: 8.0%", "Success rate below 90%: 88.0%"]
    },
    bottlenecks: [
      { area: "error-rate", severity: "high", impactScore: 62 },
      { area: "validation-quality", severity: "high", impactScore: 10 },
      { area: "recovery-failures", severity: "medium", impactScore: 15 },
      ...
    ],
    actions: [
      { rank: 1, title: "Tune retry policy", strategy: "retry-tune", estimatedImpact: 70, priority: 1 },
      { rank: 2, title: "Enable response caching", strategy: "cache", estimatedImpact: 75, priority: 2 },
      ...
    ],
    selectedStrategy: "retry-tune",
    optimizationScore: 64,
    estimatedGain: 47
  }
}
```

---

## 7. Performance Notes

- **Synchronous execution** — all 6 agents run sequentially; typical wall-clock time < 2ms on modern hardware (no I/O, no async).
- **State writes** — `recordAnalysis()` is O(1) append with a cap of 50 history entries; no memory growth.
- **No allocations on happy path** — all agent outputs reuse input object fields via shallow spread.
- **Bottleneck rules** — 5 fixed rules evaluated in O(n) where n=5; constant time regardless of input.
- **Action deduplication** — Set-based O(actions) dedup in improvement-planner.

---

## 8. Safety Constraints

- **No side effects** — module does not mutate metrics, apply fixes, or trigger external calls.
- **No agent-to-agent imports** — verified at code level; all agents are isolated.
- **Immutable state** — `Object.freeze` applied to every state snapshot and plan object.
- **History cap** — improvement history capped at 50 entries; pattern log capped at 100.
- **No destructive strategies** — only planning is done here; execution is delegated to `core/recovery/` or `core/execution/`.
- **Safe defaults** — if bottlenecks = 0, strategy defaults to `"optimize"` and no actions are forced.
- **Error isolation** — each agent wraps its logic in try/catch; pipeline aborts cleanly on first failure with full log trace.
