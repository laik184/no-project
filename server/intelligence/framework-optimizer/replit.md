# Framework Optimizer Module

## 1) Module Purpose
`framework-optimizer` is the performance intelligence layer for framework-aware systems (React, Next.js, Express, NestJS, etc.).
It detects optimization bottlenecks and returns deterministic, immutable recommendations.

## 2) Folder Structure

- `orchestrator.ts` → L1 coordinator (no business logic)
- `agents/` → L2 analyzers with single responsibility
- `utils/` → L3 pure shared helpers
- `types.ts` + `state.ts` → L0 contracts + state model

## 3) Agent Responsibilities
- `render-optimizer.agent.ts` → detect excessive renders, memoization/lazy-load gaps
- `api-optimizer.agent.ts` → detect latency/payload/pagination-batching issues
- `database-optimizer.agent.ts` → detect slow query/index/N+1 patterns
- `caching-strategy.agent.ts` → cache strategy + invalidation issues
- `bundle-optimizer.agent.ts` → bundle size and splitting opportunities
- `middleware-optimizer.agent.ts` → redundant/misordered middleware
- `concurrency-optimizer.agent.ts` → blocking calls, serial awaits, event-loop lag
- `best-practice-enforcer.agent.ts` → framework anti-patterns and rule violations

## 4) Data Flow (who calls whom)
`orchestrator.ts` -> each file in `agents/` -> aggregate issues -> score -> build metrics -> return immutable result.

## 5) Import Graph (clear direction)
- `index.ts` -> `orchestrator.ts`
- `orchestrator.ts` -> `agents/*`, `utils/*`, `state.ts`, `types.ts`
- `agents/*` -> `types.ts`
- `utils/*` -> `types.ts` (where needed)
- `state.ts` -> `types.ts`, `utils/deep-freeze.util.ts`

No agent imports another agent.
No cross-module deep imports.

## 6) Output Contract
```ts
{
  success: boolean,
  issues: OptimizationIssue[],
  score: number,
  logs: string[]
}
```

## 7) Example Input/Output
### Input
```ts
{
  framework: "nextjs",
  timestamp: 1710000000,
  api: { p95LatencyMs: 920, avgPayloadKb: 180, unpaginatedEndpoints: ["/users"] },
  database: { slowQueries: ["SELECT * FROM orders"], nPlusOnePatterns: ["orders->items"] },
  ui: { rerenders: 160, missingMemoization: 10 }
}
```

### Output
```ts
{
  success: true,
  issues: [
    {
      type: "render",
      severity: "high",
      message: "Excessive re-renders detected in UI tree.",
      fix: "Apply React.memo/useMemo/useCallback and split stateful boundaries."
    }
  ],
  score: 48,
  logs: ["Input validated.", "All optimizer agents executed.", "Final score computed: 48.", "State snapshot created."]
}
```
