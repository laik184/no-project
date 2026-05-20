import type { Issue, Severity } from '../types.ts';

const SEVERITY_PENALTY: Record<Severity, number> = {
  low: 0.05,
  medium: 0.15,
  high: 0.30,
  critical: 0.50,
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function penaltyFromIssues(issues: Issue[]): number {
  const total = issues.reduce((sum, i) => sum + (SEVERITY_PENALTY[i.severity] ?? 0), 0);
  return clamp(total, 0, 1);
}

export function scoreFromPenalty(penalty: number): number {
  return clamp(1 - penalty, 0, 1);
}

export function retryDecay(baseScore: number, attempt: number): number {
  return clamp(baseScore * Math.pow(0.9, attempt - 1), 0, 1);
}

export function confidenceFromHistory(scores: number[]): number {
  if (scores.length === 0) return 0;
  const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
  const latest = scores[scores.length - 1];
  return clamp(avg * 0.4 + latest * 0.6, 0, 1);
}

export function qualityGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 0.9) return 'A';
  if (score >= 0.75) return 'B';
  if (score >= 0.60) return 'C';
  if (score >= 0.40) return 'D';
  return 'F';
}
