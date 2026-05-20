export type {
  FileRole,
  ViolationSeverity,
  ViolationType,
  ValidationPhase,
  LayerDefinition,
  FileNode,
  ImportEdge,
  Violation,
  LayerReport,
  HVPComplianceReport,
  ProjectStructure,
  HVPAnalysisSession,
  IntermediateImportGraph,
  ValidatorResult,
} from "./types.js";

export {
  HVP_DEFAULT_LAYERS,
  SCORE_DEDUCTIONS,
  MAX_REPORT_VIOLATIONS,
} from "./types.js";

export {
  analyzeHVP,
  analyzeMultiple,
  getLastReport,
  getReportHistory,
  resetAnalyzer,
} from "./orchestrator.js";
