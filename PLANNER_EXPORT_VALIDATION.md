# PLANNER_EXPORT_VALIDATION.md

## Named Export Validation

| Export Name              | Source File          | File Exists? | Symbol Verified? | Status    |
|--------------------------|----------------------|-------------|------------------|-----------|
| `initializePlanner`      | `planner-agent.ts`   | ✓           | ✓ line 95        | **VALID** |
| `shutdownPlanner`        | `planner-agent.ts`   | ✓           | ✓ line 101       | **VALID** |
| `plan`                   | `planner-agent.ts`   | ✓           | ✓ line 149       | **VALID** |
| `runPlannerCycle`        | `planner-agent.ts`   | ✓           | ✓ line 120       | **VALID** |
| `createExecutionPlan`    | `planner-agent.ts`   | ✓           | ✓ line 276       | **VALID** |
| `PlannerCycleResult`     | `planner-agent.ts`   | ✓           | ✓ line 108       | **VALID** |
| `CreateExecutionPlanInput`| `planner-agent.ts`  | ✓           | ✓ line 257       | **VALID** |
| `CreateExecutionPlanResult`| `planner-agent.ts` | ✓           | ✓ line 265       | **VALID** |

## Type Export Validation (from `types/planner.types.ts`)

| Type Name            | Line | Status    |
|----------------------|------|-----------|
| `PlanningPhase`      | 10   | **VALID** |
| `PlanningStatus`     | 23   | **VALID** |
| `TaskPriority`       | 27   | **VALID** |
| `ExecutionStrategy`  | 31   | **VALID** |
| `PlannedTask`        | 35   | **VALID** |
| `PlanTask`           | 53   | **VALID** |
| `ExecutionPhase`     | 70   | **VALID** |
| `PlanValidationResults`| 80 | **VALID** |
| `ExecutionPlan`      | 88   | **VALID** |
| `PlanningRequest`    | 110  | **VALID** |
| `PlanningResult`     | 121  | **VALID** |
| `ValidationResult`   | 131  | **VALID** |
| `RetryPolicy`        | 139  | **VALID** |
| `RecoveryAction`     | 145  | **VALID** |
| `CoordinatorTask`    | 173  | **VALID** |

## Types in file NOT exported through index

| Type Name             | Line | Reason hidden                                         |
|-----------------------|------|-------------------------------------------------------|
| `PlanningSessionMeta` | 149  | Internal session tracking — no external consumer      |
| `PlanningTaskOutcome` | 161  | Internal outcome record — no external consumer        |

## Missing Exports

**None.** Every symbol needed by external consumers is present in the index.
The sole consumer (`agent-coordinator.ts`) only uses `runPlannerCycle`, which is exported.

## Summary

| Status    | Count |
|-----------|-------|
| VALID     | 23    |
| BROKEN    | 0     |
| DUPLICATE | 0     |
| MISSING   | 0     |
