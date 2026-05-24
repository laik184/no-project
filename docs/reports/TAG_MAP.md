# TAG_MAP — Specialist Coordination Module Tags

Index of all modules by architectural layer, responsibility, and dependency edges.

---

## Layer: Entry Points

| Tag | File | Exports |
|-----|------|---------|
| `[ENTRY:SWARM]` | `server/orchestration/execution/execution-router.ts` | `executeSwarm()` |
| `[ENTRY:COORDINATION]` | `server/coordination/index.ts` | `coordinateSpecialists()` |

---

## Layer: Task Decomposition

| Tag | File | Exports |
|-----|------|---------|
| `[DECOMPOSE:PLANNER]` | `server/coordination/task-decomposer/task-decomposer.ts` | `taskDecomposer` |
| `[DECOMPOSE:GRAPH]` | `server/coordination/task-decomposer/dependency-graph-builder.ts` | `dependencyGraphBuilder` |

---

## Layer: Wave Execution

| Tag | File | Exports |
|-----|------|---------|
| `[WAVE:COORDINATOR]` | `server/coordination/parallel-specialist-coordinator/parallel-specialist-coordinator.ts` | `parallelSpecialistCoordinator` |
| `[WAVE:RUNNER]` | `server/coordination/parallel-specialist-coordinator/specialist-wave-runner.ts` | `specialistWaveRunner` |

---

## Layer: Specialist Dispatch (NEW)

| Tag | File | Exports |
|-----|------|---------|
| `[DISPATCH:DISPATCHER]` | `server/coordination/specialist-dispatcher/specialist-dispatcher.ts` | `specialistDispatcher` |
| `[DISPATCH:EXECUTOR]` | `server/coordination/specialist-dispatcher/specialist-executor.ts` | `executeSpecialist` |
| `[DISPATCH:ROUTER]` | `server/coordination/specialist-dispatcher/domain-agent-router.ts` | `getDomainConfig`, `domainLabel` |
| `[DISPATCH:INDEX]` | `server/coordination/specialist-dispatcher/index.ts` | (re-exports) |

---

## Layer: Swarm → Coordination Bridge (NEW)

| Tag | File | Exports |
|-----|------|---------|
| `[SWARM:MAPPER]` | `server/engine/swarm/swarm-domain-mapper.ts` | `mapSwarmRoleToDomain` |
| `[SWARM:DISPATCHER]` | `server/engine/swarm/swarm-dispatcher.ts` | (internal, fixed) |

---

## Layer: Context & Memory

| Tag | File | Exports |
|-----|------|---------|
| `[CTX:REGISTRY]` | `server/coordination/scoped-context/context-registry.ts` | `contextRegistry` |
| `[CTX:FACTORY]` | `server/coordination/scoped-context/execution-context-factory.ts` | `executionContextFactory` |

---

## Layer: Conflict Resolution & Merge

| Tag | File | Exports |
|-----|------|---------|
| `[MERGE:DETECTOR]` | `server/coordination/conflict-resolution/specialist-conflict-detector.ts` | `specialistConflictDetector` |
| `[MERGE:STRATEGY]` | `server/coordination/conflict-resolution/resolution-strategy.ts` | `resolutionStrategy` |
| `[MERGE:PLANNER]` | `server/coordination/aggregation/merge-plan-builder.ts` | `mergePlanBuilder` |
| `[MERGE:MERGER]` | `server/coordination/aggregation/specialist-result-merger.ts` | `specialistResultMerger` |

---

## Layer: Telemetry & Verification (NEW/FIXED)

| Tag | File | Exports |
|-----|------|---------|
| `[TEL:SSE_BRIDGE]` | `server/coordination/telemetry/coordination-sse-bridge.ts` | `wireCoordinationSSE` |
| `[VER:GATE]` | `server/coordination/verification/post-coordination-verifier.ts` | `verifyCoordinationResult` |

---

## Layer: Contracts

| Tag | File | Exports |
|-----|------|---------|
| `[CONTRACT:SPECIALIST]` | `server/coordination/contracts/specialist.contracts.ts` | `SpecialistTask`, `SpecialistResult`, `FilePatch`, `SpecialistDomain` |
| `[CONTRACT:COORDINATION]` | `server/coordination/contracts/coordination.contracts.ts` | `CoordinationResult`, `CoordinationContext`, `DecomposedPlan` |

---

## Dependency Graph (simplified)

```
main.ts
  → coordination/index.ts [ENTRY:COORDINATION]
      → [WAVE:COORDINATOR]
          → [WAVE:RUNNER]
              → [DISPATCH:DISPATCHER]  ← NEW
                  → [DISPATCH:EXECUTOR]  ← NEW
                      → runAgentLoop (tool-loop.agent.ts)
      → [MERGE:DETECTOR]
      → [MERGE:PLANNER]
      → [MERGE:MERGER]
      → [VER:GATE]  ← NEW
  → [TEL:SSE_BRIDGE]  ← NEW (wireCoordinationSSE)
  → [CTX:REGISTRY]  (startSweeper)  ← FIXED

execution-router.ts
  → [ENTRY:COORDINATION]  ← NEW (swarm case)

swarm-dispatcher.ts
  → [SWARM:MAPPER]  ← NEW
  → [DISPATCH:DISPATCHER]  ← NEW
```
