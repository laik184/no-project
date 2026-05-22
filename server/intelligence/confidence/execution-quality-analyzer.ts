/**
 * execution-quality-analyzer.ts
 *
 * Analyses an agent execution and returns ExecutionQualityDimensions.
 * Pure computation — no store mutations, no bus emissions.
 */

import type { ExecutionQualityDimensions } from "./confidence-types.ts";

// ── Input contract ────────────────────────────────────────────────────────────

export interface QualityAnalysisInput {
  // Verification
  verificationPassed:   boolean;
  verificationChecks: {
    runtime:  boolean;
    typescript: boolean;
    packages: boolean;
    preview:  boolean;
  };

  // Runtime stability
  runtimeCrashes:    number;
  recoveryTriggers:  number;
  retryCount:        number;
  timeouts:          number;

  // Code quality signals
  lintErrors:        number;
  typeErrors:        number;
  testsFailed:       number;
  filesWritten:      number;
  avgFileSizeLines:  number;   // proxy for modularity

  // Policy compliance
  policyViolations:  number;
  maxAllowedViolations: number;

  // Modularity signals
  circularDeps:      number;
  avgImportsPerFile: number;
}

// ── Dimension scorers ─────────────────────────────────────────────────────────

function scoreVerification(input: QualityAnalysisInput): number {
  if (input.verificationPassed) return 1.0;

  const checks = input.verificationChecks;
  const passed = [checks.runtime, checks.typescript, checks.packages, checks.preview]
    .filter(Boolean).length;
  return passed / 4;
}

function scoreRuntimeStability(input: QualityAnalysisInput): number {
  let score = 1.0;
  score -= Math.min(input.runtimeCrashes   * 0.20, 0.60);
  score -= Math.min(input.recoveryTriggers * 0.10, 0.30);
  score -= Math.min(input.retryCount       * 0.05, 0.20);
  score -= Math.min(input.timeouts         * 0.10, 0.30);
  return Math.max(0, score);
}

function scoreCodeQuality(input: QualityAnalysisInput): number {
  let score = 1.0;

  // Lint errors — diminishing penalty
  if (input.lintErrors > 0) {
    score -= Math.min(input.lintErrors / 50, 0.40);
  }
  // Type errors — harder penalty
  if (input.typeErrors > 0) {
    score -= Math.min(input.typeErrors / 20, 0.50);
  }
  // Test failures
  if (input.testsFailed > 0) {
    score -= Math.min(input.testsFailed / 10, 0.30);
  }

  return Math.max(0, score);
}

function scorePolicyCompliance(input: QualityAnalysisInput): number {
  if (input.policyViolations === 0) return 1.0;
  const ratio = input.policyViolations / Math.max(input.maxAllowedViolations, 1);
  return Math.max(0, 1 - ratio);
}

function scoreModularity(input: QualityAnalysisInput): number {
  let score = 1.0;

  // Penalise circular dependencies
  score -= Math.min(input.circularDeps * 0.15, 0.45);

  // Penalise extremely large average file size (proxy for poor decomposition)
  if (input.avgFileSizeLines > 250) {
    const excess = input.avgFileSizeLines - 250;
    score -= Math.min(excess / 500, 0.30);
  }

  // Penalise very high avg imports per file (likely tight coupling)
  if (input.avgImportsPerFile > 15) {
    score -= Math.min((input.avgImportsPerFile - 15) / 20, 0.20);
  }

  return Math.max(0, score);
}

// ── Main analyser ─────────────────────────────────────────────────────────────

export function analyzeExecutionQuality(
  input: QualityAnalysisInput,
): ExecutionQualityDimensions {
  return {
    verificationSuccess: scoreVerification(input),
    runtimeStability:    scoreRuntimeStability(input),
    codeQuality:         scoreCodeQuality(input),
    policyCompliance:    scorePolicyCompliance(input),
    modularity:          scoreModularity(input),
  };
}

// ── Default dims (used when full analysis data is unavailable) ────────────────

export function defaultQualityDimensions(verificationPassed: boolean): ExecutionQualityDimensions {
  const base = verificationPassed ? 0.70 : 0.30;
  return {
    verificationSuccess: verificationPassed ? 1.0 : 0.0,
    runtimeStability:    base,
    codeQuality:         base,
    policyCompliance:    1.0,
    modularity:          0.70,
  };
}
