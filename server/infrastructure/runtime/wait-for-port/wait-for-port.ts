/**
 * server/infrastructure/runtime/wait-for-port/wait-for-port.ts
 *
 * Production-grade port readiness synchronisation using native net.Socket
 * TCP probing.
 *
 * Guarantees:
 *   ✅ Native TCP connect() — no HTTP, no external dependencies
 *   ✅ Configurable timeout + retry interval
 *   ✅ AbortSignal cancellation (checked before every probe AND during sleep)
 *   ✅ Full socket cleanup — no dangling handles, no memory leaks
 *   ✅ Structured bus events at every state transition
 *   ✅ Fail-closed — returns success=false on any non-ready outcome
 *   ✅ No infinite retry loops — hard deadline enforced
 *
 * Single responsibility: TCP port readiness detection only.
 * No preview logic, no orchestration, no spawn logic here.
 */

import net from "net";
import { bus } from "../../events/bus.ts";
import type { WaitForPortOptions, WaitForPortResult, TcpProbeResult } from "./wait-for-port.types.ts";

// ── Config ────────────────────────────────────────────────────────────────────

/** Max time a single TCP connect() attempt may take (ms). */
const TCP_PROBE_TIMEOUT_MS = 2_000;

/** Emit a "waiting" progress event every N retries to avoid bus noise. */
const PROGRESS_EMIT_INTERVAL = 5;

// ── TCP probe ─────────────────────────────────────────────────────────────────

/**
 * Attempt a single TCP connection to host:port.
 * Cleans up the socket on every exit path — success, error, or timeout.
 */
function probeTcp(host: string, port: number): Promise<TcpProbeResult> {
  return new Promise((resolve) => {
    const start  = Date.now();
    const socket = new net.Socket();
    let settled  = false;

    const settle = (result: TcpProbeResult): void => {
      if (settled) return;
      settled = true;
      socket.destroy();           // always close — no dangling handles
      resolve(result);
    };

    // Hard cap on single-probe duration
    const timer = setTimeout(() => {
      settle({ connected: false, latencyMs: Date.now() - start, error: "probe timeout" });
    }, TCP_PROBE_TIMEOUT_MS);

    socket.connect(port, host, () => {
      clearTimeout(timer);
      settle({ connected: true, latencyMs: Date.now() - start });
    });

    socket.on("error", (err) => {
      clearTimeout(timer);
      settle({ connected: false, latencyMs: Date.now() - start, error: err.message });
    });
  });
}

// ── Bus telemetry ─────────────────────────────────────────────────────────────

function emitPortEvent(
  phase:     string,
  projectId: number,
  runId:     string | undefined,
  port:      number,
  extra:     Record<string, unknown> = {},
): void {
  bus.emit("runtime.port" as any, {
    phase, projectId, runId, port, ts: Date.now(), ...extra,
  });
}

// ── Abort-safe sleep ──────────────────────────────────────────────────────────

/**
 * Sleep for `ms` milliseconds, waking early if the AbortSignal fires.
 * Checks the signal at 50 ms granularity — balances responsiveness vs CPU.
 */
async function sleepInterruptible(ms: number, signal?: AbortSignal): Promise<"elapsed" | "aborted"> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (signal?.aborted) return "aborted";
    await new Promise<void>(r => setTimeout(r, Math.min(50, deadline - Date.now())));
  }
  return "elapsed";
}

// ── Main implementation ───────────────────────────────────────────────────────

/**
 * Wait until the given TCP port accepts connections or the deadline passes.
 *
 * Returns a structured result — never throws. Callers must check `success`.
 */
export async function waitForPort(opts: WaitForPortOptions): Promise<WaitForPortResult> {
  const {
    host, port, timeoutMs, retryIntervalMs,
    signal, projectId, runId,
  } = opts;

  const startTs    = Date.now();
  let   retryCount = 0;

  // Announce start
  emitPortEvent("waiting", projectId, runId, port, { host, timeoutMs, retryIntervalMs });
  console.log(`[wait-for-port] project=${projectId} port=${port} — waiting (timeout=${timeoutMs}ms)`);

  while (true) {
    const elapsed = Date.now() - startTs;

    // ── Timeout check ───────────────────────────────────────────────────────
    if (elapsed >= timeoutMs) {
      const msg = `Port ${port} not accepting connections after ${elapsed}ms (${retryCount} retries)`;
      emitPortEvent("timeout", projectId, runId, port, { elapsed, retryCount });
      console.warn(`[wait-for-port] TIMEOUT project=${projectId} port=${port} — ${msg}`);
      return { success: false, phase: "timeout", port, host, durationMs: elapsed, retryCount, error: msg };
    }

    // ── Abort check ─────────────────────────────────────────────────────────
    if (signal?.aborted) {
      const msg = `Wait for port ${port} cancelled after ${elapsed}ms`;
      emitPortEvent("cancelled", projectId, runId, port, { elapsed, retryCount });
      return { success: false, phase: "cancelled", port, host, durationMs: elapsed, retryCount, error: msg };
    }

    // ── TCP probe ────────────────────────────────────────────────────────────
    const probe = await probeTcp(host, port);
    retryCount++;

    if (probe.connected) {
      const durationMs = Date.now() - startTs;
      emitPortEvent("ready", projectId, runId, port, {
        durationMs, retryCount, latencyMs: probe.latencyMs,
      });
      console.log(
        `[wait-for-port] READY project=${projectId} port=${port} ` +
        `— ${durationMs}ms, ${retryCount} attempts, latency=${probe.latencyMs}ms`,
      );
      return { success: true, phase: "ready", port, host, durationMs, retryCount };
    }

    // ── Progress telemetry ──────────────────────────────────────────────────
    if (retryCount % PROGRESS_EMIT_INTERVAL === 0) {
      emitPortEvent("waiting", projectId, runId, port, {
        elapsed: Date.now() - startTs, retryCount, lastError: probe.error,
      });
    }

    // ── Abort-safe wait before next probe ────────────────────────────────────
    const sleepResult = await sleepInterruptible(retryIntervalMs, signal);
    if (sleepResult === "aborted") {
      const elapsed2 = Date.now() - startTs;
      const msg = `Wait for port ${port} cancelled during retry sleep after ${elapsed2}ms`;
      emitPortEvent("cancelled", projectId, runId, port, { elapsed: elapsed2, retryCount });
      return { success: false, phase: "cancelled", port, host, durationMs: elapsed2, retryCount, error: msg };
    }
  }
}
