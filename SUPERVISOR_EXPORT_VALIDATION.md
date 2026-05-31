# SUPERVISOR_EXPORT_VALIDATION.md

## Named Export Validation

| Export Name                    | Source File                           | File Exists? | Symbol Verified? | Status    |
|--------------------------------|---------------------------------------|-------------|------------------|-----------|
| `supervise`                    | `supervisor-agent.ts`                 | ✓           | ✓ line 83        | **VALID** |
| `initSupervisorAgent`          | `supervisor-agent.ts`                 | ✓           | ✓ line 30        | **VALID** |
| `shutdownSupervisorAgent`      | `supervisor-agent.ts`                 | ✓           | ✓ line 39        | **VALID** |
| `buildSupervisionContext`      | `core/supervisor-context.ts`          | ✓           | ✓ line 24        | **VALID** |
| `SupervisionContext`           | `core/supervisor-context.ts`          | ✓           | ✓ line 10        | **VALID** |
| `supervisorSession`            | `core/supervisor-session.ts`          | ✓           | ✓ line 27        | **VALID** |
| `supervisorMetrics`            | `telemetry/supervisor-metrics.ts`     | ✓           | ✓ line 21        | **VALID** |
| `failureMonitor`               | `monitoring/failure-monitor.ts`       | ✓           | ✓ line 38        | **VALID** |
| `validateSupervisionRequest`   | `validation/supervision-validator.ts` | ✓           | ✓ line 22        | **VALID** |
| `validateTask`                 | `validation/supervision-validator.ts` | ✓           | ✓ line 59        | **VALID** |
| `validateRuntimeContext`       | `validation/supervision-validator.ts` | ✓           | ✓ line 99        | **VALID** |
| `validatePhaseTransition`      | `validation/execution-validator.ts`   | ✓           | ✓ line 31        | **VALID** |
| `validateExecutionLifecycle`   | `validation/execution-validator.ts`   | ✓           | ✓ line 46        | **VALID** |
| `validateOrchestrationFlow`    | `validation/execution-validator.ts`   | ✓           | ✓ line 84        | **VALID** |

## Type Export Validation (from `types/supervisor.types.ts`)

| Type Name              | Line | Status    |
|------------------------|------|-----------|
| `SupervisionRequest`   | 102  | **VALID** |
| `SupervisionResult`    | 114  | **VALID** |
| `SupervisionTask`      | 34   | **VALID** |
| `TaskOutcome`          | 47   | **VALID** |
| `SupervisionPhase`     | 10   | **VALID** |
| `SupervisionStatus`    | 20   | **VALID** |
| `AgentDomain`          | 24   | **VALID** |
| `RetryPolicy`          | 82   | **VALID** |
| `RecoveryAction`       | 88   | **VALID** |
| `ValidationResult`     | 59   | **VALID** |
| `SupervisionSessionMeta`| 67  | **VALID** |

## Types in file NOT exported through index

| Type | Line | Reason hidden |
|------|------|---------------|
| `EscalationRecord` | 92 | Internal escalation detail — no external consumer |

## Missing Exports (exported from source but absent from index)

| Missing Symbol        | Source File           | Line | Kind      | Evidence |
|-----------------------|-----------------------|------|-----------|----------|
| `runSupervisorCycle`  | `supervisor-agent.ts` | 58   | function  | Used at `agent-coordinator.ts:25` — external consumer cannot reach it through barrel |
| `SupervisorCycleResult`| `supervisor-agent.ts`| 46   | interface | Return type of `runSupervisorCycle` — callers need it for typing |

## Summary

| Status    | Count |
|-----------|-------|
| VALID     | 22    |
| BROKEN    | 0     |
| DUPLICATE | 0     |
| MISSING   | **2** |
