# boundary-analysis

## Purpose

`boundary-analysis` is a pure, deterministic architectural boundary validation
engine. It accepts an `ArchitectureGraph` — a structured description of modules
(nodes with layer, domain, and role metadata) and import relationships (edges) —
and produces an immutable `BoundaryReport` that identifies every layer boundary
violation, illegal dependency direction, domain leakage, infrastructure leakage,
and circular dependency in the architecture.

No code execution. No filesystem access. No mutations. Pure analysis only.

---

## What It Handles

- **Layer boundary violations** — imports that cross HVP layer rules (e.g., layer 2 importing from layer 1)
- **Upward imports** — higher layers importing from lower layers in the HVP hierarchy (CRITICAL)
- **Illegal dependency directions** — roles importing from roles they must not (e.g., `util → agent`, `state → orchestrator`)
- **Circular dependencies** — cycles detected in the import DAG (CRITICAL)
- **Cross-domain leakage** — forbidden domain-to-domain import pairs (e.g., `planning → runtime`)
- **Infrastructure leakage** — infrastructure domains bleeding into business/domain layers

## What It Does NOT Handle

- Does NOT read or write files from disk
- Does NOT modify or refactor any code
- Does NOT build or resolve import paths (caller must supply resolved graph)
- Does NOT analyze responsibility or SRP (see `responsibility-analysis`)
- Does NOT check HVP compliance scoring (see `hvp-analysis`)
- Does NOT access runtime, git, or planner
- Does NOT trigger any external system

---

## File-by-File Responsibility

| File | Responsibility |
|---|---|
| `types.ts` | All interfaces, enums, and constants: ArchNode, ArchEdge, ArchitectureGraph, BoundaryViolation, BoundaryReport, HVP_ALLOWED_DIRECTIONS, FORBIDDEN_DOMAIN_PAIRS, INFRASTRUCTURE_DOMAINS |
| `state.ts` | Session lifecycle, intermediate violations cache, report history ring-buffer (50 reports). Imports types only — never agents |
| `utils/graph.helper.ts` | Pure graph utilities: NodeIndex construction, edge resolution, adjacency, cycle detection (DFS-based), domain/layer filtering |
| `utils/rule.engine.ts` | Pure rule functions: checkLayerDirection, checkDependencyDirection, checkDomainLeakage, checkInfrastructureLeakage — all return RuleMatch records |
| `layer-boundary.validator.agent.ts` | Iterates all edges and checks HVP layer direction rules. Produces LayerValidationResult with LAYER_BOUNDARY_VIOLATION and UPWARD_IMPORT violations |
| `dependency-direction.validator.agent.ts` | Validates role-based dependency directions and detects circular dependencies. Produces DirectionValidationResult |
| `domain-leakage.detector.agent.ts` | Detects cross-domain and infrastructure leakage by checking FORBIDDEN_DOMAIN_PAIRS and INFRASTRUCTURE_DOMAINS. Produces DomainLeakageResult |
| `violation-reporter.agent.ts` | Aggregates all three violation sets, computes the overall boundary score, and builds the frozen BoundaryReport |
| `boundary-orchestrator.ts` | Level-1 coordinator — calls all agents in sequence, updates state phase, returns frozen BoundaryReport |
| `index.ts` | Clean public re-export surface for types and orchestrator functions |

---

## HVP Layer Diagram

```
Level 1 — Orchestration
└── boundary-orchestrator.ts

Level 2 — Domain Agents
├── layer-boundary.validator.agent.ts
├── dependency-direction.validator.agent.ts
├── domain-leakage.detector.agent.ts
└── violation-reporter.agent.ts

Level 3 — Infrastructure (pure, no upstream imports)
├── utils/graph.helper.ts
├── utils/rule.engine.ts
├── types.ts
└── state.ts
```

---

## Call Flow Diagram

```
index.ts
   │  (re-exports only)
   ▼
boundary-orchestrator.ts — analyzeBoundaries(graph)
   │
   ├── isValidGraph()        ← utils/graph.helper.ts
   │
   ├── [phase: LAYER_VALIDATION]
   │     layer-boundary.validator.agent.ts
   │     ├── buildNodeIndex()            ← graph.helper
   │     ├── resolveEdgeNodes()          ← graph.helper
   │     └── checkLayerDirection()       ← rule.engine
   │     → LayerValidationResult
   │         ↳ UPWARD_IMPORT           (CRITICAL)
   │         ↳ LAYER_BOUNDARY_VIOLATION (HIGH)
   │
   ├── [phase: DIRECTION_VALIDATION]
   │     dependency-direction.validator.agent.ts
   │     ├── resolveEdgeNodes()          ← graph.helper
   │     ├── checkDependencyDirection()  ← rule.engine
   │     └── detectCycles()             ← graph.helper
   │     → DirectionValidationResult
   │         ↳ ILLEGAL_DEPENDENCY_DIRECTION (MEDIUM/HIGH)
   │         ↳ CIRCULAR_DEPENDENCY          (CRITICAL)
   │
   ├── [phase: DOMAIN_LEAKAGE_DETECTION]
   │     domain-leakage.detector.agent.ts
   │     ├── resolveEdgeNodes()          ← graph.helper
   │     ├── checkDomainLeakage()        ← rule.engine
   │     └── checkInfrastructureLeakage()← rule.engine
   │     → DomainLeakageResult
   │         ↳ CROSS_DOMAIN_LEAKAGE    (CRITICAL)
   │         ↳ INFRASTRUCTURE_LEAKAGE  (HIGH)
   │
   ├── [phase: REPORT_GENERATION]
   │     violation-reporter.agent.ts — compileReport()
   │     ├── Merge all three violation sets (capped at 500)
   │     ├── computeScore() → 100 − deductions
   │     └── buildSummary()
   │     → frozen BoundaryReport
   │
   └── [phase: COMPLETE] → report stored in state, returned
```

