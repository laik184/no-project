# observability-analysis

## Purpose
Evaluates the observability posture of the codebase: logging coverage, error handling completeness, tracing hooks, and metrics instrumentation.

## Orchestrator
`orchestrator.ts` — runs observability agents and returns an `ObservabilityReport` with a compliance score.

## Agents
| Agent | Responsibility |
|---|---|
| `logging-coverage.agent.ts` | Checks that critical code paths emit structured logs |
| `error-handling.agent.ts` | Detects unhandled rejections and missing try/catch coverage |
| `tracing-hook.agent.ts` | Verifies OpenTelemetry or equivalent spans are present |
| `metrics-instrumentation.agent.ts` | Confirms Prometheus or equivalent counters/histograms exist |

## Flow
```
ObservabilityInput
  → logging coverage → error handling → tracing → metrics
  → ObservabilityReport { score, issues, recommendations }
```

## State
`state.ts` — session lifecycle and per-agent completion flags.

## Types
`types.ts` — `ObservabilityIssue`, `ObservabilityPhase`, `ObservabilityReport`.
