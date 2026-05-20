import type { PresenceResult, TestFileDescriptor } from "../types.js";
import { deduplicateFrameworks } from "../utils/test-pattern.matcher.util.js";

const RATIO_EXCELLENT = 0.5;
const RATIO_GOOD = 0.3;
const RATIO_MINIMAL = 0.1;

export function detectPresence(
  testFiles: readonly TestFileDescriptor[],
  totalComponents: number
): PresenceResult {
  const hasTests = testFiles.length > 0;
  const frameworks = deduplicateFrameworks(testFiles);

  let testToSourceRatio = 0;
  if (totalComponents > 0 && testFiles.length > 0) {
    testToSourceRatio =
      Math.round((testFiles.length / totalComponents) * 100) / 100;
  }

  return Object.freeze({
    hasTests,
    totalTestFiles: testFiles.length,
    frameworks,
    testToSourceRatio,
  });
}

export function computePresenceScore(result: PresenceResult): number {
  if (!result.hasTests) return 0;
  if (result.testToSourceRatio >= RATIO_EXCELLENT) return 100;
  if (result.testToSourceRatio >= RATIO_GOOD) return 75;
  if (result.testToSourceRatio >= RATIO_MINIMAL) return 45;
  return 20;
}
