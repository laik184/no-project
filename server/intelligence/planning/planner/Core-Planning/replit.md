# Core-Planning — Deterministic Task Planning Engine

## Purpose

Core-Planning accepts a structured `GoalInput` (already refined by PlannerBoss or equivalent)
and produces an immutable, dependency-ordered `ExecutionPlan`.

It handles only the mechanical planning pipeline:
- Analyze which task categories the goal spans
- Decompose categories into typed atomic `PlanTask` nodes
- Build a dependency graph by matching task I/O
- Topologically sort the graph into parallelizable execution levels
- Return a fully frozen `ExecutionPlan`

No risk assessment. No prompt refinement. No external calls. No execution.

---

## What It Handles

- Goal structure analysis (scope keywords, task categories, complexity)
- Atomic task generation from category templates
- I/O-based dependency inference (adjacency graph construction)
- Cycle detection in the task graph (DFS, bounded iterations)
- Topological execution ordering (Kahn's algorithm variant)
- Parallel group identification within each execution level
- Total estimated effort computation

---

## What It Does NOT Handle

- Raw text prompt parsing (PlannerBoss handles this)
- Risk assessment or plan approval (PlannerBoss safety layer)
- File system operations
- Git operations
- Runtime code execution
- Network requests
- Database access
- Environment variable management

---

## ASCII Call Hierarchy

```
Consumer
    ↓
index.ts               (re-export surface — no logic)
    ↓
core-orchestrator.ts   (4-phase coordinator — only file importing agents)
    ├── [Phase 1] goal-analyzer.agent.ts       → AnalyzedGoal
    ├── [Phase 2] task-decomposer.agent.ts     → PlanTask[]
    ├── [Phase 3] dependency-mapper.agent.ts   → TaskGraph
    └── [Phase 4] execution-sequencer.agent.ts → ExecutionLevel[]

agents → utils/ (pure helpers — downstream only):
    ├── graph.builder.ts     → buildGraph()        (adjacency + edge inference)
    ├── cycle.detector.ts    → hasCycle()           (DFS cycle detection)
    └── order.resolver.ts    → resolveExecutionOrder(), flattenLevels(), computeTotalEffort()

state.ts ← only core-orchestrator.ts writes to it
types.ts ← imported by all (no imports of its own)
```

---

## HVP Layer Diagram

```
Level 0   types.ts               (leaf — no imports)
Level 0   state.ts               (leaf — imports types only, zero agents)

Level 3   utils/graph.builder.ts     (imports types only)
Level 3   utils/cycle.detector.ts    (no imports — pure logic)
Level 3   utils/order.resolver.ts    (imports types only)

Level 2   goal-analyzer.agent.ts     (imports types)
Level 2   task-decomposer.agent.ts   (imports types)
Level 2   dependency-mapper.agent.ts (imports types + utils/graph.builder + utils/cycle.detector)
Level 2   execution-sequencer.agent.ts (imports types + utils/order.resolver)

Level 1   core-orchestrator.ts       (imports all agents + state + types + utils/order.resolver)
Level 1   index.ts                   (re-exports from orchestrator + types)
```

---

## File Responsibility Breakdown

| File | Lines | Sole Responsibility |
|------|-------|-------------------|
| `types.ts` | ~95 | All shared TypeScript interfaces and union types |
| `state.ts` | ~65 | Planning session storage — phase tracking, intermediary data |
| `utils/graph.builder.ts` | ~90 | Build adjacency map and task edges from I/O matching |
| `utils/cycle.detector.ts` | ~80 | DFS cycle detection in directed graph |
| `utils/order.resolver.ts` | ~90 | Topological sort → ExecutionLevel[], effort computation |
| `goal-analyzer.agent.ts` | ~80 | Extract task categories and scope keywords from GoalInput |
| `task-decomposer.agent.ts` | ~110 | Produce PlanTask[] from category templates |
| `dependency-mapper.agent.ts` | ~20 | Assemble TaskGraph using graph.builder + cycle.detector |
| `execution-sequencer.agent.ts` | ~20 | Produce ExecutionLevel[] using order.resolver |
| `core-orchestrator.ts` | ~110 | 4-phase pipeline coordinator — freezes final ExecutionPlan |
| `index.ts` | ~20 | Public API surface — re-exports only |

---

## Import Direction Rules

```
Allowed:
  index.ts                    → core-orchestrator.ts
  core-orchestrator.ts        → goal-analyzer.agent.ts
  core-orchestrator.ts        → task-decomposer.agent.ts
  core-orchestrator.ts        → dependency-mapper.agent.ts
  core-orchestrator.ts        → execution-sequencer.agent.ts
  core-orchestrator.ts        → state.ts
  core-orchestrator.ts        → utils/order.resolver.ts   (for computeTotalEffort)
  dependency-mapper.agent.ts  → utils/graph.builder.ts
  dependency-mapper.agent.ts  → utils/cycle.detector.ts
  execution-sequencer.agent.ts → utils/order.resolver.ts
  any file                    → types.ts

Forbidden:
  agents         → agents         (no cross-agent imports)
  state.ts       → any agent
  utils/*        → agents/*
  utils/*        → state.ts
  circular deps  → never
  any file       → outside Core-Planning
```

---

## Planning Stages

```
idle → goal-analysis → task-decomposition → dependency-mapping
     → execution-sequencing → complete
                  (or → failed at any stage)
```

---

## PlanResult Contract

```typescript
interface PlanResult<T = undefined> {
  readonly ok:     boolean;        // true = plan produced successfully
  readonly error?: string;         // human-readable reason on failure
  readonly code?:  string;         // machine-readable error code (ERR_*)
  readonly data?:  T;              // ExecutionPlan on success
  readonly stage?: PlanningStage;  // stage active at time of return
}
```

---

## Error Codes

| Code | Stage | Meaning |
|------|-------|---------|
| `ERR_INVALID_INPUT` | idle | goalId empty, objective missing, or complexity out of range |
| `ERR_NO_CATEGORIES` | goal-analysis | No task categories inferred from the goal |
| `ERR_NO_TASKS` | task-decomposition | Decomposition produced zero tasks |
| `ERR_CIRCULAR_DEPS` | dependency-mapping | Cycle found in task graph |
| `ERR_NO_LEVELS` | execution-sequencing | Sequencer returned empty level list |

---

## TaskGraph Structure

```typescript
interface TaskGraph {
  nodes:           readonly PlanTask[];
  edges:           readonly TaskEdge[];       // fromTaskId depends on toTaskId
  hasCircularDeps: boolean;
  adjacency:       Record<string, string[]>;  // id → list of dependency ids
}
```

Edges are inferred automatically: if `TaskA.inputs` contains a value produced by
`TaskB.outputs`, an edge `A → B` is created (A depends on B).

---

## ExecutionLevel Structure

```typescript
interface ExecutionLevel {
  level:          number;          // 0-indexed depth in DAG
  taskIds:        readonly string[]; // tasks executable at this level
  canParallelize: boolean;         // true if 2+ tasks at this level
}
```

All tasks within the same level have no dependencies on each other and can run in parallel.

---

## Example Input / Output

```typescript
import { createPlan } from "./index.js";

const result = createPlan({
  goalId:               "goal-001",
  primaryObjective:     "Build a REST API with Express for a User entity",
  subObjectives:        ["Generate services", "Generate controllers", "Generate routes"],
  constraints:          ["Must follow clean architecture", "No circular imports"],
  requiredCapabilities: ["api-layer", "data-modeling", "testing"],
  estimatedComplexity:  0.6,
  sessionId:            "session-xyz",
});

if (result.ok) {
  const plan = result.data!;
  console.log(plan.planId);               // "cp-plan-1234567890-0001"
  console.log(plan.totalTasks);           // e.g. 8
  console.log(plan.parallelizable);       // true
  console.log(plan.estimatedEffort);      // e.g. 18 (sum of max efforts per level)
  console.log(plan.executionLevels[0]);   // { level: 0, taskIds: [...], canParallelize: false }
  console.log(plan.taskGraph.hasCircularDeps); // false
}
```

---

## Planning Lifecycle

```
1. Receive GoalInput (structured — not raw text)
2. Phase 1 — analyzeGoal():
      Extract scope keywords from objectives + capabilities
      Infer TaskCategory[] from keyword-to-category registry
      Clamp estimatedComplexity to [0, 1]

3. Phase 2 — decomposeTasks():
      For each TaskCategory → select matching TaskSpec templates
      Instantiate PlanTask nodes with unique ids, type, I/O, effort, priority
      Append mandatory REVIEW task
      Sort by priority

4. Phase 3 — mapDependencies():
      Build output index: output-token → producing task id
      Infer edges: for each task input → find producer → create edge
      Build adjacency map
      Run DFS cycle detection

5. Phase 4 — sequenceExecution():
      Topological sort via in-degree reduction (Kahn's algorithm)
      Group zero-in-degree tasks per iteration → ExecutionLevel
      Sort tasks within each level by priority
      Mark levels with 2+ tasks as parallelizable

6. Assemble ExecutionPlan:
      Compute total estimated effort (sum of max effort per level)
      Freeze all objects
      Return PlanResult<ExecutionPlan>
```

---

## Task Category Registry

| Category | Triggered By | Tasks Produced |
|----------|-------------|---------------|
| `infrastructure` | server, deploy, container, network | CONFIGURE: infrastructure |
| `configuration` | config, env, dotenv, setting | CONFIGURE: environment |
| `data-modeling` | entity, model, schema, database | ANALYZE: data model, CREATE: entity models |
| `business-logic` | service, logic, rule, business | CREATE: services |
| `api-layer` | api, route, controller, endpoint | CREATE: controllers, CREATE: routes, VALIDATE: API contracts |
| `testing` | test, spec, unit, integration | CREATE: unit tests, CREATE: integration tests, VALIDATE: coverage |
| `documentation` | document, readme, doc, comment | DOCUMENT: API docs |
| `deployment` | deploy, publish, build, ci | CONFIGURE: CI pipeline, DEPLOY: production build |

All plans include one mandatory `REVIEW: final plan` task at the end.

---

## Extension Guide

**Adding a new task category:**
1. Add entry to `TaskCategory` union in `types.ts`
2. Add keyword triggers to `CATEGORY_KEYWORD_MAP` in `goal-analyzer.agent.ts`
3. Add task specs to `CATEGORY_SPECS` in `task-decomposer.agent.ts`

**Adding a new planning phase:**
1. Add stage to `PlanningStage` in `types.ts`
2. Implement a new agent file at Level 2
3. Add setter to `state.ts` for intermediate result
4. Insert phase call in `core-orchestrator.ts` in correct pipeline position
