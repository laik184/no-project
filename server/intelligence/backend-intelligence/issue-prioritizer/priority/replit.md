# Global Priority Engine

## 1) System Overview
The `priority` module is a deterministic backend decision engine that ranks technical issues by combining severity, impact, and urgency into a single final score. The engine is pure intelligence only: it performs no code execution, no file operations, and no side effects.

## 2) Priority Scoring Model
For each issue, the engine computes:

- **Severity** (security risk, data loss risk, system failure risk)
- **Impact** (user impact, performance impact, scalability impact)
- **Urgency** (runtime-breaking, deployment blocker, production risk)

Final scoring formula:

```text
Final Score =
  (Severity * 0.4) +
  (Impact * 0.4) +
  (Urgency * 0.2)
```

All component scores are normalized to a deterministic 0–100 scale.

## 3) Folder Responsibilities

```text
priority/
│
├── priority.orchestrator.ts
│   Orchestrates fixed execution pipeline and returns PriorityResult.
│
├── agents/
│   ├── severity.scorer.agent.ts
│   │   Computes severity + severity labels only.
│   ├── impact.analyzer.agent.ts
│   │   Computes impact only.
│   ├── urgency.detector.agent.ts
│   │   Computes urgency only.
│   └── ordering.engine.agent.ts
│       Computes final weighted score + deterministic sorting only.
│
├── utils/
│   ├── scoring.util.ts
│   │   Shared scoring helpers (averages, labels, rounding).
│   └── normalize.util.ts
│       Shared normalization helpers for risk and boolean weights.
│
├── types.ts
│   Contracts for Issue, AnalysisOutput, ScoredIssue, PriorityState, PriorityResult.
├── state.ts
│   Immutable state transitions for orchestrator pipeline.
└── index.ts
    Public API exports only.
```

## 4) Call Flow Diagram

```text
priority.orchestrator.ts
   ↓
severity.scorer.agent.ts
   ↓
impact.analyzer.agent.ts
   ↓
urgency.detector.agent.ts
   ↓
ordering.engine.agent.ts
   ↓
PriorityResult.sortedIssues
```

## 5) Example Input / Output

### Example Input

```ts
{
  issues: [
    {
      id: "ISSUE-001",
      title: "Unvalidated admin payload",
      securityRisk: 95,
      dataLossRisk: 70,
      systemFailureRisk: 65,
      affectedUsers: 80,
      performanceDegradation: 40,
      scalabilityRisk: 50,
      runtimeBreaking: true,
      deploymentBlocker: true,
      productionRisk: 90
    },
    {
      id: "ISSUE-002",
      title: "Slow analytics query",
      securityRisk: 15,
      dataLossRisk: 20,
      systemFailureRisk: 35,
      affectedUsers: 45,
      performanceDegradation: 85,
      scalabilityRisk: 75,
      runtimeBreaking: false,
      deploymentBlocker: false,
      productionRisk: 40
    }
  ]
}
```

### Example Output

```ts
{
  sortedIssues: [
    {
      id: "ISSUE-001",
      severity: 76.67,
      impact: 56.67,
      urgency: 93.33,
      finalScore: 72
    },
    {
      id: "ISSUE-002",
      severity: 23.33,
      impact: 68.33,
      urgency: 13.33,
      finalScore: 39.33
    }
  ]
}
```

The sorting is deterministic: ties are resolved by higher severity, then lexicographically by `id`.
