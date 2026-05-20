import type { QualityGrade } from "../types.js";

// ── Grade thresholds (named constants — no magic numbers) ─────────────────────

const GRADE_A_MIN = 90;
const GRADE_B_MIN = 75;
const GRADE_C_MIN = 60;
const GRADE_D_MIN = 40;

export function classifyQualityGrade(score: number): QualityGrade {
  if (score >= GRADE_A_MIN) return "A";
  if (score >= GRADE_B_MIN) return "B";
  if (score >= GRADE_C_MIN) return "C";
  if (score >= GRADE_D_MIN) return "D";
  return "F";
}
