# SUPERVISOR_INDEX_DISCOVERY_REPORT.md

## File
`server/agents/supervisor/index.ts`

---

## Export Count (pre-fix)
- Named function/value exports: **9** (3 entry point + 1 context + 1 session + 1 metrics + 1 monitor + 3 validators)
- Type exports: **13** (11 types + 1 context type + 1 session config hidden)
- Total: **22**

---

## Current Exports

### Agent Entry Point (`./supervisor-agent.ts`)
| Export | Kind |
|--------|------|
| `supervise` | function |
| `initSupervisorAgent` | function |
| `shutdownSupervisorAgent` | function |

### Types (`./types/supervisor.types.ts`)
| Export | Kind |
|--------|------|
| `SupervisionRequest` | interface |
| `SupervisionResult` | interface |
| `SupervisionTask` | interface |
| `TaskOutcome` | interface |
| `SupervisionPhase` | type |
| `SupervisionStatus` | type |
| `AgentDomain` | type |
| `RetryPolicy` | interface |
| `RecoveryAction` | type |
| `ValidationResult` | interface |
| `SupervisionSessionMeta` | interface |

### Context (`./core/supervisor-context.ts`)
| Export | Kind |
|--------|------|
| `buildSupervisionContext` | function |
| `SupervisionContext` | type |

### Singletons
| Export | Kind | Source |
|--------|------|--------|
| `supervisorSession` | singleton | `./core/supervisor-session.ts` |
| `supervisorMetrics` | singleton | `./telemetry/supervisor-metrics.ts` |
| `failureMonitor` | singleton | `./monitoring/failure-monitor.ts` |

### Validators
| Export | Kind | Source |
|--------|------|--------|
| `validateSupervisionRequest` | function | `./validation/supervision-validator.ts` |
| `validateTask` | function | `./validation/supervision-validator.ts` |
| `validateRuntimeContext` | function | `./validation/supervision-validator.ts` |
| `validatePhaseTransition` | function | `./validation/execution-validator.ts` |
| `validateExecutionLifecycle` | function | `./validation/execution-validator.ts` |
| `validateOrchestrationFlow` | function | `./validation/execution-validator.ts` |

---

## Symbols in `supervisor-agent.ts` NOT in index

| Symbol | Line | Kind | Note |
|--------|------|------|------|
| `runSupervisorCycle` | 58 | function | ✗ **MISSING** — used by `agent-coordinator.ts:25` |
| `SupervisorCycleResult` | 46 | interface | ✗ **MISSING** — return type of `runSupervisorCycle` |
| `initializeSupervisor` | 37 | const (alias) | Alias for `initSupervisorAgent` — no external consumer — correctly hidden |

---

## Module File Tree

```
server/agents/supervisor/
├── index.ts                          ← barrel (this file)
├── supervisor-agent.ts               ← agent entry (partially exported — 2 symbols missing)
├── types/
│   └── supervisor.types.ts           ← type contracts (exported)
├── core/
│   ├── supervisor-context.ts         ← partially exported (SupervisionContext + buildSupervisionContext)
│   ├── supervisor-session.ts         ← partially exported (supervisorSession only; SessionConfig hidden)
│   └── supervisor-state.ts           ← INTERNAL
├── execution/
│   ├── supervision-loop.ts           ← INTERNAL
│   ├── retry-manager.ts              ← INTERNAL
│   └── task-runner.ts                ← INTERNAL
├── telemetry/
│   ├── supervisor-metrics.ts         ← exported (supervisorMetrics)
│   └── supervisor-logger.ts          ← INTERNAL
├── monitoring/
│   └── failure-monitor.ts            ← exported (failureMonitor)
├── coordination/
│   ├── agent-coordinator.ts          ← INTERNAL
│   ├── dispatcher-client.ts          ← INTERNAL
│   └── supervision-routing.ts        ← INTERNAL
├── validation/
│   ├── supervision-validator.ts      ← exported (3 functions)
│   └── execution-validator.ts        ← exported (3 functions)
└── utils/
    └── supervision-utils.ts          ← INTERNAL
```
