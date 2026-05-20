export type {
  DbSchemaIssueType,
  DbSeverity,
  DbPhase,
  CodeLanguage,
  CodeFile,
  DbSchemaIssue,
  SchemaValidationResult,
  MigrationTrackingResult,
  OrmMisuseResult,
  IntermediateDbIssues,
  DbSchemaReport,
  DbSchemaSession,
} from "./types.js";

export type { CodeFile as DbCodeFile } from "./types.js";

export {
  DB_SCORE_START,
  MAX_DB_ISSUES,
  DB_DEDUCTIONS,
  PRIMARY_KEY_PATTERNS,
  FOREIGN_KEY_PATTERNS,
  INDEX_PATTERNS,
  TIMESTAMP_COLUMN_PATTERNS,
  CASCADE_PATTERNS,
  ROLLBACK_PATTERNS,
  MIGRATION_UP_PATTERNS,
  SELECT_STAR_ORM_PATTERNS,
  N1_QUERY_PATTERNS,
  TRANSACTION_PATTERNS,
  RAW_QUERY_IN_ORM_PATTERNS,
  EAGER_LOAD_PATTERNS,
  MIGRATION_FILE_PATTERNS,
  MODEL_FILE_PATTERNS,
} from "./types.js";

export {
  analyzeDbSchema,
  analyzeDbSchemaMultiple,
  getLastReport        as getLastDbSchemaReport,
  getReportHistory     as getDbSchemaReportHistory,
  resetAnalyzer        as resetDbSchemaAnalyzer,
} from "./orchestrator.js";
