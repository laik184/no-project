/**
 * server/runtime-truth/http-health-verifier.ts
 *
 * HTTPHealthVerifier — rolling window HTTP stability verifier.
 * Requires N consecutive successful responses before declaring stable.
 * A single 5xx or connection failure resets the window.
 * Timeout-protected. No single-request success acceptance.
 */

import type { HTTPHealthReport, EvidenceItem } from "./types.ts";

const REQUIRED_SUCCESSES = 3;
const PROBE_INTERVAL_MS  = 600;
const REQUEST_TIMEOUT_MS = 4_000;
const LATENCY_WARN_MS    = 2_000;

export class HTTPHealthVerifier {
  async verify(
    url: string,
    opts: { signal?: AbortSignal; requiredSuccesses?: number } = {}
  ): Promise<{ report: HTTPHealthReport; evidence: readonly EvidenceItem[] }> {
    const t0 = Date.now();
    const required = opts.requiredSuccesses ?? REQUIRED_SUCCESSES;
    let consecutive = 0;
    let lastCode: number | null = null;
    const latencies: number[] = [];

    while (consecutive < required) {
      if (opts.signal?.aborted) break;

      const probe = await this._probe(url, opts.signal);
      lastCode = probe.statusCode;
      latencies.push(probe.latencyMs);

      if (probe.ok) {
        consecutive++;
      } else {
        consecutive = 0; // Reset — one failure breaks the window
      }

      if (consecutive < required) {
        await this._sleep(PROBE_INTERVAL_MS, opts.signal);
      }
    }

    const stable = consecutive >= required;
    const avgLatencyMs = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : 0;

    const report: HTTPHealthReport = Object.freeze({
      url,
      consecutiveSuccesses: consecutive,
      requiredSuccesses: required,
      stable,
      lastStatusCode: lastCode,
      avgLatencyMs,
      durationMs: Date.now() - t0,
    });

    const now = Date.now();
    const evidence: EvidenceItem[] = [
      {
        kind: "HTTP_200",
        value: stable,
        detail: stable
          ? `${required} consecutive 2xx responses (avg ${avgLatencyMs}ms)`
          : `Only ${consecutive}/${required} consecutive successes. Last: HTTP ${lastCode ?? "ERR"}`,
        collectedAt: now,
        ttlMs: 15_000,
      },
    ];

    return { report, evidence: Object.freeze(evidence) };
  }

  private async _probe(
    url: string,
    signal?: AbortSignal
  ): Promise<{ ok: boolean; statusCode: number | null; latencyMs: number }> {
    const t0 = Date.now();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const linked = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
      const res = await fetch(url, { signal: linked, method: "GET" });
      clearTimeout(timer);
      return { ok: res.ok, statusCode: res.status, latencyMs: Date.now() - t0 };
    } catch {
      return { ok: false, statusCode: null, latencyMs: Date.now() - t0 };
    }
  }

  private _sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
    });
  }
}
