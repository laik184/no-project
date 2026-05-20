export type {
  ArchitectureType,
  ScoreLevel,
  PatternAnalysisInput,
  PatternAnalysisState,
  ArchitectureClassification,
  LayeringReport,
  ModularityReport,
  MicroserviceReport,
  CouplingReport,
  PatternScoreReport,
  ArchitecturePatternReport,
} from "./types.js";

export { detectArchitecturePatterns, getAnalysisState, resetPatternDetection } from "./orchestrator.js";
