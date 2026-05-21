/**
 * server/fail-closed/verifiers/build-verifier.ts
 *
 * BuildVerifier — Stage 2 of the fail-closed pipeline.
 *
 * Checks (all required):
 *   1. tsc --noEmit exit code 0
 *   2. npm dependency integrity (no missing packages)
 *
 * Evidence produced:
 *   TSC_EXIT_0, NPM_DEPS_INTACT, BUILD_SUCCEEDED
 *
 * Adapts server/verification/typescript/index.ts
 * and server/runtime-truth/dependency-integrity-verifier.ts
 */

import type { StageResult, Evidence } from "../contracts/types.ts";
import { verifyTypeScript }               from "../../verification/typescript/index.ts";
import { DependencyIntegrityVerifier }    from "../../runtime-truth/dependency-integrity-verifier.ts";

const SOURCE = "build-verifier";

export class BuildVerifier {
  private readonly _depVerifier = new DependencyIntegrityVerifier();

  async verify(
    workspacePath: string,
    opts?: { signal?: AbortSignal; skipCache?: boolean }
  ): Promise<StageResult> {
    const t0 = Date.now();
    const evidence: Evidence[] = [];

    // ── 1. TypeScript compilation ─────────────────────────────────────────────
    let tscPassed = false;
    let tscDetail = "tsc not executed";
    try {
      const result = await verifyTypeScript({
        workspacePath,
        signal:    opts?.signal,
        skipCache: opts?.skipCache ?? true,  // always run fresh in fail-closed mode
      });
      tscPassed = result.passed;
      tscDetail = result.passed
        ? "tsc --noEmit exited 0"
        : `${result.errorCount} TypeScript error(s). First: ${result.diagnostics[0]?.message ?? "unknown"}`;
    } catch (err: any) {
      tscDetail = `tsc threw: ${err?.message ?? err}`;
    }

    evidence.push({
      kind:        "TSC_EXIT_0",
      value:       tscPassed,
      detail:      tscDetail,
      collectedAt: Date.now(),
      source:      SOURCE,
      ttlMs:       30_000,
    });

    if (!tscPassed) {
      return this._failed(`TypeScript failed: ${tscDetail}`, t0, evidence);
    }

    // ── 2. Dependency integrity ───────────────────────────────────────────────
    let depsIntact = false;
    let depsDetail = "dependency check not executed";
    try {
      const { report } = await this._depVerifier.verify(workspacePath);
      depsIntact = report.intact;
      depsDetail = report.intact
        ? "All npm dependencies present"
        : `Missing packages: ${report.missingPackages.slice(0, 5).join(", ")}`;
    } catch (err: any) {
      depsDetail = `Dependency check threw: ${err?.message ?? err}`;
    }

    evidence.push({
      kind:        "NPM_DEPS_INTACT",
      value:       depsIntact,
      detail:      depsDetail,
      collectedAt: Date.now(),
      source:      SOURCE,
      ttlMs:       60_000,
    });

    if (!depsIntact) {
      return this._failed(`Dependencies invalid: ${depsDetail}`, t0, evidence);
    }

    // ── 3. Build succeeded composite ─────────────────────────────────────────
    evidence.push({
      kind: "BUILD_SUCCEEDED", value: true,
      detail: "tsc + npm deps passed",
      collectedAt: Date.now(), source: SOURCE, ttlMs: 30_000,
    });

    return Object.freeze({
      stage: "BUILD" as const,
      passed: true,
      evidence: Object.freeze(evidence),
      failureReason: null,
      durationMs: Date.now() - t0,
    });
  }

  private _failed(reason: string, t0: number, evidence: Evidence[]): StageResult {
    return Object.freeze({
      stage: "BUILD" as const,
      passed: false,
      evidence: Object.freeze(evidence),
      failureReason: reason,
      durationMs: Date.now() - t0,
    });
  }
}
