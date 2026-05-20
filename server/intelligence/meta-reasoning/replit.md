# Meta Reasoning Module

**Path:** `server/agents/intelligence/meta-reasoning/`  
**Layer:** L1 Orchestrated Pipeline (HVP-compliant)  
**Purpose:** Post-execution decision analysis. Evaluates a past decision against its context and outcome, detects what went wrong (or could be better), generates concrete alternative strategies, selects the best one, and produces an actionable improvement suggestion with a confidence score.

---

## 1. Module Purpose

Meta Reasoning is "thinking about thinking." It answers the question: *"Was this the right decision, and if not — what should we have done instead?"*

It is called after a decision has been executed and its outcome is known. It feeds structured improvements back into the system, enabling continuous learning.

**Core outputs per call:**
- `flaws[]` — what went wrong and why (inefficiency, wrong assumptions, missed opportunities)
- `alternatives[]` — 2–5 concrete alternative approaches ranked by composite score
- `bestStrategy` — the single best approach with rationale
- `improvement` — one actionable recommendation string
- `confidence` — 0–1 score reflecting reliability of the analysis

---

## 2. Flow Diagram

```
runMetaReasoning(MetaReasoningInput { decision, context, outcome })
        │
        ▼
normalizeInput         ─── trim, cap at 2000 chars, strip empty fields
        │
        ▼
decision-analyzer      ─── extract intent, logic path, assumptions, goal alignment score
        │
        ▼
flaw-detector          ─── wrong-assumption, inefficiency, missed-opportunity, premature-conclusion, scope-creep
        │
        ▼
alternative-generator  ─── per flaw type → 2–5 alternative approaches (speed/risk/efficiency scored)
        │
        ▼
strategy-comparator    ─── composite score (efficiency 40% + risk 35% + speed 25%) → ranked winner
        │
        ▼
improvement-suggester  ─── synthesize flaw summary + winner approach + tradeoff note → one sentence
        │
        ▼
confidence-evaluator   ─── outcome polarity 40% + alignment 25% + winner score 20% + assumption penalty 15% − flaw penalty
        │
        ▼
state.recordAnalysis   ─── persist frozen AnalysisResult in history (capped at 100)
        │
        ▼
MetaReasoningOutput { success, logs, analysis: { flaws, alternatives, bestStrategy, improvement, confidence } }
```

---

## 3. Agent Map

### `decision-analyzer.agent.ts`
**Input:** `MetaReasoningInput`  
**Output:** `DecisionAnalysis`  
- Extracts key phrases from decision text (stop-word filtered)
- Scores goal alignment via Jaccard overlap of decision vs context phrases
- Detects implicit assumptions via keyword patterns (if, when, always, must, etc.)
- Constructs a 5-step logic path narrative

---

### `flaw-detector.agent.ts`
**Input:** `MetaReasoningInput` + `DecisionAnalysis`  
**Output:** `DetectedFlaw[]`  
Applies 6 detection rules:
- **wrong-assumption/high** — goal alignment < 0.2
- **wrong-assumption/medium** — goal alignment < 0.4
- **premature-conclusion/medium** — > 4 implicit assumptions
- **inefficiency/high** — negative outcome polarity
- **missed-opportunity/medium** — negative outcome + > 2 missed context signals
- **scope-creep/medium** — decision < 20 chars, context > 200 chars
- **inefficiency/low** — verbose decision with shallow logic path

---

### `alternative-generator.agent.ts`
**Input:** `MetaReasoningInput` + `DetectedFlaw[]`  
**Output:** `Alternative[]` (max 5)  
Looks up a pre-built catalog of alternative templates per flaw type. Each alternative has: `title`, `approach`, `speedScore`, `riskScore`, `efficiencyScore`. Deduplicates by title. Falls back to "Conservative Baseline" if no flaws match.

---

### `strategy-comparator.agent.ts`
**Input:** `Alternative[]`  
**Output:** `StrategyComparison`  
Scores each alternative:
```
composite = efficiency×0.40 + (1−risk)×0.35 + speed×0.25
```
Sorts descending, selects winner, extracts tradeoff notes, produces text rationale.

