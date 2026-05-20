export type {
  ComplexityIssueType,
  ComplexitySeverity,
  ComplexityPhase,
  CodeLanguage,
  CodeFile,
  ComplexityIssue,
  FunctionInfo,
  CyclomaticResult,
  CognitiveResult,
  FunctionLengthResult,
  NestingDepthResult,
  IntermediateComplexityIssues,
  ComplexityReport,
  ComplexitySession,
} from "./types.js";

export type { CodeFile as ComplexityCodeFile } from "./types.js";

export {
  COMPLEX_SCORE_START,
  MAX_COMPLEX_ISSUES,
  COMPLEX_DEDUCTIONS,
  CYCLOMATIC_THRESHOLDS,
  COGNITIVE_THRESHOLDS,
  FUNCTION_LENGTH_THRESHOLDS,
  FILE_LENGTH_THRESHOLDS,
  NESTING_THRESHOLDS,
  CYCLOMATIC_DECISION_PATTERNS,
  CONTROL_FLOW_PATTERNS,
  FUNCTION_DEF_PATTERNS,
  CALLBACK_NEST_PATTERNS,
} from "./types.js";

export {
  analyzeComplexity,
  analyzeComplexityMultiple,
  getLastReport        as getLastComplexityReport,
  getReportHistory     as getComplexityReportHistory,
  resetAnalyzer        as resetComplexityAnalyzer,
} from "./orchestrator.js";
