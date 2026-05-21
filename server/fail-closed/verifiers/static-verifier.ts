/**
 * server/fail-closed/verifiers/static-verifier.ts
 *
 * StaticVerifier — Stage 1 of the fail-closed pipeline.
 *
 * Checks (all required to pass):
 *   1. Import graph — no broken imports, missing re-exports
 *   2. Circular dependencies — acyclic import graph
 *   3. AST integrity — parseable source files
 *
 * Evidence produced:
 *   IMPORT_GRAPH_CLEAN, NO_CIRCULAR_DEPS, STATIC_ANALYSIS_CLEAN
 *
 * Adapts server/verification/typescript/import-graph-validator.ts
 * ImportGraphResult: { issues: ImportIssue[], filesScanned, circularChains }
 * ImportIssue: { kind, filePath, importPath, detail }
 */

import type { StageResult, Evidence } from "../contracts/types.ts";
import { ImportGraphValidator } from "../../verification/typescript/import-graph-validator.ts";
import { TSConfigResolver }     from "../../verification/typescript/tsconfig-resolver.ts";

const SOURCE = "static-verifier";
const NOW    = () => Date.now();

export class StaticVerifier {
  private readonly _validator = new ImportGraphValidator();
  private readonly _resolver  = new TSConfigResolver();

  async verify(workspacePath: string, _signal?: AbortSignal): Promise<StageResult> {
    const t0 = NOW();
    const evidence: Evidence[] = [];

    // ── 1. Resolve tsconfig ───────────────────────────────────────────────────
    const config = this._resolver.resolve(workspacePath);
    if (!config) {
      const ev: Evidence = { kind: "STATIC_ANALYSIS_CLEAN", value: false, detail: "No tsconfig.json found", collectedAt: NOW(), source: SOURCE, ttlMs: 30_000 };
      evidence.push({ kind: "IMPORT_GRAPH_CLEAN",   value: false, detail: "No tsconfig — skipped", collectedAt: NOW(), source: SOURCE, ttlMs: 30_000 });
      evidence.push({ kind: "NO_CIRCULAR_DEPS",     value: false, detail: "No tsconfig — skipped", collectedAt: NOW(), source: SOURCE, ttlMs: 30_000 });
      evidence.push(ev);
      return this._failed("No tsconfig.json found — cannot validate import graph", t0, evidence);
    }

    // ── 2. Import graph + circular dep detection ──────────────────────────────
    let importResult: ReturnType<ImportGraphValidator["validate"]>;
    try {
      importResult = this._validator.validate(workspacePath, config.absolutePath);
    } catch (err: any) {
      const detail = `Import graph validation threw: ${err?.message ?? err}`;
      evidence.push({ kind: "IMPORT_GRAPH_CLEAN",   value: false, detail, collectedAt: NOW(), source: SOURCE, ttlMs: 30_000 });
      evidence.push({ kind: "NO_CIRCULAR_DEPS",     value: false, detail: "Not reached", collectedAt: NOW(), source: SOURCE, ttlMs: 30_000 });
      evidence.push({ kind: "STATIC_ANALYSIS_CLEAN", value: false, detail, collectedAt: NOW(), source: SOURCE, ttlMs: 30_000 });
      return this._failed(detail, t0, evidence);
    }

    // Non-circular issues
    const nonCircular = importResult.issues.filter((i) => i.kind !== "CIRCULAR");
    const importClean = nonCircular.length === 0;
    evidence.push({
      kind:        "IMPORT_GRAPH_CLEAN",
      value:       importClean,
      detail:      importClean
        ? `${importResult.filesScanned} files scanned, 0 import issues`
        : `${nonCircular.length} broken import(s): ${nonCircular[0]?.detail ?? ""}`,
      collectedAt: NOW(), source: SOURCE, ttlMs: 30_000,
    });

    // Circular dependency detection — from both issues array and circularChains
    const hasCircularIssue = importResult.issues.some((i) => i.kind === "CIRCULAR");
    const hasCircularChain = importResult.circularChains.length > 0;
    const hasCircular      = hasCircularIssue || hasCircularChain;
    evidence.push({
      kind:        "NO_CIRCULAR_DEPS",
      value:       !hasCircular,
      detail:      hasCircular
        ? `Circular dependency detected: ${importResult.circularChains[0]?.join(" → ") ?? "see issues"}`
        : "No circular dependencies",
      collectedAt: NOW(), source: SOURCE, ttlMs: 30_000,
    });

    const staticClean = importClean && !hasCircular;
    evidence.push({
      kind: "STATIC_ANALYSIS_CLEAN", value: staticClean,
      detail: staticClean ? `Static analysis clean (${importResult.filesScanned} files)` : "Static analysis failed",
      collectedAt: NOW(), source: SOURCE, ttlMs: 30_000,
    });

    if (!importClean) {
      return this._failed(`Import graph invalid: ${nonCircular[0]?.detail ?? "broken import"}`, t0, evidence);
    }
    if (hasCircular) {
      const chain = importResult.circularChains[0]?.join(" → ") ?? "see issues";
      return this._failed(`Circular dependency: ${chain}`, t0, evidence);
    }

    return Object.freeze({ stage: "STATIC" as const, passed: true, evidence: Object.freeze(evidence), failureReason: null, durationMs: NOW() - t0 });
  }

  private _failed(reason: string, t0: number, evidence: Evidence[]): StageResult {
    return Object.freeze({ stage: "STATIC" as const, passed: false, evidence: Object.freeze(evidence), failureReason: reason, durationMs: NOW() - t0 });
  }
}
