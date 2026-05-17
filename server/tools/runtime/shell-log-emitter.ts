/**
 * server/tools/runtime/shell-log-emitter.ts
 *
 * Spawns child processes and pipes their stdout/stderr to both:
 *   1. The console capture service (live tailing in the UI)
 *   2. In-memory buffers returned to the caller
 */

import { spawn }          from "child_process";
import { captureService } from "../../console/capture/capture.service.ts";
import { filterEnv }      from "../../security/safe-spawn.ts";

export interface SpawnOptions {
  command:   string;
  args:      string[];
  cwd:       string;
  projectId: number;
  env?:      NodeJS.ProcessEnv;
  timeoutMs?: number;
}

export interface SpawnResult {
  exitCode: number | null;
  stdout:   string;
  stderr:   string;
  timedOut: boolean;
}

export async function spawnWithStream(opts: SpawnOptions): Promise<SpawnResult> {
  const { command, args, cwd, projectId, env, timeoutMs = 30_000 } = opts;

  return new Promise<SpawnResult>((resolve) => {
    let stdout   = "";
    let stderr   = "";
    let timedOut = false;

    const proc = spawn(command, args, {
      cwd,
      shell: false,
      env:   filterEnv(env ?? process.env),
    });

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      setTimeout(() => proc.kill("SIGKILL"), 2_000);
    }, timeoutMs);

    proc.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stdout    += text;
      captureService.write(projectId, "stdout", text);
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr    += text;
      captureService.write(projectId, "stderr", text);
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: timedOut ? null : (code ?? null),
        stdout:   stdout.slice(0, 20_000),
        stderr:   stderr.slice(0, 5_000),
        timedOut,
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({ exitCode: 1, stdout, stderr: stderr + err.message, timedOut: false });
    });
  });
}
