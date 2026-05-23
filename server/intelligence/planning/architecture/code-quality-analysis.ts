/**
 * server/intelligence/planning/architecture/code-quality-analysis.ts
 *
 * Sub-barrel for code-quality analysis exports:
 * performance, complexity, dead-code, observability, test-architecture.
 *
 * Imported by architecture/index.ts.  Keep this file ≤250 lines.
 */

export type {
  PerformanceIssueType, PerformancePhase, CodeLanguage, CodeFile,
  PerformanceIssue, N1DetectionResult, MemoryLeakResult, AsyncMisuseResult,
  DbHotspotResult, IntermediateIssues, PerformanceReport, PerformanceSession,
} from "./code-quality/performance-analysis/index.js";
export {
  PERF_SCORE_START, MAX_PERF_ISSUES, PERF_DEDUCTIONS,
  DB_CALL_PATTERNS, MEMORY_LEAK_PATTERNS, ASYNC_MISUSE_PATTERNS,
  N1_LOOP_PATTERNS, DB_HOTSPOT_THRESHOLD, CRITICAL_HOTSPOT_THRESHOLD,
  analyzePerformance,
  analyzeMultipleProjects,
  resetAnalyzer as resetPerformanceAnalyzer,
} from "./code-quality/performance-analysis/index.js";

export type {
  ComplexityIssueType, ComplexitySeverity, ComplexityPhase,
  ComplexityCodeFile, ComplexityIssue, FunctionInfo,
  CyclomaticResult, CognitiveResult, FunctionLengthResult, NestingDepthResult,
  IntermediateComplexityIssues, ComplexityReport, ComplexitySession,
} from "./code-quality/complexity-analysis/index.js";
export {
  COMPLEX_SCORE_START, MAX_COMPLEX_ISSUES, COMPLEX_DEDUCTIONS,
  CYCLOMATIC_THRESHOLDS, COGNITIVE_THRESHOLDS, FUNCTION_LENGTH_THRESHOLDS,
  FILE_LENGTH_THRESHOLDS, NESTING_THRESHOLDS,
  CYCLOMATIC_DECISION_PATTERNS, CONTROL_FLOW_PATTERNS, FUNCTION_DEF_PATTERNS,
  CALLBACK_NEST_PATTERNS,
  analyzeComplexity,
  analyzeComplexityMultiple,
  getLastComplexityReport,
  getComplexityReportHistory,
  resetComplexityAnalyzer,
} from "./code-quality/complexity-analysis/index.js";

export type {
  DeadCodeIssueType, DeadSeverity, DeadPhase, DeadCodeFile, DeadCodeIssue,
  UnusedExportsResult, OrphanDetectionResult, UnreachableCodeResult,
  IntermediateDeadIssues, DeadCodeReport, DeadCodeSession,
} from "./code-quality/dead-code-analysis/index.js";
export {
  DEAD_SCORE_START, MAX_DEAD_ISSUES, DEAD_DEDUCTIONS,
  ENTRY_POINT_PATTERNS, NAMED_EXPORT_PATTERNS, DEFAULT_EXPORT_PATTERNS,
  NAMED_EXPORT_BLOCK_PATTERN, IMPORT_PATTERNS, BARREL_EXPORT_PATTERNS,
  DEAD_CONDITIONAL_PATTERNS, PROCESS_EXIT_PATTERN, RETURN_STATEMENT_PATTERN,
  THROW_STATEMENT_PATTERN, UNREACHABLE_CATCH_PATTERNS,
  analyzeDeadCode,
  analyzeDeadCodeMultiple,
  getLastDeadCodeReport,
  getDeadCodeReportHistory,
  resetDeadCodeAnalyzer,
} from "./code-quality/dead-code-analysis/index.js";

export type {
  ObservabilityIssueType, ObsSeverity, ObsPhase, ObsCodeFile,
  ObservabilityIssue, LoggingConsistencyResult, ErrorHandlingResult,
  MonitoringHooksResult, IntermediateObsIssues, ObservabilityReport,
  ObservabilitySession,
} from "./code-quality/observability-analysis/index.js";
export {
  OBS_SCORE_START, MAX_OBS_ISSUES, OBS_DEDUCTIONS,
  RAW_CONSOLE_PATTERNS, STRUCTURED_LOG_LIBRARY_PATTERNS,
  MISSING_CONTEXT_PATTERNS, MISSING_REQUEST_ID_PATTERNS,
  UNCAUGHT_PROMISE_PATTERNS, SWALLOWED_ERROR_PATTERNS,
  MISSING_ERROR_TYPE_PATTERNS, EMPTY_CATCH_PATTERNS,
  HEALTH_ENDPOINT_PATTERNS, METRICS_HOOK_PATTERNS,
  TRACE_CONTEXT_PATTERNS, ALERT_HOOK_PATTERNS,
  analyzeObservability,
  analyzeObservabilityMultiple,
  getLastObservabilityReport,
  getObservabilityReportHistory,
  resetObservabilityAnalyzer,
} from "./code-quality/observability-analysis/index.js";

export type {
  TestArchIssueType, TestSeverity, TestPhase, TestCodeFile, TestArchIssue,
  CoverageGapResult, LayerAnalysisResult, RatioAnalysisResult,
  IntermediateTestIssues, TestArchReport, TestArchSession,
} from "./testing/test-architecture-analysis/index.js";
export {
  TEST_SCORE_START, MAX_TEST_ISSUES, TEST_DEDUCTIONS,
  MIN_TEST_TO_CODE_RATIO, LOW_RATIO_THRESHOLD,
  TEST_FILE_PATTERNS, SOURCE_FILE_PATTERNS, SOURCE_EXCLUDE_PATTERNS,
  UNIT_TEST_PATTERNS, INTEGRATION_TEST_PATTERNS, E2E_TEST_PATTERNS,
  MOCK_PATTERNS, ASSERTION_PATTERNS, ERROR_PATH_TEST_PATTERNS,
  TEST_FRAMEWORK_PATTERNS,
  analyzeTestArchitecture,
  analyzeTestArchitectureMultiple,
  getLastTestArchReport,
  getTestArchReportHistory,
  resetTestArchAnalyzer,
} from "./testing/test-architecture-analysis/index.js";
