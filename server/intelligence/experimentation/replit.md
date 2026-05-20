# Experimentation Module

**Path:** `server/agents/intelligence/experimentation/`  
**Layer:** L1 Orchestrated Pipeline (HVP-compliant)  
**Purpose:** Strategy experimentation engine. Given a goal and context, automatically generates multiple strategy variants, simulates their execution in a controlled environment, compares results across speed/accuracy/success metrics, selects the best variant, and returns a confidence-scored recommendation.

---

## 1. Module Purpose

The Experimentation module enables the system to test multiple approaches before committing to one. It supports:
- **A/B testing** — control vs treatment comparison
- **Multivariate testing** — 3–5 strategy variants compared simultaneously
- **Exploration** — open-ended search for the best approach

Callers receive the winning `Variant` object, its `confidence` score, and all raw `ExecutionResult[]` data for further analysis.

---

## 2. Full Flow Diagram

```
runExperiment(ExperimentInput { goal, context, strategyHints? })
        │
        ▼
input validation       ─── goal required, context is string, non-empty
        │
        ▼
experiment-planner     ─── infer testType (a-b/multivariate/exploration), strategyCount 2–5, extract constraints
        │
        ▼
variant-generator      ─── seeded-random parameters per variant (learningRate, batchSize, temperature, etc.)
        │
        ▼
execution-controller   ─── simulate each variant: latency, accuracy, success per strategy base + aggressiveness
        │
        ▼
result-collector       ─── structure RawExecutionResult → ExecutionResult with human-readable notes
        │
        ▼
comparator             ─── normalize latencies+accuracies, compute speed/accuracy/successRate → composite score
        │
        ▼
winner-selector        ─── sort by composite, select top, build rationale text with margin over runner-up
        │
        ▼
confidence-scorer      ─── 5-factor weighted score: separation, winner quality, sample coverage, success fraction, variance signal
        │
        ▼
state.recordExperiment ─── persist winner + results in performanceHistory (capped 200)
        │
        ▼
ExperimentOutput { success, logs, data: { winner, confidence, results } }
```

---

## 3. Agent Responsibilities

| Agent | Single Responsibility | Key Output |
|-------|-----------------------|------------|
| `experiment-planner` | Converts raw input into a structured plan | `ExperimentPlan { testType, strategyCount, constraints }` |
| `variant-generator` | Creates N variants with seeded-random, strategy-specific parameters | `Variant[]` with `id`, `name`, `strategy`, `parameters` |
| `execution-controller` | Simulates execution per variant using strategy base + noise | `RawExecutionResult[]` with latency, accuracy, success |
| `result-collector` | Structures raw results, adds diagnostic notes | `ExecutionResult[]` with human-readable `notes` |
| `comparator` | Normalizes metrics, computes composite score per variant | `ComparisonResult[]` sorted by composite |
| `winner-selector` | Sorts by composite, identifies winner, writes rationale | `WinnerResult { variant, comparisonResult, rationale }` |
| `confidence-scorer` | 5-factor confidence analysis of how reliable the winner choice is | `confidence: number` (0–1) |

---

## 4. Call Graph

```
orchestrator.ts
  ├── experiment-planner.agent.ts
  │     └── utils/normalization.util.ts
  ├── variant-generator.agent.ts
  │     ├── utils/randomizer.util.ts
  │     └── utils/scoring.util.ts
  ├── execution-controller.agent.ts
  │     └── utils/randomizer.util.ts, scoring.util.ts
  ├── result-collector.agent.ts
  │     └── (types only — no util imports)
  ├── comparator.agent.ts
  │     ├── utils/scoring.util.ts
  │     └── utils/normalization.util.ts
  ├── winner-selector.agent.ts
  │     └── (types only — pure logic)
  ├── confidence-scorer.agent.ts
  │     └── utils/scoring.util.ts
  └── state.ts
```

No agent imports another agent. No circular dependencies.

---

## 5. Example Input / Output

### Input
```typescript
runExperiment({
  goal: "Optimize retry strategy for failed API calls",
  context: "API is rate-limited, average 429 errors spike every 30 seconds, need safe retry backoff",
  strategyHints: ["exponential backoff", "jitter", "conservative"],
});
```

### Output
```typescript
{
  success: true,
  logs: [...],
  data: {
    winner: {
      id: "v2-62",
      name: "Variant-B",
      strategy: "conservative-safe",
      parameters: {
        learningRate: 0.009,
        batchSize: 28,
        temperature: 0.68,
        maxRetries: 4,
        timeoutMs: 2180,
        aggressiveness: 0.22
      }
    },
    confidence: 0.614,
    results: [
      {
        variantId: "v1-62",
        success: true,
        latencyMs: 1740,
        accuracyScore: 0.76,
        rawScore: 0.62,
        notes: "strategy: greedy-fast"
      },
      {
        variantId: "v2-62",
        success: true,
        latencyMs: 2350,
        accuracyScore: 0.91,
        rawScore: 0.72,
        notes: "high accuracy; strategy: conservative-safe"
      },
      {
        variantId: "v3-62",
        success: false,
        latencyMs: 910,
        accuracyScore: 0.68,
        rawScore: 0.24,
        notes: "execution failed; very fast; strategy: aggressive-optimized"
      }
    ]
  }
}
```

---

## 6. Performance Notes

- **Synchronous** — zero async/await, zero I/O. All execution is simulated deterministically.
- **Seeded randomness** — `seededRandom(goal)` produces deterministic results for the same input, enabling reproducibility.
- **Normalization** — min-max normalization over the actual result set, not global constants, ensuring relative scoring is always valid regardless of scale.
- **Capped variants** — max 5 variants enforced. O(n) all the way through; no exponential paths.
- **State persistence** — `performanceHistory` capped at 200 entries. O(1) append with slice.
- **LCG RNG** — linear congruential generator for noise generation; no `Math.random()` reliance in deterministic paths.

---

## 7. Safety Notes

| Risk | Mitigation |
|------|------------|
| Empty variant list | Orchestrator aborts with `success: false` before `winner-selector` is called |
| All variants fail | `comparator` uses `rawScore * 0.4` for failed results — winner is still selected from the least-bad option |
| Zero comparisons | `winner-selector` returns `{ success: false, error: "no comparisons available" }` — orchestrator propagates |
| Negative latency | `generateLatencyMs` clamps to minimum 1ms |
| Unknown strategy | `execution-controller` falls back to `DEFAULT_BASE` values |
| Input missing context | `normalizeContextText` returns empty string — planning and constraint extraction degrade gracefully |
| NaN in scoring | `clamp` is applied at every scoring boundary — NaN is forced to 0 |
