# dependency-analysis

## Purpose

`dependency-analysis` is a pure, deterministic static analysis engine that
models, measures, and reports on the dependency structure of a software project.
It accepts a `DependencyInput` — a list of source modules with their import
relationships — and produces an immutable `DependencyAnalysisResult` containing
the full dependency graph, detected cycles, per-module coupling scores,
dependency clusters, and structural metrics.

No filesystem access. No code execution. No mutations. Pure graph analysis.

---

## What It Handles

- **Dependency graph building** — converts raw module lists + import declarations into a directed `DependencyGraph` (nodes + edges)
- **Cycle detection** — uses Tarjan's Strongly Connected Components (SCC) algorithm to detect all cyclic dependency groups
- **Coupling analysis** — computes per-module afferent coupling (Ca), efferent coupling (Ce), instability score (Ce/(Ca+Ce)), and coupling risk level
- **Dependency clustering** — groups modules into weakly-connected components to identify isolated subsystems
- **Structural metrics** — computes totalModules, totalEdges, avgFanIn, avgFanOut, maxDepth, graphDensity, overall health score

## What It Does NOT Handle

- Does NOT read files from disk or resolve import paths
- Does NOT modify or refactor code
- Does NOT validate architectural boundaries (see `boundary-analysis`)
- Does NOT validate HVP compliance (see `hvp-analysis`)
- Does NOT analyze file responsibilities (see `responsibility-analysis`)
- Does NOT access runtime, git, planner, or any external system

---

## File-by-File Responsibility

| File | Lines | Responsibility |
|---|---|---|
| `types.ts` | — | All interfaces, enums, constants: SourceModule, DependencyInput, GraphNode, GraphEdge, DependencyGraph, CycleGroup, CouplingScore, DependencyCluster, DependencyMetrics, DependencyAnalysisResult, thresholds |
| `state.ts` | — | Session lifecycle, graph cache, metrics cache, 50-result ring-buffer |
| `utils/graph.util.ts` | — | AdjMap construction (forward + reverse), degree queries, edge filtering, deduplication, density formula, input validation |
| `utils/score.util.ts` | — | Instability formula, risk classification, cluster cohesion, health score, average instability |
| `utils/traversal.util.ts` | — | DFS, BFS, Kahn topological sort, DAG longest path, weakly-connected components |
| `graph-builder.agent.ts` | — | Converts DependencyInput → DependencyGraph; builds GraphNode[], deduplicates GraphEdge[], enforces MAX_MODULES cap |
| `cycle-detector.agent.ts` | — | Tarjan's SCC algorithm; SCCs with size ≥ 2 are cycles; assigns severity via cycle length |
| `coupling-analyzer.agent.ts` | — | Per-module Ca, Ce, instability, risk; helpers for most-unstable, highest fan-in/out, critical modules |
| `cluster-detector.agent.ts` | — | Weakly-connected components → DependencyCluster[]; counts internal/external edges; computes cohesion |
| `metrics-computer.agent.ts` | — | Aggregates all data into DependencyMetrics; fan-in/out averages, density, depth, health score |
| `dependency-orchestrator.ts` | — | Level-1 coordinator — runs all 5 agents in order, manages state phases, returns frozen DependencyAnalysisResult |
| `index.ts` | — | Public re-export surface |

---

## HVP Layer Diagram

```
Level 1 — Orchestration
└── dependency-orchestrator.ts

Level 2 — Domain Agents
├── graph-builder.agent.ts
├── cycle-detector.agent.ts
├── coupling-analyzer.agent.ts
├── cluster-detector.agent.ts
└── metrics-computer.agent.ts

Level 3 — Infrastructure (pure, no upstream imports)
├── utils/graph.util.ts
├── utils/score.util.ts
├── utils/traversal.util.ts
├── types.ts
└── state.ts
```

---

## Call Flow Diagram

```
index.ts
   │  (re-exports only)
   ▼
dependency-orchestrator.ts — analyzeDependencies(input)
   │
   ├── [phase: GRAPH_BUILDING]
   │     graph-builder.agent.ts
   │     ├── isValidInput()         ← graph.util.ts
   │     ├── buildNode()            internal
   │     ├── buildEdges()           internal
   │     └── deduplicateEdges()     ← graph.util.ts
   │     → DependencyGraph { projectId, nodes[], edges[] }
   │
   ├── [phase: CYCLE_DETECTION]
   │     cycle-detector.agent.ts
   │     ├── buildAdjacency()       ← graph.util.ts
   │     ├── allNodeIds()           ← graph.util.ts
   │     └── tarjanSCC()            internal Tarjan algorithm
   │     → CycleGroup[] (each SCC with size ≥ 2)
   │
   ├── [phase: COUPLING_ANALYSIS]
   │     coupling-analyzer.agent.ts
   │     ├── buildAdjacency()       ← graph.util.ts
   │     ├── buildReverseAdjacency()← graph.util.ts
   │     ├── outDegree()  → Ce       ← graph.util.ts
   │     ├── inDegree()   → Ca       ← graph.util.ts
   │     └── computeInstability()   ← score.util.ts
   │     → CouplingScore[] per module
   │
   ├── [phase: CLUSTER_DETECTION]
   │     cluster-detector.agent.ts
   │     ├── buildAdjacency()           ← graph.util.ts
   │     ├── buildReverseAdjacency()    ← graph.util.ts
   │     └── weaklyConnectedComponents()← traversal.util.ts
   │     → DependencyCluster[] (one per connected component)
   │
   ├── [phase: METRICS_COMPUTATION]
   │     metrics-computer.agent.ts
   │     ├── outDegree/inDegree       ← graph.util.ts
   │     ├── graphDensity()           ← graph.util.ts
   │     ├── longestPath()            ← traversal.util.ts
   │     ├── avgInstabilityScore()    ← score.util.ts
   │     └── computeHealthScore()     ← score.util.ts
   │     → DependencyMetrics
   │
   └── [phase: COMPLETE] → frozen DependencyAnalysisResult returned
```

