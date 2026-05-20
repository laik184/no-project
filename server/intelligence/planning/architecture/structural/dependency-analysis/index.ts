export type {
  AnalysisPhase,
  CouplingRisk,
  EdgeKind,
  SourceModule,
  DependencyInput,
  GraphNode,
  GraphEdge,
  DependencyGraph,
  CycleGroup,
  CouplingScore,
  DependencyCluster,
  DependencyMetrics,
  DependencyAnalysisResult,
  DependencySession,
} from "./types.js";

export {
  MAX_MODULES,
  MAX_CYCLES_REPORTED,
  INSTABILITY_HIGH_RISK,
  INSTABILITY_MED_RISK,
  LARGE_CYCLE_THRESHOLD,
  HEALTH_SCORE_START,
  HEALTH_DEDUCTIONS,
} from "./types.js";

export {
  analyzeDependencies,
  analyzeMultiple,
  getLastResult,
  getResultHistory,
  resetAnalyzer,
} from "./orchestrator.js";
