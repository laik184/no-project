export type {
  DeadCodeIssueType,
  DeadSeverity,
  DeadPhase,
  CodeLanguage,
  CodeFile,
  DeadCodeIssue,
  UnusedExportsResult,
  OrphanDetectionResult,
  UnreachableCodeResult,
  IntermediateDeadIssues,
  DeadCodeReport,
  DeadCodeSession,
} from "./types.js";

export type { CodeFile as DeadCodeFile } from "./types.js";

export {
  DEAD_SCORE_START,
  MAX_DEAD_ISSUES,
  DEAD_DEDUCTIONS,
  ENTRY_POINT_PATTERNS,
  NAMED_EXPORT_PATTERNS,
  DEFAULT_EXPORT_PATTERNS,
  NAMED_EXPORT_BLOCK_PATTERN,
  IMPORT_PATTERNS,
  BARREL_EXPORT_PATTERNS,
  DEAD_CONDITIONAL_PATTERNS,
  PROCESS_EXIT_PATTERN,
  RETURN_STATEMENT_PATTERN,
  THROW_STATEMENT_PATTERN,
  UNREACHABLE_CATCH_PATTERNS,
} from "./types.js";

export {
  analyzeDeadCode,
  analyzeDeadCodeMultiple,
  getLastReport        as getLastDeadCodeReport,
  getReportHistory     as getDeadCodeReportHistory,
  resetAnalyzer        as resetDeadCodeAnalyzer,
} from "./orchestrator.js";
