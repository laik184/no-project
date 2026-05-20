# Shell Execution Module

## 1) Module Purpose
`server/agents/execution/shell` provides a safe, production-grade shell command execution engine. It validates commands, executes child processes, captures streams, enforces timeout, and returns immutable structured output.

## 2) Execution Flow
`orchestrator -> command-validator -> shell-executor -> process-monitor + timeout-controller -> exit-code-handler -> immutable CommandResult`

## 3) File Responsibilities
- `types.ts`: command/result/process/state contracts.
- `state.ts`: immutable shell state creation and patching.
- `orchestrator.ts`: flow control only; sole state mutation owner.
- `index.ts`: public exports (`runCommand`, `validateCommand`).
- `agents/*`: single-purpose runtime agents.
- `utils/*`: helper functions only.

## 4) Import Relationships
- `orchestrator.ts` imports only agents + state + utils.
- Agents import only `types.ts` and `utils/*`.
- No agent imports any other agent.
- Utility files do not import agents.

## 5) Example Command Execution
```ts
import { runCommand } from "./index.js";

const result = await runCommand({
  command: "npm",
  args: ["run", "build"],
  cwd: process.cwd(),
  timeoutMs: 120_000,
});

// {
//   success: true,
//   exitCode: 0,
//   stdout: [...],
//   stderr: [...],
//   logs: [...],
// }
```
