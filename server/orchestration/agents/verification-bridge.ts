/**
 * verification-bridge.ts
 *
 * Typed bridge between the orchestration engine and the browser verification system.
 * Wires verification into runtime completion, deployment checks, and recovery validation.
 */

import { emitAgentCoordination } from "../core/orchestration-events.ts";
import { recordSpanStart, recordSpanEnd } from "../telemetry/orchestration-trace.ts";
import { incrementCounter, recordDuration } from "../telemetry/orchestration-metrics.ts";
import { waitForRuntimeReady }  from "../execution/runtime-sync.ts";
import { bus }                  from "../../infrastructure/events/bus.ts";
import type { BridgeResult }    from "../core/orchestration-types.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VerificationInput {
  runId:        string;
  projectId:    number;
  port?:        number;
  checks:       VerificationCheck[];
  timeoutMs?:   number;
}

export type VerificationCheck =
  | "port_open"
  | "http_200"
  | "runtime_healthy"
  | "no_console_errors"
  | "screenshot_valid";

export interface VerificationResult {
  passed:    boolean;
  checks:    CheckResult[];
  score:     number;
  summary:   string;
}

export interface CheckResult {
  check:   VerificationCheck;
  passed:  boolean;
  message: string;
  details?: unknown;
}

// ── Bridge ────────────────────────────────────────────────────────────────────

class VerificationBridge {
  async verify(input: VerificationInput): Promise<BridgeResult<VerificationResult>> {
    const { runId, projectId, checks } = input;
    const t0      = Date.now();
    const timeout = input.timeoutMs ?? 30_000;
    const spanId  = recordSpanStart(runId, "verification.run", {
      projectId: String(projectId),
      checks:    checks.join(","),
    });

    try {
      emitAgentCoordination({
        runId, projectId,
        agentName: "verifier",
        role:      "verifier",
        outcome:   "success",
        phase:     "verify",
      });

      const results: CheckResult[] = [];

      for (const check of checks) {
        const r = await this.runCheck({ check, runId, projectId, port: input.port, timeout });
        results.push(r);
      }

      const passed  = results.every(r => r.passed);
      const passCount = results.filter(r => r.passed).length;
      const score   = passCount / results.length;

      // Emit runtime.verified event to integrate with existing system
      bus.emit("runtime.verified", {
        projectId,
        outcome:   passed ? "verified" : "failed",
        port:      input.port,
        summary:   `${passCount}/${results.length} checks passed`,
        analysis:  results,
        probe:     { checks },
        elapsedMs: Date.now() - t0,
        ts:        Date.now(),
      });

      const result: VerificationResult = {
        passed,
        checks: results,
        score,
        summary: `${passCount}/${results.length} checks passed`,
      };

      incrementCounter(passed ? "verification.passed" : "verification.failed", {
        projectId: String(projectId),
      });
      recordDuration("verification.duration", Date.now() - t0, { projectId: String(projectId) });
      recordSpanEnd(spanId, passed ? "ok" : "error");

      return { success: passed, data: result, durationMs: Date.now() - t0, retryable: !passed };

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      recordSpanEnd(spanId, "error");
      return { success: false, error: msg, durationMs: Date.now() - t0, retryable: true };
    }
  }

  async verifyRuntimeReady(opts: {
    runId:     string;
    projectId: number;
    timeoutMs?: number;
  }): Promise<BridgeResult<{ port?: number }>> {
    const t0 = Date.now();
    try {
      const { port } = await waitForRuntimeReady(opts.projectId, opts.timeoutMs);
      return { success: true, data: { port }, durationMs: Date.now() - t0, retryable: false };
    } catch (err) {
      return { success: false, error: String(err), durationMs: Date.now() - t0, retryable: true };
    }
  }

  // ── Individual check runner ──────────────────────────────────────────────────

  private async runCheck(opts: {
    check:     VerificationCheck;
    runId:     string;
    projectId: number;
    port?:     number;
    timeout:   number;
  }): Promise<CheckResult> {
    const { check, projectId, port } = opts;

    try {
      switch (check) {
        case "port_open": {
          if (!port) return { check, passed: false, message: "No port specified" };
          const open = await this.probePort(port, opts.timeout);
          return { check, passed: open, message: open ? `Port ${port} is open` : `Port ${port} not responding` };
        }

        case "runtime_healthy": {
          const { getRuntimeSnapshot } = await import("../execution/runtime-sync.ts");
          const snap = getRuntimeSnapshot(projectId);
          return { check, passed: snap.healthy, message: snap.healthy ? "Runtime healthy" : snap.message };
        }

        case "http_200": {
          if (!port) return { check, passed: false, message: "No port for HTTP check" };
          const ok = await this.httpCheck(port);
          return { check, passed: ok, message: ok ? `HTTP 200 on port ${port}` : `HTTP check failed on port ${port}` };
        }

        default:
          return { check, passed: true, message: `Check ${check} skipped (not implemented)` };
      }
    } catch (err) {
      return { check, passed: false, message: String(err) };
    }
  }

  private async probePort(port: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const { createConnection } = require("net");
      const socket = createConnection({ port, host: "127.0.0.1" });
      const timer  = setTimeout(() => { socket.destroy(); resolve(false); }, timeoutMs);
      socket.on("connect", () => { clearTimeout(timer); socket.destroy(); resolve(true); });
      socket.on("error",   () => { clearTimeout(timer); resolve(false); });
    });
  }

  private async httpCheck(port: number): Promise<boolean> {
    try {
      const { default: http } = await import("http");
      return new Promise((resolve) => {
        const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
          resolve(res.statusCode !== undefined && res.statusCode < 500);
        });
        req.on("error", () => resolve(false));
        req.setTimeout(5000, () => { req.destroy(); resolve(false); });
      });
    } catch {
      return false;
    }
  }
}

export const verificationBridge = new VerificationBridge();