---

## Import Direction Rules

```
ALLOWED:
index                       → dependency-orchestrator, types
dependency-orchestrator     → agents/*, state, utils/graph.util, types
agents                      → types, utils/*

FORBIDDEN:
agents      → agents         (no cross-agent imports)
state       → agents         (imports types only)
utils       → agents         (leaf nodes — pure functions)
any         → orchestrator   (except index)
any         → boundary-analysis, hvp-analysis, responsibility-analysis
```

---

## Coupling Scoring Explanation

Per-module coupling is computed using the **Martin Stability Metric**:

| Metric | Formula | Meaning |
|---|---|---|
| Ca (Afferent) | count of modules importing this module | Fan-in — how many depend on this |
| Ce (Efferent) | count of modules this module imports | Fan-out — how many this depends on |
| Instability (I) | Ce / (Ca + Ce) | 0 = maximally stable, 1 = maximally unstable |

**Risk classification:**

| Instability | Risk |
|---|---|
| 0 – 0.249 | LOW |
| 0.25 – 0.499 | MEDIUM |
| 0.5 – 0.799 | HIGH |
| 0.8 – 1.0 | CRITICAL |

An isolated module with no imports and no importers has instability=0 (LOW risk).

---

## Cycle Detection Explanation

Cycle detection uses **Tarjan's SCC** (Strongly Connected Components) algorithm:

1. Perform DFS over the entire graph
2. Track discovery index, low-link, and on-stack state for each node
3. Any SCC with 2+ members represents a circular dependency group
4. SCC severity is based on member count:

| SCC Size | Severity |
|---|---|
| 2 | LOW |
| 3 – 4 | MEDIUM |
| 5 – 9 | HIGH |
| ≥ 10 | CRITICAL |

Up to `MAX_CYCLES_REPORTED` (100) cycles are reported. Time complexity: O(V+E).

---

## Metrics Explanation

| Metric | Description |
|---|---|
| `totalModules` | Node count in the dependency graph |
| `totalEdges` | Edge count (direct dependencies) |
| `avgFanOut` | Average efferent coupling (Ce) across all modules |
| `avgFanIn` | Average afferent coupling (Ca) across all modules |
| `maxFanOut` | Highest Ce in the graph |
| `maxFanIn` | Highest Ca in the graph (most-depended-on module) |
| `graphDensity` | edges / (nodes × (nodes−1)) — 0=sparse, 1=fully connected |
| `cycleCount` | Number of detected SCCs with size ≥ 2 |
| `modulesInCycles` | Unique modules participating in any cycle |
| `clusterCount` | Number of weakly-connected components |
| `avgInstability` | Average instability across all modules |
| `maxDepth` | Longest dependency chain (DAG path length; −1 if graph has cycles) |
| `overallHealthScore` | 0–100 score; starts at 100, deductions for cycles, risk, density |

**Health score deductions:**
- Each cycle: −10
- Each large cycle (≥5 members): −20
- Each HIGH risk module: −5
- Each CRITICAL risk module: −10
- Dense graph (density > 0.5): −15

---

## Example — Clean Input/Output

```typescript
const input: DependencyInput = {
  projectId: "my-service",
  modules: [
    { id: "orch", path: "orch.ts",    imports: [] },
    { id: "ag1",  path: "agent1.ts",  imports: ["orch"] },
    { id: "ag2",  path: "agent2.ts",  imports: ["orch"] },
    { id: "util", path: "util.ts",    imports: [] },
  ],
};
const result = analyzeDependencies(input);
// result.cycles                  → []
// result.metrics.cycleCount      → 0
// result.metrics.overallHealthScore → 100
// result.metrics.totalModules    → 4
// result.metrics.totalEdges      → 2
```

## Example — Cyclic Input/Output

```typescript
const input: DependencyInput = {
  projectId: "cyclic-service",
  modules: [
    { id: "a", path: "a.ts", imports: ["b"] },
    { id: "b", path: "b.ts", imports: ["c"] },
    { id: "c", path: "c.ts", imports: ["a"] },
  ],
};
const result = analyzeDependencies(input);
// result.cycles.length           → 1
// result.cycles[0].members       → ["a","b","c"]
// result.cycles[0].severity      → "LOW"
// result.metrics.cycleCount      → 1
// result.metrics.modulesInCycles → 3
// result.metrics.overallHealthScore → 90
```

---

## Boundary Validation Lifecycle

```
IDLE               analyzeDependencies() called, session created
     ↓
GRAPH_BUILDING     graph-builder converts modules → directed DependencyGraph
     ↓
CYCLE_DETECTION    cycle-detector runs Tarjan SCC → CycleGroup[]
     ↓
COUPLING_ANALYSIS  coupling-analyzer computes Ca/Ce/instability per module
     ↓
CLUSTER_DETECTION  cluster-detector groups weakly-connected components
     ↓
METRICS_COMPUTATION metrics-computer aggregates all data → DependencyMetrics
     ↓
COMPLETE           result frozen, stored in state history, returned
```
