/**
 * hallucination-detector.ts
 *
 * Analyses agent execution evidence for hallucination signals.
 * Returns a list of HallucinationSignal objects + composite risk score.
 * Pure analysis — no store mutations, no bus emissions.
 */

import type { HallucinationSignal, HallucinationSignalType } from "./confidence-types.ts";
import { HALLUCINATION } from "./confidence-thresholds.ts";

// ── Input contract ────────────────────────────────────────────────────────────

export interface HallucinationAnalysisInput {
  agentId:            string;
  runId:              string;
  claimedFiles:       string[];       // files the agent claims to have written
  actualFiles:        string[];       // files that actually exist on disk
  claimedSuccess:     boolean;        // agent claimed task_complete
  verificationPassed: boolean;        // real verification result
  importedModules:    string[];       // modules the agent imported
  resolvedModules:    string[];       // modules that actually resolve
  claimedExports:     string[];       // exports the agent claims exist
  actualExports:      string[];       // exports that actually exist
  invalidPaths:       string[];       // paths referenced but not found
  buildPassed:        boolean;
  runtimePassed:      boolean;
}

export interface HallucinationAnalysisResult {
  signals:         HallucinationSignal[];
  compositeRisk:   number;    // 0–1
  hardBlock:       boolean;   // true if any CRITICAL signal found
}

// ── Signal builders ───────────────────────────────────────────────────────────

function signal(
  type:     HallucinationSignalType,
  detail:   string,
  severity: HallucinationSignal["severity"],
): HallucinationSignal {
  return {
    type,
    detail,
    severity,
    penalty: HALLUCINATION.PENALTY_BY_SEVERITY[severity],
  };
}

// ── Main detection function ───────────────────────────────────────────────────

export function detectHallucinations(
  input: HallucinationAnalysisInput,
): HallucinationAnalysisResult {
  const signals: HallucinationSignal[] = [];

  // 1. Fake file claims — agent says it wrote files that don't exist
  const missingFiles = input.claimedFiles.filter(
    f => !input.actualFiles.includes(f),
  );
  if (missingFiles.length > 0) {
    const severity = missingFiles.length >= 3 ? "CRITICAL" : "HIGH";
    signals.push(signal(
      "FAKE_FILE_CLAIM",
      `Agent claimed ${missingFiles.length} file(s) that do not exist: ${missingFiles.slice(0, 3).join(", ")}`,
      severity,
    ));
  }

  // 2. Fake build success — claimed success but build failed
  if (input.claimedSuccess && !input.buildPassed && !input.verificationPassed) {
    signals.push(signal(
      "FAKE_BUILD_SUCCESS",
      "Agent claimed task_complete but build verification failed",
      "CRITICAL",
    ));
  }

  // 3. Fake runtime success — claimed success but runtime failed
  if (input.claimedSuccess && !input.runtimePassed && !input.verificationPassed) {
    signals.push(signal(
      "FAKE_RUNTIME_SUCCESS",
      "Agent claimed task_complete but runtime verification failed",
      "HIGH",
    ));
  }

  // 4. Invalid imports — modules imported but not resolvable
  const badImports = input.importedModules.filter(
    m => !input.resolvedModules.includes(m),
  );
  if (badImports.length > 0) {
    signals.push(signal(
      "INVALID_IMPORT",
      `${badImports.length} unresolvable import(s): ${badImports.slice(0, 3).join(", ")}`,
      badImports.length >= 3 ? "HIGH" : "MEDIUM",
    ));
  }

  // 5. Missing exports — agent claims exports that don't exist
  const missingExports = input.claimedExports.filter(
    e => !input.actualExports.includes(e),
  );
  if (missingExports.length > 0) {
    signals.push(signal(
      "MISSING_EXPORT",
      `${missingExports.length} claimed export(s) not found`,
      "MEDIUM",
    ));
  }

  // 6. Invalid paths referenced in code
  if (input.invalidPaths.length > 0) {
    signals.push(signal(
      "INVALID_PATH",
      `${input.invalidPaths.length} invalid path reference(s) found`,
      input.invalidPaths.length >= 5 ? "HIGH" : "LOW",
    ));
  }

  // 7. Fake completion — claimed complete but verification never passed
  if (input.claimedSuccess && !input.verificationPassed && signals.length === 0) {
    signals.push(signal(
      "FAKE_COMPLETION",
      "Agent claimed completion but no verification evidence exists",
      "HIGH",
    ));
  }

  // Composite risk = capped sum of penalties
  const compositeRisk = Math.min(
    signals.reduce((sum, s) => sum + s.penalty, 0),
    1.0,
  );

  const hardBlock = compositeRisk >= HALLUCINATION.HARD_BLOCK_THRESHOLD ||
    signals.some(s => s.severity === "CRITICAL");

  return { signals, compositeRisk, hardBlock };
}

// ── Quick check helpers ───────────────────────────────────────────────────────

export function hasHallucinationRisk(risk: number): boolean {
  return risk >= HALLUCINATION.WARNING_THRESHOLD;
}

export function exceedsDegradedThreshold(risk: number): boolean {
  return risk >= HALLUCINATION.DEGRADED_THRESHOLD;
}

export function exceedsBlockThreshold(risk: number): boolean {
  return risk >= HALLUCINATION.HARD_BLOCK_THRESHOLD;
}
