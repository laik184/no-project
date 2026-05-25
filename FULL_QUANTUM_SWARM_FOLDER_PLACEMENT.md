# FULL QUANTUM SWARM — FOLDER PLACEMENT REPORT

**Date:** 2026-05-25  
**Scope:** New directory structure created this session

---

## NEW DIRECTORIES

### server/orchestration/swarm/
**Rationale:** MasterSwarmOrchestrator is an orchestration-layer concern. It sits above
the execution engines (engine/swarm/) and coordination layer (coordination/).
Placing it in `orchestration/swarm/` follows the existing pattern:
- `orchestration/core/`         ← lifecycle
- `orchestration/execution/`    ← routing
- `orchestration/rerouting/`    ← dynamic escalation
- `orchestration/distributed/`  ← multi-run fabric
- `orchestration/swarm/`        ← [NEW] swarm entry point + intent graph

**Files:**
- `master-swarm-orchestrator.ts` ← correct placement
- `intent-graph/intent-graph-types.ts` ← correct placement (co-located with analyzer)
- `intent-graph/intent-classifier.ts`  ← correct placement
- `intent-graph/dependency-inferrer.ts` ← correct placement
- `intent-graph/intent-graph-analyzer.ts` ← correct placement

### server/coordination/swarm-router/
**Rationale:** DynamicSwarmRouter is a coordination-layer concern — it routes
specialist tasks through the existing `specialistDispatcher` which lives in
`coordination/specialist-dispatcher/`. Co-locating with coordination is correct.

**Alternative considered:** `engine/swarm/swarm-router/` — rejected because
DynamicSwarmRouter uses `specialistDispatcher` (coordination layer) and
`routing-policy` (coordination domain) rather than engine internals.

**Files:**
- `dynamic-swarm-router.ts` ← correct placement
- `routing-policy.ts` ← correct placement (domain configs, not engine configs)
- `routing-telemetry.ts` ← correct placement (coordination telemetry)
- `index.ts` ← correct placement (public surface of subsystem)

### server/infrastructure/telemetry/swarm/
**Rationale:** SwarmTelemetryFabric is infrastructure — it wraps the event bus
and provides a typed facade used by ALL swarm layers (orchestration, coordination,
engine). Placing it in `infrastructure/telemetry/swarm/` follows:
- `infrastructure/events/bus.ts` ← raw event bus
- `infrastructure/telemetry/swarm/` ← [NEW] swarm telemetry facade

**Alternative considered:** `engine/swarm/swarm-telemetry.ts` — rejected because
engine/swarm/swarm-telemetry.ts already exists for engine-layer events.
The new fabric is cross-cutting (all layers) → infrastructure layer.

---

## IMPORT PATH ISSUE

**File:** `server/coordination/swarm-router/dynamic-swarm-router.ts`  
**Problem:** Imports `intent-graph-types.ts` via a path crossing from coordination/
into orchestration/swarm/intent-graph/:
```typescript
import type { IntentGraph, IntentNode } from
  "../swarm-router/../../../server/orchestration/swarm/intent-graph/intent-graph-types.ts";
```
This path is overly complex and fragile.

**Recommended Fix:** Move `intent-graph-types.ts` to a shared contracts location:
```
server/orchestration/swarm/intent-graph/intent-graph-types.ts  ← current
server/coordination/contracts/intent.contracts.ts               ← recommended
```
Or simplify the import path:
```typescript
import type { IntentGraph, IntentNode } from
  "../../orchestration/swarm/intent-graph/intent-graph-types.ts";
```
(from `server/coordination/swarm-router/` → `server/orchestration/swarm/intent-graph/`
= `../../orchestration/swarm/intent-graph/`)

---

## RECOMMENDED FUTURE STRUCTURE REFINEMENTS

### Option A: Shared types in coordination/contracts/
```
server/coordination/contracts/
├── specialist.contracts.ts      ← exists
├── coordination.contracts.ts    ← exists
└── intent.contracts.ts          ← [FUTURE] move IntentGraph types here
```

### Option B: Shared types in shared/types/
```
shared/types/
└── orchestration/
    └── intent-graph.ts          ← [FUTURE] if frontend needs intent graph display
```

### Option C: Keep current (acceptable for now)
Current placement is functional. Cross-layer import is suboptimal but not a bug.
Recommend fixing in the next refactor pass when time allows.

---

## COHESION SCORE

| Directory | Cohesion | Notes |
|-----------|----------|-------|
| orchestration/swarm/ | HIGH | All files serve the swarm entry point |
| orchestration/swarm/intent-graph/ | HIGH | 4 files, 1 responsibility (intent analysis) |
| coordination/swarm-router/ | HIGH | 4 files, 1 responsibility (routing) |
| infrastructure/telemetry/swarm/ | HIGH | 2 files, 1 responsibility (telemetry) |
