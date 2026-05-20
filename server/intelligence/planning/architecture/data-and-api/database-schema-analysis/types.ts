export type DbSchemaIssueType =
  | "MISSING_PRIMARY_KEY"
  | "MISSING_INDEX_ON_FK"
  | "MISSING_TIMESTAMP_COLUMNS"
  | "NULLABLE_FK_WITHOUT_REASON"
  | "NO_CASCADE_RULE"
  | "INCONSISTENT_NAMING_CONVENTION"
  | "UNNORMALIZED_COLUMN"
  | "MISSING_NOT_NULL_CONSTRAINT"
  | "MISSING_ROLLBACK_IN_MIGRATION"
  | "DUPLICATE_MIGRATION_VERSION"
  | "OUT_OF_ORDER_MIGRATION"
  | "MISSING_MIGRATION_FOR_MODEL_CHANGE"
  | "SELECT_STAR_IN_ORM"
  | "N1_QUERY_IN_LOOP"
  | "MISSING_TRANSACTION"
  | "RAW_QUERY_IN_ORM"
  | "EAGER_LOAD_WITHOUT_LIMIT"
  | "BULK_OP_WITHOUT_TRANSACTION";

export type DbSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type DbPhase =
  | "IDLE"
  | "SCHEMA_VALIDATION"
  | "MIGRATION_TRACKING"
  | "ORM_ANALYSIS"
  | "REPORT_GENERATION"
  | "COMPLETE";

export type CodeLanguage = "typescript" | "javascript" | "sql" | "unknown";

export interface CodeFile {
  readonly id:       string;
  readonly path:     string;
  readonly content:  string;
  readonly language: CodeLanguage;
}

export interface DbSchemaIssue {
  readonly id:         string;
  readonly type:       DbSchemaIssueType;
  readonly severity:   DbSeverity;
  readonly filePath:   string;
  readonly line:       number | null;
  readonly column:     number | null;
  readonly message:    string;
  readonly rule:       string;
  readonly suggestion: string;
  readonly snippet:    string | null;
}

export interface SchemaValidationResult {
  readonly issues:              readonly DbSchemaIssue[];
  readonly filesScanned:        number;
  readonly tablesWithoutPk:     number;
  readonly fksWithoutIndex:     number;
}

export interface MigrationTrackingResult {
  readonly issues:               readonly DbSchemaIssue[];
  readonly filesScanned:         number;
  readonly missingRollbackCount: number;
  readonly duplicateVersionCount: number;
}

export interface OrmMisuseResult {
  readonly issues:              readonly DbSchemaIssue[];
  readonly filesScanned:        number;
  readonly n1RiskCount:         number;
  readonly rawQueryCount:       number;
}

export interface IntermediateDbIssues {
  readonly schemaIssues:    readonly DbSchemaIssue[];
  readonly migrationIssues: readonly DbSchemaIssue[];
  readonly ormIssues:       readonly DbSchemaIssue[];
  readonly builtAt:         number;
}

export interface DbSchemaReport {
  readonly reportId:             string;
  readonly analyzedAt:           number;
  readonly totalFiles:           number;
  readonly totalIssues:          number;
  readonly issues:               readonly DbSchemaIssue[];
  readonly schemaIssueCount:     number;
  readonly migrationIssueCount:  number;
  readonly ormIssueCount:        number;
  readonly criticalCount:        number;
  readonly highCount:            number;
  readonly mediumCount:          number;
  readonly lowCount:             number;
  readonly overallScore:         number;
  readonly isHealthy:            boolean;
  readonly summary:              string;
}

export interface DbSchemaSession {
  readonly sessionId: string;
  readonly phase:     DbPhase;
  readonly startedAt: number;
  readonly fileCount: number;
}

export const DB_SCORE_START  = 100;
export const MAX_DB_ISSUES   = 1000;

export const DB_DEDUCTIONS = Object.freeze<Record<DbSeverity, number>>({
  CRITICAL: 30,
  HIGH:     18,
  MEDIUM:    8,
  LOW:       3,
});

export const MIGRATION_FILE_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\d{13,}_[\w-]+\.(ts|js)$/,
  /\d{4}_\d{2}_\d{2}_[\w-]+\.(ts|js|sql)$/,
  /V\d+__[\w-]+\.sql$/i,
  /migration[s]?\//i,
  /migrate\//i,
]);

export const MODEL_FILE_PATTERNS = Object.freeze<readonly RegExp[]>([
  /model[s]?\//i,
  /entity[s]?\//i,
  /schema[s]?\//i,
  /entities\//i,
]);

