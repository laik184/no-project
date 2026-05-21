/**
 * server/sandbox/runtime/process-limiter.ts
 * Executes a child process with timeout and resource constraints.
 * Single responsibility: bounded process execution. No policy logic.
 */

import { spawn }  from "child_process";
import type { SandboxConstraints, SandboxExecutionRequest, SandboxExecutionResult } from "../types.ts";

const HARD_TIMEOUT_MS = 120_000;   // absolute max regardless of config

export async function limitProcess(
  req:         SandboxExecutionRequest,
  constraints: SandboxConstraints,
): Promise<SandboxExecutionResult> {
  const timeoutMs = Math.min(req.timeoutMs ?? constraints.timeoutMs, HARD_TIMEOUT_MS);
  const start     = Date.now();

  return new Promise((resolve) => {
    const proc = spawn("bash", ["-c", req.command], {
      cwd:   req.cwd,
      env:   { ...process.env, ...(req.env ?? {}), SANDBOX_ID: req.sandboxId },
      stdio: "pipe",
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGKILL");
    }, timeoutMs);

    proc.stdout?.on("data", (d: Buffer) => { stdout += d.toString().slice(0, 50_000); });
    proc.stderr?.on("data", (d: Buffer) => { stderr += d.toString().slice(0, 10_000); });

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        sandboxId:   req.sandboxId,
        exitCode:    code,
        stdout:      stdout.slice(0, 50_000),
        stderr:      stderr.slice(0, 10_000),
        durationMs:  Date.now() - start,
        blocked:     false,
        blockReason: timedOut ? `Process timed out after ${timeoutMs}ms` : null,
        timedOut,
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({
        sandboxId:   req.sandboxId,
        exitCode:    -1,
        stdout,
        stderr:      stderr + `\nProcess error: ${err.message}`,
        durationMs:  Date.now() - start,
        blocked:     true,
        blockReason: `Spawn error: ${err.message}`,
        timedOut:    false,
      });
    });
  });
}