---

### `improvement-suggester.agent.ts`
**Input:** `DetectedFlaw[]` + `StrategyComparison` + `Alternative[]`  
**Output:** `improvement: string`  
Builds three text parts:
1. Flaw summary — focus on high-severity flaws first
2. Strategy advice — winner title + approach
3. Tradeoff note — first tradeoff if any

Joins and normalizes to one production-grade sentence.

---

### `confidence-evaluator.agent.ts`
**Input:** `DecisionAnalysis` + `DetectedFlaw[]` + `StrategyComparison` + `outcome`  
**Output:** `confidence: number` (0–1)  
4-factor weighted base:
- Outcome polarity: positive=0.85, neutral=0.55, negative=0.25 (weight 0.40)
- Goal alignment (weight 0.25)
- Winner composite score (weight 0.20)
- Assumption penalty (weight 0.15)

Then subtracts flaw penalty (high=0.15, medium=0.07, low=0.03 each, capped at 0.70).

---

## 4. Call Flow

```
orchestrator.ts
  ├── agents/decision-analyzer.agent.ts
  │     ├── utils/reasoning.util.ts
  │     └── (types.ts — type-only)
  ├── agents/flaw-detector.agent.ts
  │     └── utils/reasoning.util.ts
  ├── agents/alternative-generator.agent.ts
  │     └── utils/reasoning.util.ts
  ├── agents/strategy-comparator.agent.ts
  │     └── utils/scoring.util.ts
  ├── agents/improvement-suggester.agent.ts
  │     └── utils/normalize.util.ts
  ├── agents/confidence-evaluator.agent.ts
  │     ├── utils/scoring.util.ts
  │     ├── utils/reasoning.util.ts
  │     └── utils/normalize.util.ts
  ├── state.ts
  └── utils/normalize.util.ts
```

No agent imports another agent. No circular dependencies.

---

## 5. Import Rules

```
orchestrator  → agents (any), state, utils
agents        → utils only (NO other agents)
utils         → nothing (pure functions)
state         → types only
types         → nothing
index         → orchestrator only
```

---

## 6. Example Input / Output

### Input
```typescript
runMetaReasoning({
  decision: "Retry the failed API call immediately with the same parameters",
  context: "The API endpoint is rate-limited and returned a 429 after 3 rapid requests in the last 5 seconds",
  outcome: "Failed again with 429 — request blocked by rate limiter",
});
```

### Output
```typescript
{
  success: true,
  logs: [...],
  analysis: {
    flaws: [
      "Decision shows very low alignment with stated context — likely misread the problem constraints",
      "Outcome indicates the decision did not achieve its goal — execution path produced failure or error state",
      "Decision ignored key context signals: rate-limited, rapid, requests — alternative paths were available"
    ],
    alternatives: [
      "Context-First Approach: Re-read the full context before committing to an action...",
      "Optimized Execution Path: Profile the decision logic for bottlenecks...",
      "Broad Signal Scan: Before deciding, collect all signals from context..."
    ],
    bestStrategy: "Context-First Approach — 'Context-First Approach' selected with composite score 0.791 (efficiency=0.85, risk=0.20, speed=0.60). Weighted: efficiency 40%, risk 35%, speed 25%.",
    improvement: "Address critical flaws first: wrong assumption, inefficiency. Adopt the 'Context-First Approach' approach: Re-read the full context before committing to an action — validate each assumption against constraints before execution.",
    confidence: 0.18
  }
}
```

---

## 7. Performance Notes

- **Synchronous** — zero async/await, zero I/O. Typical wall-clock < 2ms.
- **Text processing** — all string operations are O(n) bounded by the 2000-char input cap.
- **Alternative catalog** — constant-time Map lookup per flaw type, O(flaws) total.
- **Strategy comparison** — O(n log n) sort where n ≤ 5 alternatives.
- **State history** — capped at 100 entries; O(1) append with slice.
- **No regex backtracking** — all patterns are simple keyword tests, not complex regexes.
