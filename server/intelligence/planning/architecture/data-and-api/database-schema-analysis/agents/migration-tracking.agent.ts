import type { CodeFile, DbSchemaIssue, MigrationTrackingResult } from "../types.js";
import {
  ROLLBACK_PATTERNS,
  MIGRATION_UP_PATTERNS,
} from "../types.js";
import {
  hasAnyPattern,
  isMigrationFile,
  extractMigrationVersion,
} from "../utils/pattern.matcher.util.js";

let _issueCounter = 0;
function nextId(): string {
  _issueCounter += 1;
  return `db-mig-${Date.now()}-${String(_issueCounter).padStart(4, "0")}`;
}

function checkRollbackPresence(file: CodeFile): readonly DbSchemaIssue[] {
  const hasUp       = hasAnyPattern(file.content, MIGRATION_UP_PATTERNS);
  const hasRollback = hasAnyPattern(file.content, ROLLBACK_PATTERNS);

  if (!hasUp || hasRollback) return Object.freeze([]);

  return Object.freeze([
    Object.freeze<DbSchemaIssue>({
      id:         nextId(),
      type:       "MISSING_ROLLBACK_IN_MIGRATION",
      severity:   "HIGH",
      filePath:   file.path,
      line:       null,
      column:     null,
      message:    `Migration file has an 'up' function but no 'down' / rollback function. Deployments cannot be safely reverted without a rollback path.`,
      rule:       "DB-MIG-001",
      suggestion: "Add an export async function down(knex) { ... } (or equivalent for your ORM) that fully reverses every change made by the 'up' function.",
      snippet:    null,
    }),
  ]);
}

function checkDuplicateVersions(
  files: readonly CodeFile[],
): readonly DbSchemaIssue[] {
  const migrationFiles = files.filter(isMigrationFile);
  const versionMap     = new Map<string, string[]>();

  for (const file of migrationFiles) {
    const version = extractMigrationVersion(file.path);
    if (!version) continue;
    const existing = versionMap.get(version) ?? [];
    existing.push(file.path);
    versionMap.set(version, existing);
  }

  const issues: DbSchemaIssue[] = [];
  for (const [version, paths] of versionMap.entries()) {
    if (paths.length < 2) continue;
    issues.push(
      Object.freeze<DbSchemaIssue>({
        id:         nextId(),
        type:       "DUPLICATE_MIGRATION_VERSION",
        severity:   "CRITICAL",
        filePath:   paths[0] ?? "unknown",
        line:       null,
        column:     null,
        message:    `Migration version "${version}" is used by ${paths.length} files: ${paths.join(", ")}. Duplicate versions cause non-deterministic migration execution order and data corruption risk.`,
        rule:       "DB-MIG-002",
        suggestion: "Each migration must have a unique timestamp or version number. Rename the conflicting files to use sequential, unique version prefixes.",
        snippet:    null,
      }),
    );
  }

  return Object.freeze(issues);
}

function checkOrderConsistency(
  files: readonly CodeFile[],
): readonly DbSchemaIssue[] {
  const migrationFiles = files
    .filter(isMigrationFile)
    .map((f) => ({ file: f, version: extractMigrationVersion(f.path) }))
    .filter((e): e is { file: CodeFile; version: string } => e.version !== null)
    .sort((a, b) => a.version.localeCompare(b.version));

  if (migrationFiles.length < 2) return Object.freeze([]);

  const issues: DbSchemaIssue[] = [];
  const versions = migrationFiles.map((e) => e.version);

  for (let i = 1; i < versions.length; i++) {
    const prev    = versions[i - 1]!;
    const current = versions[i]!;
    const prevTs  = Number(prev.replace(/_/g, ""));
    const currTs  = Number(current.replace(/_/g, ""));

    if (!isNaN(prevTs) && !isNaN(currTs) && currTs < prevTs) {
      issues.push(
        Object.freeze<DbSchemaIssue>({
          id:         nextId(),
          type:       "OUT_OF_ORDER_MIGRATION",
          severity:   "HIGH",
          filePath:   migrationFiles[i]?.file.path ?? "unknown",
          line:       null,
          column:     null,
          message:    `Migration "${current}" appears out of chronological order after "${prev}". Out-of-order migrations can fail on fresh database setups.`,
          rule:       "DB-MIG-003",
          suggestion: "Ensure migration filenames use strictly ascending timestamp prefixes. Avoid back-dating migration files or manually editing version numbers.",
          snippet:    null,
        }),
      );
    }
  }

  return Object.freeze(issues);
}

function checkMigrationForModelChange(
  files: readonly CodeFile[],
): readonly DbSchemaIssue[] {
  const modelFiles     = files.filter((f) => {
    const p = f.path.toLowerCase();
    return (p.includes("model") || p.includes("entity") || p.includes("schema")) &&
           !isMigrationFile(f);
  });
  const migrationFiles = files.filter(isMigrationFile);

  if (modelFiles.length === 0 || migrationFiles.length === 0) return Object.freeze([]);

  const issues: DbSchemaIssue[] = [];

  for (const modelFile of modelFiles) {
    const modelName = modelFile.path
      .split("/").pop()?.replace(/\.(ts|js)$/, "")
      .replace(/[.-]/g, "_")
      .toLowerCase() ?? "";

    const hasMigration = migrationFiles.some((mf) =>
      mf.path.toLowerCase().includes(modelName) ||
      mf.content.toLowerCase().includes(modelName),
    );

    if (!hasMigration && modelName.length > 2) {
      issues.push(
        Object.freeze<DbSchemaIssue>({
          id:         nextId(),
          type:       "MISSING_MIGRATION_FOR_MODEL_CHANGE",
          severity:   "MEDIUM",
          filePath:   modelFile.path,
          line:       null,
          column:     null,
          message:    `Model "${modelName}" has no corresponding migration file. Schema changes not backed by a migration will diverge between environments.`,
          rule:       "DB-MIG-004",
          suggestion: "Generate a migration file for every model add/change/removal (e.g., knex migrate:make add_${modelName}_table or TypeORM migration:generate).",
          snippet:    null,
        }),
      );
    }
  }

  return Object.freeze(issues.slice(0, 10));
}

export function trackMigrations(
  files: readonly CodeFile[],
): MigrationTrackingResult {
  const migrationFiles  = files.filter(isMigrationFile);
  const allIssues: DbSchemaIssue[] = [];

  for (const file of migrationFiles) {
    allIssues.push(...checkRollbackPresence(file));
  }

  allIssues.push(...checkDuplicateVersions(files));
  allIssues.push(...checkOrderConsistency(files));
  allIssues.push(...checkMigrationForModelChange(files));

  const missingRollbackCount  = allIssues.filter((i) => i.type === "MISSING_ROLLBACK_IN_MIGRATION").length;
  const duplicateVersionCount = allIssues.filter((i) => i.type === "DUPLICATE_MIGRATION_VERSION").length;

  return Object.freeze({
    issues:                Object.freeze(allIssues),
    filesScanned:          migrationFiles.length,
    missingRollbackCount,
    duplicateVersionCount,
  });
}
