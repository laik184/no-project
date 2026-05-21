/**
 * server/verification/typescript/tsc-process-runner.ts
 *
 * TSCProcessRunner — executes `tsc --noEmit` as an isolated subprocess.
 * Owns: spawn, stdout/stderr capture, timeout watchdog, cancellation.
 * Never interprets output. Returns raw execution evidence only.
 */

import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import type { TSCExecutionResult } from "./types.ts";

export interface TSCRunOptions {
  readonly tsconfigPath: string;
  readonly workspacePath: string;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 512 * 1024; // 512 KB cap

export class TSCProcessRunner {
  async run(opts: TSCRunOptions): Promise<TSCExecutionResult> {
    const {
      tsconfigPath,
      workspacePath,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      signal,
    } = opts;

    if (signal?.aborted) {
      return this._cancelled(0);
    }

    const tscBin = this._resolveTSCBin(workspacePath);
    const startMs = Date.now();
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let totalBytes = 0;

    return new Promise<TSCExecutionResult>((resolve) => {
      let settled = false;

      const settle = (result: TSCExecutionResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        resolve(result);
      };

      const proc = spawn(
        tscBin,
        ["--noEmit", "--project", tsconfigPath],
        {
          cwd: workspacePath,
          env: { ...process.env, FORCE_COLOR: "0" },
          stdio: ["ignore", "pipe", "pipe"],
        }
      );

      let spawnError: string | null = null;

      proc.on("error", (err) => {
        spawnError = err.message;
        settle({
          exitCode: null,
          stdout: "",
          stderr: "",
          durationMs: Date.now() - startMs,
          timedOut: false,
          cancelled: false,
          spawnError,
        });
      });

      proc.stdout.on("data", (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes <= MAX_OUTPUT_BYTES) stdoutChunks.push(chunk);
      });

      proc.stderr.on("data", (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes <= MAX_OUTPUT_BYTES) stderrChunks.push(chunk);
      });

      proc.on("close", (code) => {
        settle({
          exitCode: code,
          stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
          stderr: Buffer.concat(stderrChunks).toString("utf-8"),
          durationMs: Date.now() - startMs,
          timedOut: false,
          cancelled: false,
          spawnError: null,
        });
      });

      const timer = setTimeout(() => {
        if (!proc.killed) proc.kill("SIGKILL");
        settle({
          exitCode: null,
          stdout: Buffer.concat(stdoutChunks).toString("utf-8"),
          stderr: Buffer.concat(stderrChunks).toString("utf-8"),
          durationMs: Date.now() - startMs,
          timedOut: true,
          cancelled: false,
          spawnError: null,
        });
      }, timeoutMs);

      const onAbort = () => {
        if (!proc.killed) proc.kill("SIGTERM");
        settle(this._cancelled(Date.now() - startMs));
      };

      signal?.addEventListener("abort", onAbort);
    });
  }

  private _resolveTSCBin(workspacePath: string): string {
    const local = path.join(workspacePath, "node_modules", ".bin", "tsc");
    if (fs.existsSync(local)) return local;
    return "tsc";
  }

  private _cancelled(durationMs: number): TSCExecutionResult {
    return {
      exitCode: null,
      stdout: "",
      stderr: "",
      durationMs,
      timedOut: false,
      cancelled: true,
      spawnError: null,
    };
  }
}
