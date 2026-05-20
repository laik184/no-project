import type { ExecutionStatus, ShellState } from "./types.js";

const EMPTY_LINES: readonly string[] = Object.freeze([]);

function toFrozenLines(lines: readonly string[]): readonly string[] {
  return Object.freeze([...lines]);
}

export function createInitialState(processId: string, command: string): Readonly<ShellState> {
  return Object.freeze<ShellState>({
    processId,
    command,
    status: "IDLE",
    stdout: EMPTY_LINES,
    stderr: EMPTY_LINES,
    logs: EMPTY_LINES,
    errors: EMPTY_LINES,
  });
}

export interface StatePatch {
  readonly status?: ExecutionStatus;
  readonly appendStdout?: readonly string[];
  readonly appendStderr?: readonly string[];
  readonly appendLogs?: readonly string[];
  readonly appendErrors?: readonly string[];
}

export function applyStatePatch(
  state: Readonly<ShellState>,
  patch: Readonly<StatePatch>,
): Readonly<ShellState> {
  return Object.freeze<ShellState>({
    ...state,
    status: patch.status ?? state.status,
    stdout: toFrozenLines([
      ...state.stdout,
      ...(patch.appendStdout ?? EMPTY_LINES),
    ]),
    stderr: toFrozenLines([
      ...state.stderr,
      ...(patch.appendStderr ?? EMPTY_LINES),
    ]),
    logs: toFrozenLines([
      ...state.logs,
      ...(patch.appendLogs ?? EMPTY_LINES),
    ]),
    errors: toFrozenLines([
      ...state.errors,
      ...(patch.appendErrors ?? EMPTY_LINES),
    ]),
  });
}