export const PRIMARY_KEY_PATTERNS = Object.freeze<readonly RegExp[]>([
  /PRIMARY\s+KEY/gi,
  /primaryKey\s*:\s*true/gi,
  /@PrimaryKey\b/gi,
  /@PrimaryGeneratedColumn\s*\(/gi,
  /\.primary\(\)/gi,
  /\.increments\s*\(/gi,
  /id\s*:\s*\{\s*[^}]*primaryKey\s*:\s*true/gi,
  /serial\s+PRIMARY\s+KEY/gi,
  /SERIAL\s+PRIMARY/gi,
]);

export const FOREIGN_KEY_PATTERNS = Object.freeze<readonly RegExp[]>([
  /FOREIGN\s+KEY\s*\([^)]+\)\s*REFERENCES/gi,
  /REFERENCES\s+\w+\s*\(/gi,
  /references\s*:\s*\{/gi,
  /@ManyToOne\s*\(/gi,
  /@OneToMany\s*\(/gi,
  /@OneToOne\s*\(/gi,
  /@ManyToMany\s*\(/gi,
  /belongsTo\s*\(/gi,
  /hasMany\s*\(/gi,
  /hasOne\s*\(/gi,
]);

export const INDEX_PATTERNS = Object.freeze<readonly RegExp[]>([
  /CREATE\s+INDEX/gi,
  /CREATE\s+UNIQUE\s+INDEX/gi,
  /\.index\s*\(/gi,
  /\.unique\s*\(/gi,
  /@Index\s*\(/gi,
  /indexes\s*:\s*\[/gi,
  /table\.index\s*\(/gi,
]);

export const TIMESTAMP_COLUMN_PATTERNS = Object.freeze<readonly RegExp[]>([
  /created_at|createdAt|created_on/gi,
  /updated_at|updatedAt|updated_on/gi,
  /timestamps\s*:\s*true/gi,
  /@CreateDateColumn\s*\(/gi,
  /@UpdateDateColumn\s*\(/gi,
]);

export const CASCADE_PATTERNS = Object.freeze<readonly RegExp[]>([
  /ON\s+DELETE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION)/gi,
  /ON\s+UPDATE\s+(CASCADE|SET\s+NULL|RESTRICT|NO\s+ACTION)/gi,
  /onDelete\s*:/gi,
  /onUpdate\s*:/gi,
  /cascade\s*:\s*(?:true|['"`])/gi,
]);

export const ROLLBACK_PATTERNS = Object.freeze<readonly RegExp[]>([
  /export\s+(?:const\s+)?down\s*[=(]/gi,
  /async\s+down\s*\(/gi,
  /exports\.down\s*=/gi,
  /\.rollback\s*\(/gi,
  /def\s+down\b/gi,
]);

export const MIGRATION_UP_PATTERNS = Object.freeze<readonly RegExp[]>([
  /export\s+(?:const\s+)?up\s*[=(]/gi,
  /async\s+up\s*\(/gi,
  /exports\.up\s*=/gi,
]);

export const SELECT_STAR_ORM_PATTERNS = Object.freeze<readonly RegExp[]>([
  /findAll\s*\(\s*\)/g,
  /findAll\s*\(\s*\{(?![^}]*attributes)[^}]*\}\s*\)/g,
  /find\s*\(\s*\{\s*\}\s*\)/g,
  /find\s*\(\s*\{\s*where[^}]*\}\s*\)(?!\s*\.select)/g,
  /getRepository\s*\([^)]+\)\s*\.find\s*\(\s*\{\s*\}\s*\)/g,
  /select\s*\(\s*['"`]\*['"`]\s*\)/g,
]);

export const N1_QUERY_PATTERNS = Object.freeze<readonly RegExp[]>([
  /for\s*\(.*\)\s*\{[^}]*(?:await\s+)?(?:findOne|findById|findAll|find|query|execute)\s*\(/gs,
  /\.forEach\s*\([^)]*=>\s*\{[^}]*(?:await\s+)?(?:findOne|findById|find|query)\s*\(/gs,
  /\.map\s*\([^)]*(?:async\s*)?[^)]*=>\s*(?:await\s+)?(?:findOne|findById|find|query)\s*\(/g,
]);

export const MISSING_TRANSACTION_PATTERNS = Object.freeze<readonly RegExp[]>([
  /(?:create|update|delete|save|destroy|remove|insert)\s*\([^)]*\)[^;]*\n[^;]*(?:create|update|delete|save|destroy|remove|insert)\s*\(/gm,
]);

export const RAW_QUERY_IN_ORM_PATTERNS = Object.freeze<readonly RegExp[]>([
  /sequelize\.query\s*\(/gi,
  /knex\.raw\s*\(/gi,
  /queryBuilder\.raw\s*\(/gi,
  /em\.getConnection\s*\(\)/gi,
  /dataSource\.query\s*\(/gi,
  /repository\.query\s*\(/gi,
  /manager\.query\s*\(/gi,
  /prisma\.\$queryRaw\b/gi,
  /prisma\.\$executeRaw\b/gi,
]);

export const TRANSACTION_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\.transaction\s*\(/gi,
  /sequelize\.transaction\s*\(/gi,
  /knex\.transaction\s*\(/gi,
  /manager\.transaction\s*\(/gi,
  /dataSource\.transaction\s*\(/gi,
  /em\.transactional\s*\(/gi,
  /prisma\.\$transaction\s*\(/gi,
  /BEGIN\s*TRANSACTION/gi,
  /START\s+TRANSACTION/gi,
]);

export const EAGER_LOAD_PATTERNS = Object.freeze<readonly RegExp[]>([
  /include\s*:\s*\[/g,
  /relations\s*:\s*\[/g,
  /populate\s*\(\s*\[/g,
]);

export const NAMING_SNAKE_CASE_PATTERN = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/g;
export const NAMING_CAMEL_CASE_PATTERN = /\b[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b/g;
export const MIGRATION_VERSION_PATTERN  = /^(\d{13,}|\d{4}_\d{2}_\d{2})/;
