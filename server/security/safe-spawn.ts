/**
 * server/security/safe-spawn.ts
 *
 * Hardened spawn wrapper used by all tool execution paths.
 *
 * Guarantees:
 *  - shell: false always (no shell injection via command string)
 *  - Filtered environment — secrets never leak to child processes
 *  - Enforced timeout with SIGTERM → SIGKILL escalation
 *  - Bounded output buffers (stdout 20 KB, stderr 5 KB)
 *  - Command + args validation before spawn
 */

import { spawn } from "child_process";
import { validateCommand, validateArgs } from "./command-validator.ts";

// ── Environment variables allowed to pass to child processes ─────────────────
// Excludes DATABASE_URL, *API_KEY, *SECRET, *TOKEN, *PASSWORD, PGPASSWORD, etc.

const SAFE_ENV_KEYS = new Set([
  "PATH", "HOME", "USER", "SHELL", "LANG", "LC_ALL", "LC_CTYPE",
  "NODE_ENV", "NODE_PATH", "NODE_OPTIONS",
  "npm_config_cache", "npm_config_prefix",
  "TMPDIR", "TEMP", "TMP",
  "TERM", "COLORTERM", "NO_COLOR",
  "CI", "FORCE_COLOR",
  "PWD", "OLDPWD",
]);

const SECRET_KEY_RE = /(?:secret|password|token|api.?key|auth|credential|private)/i;

export function filterEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const safe: NodeJS.ProcessEnv = {};
  for (const [k, v] of Object.entries(env)) {
    if (!v) continue;
    if (SAFE_ENV_KEYS.has(k)) { safe[k] = v; continue; }
    if (SECRET_KEY_RE.test(k)) continue;     // redact secrets
    // Allow AGENT_* env vars (project config, not credentials)
    if (k.startsWith("AGENT_") && !SECRET_KEY_RE.test(v)) { safe[k] = v; continue; }
  }
  return safe;
}

// ── Spawn options ─────────────────────────────────────────────────────────────

export interface SafeSpawnOptions {
  command:    string;
  args:       string[];
  cwd:        string;
  env?:       NodeJS.ProcessEnv;
  timeoutMs?: number;
  maxStdout?: number;   // bytes, default 20 KB
  maxStderr?: number;   // bytes, default 5 KB
}

export interface SafeSpawnResult {
  exitCode: number | null;
  stdout:   string;
  stderr:   string;
  timedOut: boolean;
  blocked?:  string;   // set if execution was blocked by validation
}

// ── Main safe spawn ───────────────────────────────────────────────────────────

export async function safeSpawn(opts: SafeSpawnOptions): Promise<SafeSpawnResult> {
  const {
    command, args, cwd, env,
    timeoutMs = 30_000,
    maxStdout = 20_480,
    maxStderr  = 5_120,
  } = opts;

  // Validate before any I/O
  const cmdCheck = validateCommand(command);
  if (!cmdCheck.valid) {
    return { exitCode: 1, stdout: "", stderr: "", timedOut: false, blocked: cmdCheck.reason };
  }
  const argsCheck = validateArgs(command, args);
  if (!argsCheck.valid) {
    return { exitCode: 1, stdout: "", stderr: "", timedOut: false, blocked: argsCheck.reason };
  }

  const safeEnv = filterEnv(env ?? process.env);

  return new Promise<SafeSpawnResult>((resolve) => {
    let stdoutBuf = "";
    let stderrBuf = "";
    let timedOut  = false;
    let settled   = false;

    const proc = spawn(command, args, {
      cwd,
      shell: false,     // NEVER shell: true
      env:   safeEnv,
    });

    const settle = (result: SafeSpawnResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
      setTimeout(() => { if (!proc.killed) proc.kill("SIGKILL"); }, 2_000);
      settle({ exitCode: null, stdout: stdoutBuf, stderr: stderrBuf, timedOut: true });
    }, timeoutMs);

    proc.stdout?.on("data", (chunk: Buffer) => {
      const remaining = maxStdout - stdoutBuf.length;
      if (remaining > 0) stdoutBuf += chunk.toString().slice(0, remaining);
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      const remaining = maxStderr - stderrBuf.length;
      if (remaining > 0) stderrBuf += chunk.toString().slice(0, remaining);
    });

    proc.on("close", (code) => {
      settle({ exitCode: code, stdout: stdoutBuf, stderr: stderrBuf, timedOut: false });
    });

    proc.on("error", (err) => {
      settle({ exitCode: 1, stdout: stdoutBuf, stderr: err.message, timedOut: false });
    });
  });
}
