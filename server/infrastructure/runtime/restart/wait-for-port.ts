/**
 * server/infrastructure/runtime/restart/wait-for-port.ts
 *
 * Poll a local port with exponential backoff until it accepts HTTP connections
 * or the timeout is exceeded.
 *
 * Single responsibility: port readiness detection.
 * No bus logic, no recovery logic — pure async I/O with telemetry callbacks.
 */

import { probePort }    from "../../../runtime/health/port-probe.ts";
import { bus }          from "../../events/bus.ts";

// ── Config ────────────────────────────────────────────────────────────────────

const BASE_DELAY_MS    = 500;
const MAX_DELAY_MS     = 8_000;
const DEFAULT_TIMEOUT  = 30_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WaitForPortResult {
  reachable:  boolean;
  elapsedMs:  number;
  attempts:   number;
  error?:     string;
}

// ── Implementation ────────────────────────────────────────────────────────────

/**
 * Poll http://localhost:{port}/ with exponential backoff.
 * Returns as soon as the port is reachable or the timeout is exceeded.
 */
export async function waitForPort(
  port:        number,
  projectId:   number,
  runId?:      string,
  timeoutMs  = DEFAULT_TIMEOUT,
): Promise<WaitForPortResult> {
  const start  = Date.now();
  let attempts = 0;
  let delayMs  = BASE_DELAY_MS;

  while (Date.now() - start < timeoutMs) {
    const result = await probePort(port);
    attempts++;

    if (result.reachable) {
      emitTelemetry("restart.port_ready", projectId, runId, {
        port, attempts, elapsedMs: Date.now() - start,
      });
      return { reachable: true, elapsedMs: Date.now() - start, attempts };
    }

    const wait = Math.min(delayMs, MAX_DELAY_MS);
    await sleep(wait);
    delayMs = Math.min(delayMs * 2, MAX_DELAY_MS);
  }

  const elapsedMs = Date.now() - start;
  emitTelemetry("restart.timeout", projectId, runId, { port, attempts, elapsedMs });

  return {
    reachable: false,
    elapsedMs,
    attempts,
    error: `Port ${port} not reachable after ${elapsedMs}ms (${attempts} attempts)`,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function emitTelemetry(
  event:     string,
  projectId: number,
  runId:     string | undefined,
  extra:     Record<string, unknown>,
): void {
  bus.emit("restart.telemetry" as any, {
    event, projectId, runId, ts: Date.now(), ...extra,
  });
}
