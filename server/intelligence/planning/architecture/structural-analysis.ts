/**
 * server/intelligence/planning/architecture/structural-analysis.ts
 *
 * Sub-barrel for structural analysis exports:
 * boundary, dependency, responsibility, HVP, pattern detection,
 * arch-resolver, evolution, architecture-fixer.
 *
 * Imported by architecture/index.ts.  Keep this file ≤250 lines.
 */

export type {
  HvpLayer, NodeRole, ImportType, BoundaryViolationType,
  ValidationPhase as BoundaryValidationPhase, ArchNode, ArchEdge,
  ArchitectureGraph, BoundaryViolation, LayerValidationResult,
  DirectionValidationResult, DomainLeakageResult, BoundaryReport,
  BoundarySession, IntermediateViolations,
  ViolationSeverity as BoundaryViolationSeverity,
} from "./structural/boundary-analysis/index.js";
export {
  BOUNDARY_SCORE_START, MAX_BOUNDARY_VIOLATIONS, BOUNDARY_DEDUCTIONS,
  HVP_ALLOWED_DIRECTIONS, FORBIDDEN_DOMAIN_PAIRS, INFRASTRUCTURE_DOMAINS,
  analyzeBoundaries,
  analyzeMultiple as analyzeBoundaryMultiple,
  getLastReport  as getLastBoundaryReport,
  getReportHistory as getBoundaryReportHistory,
  resetAnalyzer  as resetBoundaryAnalyzer,
} from "./structural/boundary-analysis/index.js";

export type {
  AnalysisPhase as DependencyAnalysisPhase, CouplingRisk, EdgeKind,
  SourceModule, DependencyInput, GraphNode, GraphEdge, DependencyGraph,
  CycleGroup, CouplingScore, DependencyCluster, DependencyMetrics,
  DependencyAnalysisResult, DependencySession,
} from "./structural/dependency-analysis/index.js";
export {
  MAX_MODULES, MAX_CYCLES_REPORTED, INSTABILITY_HIGH_RISK, INSTABILITY_MED_RISK,
  LARGE_CYCLE_THRESHOLD, HEALTH_SCORE_START, HEALTH_DEDUCTIONS,
  analyzeDependencies,
  analyzeMultiple  as analyzeDependencyMultiple,
  getLastResult    as getLastDependencyResult,
  getResultHistory as getDependencyResultHistory,
  resetAnalyzer    as resetDependencyAnalyzer,
} from "./structural/dependency-analysis/index.js";

export type {
  ConcernTag, ViolationSeverity as SrpViolationSeverity, SRPViolationType,
  AnalysisPhase as SrpAnalysisPhase, FileRole as SrpFileRole, FileDescriptor,
  ConcernEvidence, ConcernDetection, ResponsibilityViolation, SRPScore,
  PurityScore, ResponsibilityReport, ProjectFiles, ResponsibilitySession,
  IntermediateAnalysis,
} from "./structural/responsibility-analysis/index.js";
export {
  LINE_COUNT_THRESHOLD, CONCERN_MIX_THRESHOLD, SRP_PERFECT_SCORE,
  VIOLATION_DEDUCTIONS,
  analyzeResponsibility,
  analyzeMultiple  as analyzeResponsibilityMultiple,
  getLastReport    as getLastResponsibilityReport,
  getReportHistory as getResponsibilityReportHistory,
  resetAnalyzer    as resetResponsibilityAnalyzer,
} from "./structural/responsibility-analysis/index.js";

export type {
  FileRole as HvpFileRole, ViolationSeverity as HvpViolationSeverity,
  ViolationType as HvpViolationType, ValidationPhase as HvpValidationPhase,
  LayerDefinition, FileNode, ImportEdge,
  Violation as HvpViolation, LayerReport, HVPComplianceReport,
  ProjectStructure, HVPAnalysisSession, IntermediateImportGraph, ValidatorResult,
} from "./structural/hvp-analysis/index.js";
export {
  HVP_DEFAULT_LAYERS, SCORE_DEDUCTIONS, MAX_REPORT_VIOLATIONS,
  analyzeHVP,
  analyzeMultiple  as analyzeHvpMultiple,
  getLastReport    as getLastHvpReport,
  getReportHistory as getHvpReportHistory,
  resetAnalyzer    as resetHvpAnalyzer,
} from "./structural/hvp-analysis/index.js";

export * from "./structural/pattern-detection/index.js";

export {
  buildDecisionPlan, getDecisionState,
} from "./engine/arch-resolver/index.js";
export type {
  ArchitectureAnalysisReport as ArchResolverReport,
  AnalysisViolation as ArchResolverViolation,
  Decision, DecisionPlan, DecisionState, PriorityLevel, ViolationCategory,
} from "./engine/arch-resolver/index.js";

export * from "./engine/evolution/index.js";
export * from "./engine/architecture-fixer/index.js";
