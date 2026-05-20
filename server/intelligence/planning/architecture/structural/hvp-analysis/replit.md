# hvp-analysis

## Purpose

`hvp-analysis` is a pure, deterministic static-analysis engine that validates
whether a TypeScript/Node project's source structure obeys **HVP (Hierarchical
Vertical Partitioning)** rules.  It accepts a description of the project
(`ProjectStructure`) — files, their roles, layer assignments, and import lists —
and returns an immutable `HVPComplianceReport` detailing every violation found.

It performs **no I/O**, executes **no code**, and has **no side effects** outside
its own in-memory state store.

---

## What It Validates

| Check | Description |
|---|---|
| Layer Structure | Every defined HVP layer has at least one file; files are assigned to valid layers with correct roles |
| Import Direction | Imports flow downward (layer 1 → 2 → 3). Upward or reversed imports are CRITICAL violations |
| Cross-Layer Role Rules | `validator→validator`, `state→validator`, `state→util`, `util→validator` are all forbidden |
| Orchestrator Rules | Non-orchestrators may not import orchestrators; agents may not import each other |
| State Isolation | Only orchestrators may import state files; state files may only import types |

## What It Does NOT Do

- Does NOT read files from disk
- Does NOT execute or run code
- Does NOT modify the filesystem
- Does NOT contact any runtime
- Does NOT perform refactoring
- Does NOT write logs
- Does NOT manage deployment or governance

---

## File-by-File Responsibility

| File | Responsibility |
|---|---|
| `types.ts` | All interfaces: FileNode, ImportEdge, Violation, LayerDefinition, HVPComplianceReport, constants |
| `state.ts` | In-memory session tracking, import graph cache, report history ring-buffer |
| `utils/layer-map.builder.ts` | Builds LayerMap (byLevel/byPath/byRole), lookup tables, resolves allowed import levels |
| `utils/import-graph.builder.ts` | Builds ImportEdge graph from FileNodes + LayerDefinitions; detects cycles; filters violations |
| `validators/layer-structure.validator.ts` | Checks required layers exist and files are assigned to valid layers with correct roles |
| `validators/import-direction.validator.ts` | Validates that imports only flow downward through HVP layers |
| `validators/cross-layer.validator.ts` | Detects forbidden role-to-role imports (validator→validator, state→util, etc.) |
| `validators/orchestrator-rule.validator.ts` | Ensures orchestrators are not bypassed; agents do not import each other |
| `validators/state-isolation.validator.ts` | Ensures state files are only accessed by orchestrators and only import types |
| `hvp-orchestrator.ts` | Level-1 coordinator — calls all 5 validators in sequence, aggregates results, returns frozen HVPComplianceReport |
| `index.ts` | Clean public re-export surface |

---

## HVP Layer Diagram

```
Level 1 — Orchestration
└── hvp-orchestrator.ts

Level 2 — Validators (Domain)
├── validators/layer-structure.validator.ts
├── validators/import-direction.validator.ts
├── validators/cross-layer.validator.ts
├── validators/orchestrator-rule.validator.ts
└── validators/state-isolation.validator.ts

Level 3 — Infrastructure (Pure, no upstream imports)
├── utils/layer-map.builder.ts
├── utils/import-graph.builder.ts
├── types.ts
└── state.ts
```

---

## Call Flow Diagram

```
index.ts
   │  (re-exports only)
   ▼
hvp-orchestrator.ts — analyzeHVP(project)
   │
   ├── [phase: LAYER_STRUCTURE]
   │     layer-structure.validator.ts
   │     ├── buildLayerMap()              ← utils/layer-map.builder.ts
   │     ├── validateRequiredLayers()
   │     └── validateFileLayerAssignment()
   │
   ├── [phase: IMPORT_DIRECTION]
   │     import-direction.validator.ts
   │     ├── buildImportGraph()           ← utils/import-graph.builder.ts
   │     └── filterViolatingEdges() → IMPORT_DIRECTION_REVERSED violations
   │
   ├── [phase: CROSS_LAYER]
   │     cross-layer.validator.ts
   │     ├── buildImportGraph()
   │     └── checkEdgeForRoleViolation()  → role-pair violation table
   │        VALIDATOR_IMPORTS_VALIDATOR
   │        STATE_IMPORTS_VALIDATOR
   │        STATE_IMPORTS_UTIL
   │        UTIL_IMPORTS_VALIDATOR
   │
   ├── [phase: ORCHESTRATOR_RULE]
   │     orchestrator-rule.validator.ts
   │     ├── buildImportGraph()
   │     ├── bypassViolation()            → ORCHESTRATOR_BYPASS (CRITICAL)
   │     └── agentToAgentViolation()      → ORCHESTRATOR_BYPASS (HIGH)
   │
   ├── [phase: STATE_ISOLATION]
   │     state-isolation.validator.ts
   │     ├── buildImportGraph()
   │     ├── stateMutationViolation()     → STATE_MUTATION_OUTSIDE_ORCHESTRATOR
   │     └── stateImportsAgentViolation() → STATE_IMPORTS_VALIDATOR
   │
   ├── buildImportGraph() → state.setImportGraph()
   ├── computeScore()     → 100 - deductions per violation severity
   ├── buildLayerReports()
   └── return frozen HVPComplianceReport
```

