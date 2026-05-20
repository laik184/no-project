export type ScoreValue = number;

export interface ScoreBreakdown {
  readonly severity: ScoreValue;
  readonly impact: ScoreValue;
  readonly risk: ScoreValue;
}
