/**
 * post-patch-verifier.ts
 *
 * Verify server health after the recovery agent has applied patches.
 * Reuses the existing startup-verifier and log-analyzer infrastructure.
 *
 * Verdict logic:
 *   - "improved"   : server is healthy AND fewer errors than before
 *   - "same"       : server is unhealthy but no new errors were introduced
 *   - "worsened"   : more errors than before patch → trigger rollback
 *   - "healthy"    : server up, port responding, no fatal errors
 *
 * Ownership: autonomous-debug/verification — single responsibility: post-patch verdict.
 * No LLM calls.  Delegates to runtime layer.
 */

import { verifyStartup }  from "../../runtime/verification/startup-verifier.ts";
import { logBuffer }      from "../../runtime/observer/log-buffer.ts";
import { analyzeLines }   from "../../runtime/observer/log-analyzer.ts";
import { runtimeManager } from "../../infrastructure/runtime/runtime-manager.ts";
import type { DebugVerdict } from "../types/debug-types.ts";

// ─── Config ───────────────────────────────────────────────────────────────────

const VERIFY_WAIT_MS = 8_000; // Wait for server to stabilise after restart

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Wait briefly for the server to come up, then evaluate its health.
 * @param projectId   The project whose server was restarted
 * @param preErrorCount  Number of errors detected BEFORE the patch was applied
 */
export async function verifyAfterPatch(
  projectId:     number,
  preErrorCount: number,
): Promise<DebugVerdict> {
  const start = Date.now();

  // Give server time to start up before probing
  await new Promise(r => setTimeout(r, VERIFY_WAIT_MS));

  const entry = runtimeManager.get(projectId);
  const port  = entry?.port;

  // If process isn't running at all, check logs for immediate crash
  if (!entry || entry.status === "crashed" || entry.status === "stopped") {
    const lines   = logBuffer.tail(projectId, 60);
    const analysis = analyzeLines(lines);
    return {
      healthy:       false,
      outcome:       "crashed",
      summary:       `Server not running after patch. ${analysis.errors[0]?.line ?? "No startup signal."}`,
      errorCount:    analysis.errors.length,
      portReachable: false,
      elapsedMs:     Date.now() - start,
    };
  }

  // Use the existing verifier for a thorough health check
  const verification = await verifyStartup(projectId, port!);
  const errorCount    = verification.analysis.errors.length;
  const healthy       = verification.outcome === "healthy" || verification.outcome === "degraded";
  const portReachable = verification.probe.reachable;

  let outcome: string;
  if (healthy) {
    outcome = errorCount < preErrorCount ? "improved" : "healthy";
  } else if (errorCount > preErrorCount) {
    outcome = "worsened";
  } else {
    outcome = "same";
  }

  return {
    healthy,
    outcome,
    summary:       verification.llmSummary,
    errorCount,
    portReachable,
    elapsedMs:     Date.now() - start,
  };
}

/**
 * Quick snapshot of current log error count — used to establish a
 * pre-patch baseline before calling verifyAfterPatch.
 */
export function capturePrePatchErrorCount(projectId: number): number {
  const lines = logBuffer.tail(projectId, 80);
  return analyzeLines(lines).errors.length;
}