---

## Import Direction Rules

```
ALLOWED:
index                    → hvp-orchestrator, types
hvp-orchestrator         → validators/*, utils/*, state, types
validators               → types, utils/*

FORBIDDEN:
validators → validators   (strict — no cross-validator imports)
state      → validators   (state imports types only)
state      → utils        (state imports types only)
utils      → validators   (leaf nodes — pure functions only)
any file   → orchestrator (except index)
```

---

## Scoring

Each violation deducts from a base score of 100:

| Severity | Deduction |
|---|---|
| CRITICAL | −25 |
| HIGH     | −15 |
| MEDIUM   | −7  |
| LOW      | −3  |

Score is clamped to a minimum of 0. A score of 100 means full HVP compliance.

---

## Example — Compliant Result

**Input:**
```typescript
const project: ProjectStructure = {
  projectId: "my-service",
  files: [
    { path: "orchestrator.ts",  role: "orchestrator", layer: 1, imports: ["validator.ts", "state.ts"], lineCount: 80,  exports: ["analyze"] },
    { path: "validator.ts",     role: "validator",    layer: 2, imports: ["utils.ts"],                 lineCount: 60,  exports: ["validate"] },
    { path: "utils.ts",         role: "util",         layer: 3, imports: [],                           lineCount: 40,  exports: ["helper"] },
    { path: "state.ts",         role: "state",        layer: 3, imports: ["types.ts"],                 lineCount: 50,  exports: ["getState"] },
    { path: "types.ts",         role: "type",         layer: 3, imports: [],                           lineCount: 30,  exports: [] },
  ],
  layerDefinitions: HVP_DEFAULT_LAYERS,
};
```

**Output:**
```json
{
  "reportId":        "hvp-1740700800000-0001",
  "isCompliant":     true,
  "complianceScore": 100,
  "totalFiles":      5,
  "totalViolations": 0,
  "violations":      [],
  "summary":         "HVP fully compliant — 5 files, score: 100/100."
}
```

---

## Example — Violation Result

**Violation scenario:** `validator.ts` imports `state.ts`

**Output:**
```json
{
  "isCompliant":     false,
  "complianceScore": 75,
  "totalViolations": 1,
  "criticalCount":   1,
  "violations": [{
    "id":           "siv-0001",
    "type":         "STATE_MUTATION_OUTSIDE_ORCHESTRATOR",
    "severity":     "CRITICAL",
    "file":         "validator.ts",
    "importedFile": "state.ts",
    "message":      "State access violation: non-orchestrator 'validator.ts' (role: validator) imports state 'state.ts'",
    "rule":         "Only orchestrators may import state.",
    "evidence":     [
      "importer: validator.ts (role: validator)",
      "state file: state.ts",
      "fix: route state access through the orchestrator"
    ]
  }]
}
```

---

## State Lifecycle

```
IDLE            analyzeHVP() called, session created
     ↓
LAYER_STRUCTURE  layer-structure.validator runs
     ↓
IMPORT_DIRECTION import-direction.validator runs
     ↓
CROSS_LAYER      cross-layer.validator runs
     ↓
ORCHESTRATOR_RULE orchestrator-rule.validator runs
     ↓
STATE_ISOLATION  state-isolation.validator runs
     ↓
COMPLETE         report frozen and stored, session marked complete
```

State stores:
- `HVPAnalysisSession` — session ID, project ID, phase, timestamps, file count
- `IntermediateImportGraph` — cached edge graph built during analysis
- `HVPComplianceReport[]` — ring buffer of last 50 reports (accessible via `getReportHistory()`)
