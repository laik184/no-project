import type {
  ComponentTestMapping,
  CoverageScoreBreakdown,
  CriticalComponentResult,
  OverallSeverity,
  PresenceResult,
  TestFileDescriptor,
} from "../types.js";

const WEIGHT_PRESENCE = 0.20;
const WEIGHT_MAPPING = 0.40;
const WEIGHT_CRITICAL_COVERAGE = 0.30;
const WEIGHT_TEST_QUALITY = 0.10;

const MAX_SCORE = 100;
const MIN_SCORE = 0;

const TESTS_PER_FILE_GOOD = 5;
const TESTS_PER_FILE_EXCELLENT = 10;

const SEVERITY_NONE_THRESHOLD = 90;
const SEVERITY_LOW_THRESHOLD = 75;
const SEVERITY_MEDIUM_THRESHOLD = 55;
const SEVERITY_HIGH_THRESHOLD = 35;

export function computePresenceScore(result: PresenceResult): number {
  if (!result.hasTests) return 0;
  if (result.testToSourceRatio >= 0.5) return 100;
  if (result.testToSourceRatio >= 0.3) return 75;
  if (result.testToSourceRatio >= 0.1) return 45;
  return 20;
}

export function computeMappingScore(
  mappings: readonly ComponentTestMapping[]
): number {
  if (mappings.length === 0) return 100;
  const tested = mappings.filter((m) => m.isTested).length;
  return Math.round((tested / mappings.length) * MAX_SCORE);
}

export function computeCriticalCoverageScore(
  criticals: readonly CriticalComponentResult[]
): number {
  if (criticals.length === 0) return 100;
  const tested = criticals.filter((c) => c.isTested).length;
  return Math.round((tested / criticals.length) * MAX_SCORE);
}

export function computeTestQualityScore(
  testFiles: readonly TestFileDescriptor[]
): number {
  if (testFiles.length === 0) return 0;
  const totalTests = testFiles.reduce((acc, f) => acc + f.testCount, 0);
  const avg = totalTests / testFiles.length;
  if (avg >= TESTS_PER_FILE_EXCELLENT) return 100;
  if (avg >= TESTS_PER_FILE_GOOD) return 70;
  if (avg >= 2) return 40;
  if (avg >= 1) return 20;
  return 5;
}

function weightedOverall(
  breakdown: Omit<CoverageScoreBreakdown, "overall">
): number {
  return Math.round(
    Math.max(
      MIN_SCORE,
      Math.min(
        MAX_SCORE,
        breakdown.presenceScore * WEIGHT_PRESENCE +
          breakdown.mappingScore * WEIGHT_MAPPING +
          breakdown.criticalCoverageScore * WEIGHT_CRITICAL_COVERAGE +
          breakdown.testQualityScore * WEIGHT_TEST_QUALITY
      )
    )
  );
}

export function deriveSeverity(score: number): OverallSeverity {
  if (score >= SEVERITY_NONE_THRESHOLD) return "NONE";
  if (score >= SEVERITY_LOW_THRESHOLD) return "LOW";
  if (score >= SEVERITY_MEDIUM_THRESHOLD) return "MEDIUM";
  if (score >= SEVERITY_HIGH_THRESHOLD) return "HIGH";
  return "CRITICAL";
}

export function buildCoverageBreakdown(
  presenceResult: PresenceResult,
  mappings: readonly ComponentTestMapping[],
  criticals: readonly CriticalComponentResult[],
  testFiles: readonly TestFileDescriptor[]
): CoverageScoreBreakdown {
  const presenceScore = computePresenceScore(presenceResult);
  const mappingScore = computeMappingScore(mappings);
  const criticalCoverageScore = computeCriticalCoverageScore(criticals);
  const testQualityScore = computeTestQualityScore(testFiles);

  const partial = {
    presenceScore,
    mappingScore,
    criticalCoverageScore,
    testQualityScore,
  };
  const overall = weightedOverall(partial);

  return Object.freeze({ ...partial, overall });
}
