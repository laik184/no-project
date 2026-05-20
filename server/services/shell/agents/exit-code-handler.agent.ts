import type { CommandResult } from "../types.js";

export interface ExitContext {
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
  readonly logs: readonly string[];
  readonly normalizedError?: string;
}

export function handleExitCode(context: Readonly<ExitContext>): Readonly<CommandResult> {
  const normalizedCode = context.exitCode ?? (context.timedOut ? 124 : 1);
  const success = !context.timedOut && normalizedCode === 0;

  const result: CommandResult = {
    success,
    exitCode: normalizedCode,
    stdout: context.stdout,
    stderr: context.stderr,
    logs: context.logs,
    error: success ? undefined : context.normalizedError ?? context.stderr[0] ?? "Command failed",
  };

  return Object.freeze(result);
}
