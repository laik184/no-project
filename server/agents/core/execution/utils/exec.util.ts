// ============================================================
// utils/exec.helper.ts — Wraps child_process.spawn into a
// Promise. Captures stdout/stderr, enforces timeouts, handles
// SIGTERM → SIGKILL escalation. No local module imports.
// ============================================================

import { spawn } from "child_process";
import type { ExecOptions, ExecOutput } from "../types.js";
import { filterEnv } from "../../../../security/safe-spawn.ts";

// ─── Default limits ───────────────────────────────────────────

const DEFAULT_TIMEOUT_MS   = 30_000;
const SIGKILL_GRACE_MS     = 3_000;
const MAX_BUFFER_BYTES     = 10 * 1024 * 1024;  // 10 MiB

// ─── Command validation ───────────────────────────────────────

const SHELL_METACHAR_RE = /[|;&`$(){}<>!\\\n\r]/;

function validateCommand(command: string): void {
  if (!command || command.trim().length === 0) {
    throw new TypeError("execCommand: command must be a non-empty string");
  }
  if (SHELL_METACHAR_RE.test(command)) {
    throw new TypeError(`execCommand: command contains disallowed characters`);
  }
}

// ─── Public API ───────────────────────────────────────────────

export function execCommand(
  command: string,
  args:    readonly string[],
  options: ExecOptions = {}
): Promise<Readonly<ExecOutput>> {
  validateCommand(command);
  return new Promise((resolve) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let bufferedOut    = 0;
    let bufferedErr    = 0;
    let timedOut       = false;
    let settled        = false;

    const spawnEnv = filterEnv(
      options.env ? { ...process.env, ...options.env } : process.env,
    );

    const child = spawn(command, [...args], {
      cwd:   options.cwd,
      env:   spawnEnv,
      shell: false,
    });

    // ─ Timeout guard ────────────────────────────────────────
    const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, SIGKILL_GRACE_MS);
    }, timeoutMs);

    // ─ stdout ────────────────────────────────────────────────
    child.stdout?.on("data", (chunk: Buffer) => {
      bufferedOut += chunk.byteLength;
      if (bufferedOut <= MAX_BUFFER_BYTES) stdoutChunks.push(chunk);
    });

    // ─ stderr ────────────────────────────────────────────────
    child.stderr?.on("data", (chunk: Buffer) => {
      bufferedErr += chunk.byteLength;
      if (bufferedErr <= MAX_BUFFER_BYTES) stderrChunks.push(chunk);
    });

    // ─ close ────────────────────────────────────────────────
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(Object.freeze<ExecOutput>({
        stdout:   Buffer.concat(stdoutChunks).toString("utf8").trim(),
        stderr:   Buffer.concat(stderrChunks).toString("utf8").trim(),
        code,
        signal:   signal ?? null,
        timedOut,
      }));
    });

    // ─ spawn error ──────────────────────────────────────────
    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(Object.freeze<ExecOutput>({
        stdout:   "",
        stderr:   err.message,
        code:     1,
        signal:   null,
        timedOut: false,
      }));
    });
  });
}

// ─── Quick one-shot helpers ───────────────────────────────────

export async function execOrThrow(
  command: string,
  args:    readonly string[],
  options: ExecOptions = {}
): Promise<string> {
  const out = await execCommand(command, args, options);
  if (out.code !== 0) {
    const msg = out.stderr || `Command exited with code ${out.code}`;
    throw new Error(msg);
  }
  return out.stdout;
}

export function buildEnv(
  base:  Readonly<Record<string, string>> | undefined,
  extra: Readonly<Record<string, string>>
): Readonly<Record<string, string>> {
  return Object.freeze({ ...(base ?? {}), ...extra });
}

export function safeArgs(raw: readonly string[] | undefined): string[] {
  if (!raw) return [];
  return raw.map(a => String(a).replace(/[^\w@:.,/=_-]/g, ""));
}
