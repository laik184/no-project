/**
 * server/fail-closed/verifiers/runtime-verifier.ts
 *
 * RuntimeVerifier — Stage 3 of the fail-closed pipeline.
 *
 * Checks (all required):
 *   1. Process alive (PID exists, not zombie)
 *   2. No crash loop (restartCount < threshold)
 *   3. Port open and reachable
 *   4. HTTP 200 stable (consecutive successes)
 *
 * Evidence produced:
 *   PROCESS_ALIVE, NO_CRASH_LOOP, PORT_OPEN, HTTP_200_STABLE
 *
 * Adapts server/runtime-truth process-health + http-health verifiers.
 * Maps internal evidence kinds (PID_ALIVE, CRASH_LOOP_ABSENT) → our contracts.
 */

import type { StageResult, Evidence } from "../contracts/types.ts";
import { ProcessHealthMonitor } from "../../runtime-truth/process-health-monitor.ts";
import { HTTPHealthVerifier }   from "../../runtime-truth/http-health-verifier.ts";
import { runtimeManager }       from "../../infrastructure/runtime/runtime-manager.ts";

const SOURCE = "runtime-verifier";
const NOW    = () => Date.now();

export class RuntimeVerifier {
  private readonly _process = new ProcessHealthMonitor();
  private readonly _http    = new HTTPHealthVerifier();

  async verify(
    projectId: number,
    opts?: { port?: number; previewUrl?: string; signal?: AbortSignal }
  ): Promise<StageResult> {
    const t0   = NOW();
    const evidence: Evidence[] = [];
    const port = opts?.port ?? null;
    const pid  = this._resolvePid(projectId);

    // ── 1. Process health ─────────────────────────────────────────────────────
    try {
      const { report } = await this._process.check({ projectId, pid, port });

      // Map PID_ALIVE → PROCESS_ALIVE
      evidence.push({
        kind: "PROCESS_ALIVE", value: report.alive,
        detail: report.alive ? `PID ${pid} alive` : `PID ${pid ?? "unknown"} not alive`,
        collectedAt: NOW(), source: SOURCE, ttlMs: 10_000,
      });
      // Map CRASH_LOOP_ABSENT → NO_CRASH_LOOP
      evidence.push({
        kind: "NO_CRASH_LOOP", value: !report.inCrashLoop,
        detail: report.inCrashLoop
          ? `Crash loop detected: ${report.restartCount} restarts`
          : "No crash loop",
        collectedAt: NOW(), source: SOURCE, ttlMs: 10_000,
      });
      // PORT_OPEN — same name in both
      evidence.push({
        kind: "PORT_OPEN", value: port !== null ? report.portOpen : true,
        detail: port !== null
          ? (report.portOpen ? `Port ${port} open` : `Port ${port} not open`)
          : "No port specified — skipped",
        collectedAt: NOW(), source: SOURCE, ttlMs: 10_000,
      });
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      evidence.push({ kind: "PROCESS_ALIVE", value: false, detail: `Process check threw: ${msg}`, collectedAt: NOW(), source: SOURCE, ttlMs: 10_000 });
      evidence.push({ kind: "NO_CRASH_LOOP",  value: false, detail: "Could not verify", collectedAt: NOW(), source: SOURCE, ttlMs: 10_000 });
      evidence.push({ kind: "PORT_OPEN",      value: false, detail: "Could not verify", collectedAt: NOW(), source: SOURCE, ttlMs: 10_000 });
    }

    const processOk = ["PROCESS_ALIVE", "NO_CRASH_LOOP", "PORT_OPEN"].every((k) =>
      evidence.find((e) => e.kind === k)?.value !== false
    );
    if (!processOk) {
      const bad = evidence.find((e) => !e.value);
      return this._failed(bad?.detail ?? "Process health failed", t0, evidence);
    }

    // ── 2. HTTP health ────────────────────────────────────────────────────────
    const url = opts?.previewUrl ?? (port !== null ? `http://localhost:${port}` : null);
    if (!url) {
      evidence.push({ kind: "HTTP_200_STABLE", value: true, detail: "No URL — HTTP gate skipped", collectedAt: NOW(), source: SOURCE, ttlMs: 15_000 });
    } else {
      try {
        const { report } = await this._http.verify(url, { signal: opts?.signal });
        evidence.push({
          kind: "HTTP_200_STABLE", value: report.stable,
          detail: report.stable
            ? `${report.consecutiveSuccesses} consecutive HTTP 200s`
            : `Only ${report.consecutiveSuccesses}/${report.requiredSuccesses} successes`,
          collectedAt: NOW(), source: SOURCE, ttlMs: 15_000,
        });
        if (!report.stable) {
          return this._failed(`HTTP not stable at ${url}`, t0, evidence);
        }
      } catch (err: any) {
        evidence.push({ kind: "HTTP_200_STABLE", value: false, detail: `HTTP check threw: ${err?.message}`, collectedAt: NOW(), source: SOURCE, ttlMs: 15_000 });
        return this._failed(`HTTP verification error: ${err?.message}`, t0, evidence);
      }
    }

    return Object.freeze({ stage: "RUNTIME" as const, passed: true, evidence: Object.freeze(evidence), failureReason: null, durationMs: NOW() - t0 });
  }

  private _resolvePid(projectId: number): number | null {
    try { return runtimeManager.get(projectId)?.pid ?? null; } catch { return null; }
  }

  private _failed(reason: string, t0: number, evidence: Evidence[]): StageResult {
    return Object.freeze({ stage: "RUNTIME" as const, passed: false, evidence: Object.freeze(evidence), failureReason: reason, durationMs: NOW() - t0 });
  }
}
