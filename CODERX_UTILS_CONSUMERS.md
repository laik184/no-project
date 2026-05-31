# CODERX UTILS CONSUMERS REPORT
> Phase 2 — Consumer Analysis
> Generated: 2026-05-31

---

## Consumers of server/agents/coderx/utils.ts

**Result: ZERO CONSUMERS**

Grep scan across all `server/**/*.ts` files for any import referencing `coderx/utils` (with and without `.ts` extension) returned **no matches outside the file itself**.

The shim is **completely unused**. No file in the backend imports from it.

---

## Consumers of server/agents/coderx/utils/coding-utils.ts (direct)

All 17 coderx consumers already import **directly** from `coding-utils.ts`, bypassing the shim entirely:

| # | File Path | Symbols Imported | Usage Count |
|---|---|---|---|
| 1 | `server/agents/coderx/coderx-agent.ts` | `toErrorMessage` | 1 |
| 2 | `server/agents/coderx/core/coderx-context.ts` | `generateSessionId` | 1 |
| 3 | `server/agents/coderx/core/coderx-session.ts` | `generateSessionId`, `now` | 2 |
| 4 | `server/agents/coderx/core/coderx-state.ts` | `now` | 1 |
| 5 | `server/agents/coderx/execution/coding-loop.ts` | `elapsedMs`, `now` | 2 |
| 6 | `server/agents/coderx/execution/retry-manager.ts` | `computeRetryDelay`, `isRetryableError`, `sleep` | 3 |
| 7 | `server/agents/coderx/execution/step-runner.ts` | `toErrorMessage` | 1 |
| 8 | `server/agents/coderx/execution/task-executor.ts` | `generateStepId` | 1 |
| 9 | `server/agents/coderx/memory/execution-history.ts` | `now` | 1 |
| 10 | `server/agents/coderx/memory/working-memory.ts` | `now` | 1 |
| 11 | `server/agents/coderx/monitoring/execution-monitor.ts` | `elapsedMs` | 1 |
| 12 | `server/agents/coderx/monitoring/failure-monitor.ts` | `now` | 1 |
| 13 | `server/agents/coderx/planning/code-planner.ts` | `generatePlanId`, `generateTaskId`, `now` | 3 |
| 14 | `server/agents/coderx/planning/execution-plan-builder.ts` | `generateStepId` | 1 |
| 15 | `server/agents/coderx/planning/implementation-planner.ts` | `generatePlanId`, `generatePhaseId` | 2 |
| 16 | `server/agents/coderx/reasoning/decision-engine.ts` | `isRetryableError` | 1 |
| 17 | `server/agents/coderx/reasoning/task-analyzer.ts` | `normalizePrompt` | 1 |

**All 17 files import from `../utils/coding-utils.ts` directly — not via the shim.**

---

## Consumers of server/tools/shared/string-utils.ts (direct)

String utils consumers import via `server/tools/index.ts` (the tools public API), not via the shim:

| File Path | Symbols |
|---|---|
| `server/tools/coding/*` | Various (`toPascalCase`, `toCamelCase`, etc.) |

None import via `coderx/utils.ts`.

---

## Summary

| Target | External Consumers | Via Shim | Via Direct Import |
|---|---|---|---|
| `coderx/utils.ts` (the shim) | **0** | N/A | N/A |
| `coderx/utils/coding-utils.ts` | 17 | 0 | 17 |
| `tools/shared/string-utils.ts` | Multiple | 0 | Multiple |

**The shim was never consumed after migration. It is dead code.**
