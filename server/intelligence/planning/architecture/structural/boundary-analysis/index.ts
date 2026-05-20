export type {
  HvpLayer,
  NodeRole,
  ImportType,
  BoundaryViolationType,
  ViolationSeverity,
  ValidationPhase,
  ArchNode,
  ArchEdge,
  ArchitectureGraph,
  BoundaryViolation,
  LayerValidationResult,
  DirectionValidationResult,
  DomainLeakageResult,
  BoundaryReport,
  BoundarySession,
  IntermediateViolations,
} from "./types.js";

export {
  BOUNDARY_SCORE_START,
  MAX_BOUNDARY_VIOLATIONS,
  BOUNDARY_DEDUCTIONS,
  HVP_ALLOWED_DIRECTIONS,
  FORBIDDEN_DOMAIN_PAIRS,
  INFRASTRUCTURE_DOMAINS,
} from "./types.js";

export {
  analyzeBoundaries,
  analyzeMultiple,
  getLastReport,
  getReportHistory,
  resetAnalyzer,
} from "./orchestrator.js";
