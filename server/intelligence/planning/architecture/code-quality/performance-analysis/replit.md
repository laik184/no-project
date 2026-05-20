# performance-analysis

## Purpose
Identifies synchronous blocking patterns, payload bloat, missing caching opportunities, and inefficient database query patterns.

## Orchestrator
`orchestrator.ts` — runs performance sub-agents and compiles a `PerformanceReport`.

## Agents
| Agent | Responsibility |
|---|---|
| `sync-blocking.agent.ts` | Finds sync I/O calls and blocking loops in async contexts |
| `payload-size.agent.ts` | Detects over-fetching and large response payloads |
| `cache-opportunity.agent.ts` | Identifies repeated computations that could be memoised |
| `query-pattern.agent.ts` | Flags N+1 queries and missing index hints |

## Flow
```
PerformanceInput
  → sync-blocking → payload-size → cache-opportunity → query-pattern
  → PerformanceReport { issues, score, recommendations }
```

## State
`state.ts` — session phases and issue accumulator.

## Types
`types.ts` — `PerformanceIssueType`, `PerformanceSeverity`, `PerformanceReport`.
