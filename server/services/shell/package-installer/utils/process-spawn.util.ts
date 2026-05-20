import { spawn } from "node:child_process";

import { TimeoutError, withTimeout } from "./timeout.util.js";
import { filterEnv } from "../../../../../../security/safe-spawn.ts";

export interface ProcessSpawnInput {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly timeoutMs: number;
}

export interface ProcessSpawnOutput {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number | null;
  readonly timedOut: boolean;
}

export async function spawnProcess(input: ProcessSpawnInput): Promise<ProcessSpawnOutput> {
  const run = new Promise<ProcessSpawnOutput>((resolve, reject) => {
    const child = spawn(input.command, [...input.args], {
      cwd: input.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: filterEnv(process.env),
    });

    const stdout: string[] = [];
    const stderr: string[] = [];

    child.stdout.on("data", chunk => stdout.push(String(chunk)));
    child.stderr.on("data", chunk => stderr.push(String(chunk)));
    child.on("error", reject);
    child.on("close", code => {
      resolve({
        stdout: stdout.join(""),
        stderr: stderr.join(""),
        exitCode: code,
        timedOut: false,
      });
    });
  });

  try {
    return await withTimeout(run, input.timeoutMs, `${input.command} ${input.args.join(" ")}`);
  } catch (error) {
    if (error instanceof TimeoutError) {
      return {
        stdout: "",
        stderr: error.message,
        exitCode: null,
        timedOut: true,
      };
    }
    throw error;
  }
}
