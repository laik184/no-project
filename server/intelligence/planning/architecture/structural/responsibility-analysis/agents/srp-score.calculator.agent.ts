import type {
  FileDescriptor,
  ConcernDetection,
  ResponsibilityViolation,
  SRPScore,
  ConcernTag,
} from "../types.js";
import {
  SRP_PERFECT_SCORE,
  VIOLATION_DEDUCTIONS,
  CONCERN_MIX_THRESHOLD,
} from "../types.js";

function primaryConcern(
  detection: Readonly<ConcernDetection>,
): ConcernTag | null {
  if (detection.concerns.length === 0) return null;

  const priority: readonly ConcernTag[] = [
    "DATABASE", "HTTP", "AUTHENTICATION", "BUSINESS_LOGIC",
    "ORCHESTRATION", "VALIDATION", "TRANSFORMATION",
    "CACHING", "STATE_MANAGEMENT", "FILESYSTEM",
    "SCHEDULING", "MESSAGING", "LOGGING",
    "CONFIGURATION", "RENDERING", "TESTING", "UNKNOWN",
  ];

  for (const tag of priority) {
    if ((detection.concerns as readonly string[]).includes(tag)) return tag;
  }
  return detection.concerns[0] ?? null;
}

function computeFileSRPScore(
  file:       Readonly<FileDescriptor>,
  detection:  Readonly<ConcernDetection>,
  violations: readonly ResponsibilityViolation[],
): SRPScore {
  const fileViolations = violations.filter((v) => v.file === file.path);
  let score = SRP_PERFECT_SCORE;

  for (const v of fileViolations) {
    score -= VIOLATION_DEDUCTIONS[v.severity] ?? 0;
  }

  const concernPenalty = Math.max(0, (detection.concerns.length - CONCERN_MIX_THRESHOLD) * 5);
  score -= concernPenalty;
  score = Math.max(0, score);

  return Object.freeze({
    path:           file.path,
    score,
    violationCount: fileViolations.length,
    concernCount:   detection.concerns.length,
    primaryConcern: primaryConcern(detection),
    isCompliant:    fileViolations.length === 0,
  });
}

export function calculateSRPScores(
  files:      readonly FileDescriptor[],
  detections: readonly ConcernDetection[],
  violations: readonly ResponsibilityViolation[],
): readonly SRPScore[] {
  if (!Array.isArray(files) || files.length === 0) {
    return Object.freeze<SRPScore[]>([]);
  }

  const detectionMap = new Map(detections.map((d) => [d.path, d]));

  const scores = files.map((file) => {
    const detection = detectionMap.get(file.path);
    if (!detection) {
      return Object.freeze({
        path:           file.path,
        score:          SRP_PERFECT_SCORE,
        violationCount: 0,
        concernCount:   0,
        primaryConcern: null,
        isCompliant:    true,
      });
    }
    return computeFileSRPScore(file, detection, violations);
  });

  return Object.freeze(scores);
}

export function overallSRPScore(scores: readonly SRPScore[]): number {
  if (scores.length === 0) return SRP_PERFECT_SCORE;
  const total = scores.reduce((sum, s) => sum + s.score, 0);
  return Math.round(total / scores.length);
}

export function compliantFileCount(scores: readonly SRPScore[]): number {
  return scores.filter((s) => s.isCompliant).length;
}

export function lowestSRPScore(scores: readonly SRPScore[]): SRPScore | null {
  if (scores.length === 0) return null;
  return scores.reduce(
    (min, s) => (s.score < min.score ? s : min),
    scores[0]!,
  );
}
