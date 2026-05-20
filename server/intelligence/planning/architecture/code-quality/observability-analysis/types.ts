export type ObservabilityIssueType =
  | "INCONSISTENT_LOG_LEVEL"
  | "MIXED_LOG_LIBRARIES"
  | "MISSING_LOG_CONTEXT"
  | "RAW_CONSOLE_USAGE"
  | "MISSING_REQUEST_ID_IN_LOG"
  | "UNCAUGHT_PROMISE_REJECTION"
  | "MISSING_TRY_CATCH"
  | "SWALLOWED_ERROR"
  | "MISSING_ERROR_TYPE_CHECK"
  | "EMPTY_CATCH_BLOCK"
  | "MISSING_HEALTH_ENDPOINT"
  | "MISSING_METRICS_HOOK"
  | "MISSING_TRACE_CONTEXT"
  | "NO_ALERT_HOOK"
  | "MISSING_LIVENESS_PROBE";

export type ObsSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type ObsPhase =
  | "IDLE"
  | "LOGGING_ANALYSIS"
  | "ERROR_COVERAGE"
  | "MONITORING_DETECTION"
  | "REPORT_GENERATION"
  | "COMPLETE";

export type CodeLanguage = "typescript" | "javascript" | "unknown";

export interface CodeFile {
  readonly id:       string;
  readonly path:     string;
  readonly content:  string;
  readonly language: CodeLanguage;
}

export interface ObservabilityIssue {
  readonly id:         string;
  readonly type:       ObservabilityIssueType;
  readonly severity:   ObsSeverity;
  readonly filePath:   string;
  readonly line:       number | null;
  readonly column:     number | null;
  readonly message:    string;
  readonly rule:       string;
  readonly suggestion: string;
  readonly snippet:    string | null;
}

export interface LoggingConsistencyResult {
  readonly issues:           readonly ObservabilityIssue[];
  readonly filesScanned:     number;
  readonly rawConsoleCount:  number;
  readonly mixedLibCount:    number;
}

export interface ErrorHandlingResult {
  readonly issues:              readonly ObservabilityIssue[];
  readonly filesScanned:        number;
  readonly uncaughtPromiseCount: number;
  readonly swallowedErrorCount: number;
}

export interface MonitoringHooksResult {
  readonly issues:                  readonly ObservabilityIssue[];
  readonly filesScanned:            number;
  readonly missingHealthEndpoints:  number;
  readonly missingMetricsHooks:     number;
}

export interface IntermediateObsIssues {
  readonly loggingIssues:   readonly ObservabilityIssue[];
  readonly errorIssues:     readonly ObservabilityIssue[];
  readonly monitoringIssues: readonly ObservabilityIssue[];
  readonly builtAt:         number;
}

export interface ObservabilityReport {
  readonly reportId:               string;
  readonly analyzedAt:             number;
  readonly totalFiles:             number;
  readonly totalIssues:            number;
  readonly issues:                 readonly ObservabilityIssue[];
  readonly loggingIssueCount:      number;
  readonly errorHandlingIssueCount: number;
  readonly monitoringIssueCount:   number;
  readonly criticalCount:          number;
  readonly highCount:              number;
  readonly mediumCount:            number;
  readonly lowCount:               number;
  readonly overallScore:           number;
  readonly isHealthy:              boolean;
  readonly summary:                string;
}

export interface ObservabilitySession {
  readonly sessionId: string;
  readonly phase:     ObsPhase;
  readonly startedAt: number;
  readonly fileCount: number;
}

export const OBS_SCORE_START  = 100;
export const MAX_OBS_ISSUES   = 1000;

export const OBS_DEDUCTIONS = Object.freeze<Record<ObsSeverity, number>>({
  CRITICAL: 25,
  HIGH:     15,
  MEDIUM:    7,
  LOW:       2,
});

export const RAW_CONSOLE_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\bconsole\.(log|debug|info|warn|error|trace)\s*\(/g,
]);

export const STRUCTURED_LOG_LIBRARY_PATTERNS = Object.freeze<ReadonlyArray<{ rx: RegExp; label: string }>>([
  { rx: /\bwinston\b/g,          label: "winston" },
  { rx: /\bpino\b/g,             label: "pino" },
  { rx: /\bbunyan\b/g,           label: "bunyan" },
  { rx: /\bmorgan\b/g,           label: "morgan" },
  { rx: /\bwinstonLogger\b/g,    label: "winston" },
  { rx: /\blog4js\b/g,           label: "log4js" },
  { rx: /\btslog\b/g,            label: "tslog" },
]);

export const MISSING_CONTEXT_PATTERNS = Object.freeze<readonly RegExp[]>([
  /console\.(log|debug|info|warn|error)\s*\(\s*['"`][^'"`]+['"`]\s*\)/g,
]);

export const MISSING_REQUEST_ID_PATTERNS = Object.freeze<readonly RegExp[]>([
  /console\.(log|debug|info|warn|error)\s*\([^)]*(?:req|request)\.[^)]*\)/gi,
]);

export const UNCAUGHT_PROMISE_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\.then\s*\([^)]*\)\s*(?!\.catch)/g,
  /async\s+\w+\s*\([^)]*\)\s*\{(?![^}]*try)[^}]*await\s+/gs,
]);

export const SWALLOWED_ERROR_PATTERNS = Object.freeze<readonly RegExp[]>([
  /catch\s*\(\s*\w+\s*\)\s*\{\s*\}/g,
  /catch\s*\(\s*\w+\s*\)\s*\{\s*\/\/[^\n]*\n?\s*\}/g,
  /catch\s*\(\s*\w+\s*\)\s*\{\s*\/\*[^*]*\*\/\s*\}/g,
]);

export const MISSING_ERROR_TYPE_PATTERNS = Object.freeze<readonly RegExp[]>([
  /catch\s*\(\s*(e|err|error)\s*\)\s*\{(?!\s*if\s*\(\s*\w+\s+instanceof)/g,
]);

export const EMPTY_CATCH_PATTERNS = Object.freeze<readonly RegExp[]>([
  /catch\s*\([^)]+\)\s*\{\s*\}/g,
]);

export const HEALTH_ENDPOINT_PATTERNS = Object.freeze<readonly RegExp[]>([
  /['"`]\/?health(?:z|check)?\/?['"`]/gi,
  /['"`]\/?liveness\/?['"`]/gi,
  /['"`]\/?readiness\/?['"`]/gi,
  /['"`]\/?ping\/?['"`]/gi,
  /['"`]\/?status\/?['"`]/gi,
]);

export const METRICS_HOOK_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\bprometheus\b/gi,
  /\bprom-client\b/gi,
  /\bstatsd\b/gi,
  /\bdatadog\b/gi,
  /\bnewrelic\b/gi,
  /\bcloudwatch\b/gi,
  /collect(?:default)?Metrics\s*\(/gi,
  /register\.metrics\s*\(/gi,
]);

export const TRACE_CONTEXT_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\bopentelemetry\b/gi,
  /\b@opentelemetry\//gi,
  /\bjaeger\b/gi,
  /\bzipkin\b/gi,
  /\btrace(?:r|Id|Parent)?\b/gi,
  /\bspanContext\b/gi,
  /startSpan\s*\(/gi,
]);

export const ALERT_HOOK_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\bpagerduty\b/gi,
  /\bpageduty\b/gi,
  /\boncall\b/gi,
  /\bopsgenie\b/gi,
  /\bvictorops\b/gi,
  /\balertmanager\b/gi,
  /sendAlert\s*\(/gi,
  /triggerAlert\s*\(/gi,
  /notifyOn(?:Call|Alert)\s*\(/gi,
]);
