# Shell Agents

## Purpose
Single-responsibility agents used by the shell orchestrator.

## Responsibilities
- `command-validator.agent.ts`: sanitize and enforce command security policy.
- `shell-executor.agent.ts`: spawn command and return process handle.
- `process-monitor.agent.ts`: collect stdout/stderr and close metadata.
- `timeout-controller.agent.ts`: enforce hard timeout and kill process.
- `exit-code-handler.agent.ts`: convert execution outcome to `CommandResult`.

## Callers / Callees
- Called by: `../orchestrator.ts`
- Calls: `../utils/*` and `../types.ts`
- No agent-to-agent imports allowed.
