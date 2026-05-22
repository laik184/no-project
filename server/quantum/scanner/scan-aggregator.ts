/**
 * scan-aggregator.ts
 *
 * Merges all worker results into a final deterministic ScanReport.
 *
 * Rules:
 *   ✅ deterministic ordering (severity → confidence → filePath → line)
 *   ✅ deduplication by content fingerprint
 *   ✅ severity-ranked risk summary
 *   ✅ confidence scoring across all workers
 *   ✅ partial-failure collection (failed workers → PartialFailure[])
 */

import type {
  ScanFinding, ScanReport, CircularRef,
  RiskSummary, PartialFailure, ScanOptions,
} from "./types/scan.types.ts";
import type { WorkerResult } from "./types/worker.types.ts";

// ── Severity order ────────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<ScanFinding["severity"], number> = {
  critical: 0,
  high:     1,
  medium:   2,
  low:      3,
  info:     4,
};

// ── Public API ────────────────────────────────────────────────────────────────

export interface AggregatorInput {
  scanId:        string;
  opts:          ScanOptions;
  startedAt:     number;
  workerResults: WorkerResult[];
  settled:       PromiseSettledResult<WorkerResult>[];
  partitionCount: number;
  minConfidence:  number;
}

/**
 * Aggregate all worker results into a single coherent ScanReport.
 * Always returns a report — failures are captured in partialFailures.
 */
export function aggregateResults(input: AggregatorInput): ScanReport {
  const completedAt = Date.now();
  const {
    scanId, opts, startedAt, workerResults, settled,
    partitionCount, minConfidence,
  } = input;

  // ── Collect partial failures ───────────────────────────────────────────────
  const partialFailures: PartialFailure[] = [];
  for (const s of settled) {
    if (s.status === "rejected") {
      partialFailures.push({
        partitionId: "unknown",
        workerIndex: -1,
        error:       (s.reason as Error)?.message ?? String(s.reason),
        fileCount:   0,
      });
    }
  }

  // ── Merge findings ────────────────────────────────────────────────────────
  const allFindings: ScanFinding[] = [];
  const allCircular: CircularRef[] = [];
  let   totalFiles   = 0;
  let   totalWorkers = 0;

  for (const result of workerResults) {
    totalFiles   += result.filesProcessed;
    totalWorkers++;
    allFindings.push(...result.findings);
    allCircular.push(...result.circularRefs);
  }

  // ── Deduplicate findings ───────────────────────────────────────────────────
  const deduped = deduplicateFindings(allFindings, minConfidence);

  // ── Sort deterministically ────────────────────────────────────────────────
  const sorted = sortFindings(deduped);

  // ── Deduplicate circular refs ─────────────────────────────────────────────
  const uniqueCircular = deduplicateCircular(allCircular);

  // ── Build risk summary ────────────────────────────────────────────────────
  const riskSummary = buildRiskSummary(sorted);

  // ── Compute overall confidence ────────────────────────────────────────────
  const confidenceScore = computeOverallConfidence(workerResults);

  return {
    scanId,
    projectId:       opts.projectId,
    trigger:         opts.trigger,
    startedAt,
    completedAt,
    durationMs:      completedAt - startedAt,
    filesScanned:    totalFiles,
    partitionCount,
    workerCount:     totalWorkers,
    findings:        sorted,
    circularImports: uniqueCircular,
    riskSummary,
    confidenceScore,
    partialFailures,
    success:         partialFailures.length < settled.length, // at least 1 worker succeeded
  };
}

// ── Deduplication ─────────────────────────────────────────────────────────────

function deduplicateFindings(
  findings:      ScanFinding[],
  minConfidence: number,
): ScanFinding[] {
  const seen  = new Set<string>();
  const result: ScanFinding[] = [];

  for (const f of findings) {
    if (f.confidence < minConfidence) continue;

    // Fingerprint: type + filePath + line + first 80 chars of message
    const key = `${f.type}::${f.filePath}::${f.line ?? 0}::${f.message.slice(0, 80)}`;
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(f);
  }

  return result;
}

function deduplicateCircular(refs: CircularRef[]): CircularRef[] {
  const seen = new Set<string>();
  return refs.filter(r => {
    const key = [...r.cycle].sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Sorting ───────────────────────────────────────────────────────────────────

function sortFindings(findings: ScanFinding[]): ScanFinding[] {
  return [...findings].sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;

    const conf = b.confidence - a.confidence;
    if (Math.abs(conf) > 0.05) return conf;

    const file = a.filePath.localeCompare(b.filePath);
    if (file !== 0) return file;

    return (a.line ?? 0) - (b.line ?? 0);
  });
}

// ── Risk summary ──────────────────────────────────────────────────────────────

function buildRiskSummary(findings: ScanFinding[]): RiskSummary {
  const s: RiskSummary = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };
  for (const f of findings) {
    s[f.severity]++;
    s.total++;
  }
  return s;
}

// ── Confidence ────────────────────────────────────────────────────────────────

function computeOverallConfidence(results: WorkerResult[]): number {
  if (results.length === 0) return 0;
  const scores = results.map(r => r.confidenceScore);
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
