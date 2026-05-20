/**
 * execution-scorer.ts
 *
 * Scores execution quality across multiple dimensions.
 * Used by the reflection engine and autonomous loop to calibrate strategy.
 */

export interface ExecutionMetrics {
  stepsUsed:     number;
  maxSteps:      number;
  durationMs:    number;
  maxDurationMs: number;
  errorCount:    number;
  retryCount:    number;
  agentCount:    number;
  confidence:    number;
  outcome:       "success" | "partial" | "failure" | "timeout" | "blocked";
}

export interface ExecutionScore {
  overall:     number;    // 0.0–1.0
  efficiency:  number;    // steps + time efficiency
  reliability: number;    // error rate, retries
  quality:     number;    // confidence + outcome
  grade:       "A" | "B" | "C" | "D" | "F";
  explanation: string;
}

// ── Dimension scorers ─────────────────────────────────────────────────────────

function efficiencyScore(m: ExecutionMetrics): number {
  const stepEff = m.maxSteps > 0 ? 1 - (m.stepsUsed / m.maxSteps) * 0.5 : 1.0;
  const timeEff = m.maxDurationMs > 0
    ? Math.max(0, 1 - (m.durationMs / m.maxDurationMs))
    : 1.0;
  return Math.min(1.0, (stepEff + timeEff) / 2);
}

function reliabilityScore(m: ExecutionMetrics): number {
  const errorPenalty = Math.min(0.8, m.errorCount * 0.15);
  const retryPenalty = Math.min(0.4, m.retryCount * 0.10);
  return Math.max(0, 1.0 - errorPenalty - retryPenalty);
}

function qualityScore(m: ExecutionMetrics): number {
  const outcomeScores: Record<ExecutionMetrics["outcome"], number> = {
    success:  1.00,
    partial:  0.60,
    failure:  0.15,
    timeout:  0.10,
    blocked:  0.20,
  };
  return (outcomeScores[m.outcome] * 0.7) + (m.confidence * 0.3);
}

function toGrade(score: number): ExecutionScore["grade"] {
  if (score >= 0.90) return "A";
  if (score >= 0.75) return "B";
  if (score >= 0.60) return "C";
  if (score >= 0.40) return "D";
  return "F";
}

// ── Weights ───────────────────────────────────────────────────────────────────

const WEIGHTS = { quality: 0.50, reliability: 0.30, efficiency: 0.20 };

// ── Scorer ────────────────────────────────────────────────────────────────────

export function scoreExecution(m: ExecutionMetrics): ExecutionScore {
  const efficiency  = efficiencyScore(m);
  const reliability = reliabilityScore(m);
  const quality     = qualityScore(m);

  const overall = (
    quality     * WEIGHTS.quality     +
    reliability * WEIGHTS.reliability +
    efficiency  * WEIGHTS.efficiency
  );

  const grade = toGrade(overall);

  const parts: string[] = [];
  if (quality     < 0.5)  parts.push(`poor outcome (${m.outcome})`);
  if (reliability < 0.6)  parts.push(`${m.errorCount} errors, ${m.retryCount} retries`);
  if (efficiency  < 0.5)  parts.push(`used ${m.stepsUsed}/${m.maxSteps} steps`);
  if (parts.length === 0) parts.push("execution met all quality thresholds");

  return {
    overall: Math.round(overall * 100) / 100,
    efficiency:  Math.round(efficiency  * 100) / 100,
    reliability: Math.round(reliability * 100) / 100,
    quality:     Math.round(quality     * 100) / 100,
    grade,
    explanation: parts.join("; "),
  };
}

// ── Trend analysis (across multiple runs) ────────────────────────────────────

export interface ScoreTrend {
  improving:     boolean;
  stagnating:    boolean;
  degrading:     boolean;
  avgScore:      number;
  recommendation:string;
}

export function analyzeTrend(scores: number[]): ScoreTrend {
  if (scores.length < 2) {
    return { improving: false, stagnating: true, degrading: false, avgScore: scores[0] ?? 0, recommendation: "Need more data" };
  }

  const avg    = scores.reduce((s, v) => s + v, 0) / scores.length;
  const recent = scores.slice(-3);
  const older  = scores.slice(0, -3);
  const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
  const olderAvg  = older.length > 0 ? older.reduce((s, v) => s + v, 0) / older.length : recentAvg;

  const delta = recentAvg - olderAvg;
  const improving  = delta > 0.05;
  const degrading  = delta < -0.05;
  const stagnating = !improving && !degrading;

  const recommendation = improving
    ? "Keep current strategy — scores improving"
    : degrading
    ? "Strategy change needed — scores declining"
    : "Consider adding memory injection to break plateau";

  return { improving, stagnating, degrading, avgScore: avg, recommendation };
}
