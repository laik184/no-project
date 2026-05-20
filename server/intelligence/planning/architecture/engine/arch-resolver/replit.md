# Architecture Decision Engine

## 1) System overview
The Decision Engine converts architecture analysis violations into deterministic remediation decisions.
It consumes analysis reports only, computes severity/impact/risk, assigns a priority, and returns a
ranked DecisionPlan with fix strategies. It never invokes execution/fix runners directly.

## 2) Folder responsibilities
- `orchestrator/`: end-to-end deterministic decision pipeline.
- `classification/`: violation category detection (`boundary`, `dependency`, `hvp`, `responsibility`).
- `scoring/`: independent scoring modules for severity, impact, and risk.
- `prioritization/`: weighted priority scoring and urgency/deployment-block detection.
- `strategy/`: strategy generation from classified violations.
- `utils/`: score normalization and weighted-score composition helpers.
- `state.ts`: in-memory decision snapshot for last run.
- `types.ts`: canonical public contracts.

## 3) Decision pipeline
1. `index.ts` receives report input.
2. `decision.orchestrator.ts` classifies each violation.
3. Scoring phase computes:
   - severity
   - impact
   - risk
4. Priority phase computes weighted score and mapped priority.
5. Urgency phase determines immediate action/deploy blocking status.
6. Strategy phase maps violation context to deterministic fix strategy.
7. Decisions are ranked and persisted to `state.ts`.
8. Engine returns a frozen `DecisionPlan`.

## 4) Scoring system explanation
- **Severity score** (fixed mapping):
  - CRITICAL = 100
  - HIGH = 75
  - MEDIUM = 50
  - LOW = 25
- **Impact score** combines:
  - affected module spread
  - layer violation depth
  - system criticality signal
- **Risk score** combines:
  - production break risk
  - performance degradation risk
  - security exposure risk
- **Priority formula**:

```txt
priorityScore = (severity * 0.5) + (impact * 0.3) + (risk * 0.2)
```

- Priority bands:
  - HIGH: score >= 75
  - MEDIUM: 50 <= score < 75
  - LOW: score < 50

## 5) Example decision output
```ts
{
  totalIssues: 2,
  highPriority: 1,
  mediumPriority: 1,
  lowPriority: 0,
  decisions: [
    {
      id: "vio-1",
      violationType: "CIRCULAR_DEPENDENCY",
      severity: 100,
      impact: 82,
      risk: 85,
      priority: "HIGH",
      strategy: "Extract interface/port, invert dependency, and update import direction.",
      reason: "Dependency issues are stabilized by introducing abstraction boundaries. Violation can block deployment or break runtime safety."
    }
  ]
}
```

## 6) Integration with analysis modules
The engine accepts a generic `ArchitectureAnalysisReport` containing a `violations` array.
It is compatible with outputs from boundary analysis, HVP analysis, and responsibility analysis
as long as violations provide `id`, `type`, `severity`, and `message` fields.
