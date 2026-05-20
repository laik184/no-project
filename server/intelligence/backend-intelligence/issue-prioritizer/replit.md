# intelligence/backend-intelligence/issue-prioritizer

## Purpose
Analyzes and prioritizes backend code issues by severity, impact, and urgency.
Produces a ranked list of issues and fix strategies for the backend repair pipeline.

Previously named: `decision-engine` (renamed to avoid naming collision with the primary
`intelligence/decision-engine` task-routing module).

## Sub-modules
- `priority/` — scores and sorts issues by severity, impact, urgency
- `strategy/` — plans fix strategies per issue category (database, security, reliability, etc.)

## Flow
```
AnalysisOutput (issues[])
  → priority/orchestrator (score + rank issues)
  → strategy/orchestrator (plan fix strategies)
  → FinalStrategyOutput
```

## Agent Roles
| Agent | Responsibility |
|---|---|
| `impact.analyzer.agent` | Scores affected users, performance degradation, scalability risk |
| `severity.scorer.agent` | Assigns CRITICAL/HIGH/MEDIUM/LOW label |
| `urgency.detector.agent` | Detects production-blocker and deployment-blocker conditions |
| `ordering.engine.agent` | Sorts issues by final composite score |
| `dependency-sequencer.agent` | Orders fix steps respecting inter-issue dependencies |
| `fix-planner.agent` | Maps issues to fix strategies by keyword rules |
| `step-builder.agent` | Builds concrete fix step sequences |

## Input / Output
- **Input**: `AnalysisOutput` — list of detected backend issues
- **Output**: `FinalStrategyOutput` — prioritized, strategy-annotated fix plans
