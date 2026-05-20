import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { ValidatedCommand } from "./types.js";

export function spawnCommand(validated: Readonly<ValidatedCommand>): ChildProcessWithoutNullStreams {
  return spawn(validated.command, validated.args as string[], {
    cwd: validated.cwd,
    env: { ...process.env, ...(validated.env ?? {}) },
    shell: false,
  }) as ChildProcessWithoutNullStreams;
}