---

## Import Direction Rules

```
ALLOWED:
index                  → boundary-orchestrator, types
boundary-orchestrator  → agents/*, state, utils/graph.helper, types
agents                 → types, utils/*

FORBIDDEN:
agents      → agents       (no cross-agent imports)
state       → agents       (imports types only)
utils       → agents       (leaf nodes — pure functions)
any         → orchestrator  (except index)
```

---

## HVP Layer Direction Rules

```
HvpLayer 1 (orchestrator) → may import layers 2, 3, 4
HvpLayer 2 (agent)        → may import layers 3, 4
HvpLayer 3 (util/state)   → may import layer 4 only
HvpLayer 4 (types)        → may not import anything

Violations:
  Layer 2 → Layer 1  : UPWARD_IMPORT   (CRITICAL)
  Layer 3 → Layer 2  : UPWARD_IMPORT   (CRITICAL)
  Layer 3 → Layer 1  : UPWARD_IMPORT   (CRITICAL)
  Peer cross-layer   : LAYER_BOUNDARY_VIOLATION (HIGH)
```

## Role Dependency Direction Rules

```
util  → [agent, orchestrator, service]  : ILLEGAL (MEDIUM)
state → [agent, orchestrator, service]  : ILLEGAL (MEDIUM)
type  → [agent, orchestrator, service, util, state] : ILLEGAL (HIGH)
agent → [orchestrator]                  : ILLEGAL (MEDIUM)
```

---

## Scoring Explanation

Each report starts at **100**. Deductions applied per violation:

| Severity | Deduction |
|---|---|
| CRITICAL | −25 |
| HIGH     | −15 |
| MEDIUM   | −7  |
| LOW      | −3  |

Score is clamped to a minimum of **0**.

`isCompliant = totalViolations === 0`

---

## Forbidden Domain Pairs (CROSS_DOMAIN_LEAKAGE)

| From       | To         | Reason |
|---|---|---|
| planning   | runtime    | Planner must not depend on runtime |
| runtime    | planning   | Runtime must not depend on planner |
| stability  | analysis   | Stability agents must not import architecture analysis |
| stability  | planning   | Stability must not import planner |
| analysis   | runtime    | Analysis must not depend on runtime execution |
| analysis   | planning   | Analysis must not depend on planner |
| analysis   | stability  | Analysis must not depend on stability |
| governance | runtime    | Governance must not touch runtime |
| security   | planning   | Security must not depend on planner |
| pipeline   | governance | Pipeline must not bypass governance through direct import |

---

## Example — Compliant Input/Output

```typescript
const graph: ArchitectureGraph = {
  projectId: "clean-service",
  nodes: [
    { id: "n1", path: "orchestrator.ts", layer: 1, domain: "analysis", role: "orchestrator" },
    { id: "n2", path: "validator.agent.ts", layer: 2, domain: "analysis", role: "agent" },
    { id: "n3", path: "helper.util.ts", layer: 3, domain: "analysis", role: "util" },
  ],
  edges: [
    { from: "n1", to: "n2", importType: "direct" },
    { from: "n2", to: "n3", importType: "direct" },
  ],
};
const report = analyzeBoundaries(graph);
// report.isCompliant     → true
// report.overallScore    → 100
// report.totalViolations → 0
```

## Example — Violation Input/Output

```typescript
const graph: ArchitectureGraph = {
  projectId: "broken-service",
  nodes: [
    { id: "a", path: "agent.ts",   layer: 2, domain: "analysis", role: "agent" },
    { id: "o", path: "orch.ts",    layer: 1, domain: "analysis", role: "orchestrator" },
    { id: "p", path: "planner.ts", layer: 2, domain: "planning", role: "agent" },
    { id: "r", path: "runtime.ts", layer: 2, domain: "runtime",  role: "agent" },
  ],
  edges: [
    { from: "a", to: "o", importType: "direct" },         // agent → orchestrator (UPWARD)
    { from: "p", to: "r", importType: "direct" },         // planning → runtime   (CROSS_DOMAIN)
  ],
};
const report = analyzeBoundaries(graph);
// report.violations[0].type     → "UPWARD_IMPORT"        (CRITICAL)
// report.violations[1].type     → "CROSS_DOMAIN_LEAKAGE" (CRITICAL)
// report.overallScore           → 50
// report.isCompliant            → false
```

---

## Boundary Validation Lifecycle

```
IDLE                  analyzeBoundaries() called, session created
     ↓
LAYER_VALIDATION      layer-boundary.validator checks all edges for HVP layer direction
     ↓
DIRECTION_VALIDATION  dependency-direction.validator checks role rules + cycle detection
     ↓
DOMAIN_LEAKAGE        domain-leakage.detector checks forbidden domain pairs + infra leakage
     ↓
REPORT_GENERATION     violation-reporter merges all violations, scores, builds report
     ↓
COMPLETE              report frozen, stored in state history, returned to caller
```
