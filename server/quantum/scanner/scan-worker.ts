/**
 * scan-worker.ts
 *
 * Isolated worker that analyses a single file partition.
 * Coordinates all sub-scanners and aggregates their output into WorkerResult.
 *
 * Rules:
 *   ✅ read-only — never mutates files
 *   ✅ no shared mutable state
 *   ✅ timeout-safe via AbortSignal check between files
 *   ✅ partial failure recovery — one bad file never aborts the whole partition
 */

import fs from "fs/promises";
import { scanImports, detectCircularImports } from "./import-scanner.ts";
import { scanDependencies }                   from "./dependency-scanner.ts";
import { scanBugPatterns, scanRuntimeRisks }  from "./bug-pattern-scanner.ts";
import type { WorkerInput, WorkerResult, ImportGraphEntry } from "./types/worker.types.ts";
import type { ScanFinding, CircularRef }      from "./types/scan.types.ts";

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run all scanners over the assigned file partition.
 * Always resolves — errors are captured in result.error.
 */
export async function runWorker(input: WorkerInput): Promise<WorkerResult> {
  const t0 = Date.now();

  const allFindings:    ScanFinding[]      = [];
  const allImports:     ImportGraphEntry[] = [];
  const allCircular:    CircularRef[]      = [];
  let   filesProcessed = 0;
  let   errorCount     = 0;

  for (const file of input.files) {
    // Honour cancellation between files
    if (input.signal?.aborted) break;

    try {
      const content = await readFileSafe(file.path);
      if (content === null) {
        errorCount++;
        continue;
      }

      const isCode = /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file.ext);

      if (isCode) {
        // ── Import scanning ─────────────────────────────────────────────────
        const { imports, findings: importFindings } = scanImports(file.path, content);
        allImports.push(...imports);
        allFindings.push(...importFindings);

        // ── Dependency scanning ────────────────────────────────────────────
        const depFindings = scanDependencies(file.path, content, file.category, imports);
        allFindings.push(...depFindings);

        // ── Bug pattern scanning ───────────────────────────────────────────
        const bugFindings     = scanBugPatterns(file.path, content);
        const runtimeFindings = scanRuntimeRisks(file.path, content);
        allFindings.push(...bugFindings, ...runtimeFindings);
      }

      filesProcessed++;
    } catch (err) {
      errorCount++;
      // Non-fatal: log and continue
      console.warn(
        `[scan-worker:${input.workerIndex}] Error scanning ${file.path}:`,
        (err as Error).message,
      );
    }
  }

  // ── Cross-file circular import detection ──────────────────────────────────
  try {
    const circular = detectCircularImports(allImports);
    allCircular.push(...circular);

    // Elevate circular refs to findings
    for (const ref of circular) {
      allFindings.push({
        id:         crypto.randomUUID(),
        type:       "circular_import",
        severity:   "high",
        filePath:   ref.cycle[0] ?? "unknown",
        message:    `Circular import cycle detected (${ref.cycle.length} files)`,
        evidence:   ref.cycle.join(" → "),
        confidence: 0.9,
      });
    }
  } catch {
    // Non-fatal — circular detection is best-effort
  }

  const durationMs       = Date.now() - t0;
  const confidenceScore  = computeConfidence(filesProcessed, errorCount, allFindings.length);

  return {
    partitionId:     input.partitionId,
    workerIndex:     input.workerIndex,
    findings:        allFindings,
    importGraph:     allImports,
    circularRefs:    allCircular,
    durationMs,
    filesProcessed,
    errorCount,
    confidenceScore,
    success:         true,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

function computeConfidence(
  processed: number,
  errors:    number,
  findings:  number,
): number {
  if (processed === 0) return 0;
  const errorRate   = errors / (processed + errors);
  const base        = 1 - errorRate;
  // Slightly reduce confidence when many findings (could be noise)
  const noisePenalty = Math.min(findings / 1000, 0.1);
  return Math.max(0, Math.min(1, base - noisePenalty));
}
