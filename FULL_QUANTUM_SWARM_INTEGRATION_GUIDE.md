# FULL QUANTUM SWARM — INTEGRATION GUIDE

**Date:** 2026-05-25  
**Audience:** Engineers extending or integrating with the Quantum Swarm Routing System

---

## QUICK START

### 1. Trigger a swarm run
```typescript
// In orchestration-engine.ts (already wired)
await executeOrchestration({
  runId: "my-run-001",
  projectId: 1,
  goal: "Add a users table, REST API, and React frontend",
  mode: "swarm",   // ← triggers MasterSwarmOrchestrator
});
```

### 2. Monitor via telemetry events
```typescript
import { bus } from "server/infrastructure/events/bus.ts";
import { SWARM_EVENTS } from "server/infrastructure/telemetry/swarm/swarm-event-map.ts";

bus.on("agent.event", (event) => {
  if (event.eventType === SWARM_EVENTS.ROUTE_START) {
    console.log("Swarm started:", event.payload);
  }
  if (event.eventType === SWARM_EVENTS.ROUTE_COMPLETE) {
    console.log("Swarm done:", event.payload);
  }
});
```

### 3. Inspect intent graph
```typescript
import { analyzeIntent } from "server/orchestration/swarm/intent-graph/intent-graph-analyzer.ts";

const { graph, complexity } = analyzeIntent("run-preview", goal);
console.log("Strategy:", graph.strategy.strategy);
console.log("Waves:", graph.waves);
console.log("Domains:", [...new Set(graph.nodes.map(n => n.domain))]);
```

---

## EXTENDING THE SYSTEM

### Add a new specialist domain

1. Add to `SpecialistDomain` union in `coordination/contracts/specialist.contracts.ts`
2. Add routing policy in `coordination/swarm-router/routing-policy.ts`
3. Add to `DOMAIN_SIGNALS` in `orchestration/swarm/intent-graph/intent-classifier.ts`
4. Add to `DOMAIN_PRECEDENCE` in `orchestration/swarm/intent-graph/dependency-inferrer.ts`
5. Add to `ROLE_TO_DOMAIN` in `engine/swarm/swarm-domain-mapper.ts`
6. Add to `DOMAIN_MERGE_PRIORITY` in `coordination/contracts/specialist.contracts.ts`

### Add a new canonical telemetry event

1. Add event name constant to `SWARM_EVENTS` in `swarm-event-map.ts`
2. Add payload type interface in `swarm-event-map.ts`
3. Add emitter method to `SwarmTelemetryFabric` class in `swarm-telemetry-fabric.ts`
4. Add helper function in `routing-telemetry.ts` if it's routing-scoped

### Add a new execution strategy

1. Add to `ExecutionStrategy` union in `intent-graph/intent-graph-types.ts`
2. Add detection signals to `intent-classifier.ts`
3. Add case to `classifyIntent()` decision tree in `intent-classifier.ts`
4. Add execution handler in `master-swarm-orchestrator.ts` switch statement

### Override intent classification for a specific run

Pass a `forcedStrategy` in metadata:
```typescript
await executeOrchestration({
  mode: "swarm",
  goal: "...",
  metadata: { forcedStrategy: "dag" },   // overrides classifier
});
```
Then handle in `master-swarm-orchestrator.ts`:
```typescript
const strategy = (context.forcedStrategy as ExecutionStrategy) ?? graph.strategy.strategy;
```

---

## ROUTING POLICY TUNING

Edit `coordination/swarm-router/routing-policy.ts`:

```typescript
// Increase database timeout for slow migrations
database: {
  baseTimeoutMs: 60_000,   // was 30_000
  ...
},

// Lower circuit breaker for strict security domain
security: {
  circuitBreakerLimit: 1,  // was 2 — open on first failure
  ...
},
```

---

## ADDING SWARM TELEMETRY TO EXISTING MODULES

Any module can emit canonical swarm events:

```typescript
import { swarmTelemetryFabric } from
  "server/infrastructure/telemetry/swarm/swarm-telemetry-fabric.ts";

// Example: emit merge events from merge-pipeline.ts
swarmTelemetryFabric.mergeStart(runId, projectId, {
  patchCount:    patches.length,
  conflictCount: conflicts.length,
});

// ... perform merge ...

swarmTelemetryFabric.mergeComplete(runId, projectId, {
  applied:    appliedCount,
  skipped:    skippedCount,
  consistent: isConsistent,
  durationMs: Date.now() - t0,
});
```

---

## CONNECTING ActiveSwarmEngine

`ActiveSwarmEngine` (engine/swarm/active-swarm-engine.ts) provides a full 4-wave
swarm execution with its own task graph, barrier, conflict resolution, and verification.
It is not currently called from the execution path (swarm strategy uses DynamicSwarmRouter).

To wire ActiveSwarmEngine for "swarm" strategy:

```typescript
// In master-swarm-orchestrator.ts
case "swarm":
  // Use ActiveSwarmEngine for full 4-wave parallel execution
  const swarmResult = await activeSwarmEngine.run(runId, projectId, goal);
  execResult = {
    patches:  [],  // ActiveSwarmEngine writes files directly
    failed:   [],
  };
  break;

case "dag":
  // Use DynamicSwarmRouter for graph-based routing
  execResult = await _executeViaRouter(graph, projectId);
  break;
```

This separates concerns cleanly:
- `swarm` → full autonomous agent swarm (4 waves, specialist spawning)
- `dag` → graph-driven parallel specialist routing

---

## DEBUGGING A FAILED SWARM RUN

### 1. Check route-level failure
```
grep "swarm.route.complete" logs | jq '.payload | select(.success == false)'
```

### 2. Find which specialist failed
```
grep "specialist.failed" logs | jq '.payload | select(.taskId == "intent-3")'
```

### 3. Check circuit breaker state
Enable debug logging in `dynamic-swarm-router.ts`:
```typescript
console.debug(`[router] circuit ${domain} failures=${_failureCounters.get(_cbKey(runId, domain))}`);
```

### 4. Inspect intent graph
Add a `console.log(JSON.stringify(graph, null, 2))` in `master-swarm-orchestrator.ts`
after `analyzeIntent()`.

### 5. Check correlation chain
Find all events for a run:
```
grep "corr-run-42" logs  ← all 17 events in order
```

---

## PERFORMANCE CHARACTERISTICS

| Scenario | Latency | Parallelism |
|----------|---------|-------------|
| Single-domain simple goal (tool-loop) | ~2s | 1x |
| Multi-step single-domain (planned) | ~8s | 1x |
| Multi-step ordered (dag) | ~12s | 2-3x |
| Multi-domain parallel (swarm) | ~8s | 4x |
| Exploratory research (quantum) | ~20s | varies |

Parallelism factor is reported in `swarm.route.complete` payload and
`SwarmOrchestrationResult.parallelismFactor`.

---

## CAPACITY LIMITS

| Resource | Limit | Config |
|----------|-------|--------|
| Concurrent swarm runs | 20 | `ParallelOrchestrationFabric.maxConcurrentRuns` |
| Critical-tier workers | 4 | `swarm-priority-router.ts MAX_CONCURRENT.critical` |
| Normal-tier workers | 3 | `swarm-priority-router.ts MAX_CONCURRENT.normal` |
| Low-tier workers | 2 | `swarm-priority-router.ts MAX_CONCURRENT.low` |
| Database domain parallel | 2 | `routing-policy.ts database.maxParallel` |
| Verification domain parallel | 1 | `routing-policy.ts verification.maxParallel` |
| Failover chain length | 3 | hardcoded: primary → failover → fullstack |
