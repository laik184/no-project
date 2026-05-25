# FULL QUANTUM SWARM ROUTING SYSTEM — ARCHITECTURE BLUEPRINT

**Version:** 1.0.0  
**Date:** 2026-05-25

---

## DESIGN GOALS

1. **Single entry point** — all swarm execution enters through `MasterSwarmOrchestrator`
2. **Intent-driven routing** — no hardcoded mode selection; the goal's semantics drive the strategy
3. **Fail-closed by default** — critical failures abort immediately; no silent fallbacks
4. **Full canonical telemetry** — 17 events with correlation IDs for end-to-end traceability
5. **Domain isolation** — per-domain policies, circuit breakers, and failover chains
6. **Under 250 LOC per file** — every file is single-responsibility and reviewable

---

## COMPONENT OVERVIEW

### Tier 1: Intent Analysis
```
IntentGraphAnalyzer (intent-graph-analyzer.ts)
  ├── IntentClassifier (intent-classifier.ts)
  │   ├── Quantum signals  → strategy: "quantum"
  │   ├── Multi-domain     → strategy: "swarm"
  │   ├── DAG signals      → strategy: "dag"
  │   ├── Build signals    → strategy: "planned"
  │   └── Simple signals   → strategy: "tool-loop"
  ├── DependencyInferrer (dependency-inferrer.ts)
  │   ├── Domain-order edges (database→backend→security→runtime→frontend→verification)
  │   ├── Structural edges (schema→route→test)
  │   └── Data edges (consumer signals)
  └── WaveBuilder (topological sort of nodes into parallel waves)
```

### Tier 2: Orchestration
```
MasterSwarmOrchestrator (master-swarm-orchestrator.ts)
  ├── ParallelOrchestrationFabric.spawn()   ← capacity gate (max 20 concurrent)
  ├── analyzeIntent()                        ← intent graph
  ├── SwarmTelemetryFabric.routeStart()
  ├── Strategy dispatch:
  │   ├── quantum  → runQuantum()
  │   ├── swarm    → DynamicSwarmRouter.route(graph)
  │   ├── dag      → DynamicSwarmRouter.route(graph)
  │   ├── planned  → coordinateSpecialists()
  │   └── tool-loop → coordinateSpecialists()
  ├── SwarmTelemetryFabric.routeComplete()
  └── ParallelOrchestrationFabric.transition("complete")
```

### Tier 3: Dynamic Routing
```
DynamicSwarmRouter (dynamic-swarm-router.ts)
  ├── Per-wave parallel execution
  │   ├── parallel nodes   → Promise.all()
  │   └── sequential nodes → sequential loop (database, verification)
  ├── Per-domain RoutingPolicy
  │   ├── WorkerType       (io-bound / cpu-bound / llm)
  │   ├── Timeout          (base × multiplier)
  │   ├── MaxParallel      (per-domain concurrency cap)
  │   └── CircuitBreaker   (consecutive failure limit)
  ├── FailoverChain        (primary → failover → fullstack)
  └── CriticalAbort        (AbortController on critical node failure)
```

### Tier 4: Telemetry
```
SwarmTelemetryFabric (swarm-telemetry-fabric.ts)
  ├── Correlation registry (per-runId correlation IDs)
  ├── 17 canonical events (swarm-event-map.ts)
  └── Delegates all emission to EventBus (bus.emit)
```

---

## DOMAIN ROUTING POLICIES

| Domain | Worker Type | Base Timeout | Max Parallel | CB Limit | Failover |
|--------|-------------|-------------|-------------|---------|---------|
| database | io-bound | 30s | 2 | 2 | backend |
| backend | llm | 60s | 3 | 3 | fullstack |
| security | cpu-bound | 45s | 2 | 2 | — |
| runtime | io-bound | 60s | 2 | 3 | fullstack |
| frontend | llm | 60s | 4 | 4 | fullstack |
| verification | cpu-bound | 120s | 1 | 1 | — |
| fullstack | llm | 90s | 3 | 4 | — |

---

## INTENT CLASSIFICATION DECISION TREE

```
goal → classifyIntent(goal)
  │
  ├── QUANTUM_SIGNALS ≥ 1?  → strategy: "quantum"  (confidence: 0.5+)
  │
  ├── domainCount ≥ 2?      → strategy: "swarm"    (confidence: 0.6+)
  │
  ├── dagHits ≥ 2           → strategy: "dag"      (confidence: 0.5+)
  │   OR complexity ≥ 50?
  │
  ├── plannedHits ≥ 1       → strategy: "planned"  (confidence: 0.5+)
  │   OR complexity ≥ 20?
  │
  └── default               → strategy: "tool-loop" (confidence: 0.80)
```

---

## EXECUTION WAVE MODEL

```
IntentGraph.waves = [
  ["intent-1", "intent-2"],   ← Wave 0: no deps, run in parallel
  ["intent-3"],               ← Wave 1: depends on wave 0
  ["intent-4", "intent-5"],   ← Wave 2: depends on wave 1, run in parallel
]

For each wave:
  parallel_nodes = wave.filter(n => n.parallel)
  sequential_nodes = wave.filter(n => !n.parallel)  ← database, verification
  
  await Promise.all(parallel_nodes.map(n => dispatchWithFailover(n)))
  for (const n of sequential_nodes) {
    await dispatchWithFailover(n)
  }
```

---

## CIRCUIT BREAKER MODEL

```
Per-run, per-domain failure counter:
  key = "{runId}::{domain}"
  
On specialist failure:
  _recordFailure(runId, domain)  ← increments counter
  
Before dispatch:
  if (_circuitOpen(runId, domain)) → skip to next in failover chain
  
Cleanup:
  _clearCircuits(runId)  ← called on route complete/abort
```

---

## INVARIANTS

1. `verification` domain always runs sequential (maxParallel=1)
2. `database` always runs sequential (parallel=false in IntentNode)
3. Circuit breaker state never bleeds across runs (keyed by runId)
4. Critical node failure aborts all remaining tasks via AbortController
5. SwarmTelemetryFabric clears correlation state on routeComplete + abort
6. ParallelOrchestrationFabric capacity gate enforced before intent analysis
7. No LLM calls in intent analysis layer — fully deterministic
