/**
 * server/intelligence/planning/architecture/api-and-data-analysis.ts
 *
 * Sub-barrel for API and data-layer analysis exports:
 * security, API-contract, database-schema.
 *
 * Imported by architecture/index.ts.  Keep this file ≤250 lines.
 */

export type {
  SecurityIssueType, SecuritySeverity, SecurityPhase, SecurityCodeFile,
  SecurityIssue, AuthEnforcementResult, SecretsDetectionResult,
  InjectionScanResult, RbacValidationResult, IntermediateSecurityIssues,
  SecurityReport, SecuritySession,
} from "./security/security-analysis/index.js";
export {
  SEC_SCORE_START, MAX_SEC_ISSUES, SEC_DEDUCTIONS,
  AUTH_MIDDLEWARE_PATTERNS, ROUTE_DEFINITION_PATTERNS, SECRET_PATTERNS,
  SQL_INJECTION_PATTERNS, XSS_PATTERNS, COMMAND_INJECTION_PATTERNS,
  PATH_TRAVERSAL_PATTERNS, RBAC_ROLE_CHECK_PATTERNS, ADMIN_ENDPOINT_PATTERNS,
  analyzeSecurity,
  analyzeSecurityMultiple,
  getLastSecurityReport,
  getSecurityReportHistory,
  resetSecurityAnalyzer,
} from "./security/security-analysis/index.js";

export type {
  ApiContractIssueType, ContractSeverity, ApiContractPhase,
  HttpMethod, VersioningStrategy, ApiEndpoint, ApiContractIssue,
  EndpointConsistencyResult,
  SchemaValidationResult as ApiSchemaValidationResult,
  VersioningCheckResult, BreakingChangeResult, IntermediateContractIssues,
  ApiContractReport, ApiContractSession, ApiCodeFile,
} from "./data-and-api/api-contract-analysis/index.js";
export {
  CONTRACT_SCORE_START, MAX_CONTRACT_ISSUES, CONTRACT_DEDUCTIONS,
  ROUTE_DEFINITION_PATTERNS as API_ROUTE_DEFINITION_PATTERNS,
  SCHEMA_VALIDATION_PATTERNS, VERSION_PATH_PATTERN,
  VERSION_HEADER_PATTERN, VERSION_QUERY_PATTERN,
  STANDARD_SUCCESS_CODES, STANDARD_ERROR_CODES,
  analyzeApiContract,
  analyzeApiContractMultiple,
  getLastApiContractReport,
  getApiContractReportHistory,
  resetApiContractAnalyzer,
} from "./data-and-api/api-contract-analysis/index.js";

export type {
  DbSchemaIssueType, DbSeverity, DbPhase, DbCodeFile, DbSchemaIssue,
  SchemaValidationResult, MigrationTrackingResult, OrmMisuseResult,
  IntermediateDbIssues, DbSchemaReport, DbSchemaSession,
} from "./data-and-api/database-schema-analysis/index.js";
export {
  DB_SCORE_START, MAX_DB_ISSUES, DB_DEDUCTIONS,
  PRIMARY_KEY_PATTERNS, FOREIGN_KEY_PATTERNS, INDEX_PATTERNS,
  TIMESTAMP_COLUMN_PATTERNS, CASCADE_PATTERNS, ROLLBACK_PATTERNS,
  MIGRATION_UP_PATTERNS, SELECT_STAR_ORM_PATTERNS, N1_QUERY_PATTERNS,
  TRANSACTION_PATTERNS, RAW_QUERY_IN_ORM_PATTERNS, EAGER_LOAD_PATTERNS,
  MIGRATION_FILE_PATTERNS, MODEL_FILE_PATTERNS,
  analyzeDbSchema,
  analyzeDbSchemaMultiple,
  getLastDbSchemaReport,
  getDbSchemaReportHistory,
  resetDbSchemaAnalyzer,
} from "./data-and-api/database-schema-analysis/index.js";
