# PlannerBoss — Top-Level Planning Authority

## Purpose

PlannerBoss is the top-level planning authority of the system. Its sole responsibility is
to receive a raw user goal and produce an immutable, validated, dependency-ordered
`ExecutionPlan` that any executor in the system can safely consume.

It operates as a **pure planning pipeline** — no execution, no I/O, no side effects.
Every output is deterministic given the same input.

---

## What It Does

- Refines and normalizes raw user input into a structured prompt
- Maps required capabilities to available system agents
- Analyzes goal structure: primary objective, sub-objectives, constraints, success criteria
- Decomposes the goal into atomic, typed, independently-executable tasks
- Maps task I/O to infer dependencies and produce a directed acyclic graph (DAG)
- Topologically sorts the DAG into execution levels
- Builds an execution strategy (SEQUENTIAL / PARALLEL / MIXED) with retry policies per task type
- Performs risk assessment: complexity, effort density, dangerous operation types, parallelism
- Validates the plan against completeness, ordering, and risk-approval thresholds
- Freezes and returns the final `ExecutionPlan`

---

## What It Does NOT Do

- Execute any task
- Create, rename, move, or delete files on disk
- Call Git operations
- Perform runtime code execution
- Modify any external system state
- Make network requests
- Access databases or environment variables

---

## ASCII Call Hierarchy

```
Consumer
    ↓
index.ts                        (re-export surface — no logic)
    ↓
planner-orchestrator.ts         (top-level coordinator — all phases flow through here)
    │
    ├── [Phase 1] prompt-refinement.agent.ts     → normalize, extract keywords/constraints
    ├── [Phase 2] goal-analyzer.agent.ts          → extract intent, objectives, capabilities
    ├── [Phase 3] capability-router.agent.ts      → map capabilities to agent types
    ├── [Phase 4] task-decomposer.agent.ts        → produce AtomicTask[]
    ├── [Phase 5] dependency-planner.agent.ts     → infer deps, topological sort, cycle detect
    ├── [Phase 6] execution-strategy.agent.ts     → build ExecutionStrategy with retry config
    ├── [Phase 7] risk-assessment.agent.ts        → evaluate risk factors and approval status
    └── [Phase 8] plan-validator.agent.ts         → score plan, check completeness, issue report
         ↓
    Freeze and return ExecutionPlan
```

---

## HVP Layer Explanation

```
Level 0   types.ts                           (leaf — no imports)
Level 0   state.ts                           (leaf — imports types only, no agents)

Level 4   intelligence/prompt-refinement.agent.ts   (earliest in pipeline)
Level 4   intelligence/capability-router.agent.ts

Level 2   core/goal-analyzer.agent.ts
Level 2   core/task-decomposer.agent.ts
Level 2   core/dependency-planner.agent.ts
Level 2   core/execution-strategy.agent.ts

Level 3   safety/risk-assessment.agent.ts
Level 3   safety/plan-validator.agent.ts

Level 1   planner-orchestrator.ts            (coordinator — only file allowed to import agents)
Level 1   index.ts                           (API surface — re-exports only)
```

HVP = Hierarchical Vertical Partitioning. Each layer only communicates downward through the
orchestrator. Agents never import each other.

---

## File Responsibility Breakdown

| File | Lines | Responsibility |
|------|-------|----------------|
| `types.ts` | ~165 | All shared TypeScript interfaces and union types |
| `state.ts` | ~100 | Mutable planning session — phase tracking, intermediary storage |
| `intelligence/prompt-refinement.agent.ts` | ~90 | Text normalization, keyword extraction, constraint detection, ambiguity scoring |
| `intelligence/capability-router.agent.ts` | ~100 | Maps required capabilities to agent types via keyword registry |
| `core/goal-analyzer.agent.ts` | ~115 | Extracts structured intent: objectives, criteria, capabilities, complexity |
| `core/task-decomposer.agent.ts` | ~155 | Produces AtomicTask[] from intent using typed task templates |
| `core/dependency-planner.agent.ts` | ~115 | Infers task deps from I/O, detects cycles, builds execution levels |
| `core/execution-strategy.agent.ts` | ~110 | Assigns execution units, determines mode, builds retry config per type |
| `safety/risk-assessment.agent.ts` | ~135 | Evaluates complexity, effort, parallelism, and operation-type risks |
| `safety/plan-validator.agent.ts` | ~140 | Validates completeness, ordering, risk approval; produces score + summary |
| `planner-orchestrator.ts` | ~130 | Coordinates all 8 phases; sole importer of agents; freezes final plan |
| `index.ts` | ~30 | Public re-export surface |

---

## Import Direction Rules

```
Allowed:
  index.ts                   → planner-orchestrator.ts
  planner-orchestrator.ts    → intelligence/*.agent.ts
  planner-orchestrator.ts    → core/*.agent.ts
  planner-orchestrator.ts    → safety/*.agent.ts
  planner-orchestrator.ts    → state.ts
  planner-orchestrator.ts    → types.ts
  any agent                  → types.ts only

Forbidden:
  core/*        → safety/*             (core must not depend on safety)
  safety/*      → core/*               (safety must not depend on core)
  intelligence/* → core/*              (intelligence is earlier in pipeline)
  intelligence/* → safety/*            (intelligence must not reach safety)
  state.ts      → any agent            (state is a pure data holder)
  agent         → agent                (no agent-to-agent imports)
  any file      → outside PlannerBoss  (fully self-contained module)
  circular deps → never allowed
```

