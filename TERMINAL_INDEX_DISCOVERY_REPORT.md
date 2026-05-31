# TERMINAL_INDEX_DISCOVERY_REPORT.md

## File
`server/agents/terminal/index.ts`

---

## Export Count (pre-fix)
- Named function/value exports: **8** (3 entry point + 2 monitoring + 3 validators)
- Type exports: **13** (2 inline from terminal-agent + 11 from terminal.types.ts)
- Total: **21**

---

## Current Exports

### Agent Entry Point (`./terminal-agent.ts`)
| Export | Kind |
|--------|------|
| `initTerminalAgent` | function |
| `shutdownTerminalAgent` | function |
| `executeTerminalSession` | function |
| `TerminalAgentRequest` | type (inline modifier) |
| `TerminalAgentResult` | type (inline modifier) |

### Monitoring (`./monitoring/runtime-health-monitor.ts`)
| Export | Kind |
|--------|------|
| `runtimeMonitor` | singleton |
| `runtimeHealthMonitor` | singleton |

### Validators (`./validation/execution-validator.ts`)
| Export | Kind |
|--------|------|
| `validateExecutionRequest` | function |
| `validateGeneratedOutput` | function |
| `validateCommandOutput` | function |

### Types (`./types/terminal.types.ts`)
| Export | Kind |
|--------|------|
| `ExecutionStep` | interface |
| `StepOutcome` | interface |
| `CommandResult` | interface |
| `NpmOptions` | interface |
| `CommandRunOptions` | interface |
| `ValidationResult` | interface |
| `SessionStatus` | type |
| `TerminalSessionMeta` | interface |
| `TerminalPhase` | type |
| `RetryPolicy` | interface |
| `RecoveryAction` | type |

---

## Symbols in source NOT in index (observations)

| Symbol | Source | Line | Reason hidden |
|--------|--------|------|---------------|
| `RuntimeHealth` | `monitoring/runtime-health-monitor.ts` | 23 | Interface for monitor internals — no external consumer requests it |
| `OutputValidation` | `validation/execution-validator.ts` | 64 | Return type of exported validators — no external consumer imports it |
| `validateSessionState` | `validation/execution-validator.ts` | 45 | Internal validation helper — no external consumer |
| `validateMissingContext` | `validation/execution-validator.ts` | 52 | Internal validation helper — no external consumer |

---

## Module File Tree

```
server/agents/terminal/
├── index.ts                          ← barrel (this file)
├── terminal-agent.ts                 ← agent entry (exported)
├── types/
│   └── terminal.types.ts             ← type contracts (exported)
├── monitoring/
│   ├── runtime-health-monitor.ts     ← partially exported (RuntimeHealth hidden)
│   └── failure-monitor.ts            ← INTERNAL
├── validation/
│   ├── execution-validator.ts        ← partially exported (3 of 5 exports surfaced)
│   ├── command-validator.ts          ← INTERNAL
│   └── security-validator.ts         ← INTERNAL
├── execution/
│   ├── execution-loop.ts             ← INTERNAL
│   ├── retry-manager.ts              ← INTERNAL
│   ├── step-runner.ts                ← INTERNAL
│   └── terminal-runner.ts            ← INTERNAL
├── core/
│   ├── terminal-context.ts           ← INTERNAL
│   ├── terminal-session.ts           ← INTERNAL
│   └── terminal-state.ts             ← INTERNAL
├── coordination/
│   ├── dispatcher-client.ts          ← INTERNAL
│   ├── execution-routing.ts          ← INTERNAL
│   └── tool-coordinator.ts           ← INTERNAL
├── telemetry/
│   ├── terminal-logger.ts            ← INTERNAL
│   └── terminal-metrics.ts           ← INTERNAL
└── utils/
    └── execution-utils.ts            ← INTERNAL
```
