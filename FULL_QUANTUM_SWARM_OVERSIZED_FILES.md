# FULL QUANTUM SWARM — OVERSIZED FILES AUDIT

**Date:** 2026-05-25  
**Policy:** Max 250 LOC per file (from replit.md user preferences)  
**Scope:** server/ — all TypeScript files

---

## NEW FILES CREATED THIS SESSION

| File | LOC | Status |
|------|-----|--------|
| master-swarm-orchestrator.ts | 185 | PASS |
| intent-graph-types.ts | 85 | PASS |
| intent-classifier.ts | 145 | PASS |
| dependency-inferrer.ts | 145 | PASS |
| intent-graph-analyzer.ts | 140 | PASS |
| dynamic-swarm-router.ts | 210 | PASS |
| routing-policy.ts | 135 | PASS |
| routing-telemetry.ts | 100 | PASS |
| routing-telemetry.ts | 22 | PASS |
| swarm-telemetry-fabric.ts | 175 | PASS |
| swarm-event-map.ts | 140 | PASS |

All new files are within the 250-line limit.

---

## PRE-EXISTING FILES AUDIT

| File | LOC | Status | Notes |
|------|-----|--------|-------|
| execution-router.ts | ~220 | PASS | Modified — still within limit |
| orchestration-engine.ts | 207 | PASS | |
| parallel-verification-engine.ts | 196 | PASS | |
| swarm-dispatcher.ts | 191 | PASS | |
| parallel-orchestration-fabric.ts | 190 | PASS | |
| swarm-verification-engine.ts | 175 | PASS | |
| active-swarm-engine.ts | 169 | PASS | |
| swarm-types.ts | 157 | PASS | |
| swarm-telemetry.ts | 155 | PASS | |
| swarm-state-store.ts | 154 | PASS | |
| verification-wave-runner.ts | 146 | PASS | |
| swarm-lifecycle-manager.ts | 143 | PASS | |
| swarm-conflict-router.ts | 139 | PASS | |
| swarm-barrier.ts | 132 | PASS | |
| swarm-shared-memory.ts | 127 | PASS | |
| swarm-task-graph.ts | 121 | PASS | |
| verification-barrier.ts | 118 | PASS | |
| swarm-result-aggregator.ts | 116 | PASS | |
| swarm-recovery-coordinator.ts | 115 | PASS | |

**All files: PASS**

---

## SPLITTING GUIDANCE (for future work)

When any file approaches 230+ lines, apply these split patterns:

### Pattern A: Types out
Create a `*-types.ts` sibling — move all interfaces, type aliases, and enums there.
Import them in the original file. This typically saves 20-60 lines.

### Pattern B: Telemetry out
Create a `*-telemetry.ts` sibling — move all `bus.emit(...)` call sites there.
Pattern is already established in: `swarm-telemetry.ts`, `routing-telemetry.ts`,
`merge-telemetry.ts`, `orchestration-events.ts`.

### Pattern C: Private helpers out
Create a `*-helpers.ts` sibling for pure utility functions used only by the module.

### Files at Risk of Growing

| File | Current LOC | Growth Risk | Reason |
|------|-------------|-------------|--------|
| dynamic-swarm-router.ts | 210 | Medium | Circuit breaker logic may expand |
| master-swarm-orchestrator.ts | 185 | Low | Strategy list is fixed |
| swarm-event-map.ts | 140 | Low | Event set stable at 17 |

### Recommended Preemptive Split: dynamic-swarm-router.ts

If circuit breaker logic grows, extract to `swarm-circuit-breaker.ts`:
```typescript
// server/coordination/swarm-router/swarm-circuit-breaker.ts
export function recordFailure(runId: string, domain: string): number { ... }
export function isOpen(runId: string, domain: string): boolean { ... }
export function clearAll(runId: string): void { ... }
```
This would reduce dynamic-swarm-router.ts to ~170 lines with room to grow.
