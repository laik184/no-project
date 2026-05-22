/**
 * runtime-types.ts
 *
 * Unified public types for the runtime orchestration layer.
 *
 * Consumers (routes, tools, preview, service) import from here.
 * The process/ layer types are internal implementation details.
 */

// ─── Status ───────────────────────────────────────────────────────────────────

export type RuntimeStatus = "starting" | "running" | "stopped" | "crashed";

// ─── Start / stop / restart options ──────────────────────────────────────────

export interface RuntimeStartOptions {
  /** Shell command to run (default: "npm run dev"). */
  command?: string;
  /** Extra environment variables passed to the child process. */
  env?: Record<string, string>;
}

// ─── Results ──────────────────────────────────────────────────────────────────

export interface RuntimeStartResult {
  ok: boolean;
  port?: number;
  pid?: number;
  error?: string;
  alreadyRunning?: boolean;
}

export interface RuntimeStopResult {
  ok: boolean;
  error?: string;
}

export interface RuntimeRestartResult {
  ok: boolean;
  port?: number;
  pid?: number;
  error?: string;
}

/**
 * Result of runtimeManager.startDeterministic() — extends the base start result
 * with port-wait and verification metadata from the deterministic startup pipeline.
 */
export interface DeterministicStartResult extends RuntimeStartResult {
  /** True only when port was confirmed reachable AND startup verification passed. */
  ready:                boolean;
  /** Time spent waiting for the TCP port to accept connections (ms). */
  portWaitMs?:          number;
  /** Classification from startup-verifier: "healthy" | "degraded" | etc. */
  verificationOutcome?: string;
}

/**
 * Options for the deterministic startup pipeline.
 * Extends base start options with port-wait and verification config.
 */
export interface DeterministicStartOptions extends RuntimeStartOptions {
  /** Hard deadline for port readiness (ms). Default: 30 000. */
  waitTimeoutMs?:   number;
  /** Delay between TCP probe attempts (ms). Default: 250. */
  retryIntervalMs?: number;
  /** Agent run ID — attached to telemetry events. */
  runId?:           string;
  /** Optional AbortSignal for external cancellation. */
  signal?:          AbortSignal;
}

// ─── Entry (read view) ────────────────────────────────────────────────────────

export interface RuntimeEntry {
  projectId: number;
  pid: number;
  port: number;
  status: RuntimeStatus;
  startedAt: number;
  command: string;
  cwd: string;
  restartCount: number;
  lastHeartbeat: number;
  uptimeMs: number;
}
