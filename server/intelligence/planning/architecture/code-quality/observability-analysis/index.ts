export type {
  ObservabilityIssueType,
  ObsSeverity,
  ObsPhase,
  CodeLanguage,
  CodeFile,
  ObservabilityIssue,
  LoggingConsistencyResult,
  ErrorHandlingResult,
  MonitoringHooksResult,
  IntermediateObsIssues,
  ObservabilityReport,
  ObservabilitySession,
} from "./types.js";

export type { CodeFile as ObsCodeFile } from "./types.js";

export {
  OBS_SCORE_START,
  MAX_OBS_ISSUES,
  OBS_DEDUCTIONS,
  RAW_CONSOLE_PATTERNS,
  STRUCTURED_LOG_LIBRARY_PATTERNS,
  MISSING_CONTEXT_PATTERNS,
  MISSING_REQUEST_ID_PATTERNS,
  UNCAUGHT_PROMISE_PATTERNS,
  SWALLOWED_ERROR_PATTERNS,
  MISSING_ERROR_TYPE_PATTERNS,
  EMPTY_CATCH_PATTERNS,
  HEALTH_ENDPOINT_PATTERNS,
  METRICS_HOOK_PATTERNS,
  TRACE_CONTEXT_PATTERNS,
  ALERT_HOOK_PATTERNS,
} from "./types.js";

export {
  analyzeObservability,
  analyzeObservabilityMultiple,
  getLastReport        as getLastObservabilityReport,
  getReportHistory     as getObservabilityReportHistory,
  resetAnalyzer        as resetObservabilityAnalyzer,
} from "./orchestrator.js";
