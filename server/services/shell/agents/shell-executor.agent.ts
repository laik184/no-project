import { randomUUID } from "node:crypto";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { ProcessInfo, ValidatedCommand } from "../types.js";
import { spawnCommand } from "../spawn.service.js";

export interface ExecutionHandle {
  readonly process: ChildProcessWithoutNullStreams;
  readonly processInfo: Readonly<ProcessInfo>;
}

export function executeCommand(validated: Readonly<ValidatedCommand>): Readonly<ExecutionHandle> {
  const child = spawnCommand(validated);

  return Object.freeze<ExecutionHandle>({
    process: child,
    processInfo: Object.freeze<ProcessInfo>({
      processId: randomUUID(),
      pid: child.pid ?? -1,
      command: `${validated.command} ${validated.args.join(" ")}`.trim(),
      status: "RUNNING",
      startedAt: Date.now(),
    }),
  });
}
