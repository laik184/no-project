# FULL QUANTUM SWARM — TELEMETRY MAP

**Date:** 2026-05-25  
**System:** NURA-X Quantum Swarm Routing v1.0  
**Total canonical events:** 17

---

## EVENT CATALOG

### swarm.route.start
**Emitter:** SwarmTelemetryFabric (via MasterSwarmOrchestrator)  
**Timing:** Immediately after intent analysis, before first wave dispatch  
**Payload:**
```typescript
{
  strategy:    string;   // "swarm" | "dag" | "planned" | "tool-loop" | "quantum"
  domainCount: number;   // distinct specialist domains required
  nodeCount:   number;   // total IntentNodes in graph
  waves:       number;   // number of parallel execution waves
  correlationId: string; // links all events in this run
}
```

### swarm.route.complete
**Emitter:** SwarmTelemetryFabric (via MasterSwarmOrchestrator)  
**Timing:** After all waves complete (or on failure)  
**Payload:**
```typescript
{
  strategy:    string;
  success:     boolean;
  durationMs:  number;
  patchCount:  number;
  correlationId: string;
}
```

### DAG.node.start
**Emitter:** SwarmTelemetryFabric (via QuantumDAGEngine)  
**Timing:** Before each node is submitted to the worker pool  
**Payload:**
```typescript
{
  nodeId:     string;    // DistributedNode.id
  domain:     string;    // worker type ("io-bound" | "cpu-bound" | "llm")
  waveIndex:  number;
  workerType: string;
  correlationId: string;
}
```

### DAG.node.complete
**Emitter:** SwarmTelemetryFabric (via QuantumDAGEngine)  
**Timing:** After worker pool returns result for a node  
**Payload:**
```typescript
{
  nodeId:     string;
  domain:     string;
  success:    boolean;
  durationMs: number;
  correlationId: string;
}
```

### specialist.dispatch
**Emitter:** RoutingTelemetry (via DynamicSwarmRouter)  
**Timing:** Before each specialistDispatcher.dispatch() call  
**Payload:**
```typescript
{
  taskId:    string;
  domain:    string;     // SpecialistDomain
  priority:  string;     // "0" (critical) | "1" (high) | "2" (normal) | "3" (low)
  goal:      string;     // first 120 chars of goal fragment
  correlationId: string;
}
```

### specialist.complete
**Emitter:** RoutingTelemetry (via DynamicSwarmRouter)  
**Timing:** After successful specialist dispatch  
**Payload:**
```typescript
{
  taskId:     string;
  domain:     string;
  success:    boolean;
  patches:    number;    // FilePatch count
  durationMs: number;
  correlationId: string;
}
```

### specialist.failed
**Emitter:** RoutingTelemetry (via DynamicSwarmRouter)  
**Timing:** After each failed dispatch attempt (including failover attempts)  
**Payload:**
```typescript
{
  taskId:    string;
  domain:    string;
  error:     string;
  retryable: boolean;
  correlationId: string;
}
```

### lock.acquire
**Emitter:** SwarmTelemetryFabric  
**Timing:** When a specialist acquires an exclusive file lock  
**Payload:**
```typescript
{
  filePath:  string;
  ownerId:   string;     // specialist taskId
  timeoutMs: number;
  correlationId: string;
}
```

### lock.release
**Emitter:** SwarmTelemetryFabric  
**Timing:** When a specialist releases a file lock  
**Payload:**
```typescript
{
  filePath: string;
  ownerId:  string;
  heldMs:   number;      // how long the lock was held
  correlationId: string;
}
```

### merge.start
**Emitter:** SwarmTelemetryFabric  
**Timing:** Before the merge pipeline begins applying patches  
**Payload:**
```typescript
{
  patchCount:    number;
  conflictCount: number;
  correlationId: string;
}
```

### merge.complete
**Emitter:** SwarmTelemetryFabric  
**Timing:** After merge pipeline completes  
**Payload:**
```typescript
{
  applied:    number;
  skipped:    number;
  consistent: boolean;
  durationMs: number;
  correlationId: string;
}
```

### verification.start
**Emitter:** SwarmTelemetryFabric  
**Timing:** Before ParallelVerificationEngine.run()  
**Payload:**
```typescript
{
  waves:       string[];   // ["WAVE_A", "WAVE_B", "WAVE_C"]
  skipStages?: string[];
  correlationId: string;
}
```

### verification.complete
**Emitter:** SwarmTelemetryFabric  
**Timing:** After all verification waves complete  
**Payload:**
```typescript
{
  ok:          boolean;
  durationMs:  number;
  failedWave?: string;   // "A" | "B" | "C" if failed
  correlationId: string;
}
```

### orchestration.abort
**Emitter:** SwarmTelemetryFabric (via MasterSwarmOrchestrator + DynamicSwarmRouter)  
**Timing:** When a critical failure forces immediate abort  
**Payload:**
```typescript
{
  reason:  string;
  phase:   string;
  runId:   string;
  correlationId: string;
}
```

### runtime.crashed
**Emitter:** SwarmTelemetryFabric  
**Timing:** When the runtime process crashes (SIGKILL, OOM, etc.)  
**Payload:**
```typescript
{
  error:      string;
  processId?: number;
  phase:      string;
  correlationId: string;
}
```

### recovery.start
**Emitter:** SwarmTelemetryFabric  
**Timing:** When orchestration-recovery triggers a recovery strategy  
**Payload:**
```typescript
{
  reason:    string;
  fromPhase: string;
  strategy:  string;   // "retry" | "resume" | "fallback"
  correlationId: string;
}
```

### recovery.complete
**Emitter:** SwarmTelemetryFabric  
**Timing:** After recovery strategy completes  
**Payload:**
```typescript
{
  success:      boolean;
  durationMs:   number;
  resumePhase?: string;
  correlationId: string;
}
```

---

## CORRELATION ID SYSTEM

Every run gets a unique correlation ID generated on first `swarmTelemetryFabric` call:
```
correlationId = "corr-{runId}-{timestamp}"
```

All 17 events for a run share the same correlationId, enabling:
- End-to-end trace reconstruction in log aggregators
- Filtering all events for a specific run: `correlationId LIKE "corr-run-42-%"`
- Span linking: route→dispatch→merge→verification form a complete trace

Correlation state is cleared on:
- `routeComplete` (success path)
- `orchestrationAbort` (failure path)
- `clearRun(runId)` (explicit cleanup)

---

## EVENT FLOW DIAGRAM

```
swarm.route.start
     │
     ├── [for each wave]
     │   ├── DAG.node.start        (if QuantumDAGEngine used)
     │   ├── specialist.dispatch   (per node)
     │   ├── specialist.complete   (success)
     │   ├── specialist.failed     (failure → failover)
     │   ├── lock.acquire          (if exclusive file lock)
     │   ├── lock.release          (after write)
     │   └── DAG.node.complete     (if QuantumDAGEngine used)
     │
     ├── merge.start
     ├── merge.complete
     │
     ├── verification.start
     ├── verification.complete
     │
swarm.route.complete
     │
     └── OR on failure:
         ├── orchestration.abort
         ├── recovery.start
         └── recovery.complete
```
