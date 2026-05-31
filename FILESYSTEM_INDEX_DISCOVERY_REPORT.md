# FILESYSTEM_INDEX_DISCOVERY_REPORT.md

## File
`server/agents/filesystem/index.ts`

---

## Export Count (pre-fix)
- Named function/value exports: **9**
- Type exports: **25** (22 from types file + `FilesystemAgentInput` inline + `FilesystemLoopOptions` + `FilesystemContextInput`)
- Total: **34**

---

## Current Exports

### Agent Entry Point (`./filesystem-agent.ts`)
| Export | Kind |
|--------|------|
| `initializeFilesystemAgent` | function |
| `shutdownFilesystemAgent` | function |
| `runFilesystemAgent` | function |
| `getFilesystemAgentDiagnostics` | function |
| `FilesystemAgentInput` | type (inline modifier) |

### Types (`./types/filesystem.types.ts`)
| Export | Kind |
|--------|------|
| `FilesystemOperationKind` | type |
| `FilesystemOperationStatus` | type |
| `FilesystemSessionStatus` | type |
| `FilesystemOperationRequest` | type |
| `FilesystemOperationResult` | type |
| `FilesystemAgentResult` | interface |
| `FilesystemExecutionContext` | interface |
| `FilesystemOperation` | interface |
| `FilesystemSession` | interface |
| `FilesystemRetryConfig` | interface |
| `FilesystemFailureRecord` | interface |
| `ReadOperationRequest` | interface |
| `ReadOperationResult` | interface |
| `WriteOperationRequest` | interface |
| `WriteOperationResult` | interface |
| `PatchOperationRequest` | interface |
| `PatchOperationResult` | interface |
| `PatchHunk` | interface |
| `DeleteOperationRequest` | interface |
| `DeleteOperationResult` | interface |
| `SearchOperationRequest` | interface |
| `SearchOperationResult` | interface |
| `SearchKind` | type |
| `SearchMatch` | interface |

### Loop Options (`./execution/filesystem-loop.ts`)
| Export | Kind |
|--------|------|
| `FilesystemLoopOptions` | type |

### Telemetry & Monitoring
| Export | Kind | Source |
|--------|------|--------|
| `filesystemMetrics` | singleton | `./telemetry/filesystem-metrics.ts` |
| `filesystemLogger` | singleton | `./telemetry/filesystem-logger.ts` |
| `failureMonitor` | singleton | `./monitoring/failure-monitor.ts` |

### Context (`./core/filesystem-context.ts`)
| Export | Kind |
|--------|------|
| `buildContext` | function |
| `toToolContext` | function |
| `FilesystemContextInput` | type (inline modifier) |

### Retry (`./execution/retry-manager.ts`)
| Export | Kind |
|--------|------|
| `DEFAULT_RETRY_CONFIG` | const |
| `isRetryable` | function |

---

## Module File Tree

```
server/agents/filesystem/
├── index.ts                        ← barrel (this file)
├── filesystem-agent.ts             ← agent entry (exported)
├── types/
│   └── filesystem.types.ts         ← type contracts (exported)
├── execution/
│   ├── filesystem-loop.ts          ← partially exported (FilesystemLoopOptions only)
│   ├── retry-manager.ts            ← partially exported (DEFAULT_RETRY_CONFIG, isRetryable)
│   └── step-runner.ts              ← INTERNAL
├── operations/
│   ├── delete-operation.ts         ← INTERNAL
│   ├── patch-operation.ts          ← INTERNAL
│   ├── read-operation.ts           ← INTERNAL
│   ├── search-operation.ts         ← INTERNAL
│   └── write-operation.ts          ← INTERNAL
├── telemetry/
│   ├── filesystem-metrics.ts       ← exported
│   └── filesystem-logger.ts        ← exported
├── monitoring/
│   └── failure-monitor.ts          ← exported
├── core/
│   ├── filesystem-context.ts       ← partially exported (FilesystemContextError hidden)
│   ├── filesystem-session.ts       ← INTERNAL
│   └── filesystem-state.ts         ← INTERNAL
├── coordination/
│   ├── dispatcher-client.ts        ← INTERNAL
│   ├── filesystem-routing.ts       ← INTERNAL
│   └── tool-coordinator.ts         ← INTERNAL
├── validation/
│   ├── integrity-validator.ts      ← INTERNAL
│   ├── operation-validator.ts      ← INTERNAL
│   └── path-validator.ts           ← INTERNAL
└── utils/
    └── filesystem-utils.ts         ← INTERNAL
```