---

## PlannerResult Contract

Every public function returns:
```typescript
interface PlannerResult<T = undefined> {
  readonly ok:     boolean;      // true = plan produced successfully
  readonly error?: string;       // human-readable reason on failure
  readonly code?:  string;       // machine-readable error code (ERR_*)
  readonly data?:  T;            // ExecutionPlan on success
  readonly phase?: PlanningPhase; // which phase was active at return time
}
```

---

## Error Codes

| Code | Phase | Meaning |
|------|-------|---------|
| `ERR_EMPTY_INPUT` | idle | rawInput is empty or blank |
| `ERR_EMPTY_PROMPT` | prompt-refinement | normalization produced empty result |
| `ERR_NO_OBJECTIVE` | goal-analysis | could not extract a primary objective |
| `ERR_NO_TASKS` | task-decomposition | decomposition produced zero tasks |
| `ERR_CIRCULAR_DEPS` | dependency-planning | cycle detected in task dependency graph |
| `ERR_INVALID_PLAN` | validation | plan failed validation score or has blocking errors |

---

## Planning Phases

```
idle → prompt-refinement → goal-analysis → task-decomposition
     → dependency-planning → strategy-building → risk-assessment
     → validation → complete
                         (or → failed at any phase)
```

State transitions are tracked in `state.ts` and readable via `getActiveSession()`.

---

## State Policy

`state.ts` is the only file that holds mutable state. It follows these rules:
- No agent imports
- No business logic
- Only plain setters and getters
- Each setter re-freezes the session object completely (immutable snapshot pattern)
- Only `planner-orchestrator.ts` is permitted to call state mutation functions

---

## Execution Plan Structure

```typescript
interface ExecutionPlan {
  planId:           string;              // unique plan identifier
  sessionId:        string;              // planning session identifier
  createdAt:        number;              // Unix timestamp (ms)
  goal:             UserGoal;            // original raw input
  refinedPrompt:    RefinedPrompt;       // normalized + keywords + constraints
  intent:           StructuredIntent;    // primary objective, sub-objectives, success criteria
  capabilityMap:    CapabilityMap;       // capability → agent type routing
  tasks:            AtomicTask[];        // all decomposed atomic tasks
  dependencyMap:    TaskDependencyMap;   // DAG with topological levels
  strategy:         ExecutionStrategy;   // execution units with retry config
  riskAssessment:   RiskAssessment;      // risk factors + approval status
  validationReport: PlanValidationReport; // score + issues + summary
  approved:         boolean;             // true only if risk + validation both pass
}
```

---

## Example Usage

```typescript
import { plan, getActiveSession, resetPlanner } from "./index.js";

// Plan a goal
const result = plan({
  rawInput: "Create a backend API with Express, generate controllers, services, and routes for a User entity. Must follow REST conventions. Should include unit tests.",
  sessionId: "my-session-001",
});

if (result.ok) {
  const executionPlan = result.data!;
  console.log("Plan ID:", executionPlan.planId);
  console.log("Approved:", executionPlan.approved);
  console.log("Tasks:", executionPlan.tasks.length);
  console.log("Strategy:", executionPlan.strategy.mode);
  console.log("Risk:", executionPlan.riskAssessment.overallRisk);
  console.log("Score:", executionPlan.validationReport.score);
} else {
  console.error("Planning failed:", result.error, "(code:", result.code + ")");
}

// Check active session
const session = getActiveSession();
console.log("Current phase:", session?.phase);

// Reset for next use
resetPlanner();
```

---

## Retry Policy by Task Type

| Task Type | Strategy | Max Attempts | Delay |
|-----------|----------|-------------|-------|
| ANALYZE | FIXED | 2 | 500ms |
| CONFIGURE | FIXED | 3 | 1000ms |
| CREATE | EXPONENTIAL | 3 | 2000ms |
| MODIFY | EXPONENTIAL | 3 | 2000ms |
| VALIDATE | FIXED | 2 | 500ms |
| TEST | FIXED | 2 | 1000ms |
| DOCUMENT | NONE | 1 | 0ms |
| DEPLOY | EXPONENTIAL | 2 | 5000ms |
| REVIEW | NONE | 1 | 0ms |
| DELETE | NONE | 1 | 0ms |

---

## Extension Guide

**Adding a new planning phase:**
1. Add the phase name to `PlanningPhase` in `types.ts`
2. Implement a new agent file (core/, safety/, or intelligence/)
3. Add the phase call in `planner-orchestrator.ts` at the correct pipeline position
4. Add state setter in `state.ts` for the new intermediate result

**Adding a new task type:**
1. Add the type to `TaskType` union in `types.ts`
2. Add a `RetryConfig` entry in `RETRY_POLICY` in `execution-strategy.agent.ts`
3. Add a task template entry in `TASK_TEMPLATES` in `task-decomposer.agent.ts`
