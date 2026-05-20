import type { ReportStatus } from "../types.js";

// ── Score-to-status mapping (single source of truth) ─────────────────────────
//
// Both section.generator.agent and formatter.agent use the same thresholds
// to convert a 0-100 score into a ReportStatus. Centralising here prevents
// the thresholds from drifting between the two call sites.

const STATUS_THRESHOLD_CRITICAL = 60;
const STATUS_THRESHOLD_WARNING  = 80;

export function scoreToStatus(score: number): ReportStatus {
  if (score < STATUS_THRESHOLD_CRITICAL) return "CRITICAL";
  if (score < STATUS_THRESHOLD_WARNING)  return "WARNING";
  return "GOOD";
}
