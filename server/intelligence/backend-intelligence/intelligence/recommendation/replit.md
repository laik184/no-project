# Backend Recommendation Engine

## 1. System Overview
The Recommendation Engine converts normalized backend analysis signals into deterministic, production-safe recommendations. It only consumes shared contracts from analysis, priority, and consistency outputs. The engine is stateless and pure, so equal inputs always produce equal outputs.

## 2. Folder Responsibilities
- `recommendation.orchestrator.ts` (L1): Main pipeline orchestration, normalization, consistency filtering, priority mapping, and response assembly.
- `agents/action.generator.agent.ts` (L2): Converts categorized problems into concrete remediation actions.
- `agents/improvement.suggester.agent.ts` (L2): Produces high-level strategic improvements per finding.
- `agents/fix-recommendation.agent.ts` (L2): Produces low-level deterministic step-by-step fixes.
- `agents/explanation.builder.agent.ts` (L2): Builds WHY + IMPACT explanations with optional contextual qualifiers.
- `utils/format.util.ts` (L3): Formats final `Recommendation` objects and stable IDs.
- `utils/grouping.util.ts` (L3): Normalizes analysis findings into recommendation candidates.
- `utils/dedupe.util.ts` (L3): Removes duplicate candidates deterministically.
- `types.ts` (L0): Shared contracts for input, intermediate, and output models.
- `state.ts` (L0): Immutable state transitions and final response conversion.
- `index.ts`: Public exports.

## 3. Call Flow Diagram
```text
buildRecommendations (recommendation.orchestrator.ts)
  -> groupFindings (utils/grouping.util.ts)
  -> apply priority map
  -> apply consistency truth filter
  -> dedupeCandidates (utils/dedupe.util.ts)
  -> suggestImprovements (agents/improvement.suggester.agent.ts)
  -> buildFixRecommendations (agents/fix-recommendation.agent.ts)
  -> generateActions (agents/action.generator.agent.ts)
  -> buildExplanations (agents/explanation.builder.agent.ts)
  -> formatRecommendations (utils/format.util.ts)
  -> RecommendationResponse
```

## 4. Recommendation Lifecycle
1. Receive input from analysis/priority/consistency modules.
2. Normalize finding category, impact, evidence, and baseline priority.
3. Normalize priority values into range `[0..100]`.
4. Resolve conflicts through consistency truth (`OK` findings are suppressed).
5. Generate improvement, fix, action, and explanation artifacts.
6. Format deterministic recommendation payload with stable IDs.
7. Return immutable `RecommendationResponse`.

## 5. Input / Output Format
### Input: `RecommendationInput`
```json
{
  "analysis": { "findings": [] },
  "priority": { "priorities": [] },
  "consistency": { "finalTruth": [] },
  "context": {
    "domain": "payments",
    "environment": "production",
    "constraints": ["strict-sla"]
  }
}
```

### Output: `RecommendationResponse`
```json
{
  "total": 1,
  "recommendations": [
    {
      "id": "rec-query-latency-optimize-query-latency-performance-path",
      "title": "Optimize Query latency performance path",
      "description": "Reduce query latency bottlenecks by improving data access strategy, caching, and execution efficiency.",
      "action": "Rework query latency execution path to remove redundant queries and apply deterministic caching.",
      "impact": "HIGH",
      "category": "performance",
      "priority": 90,
      "steps": [
        "Profile query latency flow and identify top latency contributors.",
        "Replace repeated reads in query latency with batched queries or joins.",
        "Introduce cache policy for query latency hot paths with TTL and invalidation strategy."
      ],
      "explanation": "This change directly lowers severe failure risk and protects service reliability."
    }
  ]
}
```

## 6. Example Usage
```ts
import { buildRecommendations } from "./recommendation/index.js";

const response = buildRecommendations({
  analysis: {
    findings: [
      {
        subject: "query latency",
        message: "N+1 query pattern detected in order retrieval",
        category: "performance",
        impact: "HIGH",
      },
    ],
  },
  priority: {
    priorities: [{ subject: "query latency", priority: 90 }],
  },
  consistency: {
    finalTruth: [{ subject: "query latency", status: "NOT_OK", severity: "HIGH" }],
  },
  context: {
    domain: "orders",
    environment: "production",
  },
});

console.log(response.total);
console.log(response.recommendations[0]?.action);
```
