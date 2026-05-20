export type {
  TestArchIssueType,
  TestSeverity,
  TestPhase,
  CodeLanguage,
  CodeFile,
  TestArchIssue,
  CoverageGapResult,
  LayerAnalysisResult,
  RatioAnalysisResult,
  IntermediateTestIssues,
  TestArchReport,
  TestArchSession,
} from "./types.js";

export type { CodeFile as TestCodeFile } from "./types.js";

export {
  TEST_SCORE_START,
  MAX_TEST_ISSUES,
  TEST_DEDUCTIONS,
  MIN_TEST_TO_CODE_RATIO,
  LOW_RATIO_THRESHOLD,
  TEST_FILE_PATTERNS,
  SOURCE_FILE_PATTERNS,
  SOURCE_EXCLUDE_PATTERNS,
  UNIT_TEST_PATTERNS,
  INTEGRATION_TEST_PATTERNS,
  E2E_TEST_PATTERNS,
  MOCK_PATTERNS,
  ASSERTION_PATTERNS,
  ERROR_PATH_TEST_PATTERNS,
  TEST_FRAMEWORK_PATTERNS,
} from "./types.js";

export {
  analyzeTestArchitecture,
  analyzeTestArchitectureMultiple,
  getLastReport        as getLastTestArchReport,
  getReportHistory     as getTestArchReportHistory,
  resetAnalyzer        as resetTestArchAnalyzer,
} from "./orchestrator.js";
