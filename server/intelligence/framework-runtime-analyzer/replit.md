# Framework Runtime Analyzer

## MODULE PURPOSE

Framework Runtime Analyzer is a pure runtime-intelligence module that models framework execution behavior from static runtime descriptors (`nodes`, `edges`, `entryPoints`). It provides deterministic analysis for runtime flow, lifecycle detection, async chains, branching paths, and anomaly prediction without any side effects or external I/O.

## FILE MAP

- `orchestrator.ts` — L1 coordinator that calls required agents in strict order and merges outputs.
- `index.ts` — public module exports.
- `types.ts` — L0 data contracts, inputs, and output interface.
- `state.ts` — L0 immutable default analyzer state.
- `agents/runtime-flow.agent.ts` — builds execution flow and call graph from entry to exits.
- `agents/lifecycle-detector.agent.ts` — detects lifecycle patterns for React, Express, and NestJS.
- `agents/execution-path.agent.ts` — maps branching and conditional execution paths.
- `agents/async-flow.agent.ts` — tracks async chain flow and parallel await groups.
- `agents/middleware-chain.agent.ts` — maps middleware ordering and blocking middleware risks.
- `agents/render-cycle.agent.ts` — detects render triggers and unnecessary re-render candidates.
- `agents/dependency-runtime.agent.ts` — detects dynamic runtime dependencies and injection flow.
- `agents/state-mutation.agent.ts` — flags mutable state and unsafe state mutation operations.
- `agents/error-propagation.agent.ts` — traces try/catch paths and uncaught error nodes.
- `agents/anomaly-detector.agent.ts` — predicts loops, race risks, deadlock, and memory leak patterns.
- `utils/ast-traversal.util.ts` — pure node selectors by kind and metadata flags.
- `utils/graph-builder.util.ts` — pure graph construction helpers from typed edges.
- `utils/callstack.util.ts` — pure path/order traversal helpers.
- `utils/async-map.util.ts` — pure async chain + parallel grouping helpers.
- `utils/pattern-match.util.ts` — pure regex pattern mapping and framework grouping.
- `utils/deep-freeze.util.ts` — recursive deep freeze helper for immutable outputs.

## FLOW

1. `orchestrator.ts` calls `runtime-flow.agent.ts`
2. `orchestrator.ts` calls `lifecycle-detector.agent.ts`
3. `orchestrator.ts` calls `async-flow.agent.ts`
4. `orchestrator.ts` calls `execution-path.agent.ts`
5. `orchestrator.ts` calls `anomaly-detector.agent.ts`
6. orchestrator merges and deep-freezes final deterministic output

Layering is strictly: `orchestrator -> agents -> utils`.

## IMPORT GRAPH

- `orchestrator.ts` imports:
  - required agents (runtime-flow, lifecycle-detector, async-flow, execution-path, anomaly-detector)
  - `state.ts`
  - `types.ts`
  - `utils/deep-freeze.util.ts`
- agents import only:
  - `types.ts`
  - utility files from `utils/`
- utils import only:
  - `types.ts` where needed
- `index.ts` re-exports orchestrator + state + types

No agent imports another agent. No reverse layer imports.

## OUTPUT FORMAT

The module returns the strict contract:

```ts
{
  success: boolean,
  logs: string[],
  data: {
    runtimeFlow: object,
    lifecycle: object,
    asyncFlow: object,
    executionPaths: object,
    anomalies: string[]
  },
  error?: string
}
```

## SUPPORTED FRAMEWORKS

- express
- nestjs
- react
- nextjs
