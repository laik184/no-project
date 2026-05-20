# Migration Runner Module

## 1) Module Purpose
This module executes SQL migration files in a strict, ordered, and safe flow. It logs every major execution step, stops immediately on failure, and emits a rollback trigger signal (without implementing rollback logic).

## 2) File Responsibilities
- `types.ts` (L0): Shared contracts (`MigrationScript`, `ExecutionPlan`, `ExecutionResult`, `MigrationLog`, `FailureReport`, adapter input types).
- `state.ts` (L0): Immutable execution state store and read/status API.
- `orchestrator.ts` (L1): Coordinates the full pipeline; only location that mutates state.
- `agents/migration-runner.agent.ts` (L2): Executes migration SQL scripts sequentially.
- `agents/execution-planner.agent.ts` (L2): Builds ordered execution plan.
- `agents/script-loader.agent.ts` (L2): Loads migration scripts from disk.
- `agents/execution-logger.agent.ts` (L2): Appends execution logs.
- `agents/failure-handler.agent.ts` (L2): Builds rollback trigger report for failures.
- `utils/sql-executor.util.ts` (L3): Delegates SQL execution to DB adapter abstraction.
- `utils/file-reader.util.ts` (L3): Reads `.sql` files from filesystem.
- `utils/order-resolver.util.ts` (L3): Resolves deterministic migration order and rejects duplicates.
- `utils/error-normalizer.util.ts` (L3): Normalizes unknown errors to strings.
- `utils/logger.util.ts` (L3): Builds canonical log entries.
- `index.ts`: Public exports (`runMigrations`, `getExecutionStatus`).

## 3) Execution Flow
1. `orchestrator` initializes immutable state.
2. `script-loader.agent` loads migration files.
3. `execution-planner.agent` sorts and validates order.
4. `migration-runner.agent` executes migrations in order.
5. `execution-logger.agent` records each critical step.
6. `failure-handler.agent` prepares rollback trigger if any failure occurs.
7. `orchestrator` returns frozen output result.

## 4) Import Relationships
- Layer rule: L1 → L2 → L3, with L0 shared and no agent-to-agent imports.
- Diagram:

```text
index
  └─ orchestrator (L1)
      ├─ agents/script-loader (L2) ──> utils/file-reader (L3)
      ├─ agents/execution-planner (L2) ──> utils/order-resolver (L3)
      ├─ agents/migration-runner (L2) ──> utils/sql-executor + error-normalizer (L3)
      ├─ agents/execution-logger (L2) ──> utils/logger (L3)
      ├─ agents/failure-handler (L2)
      └─ state (L0) + types (L0)
```
