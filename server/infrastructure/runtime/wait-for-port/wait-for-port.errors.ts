/**
 * server/infrastructure/runtime/wait-for-port/wait-for-port.errors.ts
 *
 * Structured error hierarchy for waitForPort() failures.
 * Consumers can instanceof-check for precise error handling.
 *
 * Single responsibility: error type definitions only.
 */

// ── Base ──────────────────────────────────────────────────────────────────────

export class WaitForPortError extends Error {
  readonly port:       number;
  readonly durationMs: number;
  readonly retryCount: number;

  constructor(
    message:    string,
    port:       number,
    durationMs: number,
    retryCount: number,
  ) {
    super(message);
    this.name       = "WaitForPortError";
    this.port       = port;
    this.durationMs = durationMs;
    this.retryCount = retryCount;
  }
}

// ── Timeout ───────────────────────────────────────────────────────────────────

/**
 * Thrown (or returned as error) when the port never accepted a TCP connection
 * within the configured timeoutMs deadline.
 */
export class WaitForPortTimeoutError extends WaitForPortError {
  readonly timeoutMs: number;

  constructor(port: number, timeoutMs: number, durationMs: number, retryCount: number) {
    super(
      `Port ${port} did not accept TCP connections within ${timeoutMs}ms ` +
      `(${retryCount} probe attempts over ${durationMs}ms)`,
      port, durationMs, retryCount,
    );
    this.name      = "WaitForPortTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

// ── Cancelled ─────────────────────────────────────────────────────────────────

/**
 * Returned when waiting was cancelled via an AbortSignal before the port
 * became reachable or the timeout elapsed.
 */
export class WaitForPortCancelledError extends WaitForPortError {
  constructor(port: number, durationMs: number, retryCount: number) {
    super(
      `Port ${port} wait cancelled after ${durationMs}ms (${retryCount} attempts)`,
      port, durationMs, retryCount,
    );
    this.name = "WaitForPortCancelledError";
  }
}

// ── Probe failure ─────────────────────────────────────────────────────────────

/**
 * Returned when TCP probing itself fails in an unexpected way
 * (not just ECONNREFUSED — e.g. permission error, bad host, etc.).
 */
export class WaitForPortProbeError extends WaitForPortError {
  readonly lastError: string;

  constructor(port: number, lastError: string, durationMs: number, retryCount: number) {
    super(
      `TCP probe to port ${port} failed: ${lastError} ` +
      `(after ${retryCount} attempts in ${durationMs}ms)`,
      port, durationMs, retryCount,
    );
    this.name      = "WaitForPortProbeError";
    this.lastError = lastError;
  }
}
