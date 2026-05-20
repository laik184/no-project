export type ArchitecturePattern = "monolith" | "layered" | "modular" | "microservices";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface AnalysisViolation {
  readonly id: string;
  readonly type: string;
  readonly severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  readonly message: string;
  readonly file?: string;
  readonly from?: string;
  readonly to?: string;
  readonly source?: string;
}

export interface ArchitectureAnalysisReport {
  readonly reportId: string;
  readonly analyzedAt: number;
  readonly totalViolations: number;
  readonly violations: readonly AnalysisViolation[];
  readonly metadata?: Readonly<{
    serviceCount?: number;
    moduleCount?: number;
    teamSize?: number;
    scale?: "low" | "medium" | "high";
    throughputRps?: number;
  }>;
}

export interface PatternDetectionResult {
  readonly currentPattern: ArchitecturePattern;
  readonly antiPatterns: readonly string[];
  readonly confidence: number;
}

export interface EvolutionStrategy {
  readonly targetPattern: ArchitecturePattern;
  readonly strategy: string;
  readonly rationale: readonly string[];
}

export interface MigrationPlan {
  readonly migrationSteps: readonly string[];
}

export interface RiskAssessment {
  readonly riskLevel: RiskLevel;
  readonly risks: readonly string[];
}

export interface TradeoffEvaluation {
  readonly tradeoffs: readonly string[];
}

export interface ArchitectureEvolutionPlan {
  readonly currentArchitecture: ArchitecturePattern;
  readonly targetArchitecture: ArchitecturePattern;
  readonly strategy: string;
  readonly migrationSteps: readonly string[];
  readonly risks: readonly string[];
  readonly tradeoffs: readonly string[];
  readonly score: number;
}

export interface EvolutionState {
  readonly currentPattern: string;
  readonly targetPattern: string;
  readonly riskLevel: RiskLevel;
  readonly stepsGenerated: number;
}

export interface PatternMetrics {
  readonly serviceCount: number;
  readonly moduleCount: number;
  readonly violationDensity: number;
  readonly cycleSignals: number;
  readonly couplingSignals: number;
}

export interface ScoreBreakdown {
  readonly feasibility: number;
  readonly riskPenalty: number;
  readonly migrationComplexityPenalty: number;
  readonly maintainabilityGain: number;
}
