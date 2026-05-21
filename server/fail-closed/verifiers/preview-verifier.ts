/**
 * server/fail-closed/verifiers/preview-verifier.ts
 *
 * PreviewVerifier — Stage 4 of the fail-closed pipeline.
 *
 * Checks (all required):
 *   1. DOM renders valid content (no blank page, error overlay)
 *   2. No fatal console errors
 *   3. Interactive elements present
 *
 * Evidence produced:
 *   PREVIEW_DOM_VALID, PREVIEW_NO_FATAL_ERRORS, PREVIEW_INTERACTIVE
 *
 * Adapts server/runtime-truth/preview-behavior-verifier.ts.
 * Maps internal evidence kind DOM_VALID → PREVIEW_DOM_VALID, etc.
 */

import type { StageResult, Evidence } from "../contracts/types.ts";
import { PreviewBehaviorVerifier } from "../../runtime-truth/preview-behavior-verifier.ts";

const SOURCE = "preview-verifier";
const NOW    = () => Date.now();

export class PreviewVerifier {
  private readonly _verifier = new PreviewBehaviorVerifier();

  async verify(
    opts: { port?: number; previewUrl?: string; signal?: AbortSignal }
  ): Promise<StageResult> {
    const t0 = NOW();
    const evidence: Evidence[] = [];

    if (!opts.port && !opts.previewUrl) {
      return this._failed("No port or previewUrl provided — preview cannot be verified", t0, evidence);
    }

    const url = opts.previewUrl ?? `http://localhost:${opts.port}`;

    let passed = false;
    let domValid    = false;
    let noErrors    = false;
    let interactive = false;
    let topDetail   = "Preview verification not executed";

    try {
      const result = await this._verifier.verify(url, opts.signal);
      passed   = result.passed;
      topDetail = result.detail;

      // Map internal evidence kinds to our contract evidence kinds
      for (const ev of result.evidence) {
        const kind = ev.kind as string;

        if (kind === "DOM_VALID" || kind === "PREVIEW_DOM_VALID") {
          domValid = ev.value as boolean;
          evidence.push({ kind: "PREVIEW_DOM_VALID", value: domValid, detail: ev.detail as string, collectedAt: ev.collectedAt as number, source: SOURCE, ttlMs: 20_000 });
        }
        if (kind === "NO_JS_ERRORS" || kind === "NO_FATAL_ERRORS" || kind === "CONSOLE_CLEAN" || kind === "PREVIEW_NO_FATAL_ERRORS") {
          noErrors = ev.value as boolean;
          evidence.push({ kind: "PREVIEW_NO_FATAL_ERRORS", value: noErrors, detail: ev.detail as string, collectedAt: ev.collectedAt as number, source: SOURCE, ttlMs: 20_000 });
        }
        if (kind === "INTERACTIVE" || kind === "ELEMENTS_PRESENT" || kind === "PREVIEW_INTERACTIVE") {
          interactive = ev.value as boolean;
          evidence.push({ kind: "PREVIEW_INTERACTIVE", value: interactive, detail: ev.detail as string, collectedAt: ev.collectedAt as number, source: SOURCE, ttlMs: 20_000 });
        }
      }

      // Fill any missing evidence types from the overall passed flag
      if (!evidence.find((e) => e.kind === "PREVIEW_DOM_VALID")) {
        evidence.push({ kind: "PREVIEW_DOM_VALID", value: passed, detail: passed ? "DOM valid (inferred)" : topDetail, collectedAt: NOW(), source: SOURCE, ttlMs: 20_000 });
      }
      if (!evidence.find((e) => e.kind === "PREVIEW_NO_FATAL_ERRORS")) {
        evidence.push({ kind: "PREVIEW_NO_FATAL_ERRORS", value: passed, detail: passed ? "No fatal errors (inferred)" : topDetail, collectedAt: NOW(), source: SOURCE, ttlMs: 20_000 });
      }
      if (!evidence.find((e) => e.kind === "PREVIEW_INTERACTIVE")) {
        evidence.push({ kind: "PREVIEW_INTERACTIVE", value: passed, detail: passed ? "Interactive (inferred)" : topDetail, collectedAt: NOW(), source: SOURCE, ttlMs: 20_000 });
      }
    } catch (err: any) {
      topDetail = `Preview verifier threw: ${err?.message ?? err}`;
      evidence.push({ kind: "PREVIEW_DOM_VALID",        value: false, detail: topDetail, collectedAt: NOW(), source: SOURCE, ttlMs: 20_000 });
      evidence.push({ kind: "PREVIEW_NO_FATAL_ERRORS",  value: false, detail: topDetail, collectedAt: NOW(), source: SOURCE, ttlMs: 20_000 });
      evidence.push({ kind: "PREVIEW_INTERACTIVE",      value: false, detail: topDetail, collectedAt: NOW(), source: SOURCE, ttlMs: 20_000 });
    }

    if (!passed) {
      return this._failed(topDetail, t0, evidence);
    }

    return Object.freeze({ stage: "PREVIEW" as const, passed: true, evidence: Object.freeze(evidence), failureReason: null, durationMs: NOW() - t0 });
  }

  private _failed(reason: string, t0: number, evidence: Evidence[]): StageResult {
    return Object.freeze({ stage: "PREVIEW" as const, passed: false, evidence: Object.freeze(evidence), failureReason: reason, durationMs: NOW() - t0 });
  }
}
