# TERMINAL_EXPORT_VALIDATION.md

## Named Export Validation

| Export Name               | Source File                            | File Exists? | Symbol Verified? | Status    |
|---------------------------|----------------------------------------|-------------|------------------|-----------|
| `initTerminalAgent`       | `terminal-agent.ts`                    | ✓           | ✓ line 50        | **VALID** |
| `shutdownTerminalAgent`   | `terminal-agent.ts`                    | ✓           | ✓ line 57        | **VALID** |
| `executeTerminalSession`  | `terminal-agent.ts`                    | ✓           | ✓ line 65        | **VALID** |
| `TerminalAgentRequest`    | `terminal-agent.ts`                    | ✓           | ✓ line 29        | **VALID** |
| `TerminalAgentResult`     | `terminal-agent.ts`                    | ✓           | ✓ line 38        | **VALID** |
| `runtimeMonitor`          | `monitoring/runtime-health-monitor.ts` | ✓           | ✓ line 40        | **VALID** |
| `runtimeHealthMonitor`    | `monitoring/runtime-health-monitor.ts` | ✓           | ✓ line 110       | **VALID** |
| `validateExecutionRequest`| `validation/execution-validator.ts`    | ✓           | ✓ line 13        | **VALID** |
| `validateGeneratedOutput` | `validation/execution-validator.ts`    | ✓           | ✓ line 69        | **VALID** |
| `validateCommandOutput`   | `validation/execution-validator.ts`    | ✓           | ✓ line 94        | **VALID** |

## Type Export Validation (from `types/terminal.types.ts`)

| Type Name          | Line | Status    |
|--------------------|------|-----------|
| `TerminalPhase`    | 10   | **VALID** |
| `SessionStatus`    | 20   | **VALID** |
| `StepType`         | 24   | **VALID** |
| `ExecutionStep`    | 42   | **VALID** |
| `StepOutcome`      | 54   | **VALID** |
| `CommandResult`    | 66   | **VALID** |
| `CommandRunOptions`| 72   | **VALID** |
| `NpmOptions`       | 79   | **VALID** |
| `ValidationResult` | 89   | **VALID** |
| `TerminalSessionMeta`| 97 | **VALID** |
| `RetryPolicy`      | 111  | **VALID** |
| `RecoveryAction`   | 117  | **VALID** |

## Missing Exports

**None.** Every symbol required by external consumers is present in the index.
The sole consumer (`agent-coordinator.ts`) only needs `executeTerminalSession`
which is exported at line 13 of the index.

## Summary

| Status    | Count |
|-----------|-------|
| VALID     | 21    |
| BROKEN    | 0     |
| DUPLICATE | 0     |
| MISSING   | 0     |
