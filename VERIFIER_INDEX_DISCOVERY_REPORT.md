# VERIFIER_INDEX_DISCOVERY_REPORT.md

## File
`server/agents/verifier/index.ts`

---

## Export Count (pre-fix)
- Named function/value exports: **5** (3 entry point + 1 monitor + 1 validator)
- Type exports: **9** (from verifier.types.ts)
- Total: **14**

---

## Current Exports

### Agent Entry Point (`./verifier-agent.ts`)
| Export | Kind |
|--------|------|
| `initializeVerifier` | function |
| `shutdownVerifier` | function |
| `runVerification` | function |

### Health Monitoring (`./monitoring/health-monitor.ts`)
| Export | Kind |
|--------|------|
| `verifierHealthMonitor` | singleton |

### Validator (`./validation/verification-validator.ts`)
| Export | Kind |
|--------|------|
| `validateVerifierInput` | function |

### Types (`./types/verifier.types.ts`)
| Export | Kind |
|--------|------|
| `VerifierInput` | interface |
| `VerifierOutput` | interface |
| `VerificationStep` | interface |
| `VerificationStepResult` | interface |
| `VerificationPhase` | type |
| `VerificationStatus` | type |
| `VerifierLifecycleState` | type |
| `RetryPolicy` | interface |
| `RecoveryAction` | type |

---

## Symbols in source NOT in index (observations)

| Symbol | Source | Line | Reason hidden |
|--------|--------|------|---------------|
| `HealthState` | `monitoring/health-monitor.ts` | 21 | Internal monitor type — no external consumer |
| `VerificationStepType` | `types/verifier.types.ts` | 19 | Internal step-type enum — no external consumer |
| `VerifierValidationResult` | `types/verifier.types.ts` | 94 | Return type of `validateVerifierInput` — no external consumer imports it |

---

## Module File Tree

```
server/agents/verifier/
├── index.ts                          ← barrel (this file)
├── verifier-agent.ts                 ← agent entry (exported)
├── types/
│   └── verifier.types.ts             ← type contracts (partially exported)
├── monitoring/
│   ├── health-monitor.ts             ← partially exported (HealthState hidden)
│   └── failure-monitor.ts            ← INTERNAL
├── validation/
│   ├── verification-validator.ts     ← partially exported (1 of 1 fn exported)
│   ├── integrity-validator.ts        ← INTERNAL
│   └── runtime-validator.ts          ← INTERNAL
├── execution/
│   ├── verification-loop.ts          ← INTERNAL
│   ├── verification-runner.ts        ← INTERNAL
│   ├── retry-manager.ts              ← INTERNAL
│   └── step-runner.ts                ← INTERNAL
├── diagnostics/
│   ├── failure-analyzer.ts           ← INTERNAL
│   └── rootcause-detector.ts         ← INTERNAL
├── core/
│   ├── verifier-context.ts           ← INTERNAL
│   ├── verifier-session.ts           ← INTERNAL
│   └── verifier-state.ts             ← INTERNAL
├── coordination/
│   ├── dispatcher-client.ts          ← INTERNAL
│   ├── tool-coordinator.ts           ← INTERNAL
│   └── verification-routing.ts       ← INTERNAL
├── telemetry/
│   ├── verifier-logger.ts            ← INTERNAL
│   └── verifier-metrics.ts           ← INTERNAL
└── utils/
    └── verification-utils.ts         ← INTERNAL
```
