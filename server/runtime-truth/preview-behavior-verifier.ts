/**
 * server/runtime-truth/preview-behavior-verifier.ts
 *
 * PreviewBehaviorVerifier — delegates to the existing browser-verifier.
 * Wraps BrowserVerificationResult into EvidenceItems.
 * Binary PASS/FAIL only — no score-based soft success.
 *
 * PASS requires ALL of:
 *   - HTTP 2xx
 *   - DOM not blank
 *   - No React error boundary triggered
 *   - Zero JS console errors
 *   - No white screen
 */

import { runBrowserVerification } from "../verification/browser/browser-verifier.ts";
import type { EvidenceItem, StageResult } from "./types.ts";

const PASS_REQUIRES: string[] = [
  "HTTP 2xx",
  "DOM not blank",
  "No React error boundary",
  "Zero JS errors",
];

export class PreviewBehaviorVerifier {
  async verify(
    url: string,
    signal?: AbortSignal
  ): Promise<{ passed: boolean; evidence: readonly EvidenceItem[]; detail: string }> {
    const t0 = Date.now();

    let result;
    try {
      result = await runBrowserVerification({ url, depth: "standard" });
    } catch (err) {
      const now = Date.now();
      return {
        passed: false,
        evidence: Object.freeze([{
          kind: "DOM_VALID" as const,
          value: false,
          detail: `Browser verification threw: ${String(err)}`,
          collectedAt: now,
          ttlMs: 15_000,
        }]),
        detail: `Preview verification error: ${String(err)}`,
      };
    }

    const now = Date.now();

    // Deterministic binary criteria — no score thresholds
    const httpOk      = !result.network.serverError && result.network.statusCode >= 200 && result.network.statusCode < 400;
    const domOk       = !result.dom.isBlank && !result.dom.hasWhiteScreen;
    const noReactErr  = !result.dom.hasReactError;
    const noJSErrors  = result.consoleErrors.filter(e => e.level === "error").length === 0;

    const passed = httpOk && domOk && noReactErr && noJSErrors;

    const evidence: EvidenceItem[] = [
      {
        kind: "DOM_VALID",
        value: domOk,
        detail: domOk
          ? "DOM present, no blank/white screen"
          : `DOM issues: blank=${result.dom.isBlank} white=${result.dom.hasWhiteScreen}`,
        collectedAt: now,
        ttlMs: 15_000,
      },
      {
        kind: "HTTP_200",
        value: httpOk,
        detail: `HTTP ${result.network.statusCode} (${result.network.responseTimeMs}ms)`,
        collectedAt: now,
        ttlMs: 15_000,
      },
    ];

    const issues = result.issues.slice();
    if (!noReactErr)  issues.push("React error boundary triggered");
    if (!noJSErrors)  issues.push(`${result.consoleErrors.filter(e=>e.level==="error").length} JS error(s)`);

    return {
      passed,
      evidence: Object.freeze(evidence),
      detail: passed
        ? `Preview PASSED in ${Date.now() - t0}ms`
        : `Preview FAILED: ${issues.join("; ")}`,
    };
  }
}
