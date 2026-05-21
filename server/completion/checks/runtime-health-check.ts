/**
 * server/completion/checks/runtime-health-check.ts
 * Probes the running dev server to confirm it responds on the expected port.
 * Single responsibility: HTTP health probe. No browser or policy logic.
 */

import type { CompletionCheckResult, CompletionGateInput } from "../types.ts";

const PROBE_TIMEOUT_MS  = 5_000;
const PROBE_ATTEMPTS    = 3;
const PROBE_DELAY_MS    = 1_000;
const DEFAULT_DEV_PORT  = 5000;
const HEALTH_PATHS      = ["/", "/health", "/api/status"];

async function probeUrl(url: string): Promise<{ ok: boolean; status: number; ms: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return { ok: res.status < 500, status: res.status, ms: Date.now() - start };
  } catch {
    return { ok: false, status: 0, ms: Date.now() - start };
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function probeWithRetry(
  port: number,
): Promise<{ ok: boolean; url: string; status: number }> {
  for (const probePath of HEALTH_PATHS) {
    const url = `http://localhost:${port}${probePath}`;
    for (let attempt = 0; attempt < PROBE_ATTEMPTS; attempt++) {
      const result = await probeUrl(url);
      if (result.ok) return { ok: true, url, status: result.status };
      await sleep(PROBE_DELAY_MS);
    }
  }
  return { ok: false, url: `http://localhost:${port}`, status: 0 };
}

export async function runRuntimeHealthCheck(
  input: CompletionGateInput,
): Promise<CompletionCheckResult> {
  const port = input.devPort ?? DEFAULT_DEV_PORT;
  const result = await probeWithRetry(port);

  return {
    check:   "RuntimeHealth",
    status:  result.ok ? "passed" : "failed",
    passed:  result.ok,
    details: result.ok
      ? `Runtime healthy — port ${port} responding at ${result.url} (HTTP ${result.status}).`
      : `Runtime not responding — port ${port} probed ${PROBE_ATTEMPTS} times with no success.`,
    evidence: { port, url: result.url, httpStatus: result.status },
  };
}
