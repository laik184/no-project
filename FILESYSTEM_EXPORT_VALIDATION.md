# FILESYSTEM_EXPORT_VALIDATION.md

## Named Export Validation

| Export Name                    | Source File                      | File Exists? | Symbol Verified? | Status    |
|--------------------------------|----------------------------------|-------------|------------------|-----------|
| `initializeFilesystemAgent`    | `filesystem-agent.ts`            | ✓           | ✓ line 52        | **VALID** |
| `shutdownFilesystemAgent`      | `filesystem-agent.ts`            | ✓           | ✓ line 58        | **VALID** |
| `runFilesystemAgent`           | `filesystem-agent.ts`            | ✓           | ✓ line 77        | **VALID** |
| `getFilesystemAgentDiagnostics`| `filesystem-agent.ts`            | ✓           | ✓ line 159       | **VALID** |
| `FilesystemAgentInput`         | `filesystem-agent.ts`            | ✓           | ✓ line 42        | **VALID** |
| `FilesystemLoopOptions`        | `execution/filesystem-loop.ts`   | ✓           | ✓ line 25        | **VALID** |
| `filesystemMetrics`            | `telemetry/filesystem-metrics.ts`| ✓           | ✓ line 37        | **VALID** |
| `filesystemLogger`             | `telemetry/filesystem-logger.ts` | ✓           | ✓ line 44        | **VALID** |
| `failureMonitor`               | `monitoring/failure-monitor.ts`  | ✓           | ✓ line 21        | **VALID** |
| `buildContext`                 | `core/filesystem-context.ts`     | ✓           | ✓ line 32        | **VALID** |
| `toToolContext`                | `core/filesystem-context.ts`     | ✓           | ✓ line 55        | **VALID** |
| `FilesystemContextInput`       | `core/filesystem-context.ts`     | ✓           | ✓ line 13        | **VALID** |
| `DEFAULT_RETRY_CONFIG`         | `execution/retry-manager.ts`     | ✓           | ✓ line 15        | **VALID** |
| `isRetryable`                  | `execution/retry-manager.ts`     | ✓           | ✓ line 33        | **VALID** |

## Type Export Validation (from `types/filesystem.types.ts`)

| Type Name                  | Line | Status    |
|----------------------------|------|-----------|
| `FilesystemOperationKind`  | 10   | **VALID** |
| `FilesystemOperationStatus`| 19   | **VALID** |
| `FilesystemSessionStatus`  | 29   | **VALID** |
| `FilesystemOperationRequest`| 140 | **VALID** |
| `FilesystemOperationResult`| 147  | **VALID** |
| `FilesystemAgentResult`    | 192  | **VALID** |
| `FilesystemExecutionContext`| 156 | **VALID** |
| `FilesystemOperation`      | 166  | **VALID** |
| `FilesystemSession`        | 179  | **VALID** |
| `FilesystemRetryConfig`    | 213  | **VALID** |
| `FilesystemFailureRecord`  | 221  | **VALID** |
| `ReadOperationRequest`     | 37   | **VALID** |
| `ReadOperationResult`      | 45   | **VALID** |
| `WriteOperationRequest`    | 55   | **VALID** |
| `WriteOperationResult`     | 63   | **VALID** |
| `PatchOperationRequest`    | 76   | **VALID** |
| `PatchOperationResult`     | 83   | **VALID** |
| `PatchHunk`                | 71   | **VALID** |
| `DeleteOperationRequest`   | 91   | **VALID** |
| `DeleteOperationResult`    | 98   | **VALID** |
| `SearchOperationRequest`   | 116  | **VALID** |
| `SearchOperationResult`    | 131  | **VALID** |
| `SearchKind`               | 106  | **VALID** |
| `SearchMatch`              | 125  | **VALID** |

## Types in file NOT exported through index

| Type Name        | Line | Reason hidden                                          |
|------------------|------|--------------------------------------------------------|
| `RoutedOperation`| 206  | Internal routing type — no external consumer requests it |

## Missing Exports

**None.** Every symbol needed by external consumers is present in the index.

## Summary

| Status    | Count |
|-----------|-------|
| VALID     | 34    |
| BROKEN    | 0     |
| DUPLICATE | 0     |
| MISSING   | 0     |
