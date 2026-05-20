import type { CodeFile, DbSchemaIssue, SchemaValidationResult } from "../types.js";
import {
  PRIMARY_KEY_PATTERNS,
  FOREIGN_KEY_PATTERNS,
  INDEX_PATTERNS,
  TIMESTAMP_COLUMN_PATTERNS,
  CASCADE_PATTERNS,
  NAMING_SNAKE_CASE_PATTERN,
  NAMING_CAMEL_CASE_PATTERN,
} from "../types.js";
import {
  hasAnyPattern,
  countPatternMatches,
  matchAllPatterns,
  isSchemaFile,
} from "../utils/pattern.matcher.util.js";

let _issueCounter = 0;
function nextId(): string {
  _issueCounter += 1;
  return `db-schema-${Date.now()}-${String(_issueCounter).padStart(4, "0")}`;
}

function checkPrimaryKey(file: CodeFile): readonly DbSchemaIssue[] {
  const hasPk = hasAnyPattern(file.content, PRIMARY_KEY_PATTERNS);
  if (hasPk) return Object.freeze([]);

  const looksLikeTable =
    /CREATE\s+TABLE/i.test(file.content) ||
    /defineModel\s*\(/i.test(file.content) ||
    /@Entity\s*\(/i.test(file.content) ||
    /schema\s*=\s*new\s+Schema\s*\(/i.test(file.content) ||
    /extends\s+Model\b/.test(file.content);

  if (!looksLikeTable) return Object.freeze([]);

  return Object.freeze([
    Object.freeze<DbSchemaIssue>({
      id:         nextId(),
      type:       "MISSING_PRIMARY_KEY",
      severity:   "CRITICAL",
      filePath:   file.path,
      line:       null,
      column:     null,
      message:    "No primary key definition found in schema/model. Every table must have a primary key to guarantee row uniqueness and support foreign key references.",
      rule:       "DB-SCH-001",
      suggestion: "Add a primary key column (e.g., id SERIAL PRIMARY KEY in SQL, primaryKey: true in Sequelize, @PrimaryGeneratedColumn() in TypeORM, or id Int @id @default(autoincrement()) in Prisma).",
      snippet:    null,
    }),
  ]);
}

function checkForeignKeyIndexes(file: CodeFile): readonly DbSchemaIssue[] {
  const hasFk    = hasAnyPattern(file.content, FOREIGN_KEY_PATTERNS);
  const hasIndex = hasAnyPattern(file.content, INDEX_PATTERNS);

  if (!hasFk || hasIndex) return Object.freeze([]);

  return Object.freeze([
    Object.freeze<DbSchemaIssue>({
      id:         nextId(),
      type:       "MISSING_INDEX_ON_FK",
      severity:   "HIGH",
      filePath:   file.path,
      line:       null,
      column:     null,
      message:    "Foreign key relationship defined but no index found on the file. FK columns without indexes cause full table scans on every join.",
      rule:       "DB-SCH-002",
      suggestion: "Create an index on every foreign key column (e.g., CREATE INDEX ON orders(customer_id); or add indexes: [{ fields: ['customerId'] }] in Sequelize).",
      snippet:    null,
    }),
  ]);
}

function checkTimestampColumns(file: CodeFile): readonly DbSchemaIssue[] {
  const looksLikeTable =
    /CREATE\s+TABLE/i.test(file.content) ||
    /defineModel\s*\(/i.test(file.content) ||
    /@Entity\s*\(/i.test(file.content) ||
    /extends\s+Model\b/.test(file.content) ||
    /new\s+Schema\s*\(/.test(file.content);

  if (!looksLikeTable) return Object.freeze([]);

  const hasTimestamps = hasAnyPattern(file.content, TIMESTAMP_COLUMN_PATTERNS);
  if (hasTimestamps)  return Object.freeze([]);

  return Object.freeze([
    Object.freeze<DbSchemaIssue>({
      id:         nextId(),
      type:       "MISSING_TIMESTAMP_COLUMNS",
      severity:   "MEDIUM",
      filePath:   file.path,
      line:       null,
      column:     null,
      message:    "No created_at / updated_at timestamp columns detected. Without audit timestamps, data history and debugging are severely limited.",
      rule:       "DB-SCH-003",
      suggestion: "Add created_at TIMESTAMPTZ DEFAULT NOW() and updated_at TIMESTAMPTZ DEFAULT NOW() columns, or enable timestamps: true in your ORM model definition.",
      snippet:    null,
    }),
  ]);
}

function checkCascadeRules(file: CodeFile): readonly DbSchemaIssue[] {
  const hasFk      = hasAnyPattern(file.content, FOREIGN_KEY_PATTERNS);
  const hasCascade = hasAnyPattern(file.content, CASCADE_PATTERNS);

  if (!hasFk || hasCascade) return Object.freeze([]);

  return Object.freeze([
    Object.freeze<DbSchemaIssue>({
      id:         nextId(),
      type:       "NO_CASCADE_RULE",
      severity:   "MEDIUM",
      filePath:   file.path,
      line:       null,
      column:     null,
      message:    "Foreign key defined without explicit ON DELETE / ON UPDATE cascade rules. Default behavior varies by database and may leave orphaned rows.",
      rule:       "DB-SCH-004",
      suggestion: "Explicitly set ON DELETE CASCADE, ON DELETE SET NULL, or ON DELETE RESTRICT on every FK so referential integrity is predictable and intentional.",
      snippet:    null,
    }),
  ]);
}

function checkNamingConsistency(file: CodeFile): readonly DbSchemaIssue[] {
  const content = file.content;
  const snakeMatches = (content.match(new RegExp(NAMING_SNAKE_CASE_PATTERN.source, "g")) ?? []).length;
  const camelMatches = (content.match(new RegExp(NAMING_CAMEL_CASE_PATTERN.source, "g")) ?? []).length;

  const total = snakeMatches + camelMatches;
  if (total < 5) return Object.freeze([]);

  const snakeRatio = snakeMatches / total;
  const camelRatio = camelMatches / total;

  if (snakeRatio > 0.15 && camelRatio > 0.15) {
    return Object.freeze([
      Object.freeze<DbSchemaIssue>({
        id:         nextId(),
        type:       "INCONSISTENT_NAMING_CONVENTION",
        severity:   "LOW",
        filePath:   file.path,
        line:       null,
        column:     null,
        message:    `Mixed naming conventions detected in schema file — both snake_case (${snakeMatches} occurrences) and camelCase (${camelMatches} occurrences) column/table names are present.`,
        rule:       "DB-SCH-005",
        suggestion: "Standardize on snake_case for SQL/database columns and table names. Use ORM column mapping (e.g., field: 'user_id') to bridge with camelCase application code.",
        snippet:    null,
      }),
    ]);
  }

  return Object.freeze([]);
}

export function validateSchemaDesign(
  files: readonly CodeFile[],
): SchemaValidationResult {
  const schemaFiles = files.filter(isSchemaFile);
  const allIssues:  DbSchemaIssue[] = [];
  let tablesWithoutPk  = 0;
  let fksWithoutIndex  = 0;

  for (const file of schemaFiles) {
    const pkIssues        = checkPrimaryKey(file);
    const fkIndexIssues   = checkForeignKeyIndexes(file);
    const timestampIssues = checkTimestampColumns(file);
    const cascadeIssues   = checkCascadeRules(file);
    const namingIssues    = checkNamingConsistency(file);

    tablesWithoutPk  += pkIssues.length;
    fksWithoutIndex  += fkIndexIssues.length;

    allIssues.push(
      ...pkIssues,
      ...fkIndexIssues,
      ...timestampIssues,
      ...cascadeIssues,
      ...namingIssues,
    );
  }

  return Object.freeze({
    issues:           Object.freeze(allIssues),
    filesScanned:     schemaFiles.length,
    tablesWithoutPk,
    fksWithoutIndex,
  });
}
