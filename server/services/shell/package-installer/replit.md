# Package Installer Module (HVP)

## 1) Module Overview

`package-installer/` provides a stable package installation engine for npm, pnpm, and yarn. It supports installation, updates, and removals with structured outputs, immutable state snapshots, validation-before-run safety checks, timeout handling, and centralized logging.

## 2) File Responsibilities

### L0
- `types.ts`: contracts for inputs/outputs/options/errors.
- `state.ts`: immutable in-memory state (`manager`, `packages`, `status`, `logs`, `errors`).

### L1
- `orchestrator.ts`: operation flow only (detect → validate → run → parse errors → return frozen result).

### L2 (agents)
- `manager-detector.agent.ts`: lockfile-based package manager detection.
- `install-runner.agent.ts`: executes install operation.
- `update-runner.agent.ts`: executes update operation.
- `remove-runner.agent.ts`: executes remove operation.
- `error-parser.agent.ts`: classifies common npm/pnpm/yarn errors.
- `dependency-validator.agent.ts`: validates `package.json` and prevents duplicate package input.

### L3 (utils)
- `command-builder.util.ts`: builds manager-specific commands.
- `process-spawn.util.ts`: process execution and timeout integration.
- `output-parser.util.ts`: extracts package names from CLI output.
- `timeout.util.ts`: generic timeout wrapper and timeout error class.
- `logger.util.ts`: timestamped structured logs.

## 3) Import Flow

- `orchestrator.ts` → `agents/*`, `state.ts`, `logger.util.ts`
- `agents/*` → `utils/*`, `types.ts`
- `utils/*` → local utility dependencies only
- No agent-to-agent imports.

## 4) Example Install Flow

`orchestrator` → `manager-detector` → `dependency-validator` → `install-runner` → `error-parser` → frozen output

Input:
```ts
await installPackages({
  projectPath: "/workspace/app",
  packages: ["express", "zod"],
  options: { timeoutMs: 120000 }
});
```

Output:
```ts
{
  success: true,
  manager: "npm",
  installed: ["express", "zod"],
  logs: ["..."]
}
```

## 5) Error Handling

- Validation failures stop execution before any package command.
- Network/version conflict/permission/timeout errors are parsed into deterministic messages.
- Timeout uses a dedicated `TimeoutError` path.
- Every critical step is logged and returned in output logs.
