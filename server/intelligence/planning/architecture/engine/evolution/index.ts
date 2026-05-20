export type {
  ArchitecturePattern,
  RiskLevel,
  AnalysisViolation,
  ArchitectureAnalysisReport,
  PatternDetectionResult,
  EvolutionStrategy,
  MigrationPlan,
  RiskAssessment,
  TradeoffEvaluation,
  ArchitectureEvolutionPlan,
  EvolutionState,
  PatternMetrics,
  ScoreBreakdown,
} from "./types.js";

export {
  runArchitectureEvolution,
  getEvolutionState,
  getLastPlan,
  clearEvolutionState,
} from "./orchestrator.js";
