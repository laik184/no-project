export type {
  SecurityIssueType,
  SecuritySeverity,
  SecurityPhase,
  CodeLanguage,
  SecurityIssue,
  AuthEnforcementResult,
  SecretsDetectionResult,
  InjectionScanResult,
  RbacValidationResult,
  IntermediateSecurityIssues,
  SecurityReport,
  SecuritySession,
} from "./types.js";

export type { CodeFile as SecurityCodeFile } from "./types.js";

export {
  SEC_SCORE_START,
  MAX_SEC_ISSUES,
  SEC_DEDUCTIONS,
  AUTH_MIDDLEWARE_PATTERNS,
  ROUTE_DEFINITION_PATTERNS,
  SECRET_PATTERNS,
  SQL_INJECTION_PATTERNS,
  XSS_PATTERNS,
  COMMAND_INJECTION_PATTERNS,
  PATH_TRAVERSAL_PATTERNS,
  RBAC_ROLE_CHECK_PATTERNS,
  ADMIN_ENDPOINT_PATTERNS,
} from "./types.js";

export {
  analyzeSecurity,
  analyzeSecurityMultiple,
  getLastReport        as getLastSecurityReport,
  getReportHistory     as getSecurityReportHistory,
  resetAnalyzer        as resetSecurityAnalyzer,
} from "./orchestrator.js";
