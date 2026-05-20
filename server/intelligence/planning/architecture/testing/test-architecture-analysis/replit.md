# test-architecture-analysis

## Purpose
Evaluates the overall test architecture: coverage distribution, test isolation, assertion quality, and flakiness risk.

## Orchestrator
`orchestrator.ts` — runs test-architecture agents and returns a `TestArchitectureReport`.

## Agents
| Agent | Responsibility |
|---|---|
| `coverage-distribution.agent.ts` | Analyses coverage spread across unit, integration, and e2e layers |
| `isolation-checker.agent.ts` | Flags tests with shared mutable state or external dependencies |
| `assertion-quality.agent.ts` | Detects weak assertions (e.g. `toBeTruthy` without specifics) |
| `flakiness-detector.agent.ts` | Identifies timing-dependent or order-dependent tests |

## Flow
```
TestArchitectureInput
  → coverage distribution → isolation check → assertion quality → flakiness detection
  → TestArchitectureReport { score, issues, recommendations }
```

## State
`state.ts` — session phases and per-layer coverage counters.

## Types
`types.ts` — `TestIssueType`, `TestSeverity`, `TestArchitectureReport`.
