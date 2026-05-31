# PLANNER_INDEX_DISCOVERY_REPORT.md

## File
`server/agents/planner/index.ts`

---

## Export Count (pre-fix)
- Named function/value exports: **5**
- Type exports: **23** (3 from planner-agent.ts + 15 from planner.types.ts + 5 types inlined above)
- Total: **28** (5 functions + 3 companion types from planner-agent + 15 domain types + 5 from planner-agent inline)

Let me recount precisely:

From `./planner-agent.ts` (value exports): `initializePlanner`, `shutdownPlanner`, `plan`, `runPlannerCycle`, `createExecutionPlan` = **5**
From `./planner-agent.ts` (type exports): `PlannerCycleResult`, `CreateExecutionPlanInput`, `CreateExecutionPlanResult` = **3**
From `./types/planner.types.ts` (type exports): 15 types = **15**

**Total: 23 exports**

---

## Current Exports

### Agent Entry Point (`./planner-agent.ts`)
| Export | Kind |
|--------|------|
| `initializePlanner` | function |
| `shutdownPlanner` | function |
| `plan` | function |
| `runPlannerCycle` | function |
| `createExecutionPlan` | function |
| `PlannerCycleResult` | type |
| `CreateExecutionPlanInput` | type |
| `CreateExecutionPlanResult` | type |

### Types (`./types/planner.types.ts`)
| Export | Kind |
|--------|------|
| `PlanningRequest` | interface |
| `PlanningResult` | interface |
| `ExecutionPlan` | interface |
| `ExecutionPhase` | interface |
| `PlannedTask` | interface |
| `PlanTask` | interface |
| `PlanningPhase` | type |
| `PlanningStatus` | type |
| `TaskPriority` | type |
| `ExecutionStrategy` | type |
| `CoordinatorTask` | interface |
| `ValidationResult` | interface |
| `RetryPolicy` | interface |
| `RecoveryAction` | type |
| `PlanValidationResults` | interface |

---

## Module File Tree

```
server/agents/planner/
├── index.ts                          ← barrel (this file)
├── planner-agent.ts                  ← agent entry (exported)
├── types/
│   └── planner.types.ts              ← type contracts (exported)
├── planning/
│   ├── dependency-planner.ts         ← INTERNAL
│   ├── execution-plan-builder.ts     ← INTERNAL
│   ├── phase-planner.ts              ← INTERNAL
│   ├── task-graph-builder.ts         ← INTERNAL
│   └── task-planner.ts               ← INTERNAL
├── execution/
│   ├── planning-loop.ts              ← INTERNAL
│   ├── retry-manager.ts              ← INTERNAL
│   └── task-runner.ts                ← INTERNAL
├── reasoning/
│   ├── dependency-analyzer.ts        ← INTERNAL
│   └── risk-estimator.ts             ← INTERNAL
├── telemetry/
│   ├── planner-logger.ts             ← INTERNAL (not in index)
│   └── planner-metrics.ts            ← INTERNAL (not in index)
├── monitoring/
│   └── planning-monitor.ts           ← INTERNAL
├── core/
│   ├── planner-context.ts            ← INTERNAL
│   ├── planner-session.ts            ← INTERNAL
│   └── planner-state.ts              ← INTERNAL
├── coordination/
│   ├── agent-coordinator.ts          ← INTERNAL
│   ├── dispatcher-client.ts          ← INTERNAL
│   └── planning-routing.ts           ← INTERNAL
├── validation/
│   ├── dependency-validator.ts       ← INTERNAL
│   └── planning-validator.ts         ← INTERNAL
└── utils/
    └── planning-utils.ts             ← INTERNAL
```
