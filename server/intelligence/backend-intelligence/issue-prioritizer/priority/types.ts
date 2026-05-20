export type SeverityLabel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface Issue {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly securityRisk?: number;
  readonly dataLossRisk?: number;
  readonly systemFailureRisk?: number;
  readonly affectedUsers?: number;
  readonly performanceDegradation?: number;
  readonly scalabilityRisk?: number;
  readonly runtimeBreaking?: boolean;
  readonly deploymentBlocker?: boolean;
  readonly productionRisk?: number;
}

export interface AnalysisOutput {
  readonly issues: readonly Issue[];
}

export interface ScoredIssue {
  readonly id: string;
  readonly severityLabel: SeverityLabel;
  readonly severity: number;
  readonly impact: number;
  readonly urgency: number;
  readonly finalScore: number;
}

export interface PriorityState {
  readonly issues: readonly Issue[];
  readonly scored: readonly ScoredIssue[];
  readonly sorted: readonly ScoredIssue[];
}

export interface PriorityResult {
  readonly sortedIssues: readonly ScoredIssue[];
}
