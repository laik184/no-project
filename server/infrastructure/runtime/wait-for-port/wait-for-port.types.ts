/**
 * server/infrastructure/runtime/wait-for-port/wait-for-port.types.ts
 *
 * Canonical types for the production-grade waitForPort() system.
 * Single responsibility: type definitions only. No imports, no side-effects.
 */

// ── Phase ─────────────────────────────────────────────────────────────────────

/** Each discrete state the port-wait FSM can be in. */
export type PortPhase = "waiting" | "ready" | "timeout" | "failed" | "cancelled";

// ── Options ───────────────────────────────────────────────────────────────────

export interface WaitForPortOptions {
  /** Host to probe — always "127.0.0.1" for local spawned processes. */
  host:            string;
  /** TCP port to wait for. */
  port:            number;
  /** Hard deadline from call start (ms). Default: 30 000. */
  timeoutMs:       number;
  /** Delay between TCP probe attempts (ms). Default: 250. */
  retryIntervalMs: number;
  /** Optional AbortSignal for external cancellation. */
  signal?:         AbortSignal;
  /** Project this port belongs to — used for telemetry / bus events. */
  projectId:       number;
  /** Agent run ID — attached to telemetry but optional. */
  runId?:          string;
}

// ── TCP probe ─────────────────────────────────────────────────────────────────

export interface TcpProbeResult {
  /** True when the TCP handshake completed before the probe timeout. */
  connected:  boolean;
  /** Round-trip time for the TCP connect() call (ms). */
  latencyMs:  number;
  /** Error message if not connected — ECONNREFUSED / timeout / etc. */
  error?:     string;
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface WaitForPortResult {
  /** True only when TCP connection was established within the deadline. */
  success:    boolean;
  /** Final phase when the function returned. */
  phase:      PortPhase;
  /** The port that was probed. */
  port:       number;
  /** The host that was probed. */
  host:       string;
  /** Wall-clock time from call start to return (ms). */
  durationMs: number;
  /** Total number of TCP probe attempts made. */
  retryCount: number;
  /** Human-readable failure reason — present when success=false. */
  error?:     string;
}
