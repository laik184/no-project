import type { CodeFile, DbSchemaIssue, OrmMisuseResult } from "../types.js";
import {
  SELECT_STAR_ORM_PATTERNS,
  N1_QUERY_PATTERNS,
  TRANSACTION_PATTERNS,
  RAW_QUERY_IN_ORM_PATTERNS,
  EAGER_LOAD_PATTERNS,
} from "../types.js";
import {
  matchAllPatterns,
  hasAnyPattern,
  countPatternMatches,
  isOrmFile,
} from "../utils/pattern.matcher.util.js";

let _issueCounter = 0;
function nextId(): string {
  _issueCounter += 1;
  return `db-orm-${Date.now()}-${String(_issueCounter).padStart(4, "0")}`;
}

function detectSelectStar(file: CodeFile): readonly DbSchemaIssue[] {
  const matches = matchAllPatterns(file.content, SELECT_STAR_ORM_PATTERNS);
  return Object.freeze(
    matches.slice(0, 10).map((m) =>
      Object.freeze<DbSchemaIssue>({
        id:         nextId(),
        type:       "SELECT_STAR_IN_ORM",
        severity:   "MEDIUM",
        filePath:   file.path,
        line:       m.line,
        column:     m.column,
        message:    "ORM query fetches all columns (SELECT *). This transfers unnecessary data, leaks internal fields, and breaks when columns are added/removed.",
        rule:       "DB-ORM-001",
        suggestion: "Use the 'attributes' option in Sequelize, 'select' in TypeORM, or { select: { field: true } } in Prisma to fetch only the columns the caller needs.",
        snippet:    m.snippet,
      }),
    ),
  );
}

function detectN1Queries(file: CodeFile): readonly DbSchemaIssue[] {
  const lines   = file.content.split("\n");
  const issues: DbSchemaIssue[] = [];

  const loopKeywords = [
    /\bfor\s*\(/g,
    /\bfor\s+(?:const|let|var)\b/g,
    /\.forEach\s*\(/g,
    /\.map\s*\(/g,
    /\.reduce\s*\(/g,
    /while\s*\(/g,
  ];

  const dbCallKeywords = /await\s+(?:\w+\.)*(?:findOne|findById|findAll|find|findByPk|findAndCount|query|execute|save|update|delete|remove|create|insert)\s*\(/g;

  let insideLoop   = false;
  let loopDepth    = 0;
  let braceDepth   = 0;
  let loopStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";

    const isLoopLine = loopKeywords.some((rx) => {
      const fresh = new RegExp(rx.source, "g");
      return fresh.test(line);
    });

    if (isLoopLine && !insideLoop) {
      insideLoop   = true;
      loopDepth    = braceDepth;
      loopStartLine = i + 1;
    }

    braceDepth += (line.match(/\{/g) ?? []).length;
    braceDepth -= (line.match(/\}/g) ?? []).length;

    if (insideLoop && braceDepth <= loopDepth) {
      insideLoop = false;
    }

    if (insideLoop) {
      const dbCallFresh = new RegExp(dbCallKeywords.source, "g");
      if (dbCallFresh.test(line)) {
        issues.push(
          Object.freeze<DbSchemaIssue>({
            id:         nextId(),
            type:       "N1_QUERY_IN_LOOP",
            severity:   "HIGH",
            filePath:   file.path,
            line:       i + 1,
            column:     null,
            message:    `Database query detected inside a loop (loop started at line ${loopStartLine}). This produces N+1 queries — one query per iteration — causing severe performance degradation.`,
            rule:       "DB-ORM-002",
            suggestion: "Collect all required IDs first, then use a single batch query (e.g., findAll({ where: { id: ids } }) or include/populate with eager loading) outside the loop.",
            snippet:    line.trim().slice(0, 120),
          }),
        );
      }
    }
  }

  return Object.freeze(issues.slice(0, 15));
}

function detectMissingTransactions(file: CodeFile): readonly DbSchemaIssue[] {
  const content          = file.content;
  const hasTransaction   = hasAnyPattern(content, TRANSACTION_PATTERNS);

  const multiWritePattern =
    /(await\s+(?:\w+\.)*(?:create|update|save|destroy|delete|remove|insert)\s*\([^)]*\)[^;]*;\s*){2,}/gs;

  const fresh = new RegExp(multiWritePattern.source, "gs");
  const match = fresh.exec(content);

  if (match && !hasTransaction) {
    const beforeMatch = content.slice(0, match.index);
    const lineNum     = beforeMatch.split("\n").length;

    return Object.freeze([
      Object.freeze<DbSchemaIssue>({
        id:         nextId(),
        type:       "MISSING_TRANSACTION",
        severity:   "HIGH",
        filePath:   file.path,
        line:       lineNum,
        column:     null,
        message:    "Multiple sequential database write operations detected without a wrapping transaction. A partial failure will leave data in an inconsistent state.",
        rule:       "DB-ORM-003",
        suggestion: "Wrap all related writes in a transaction block (e.g., await sequelize.transaction(async (t) => { ... }) or prisma.$transaction([...])).",
        snippet:    match[0]?.slice(0, 120) ?? null,
      }),
    ]);
  }

  return Object.freeze([]);
}

function detectRawQueries(file: CodeFile): readonly DbSchemaIssue[] {
  const matches = matchAllPatterns(file.content, RAW_QUERY_IN_ORM_PATTERNS);
  return Object.freeze(
    matches.slice(0, 8).map((m) =>
      Object.freeze<DbSchemaIssue>({
        id:         nextId(),
        type:       "RAW_QUERY_IN_ORM",
        severity:   "MEDIUM",
        filePath:   file.path,
        line:       m.line,
        column:     m.column,
        message:    "Raw SQL query executed through the ORM. Raw queries bypass type safety, parameterization helpers, and migration tracking.",
        rule:       "DB-ORM-004",
        suggestion: "Replace with a typed ORM query builder. If raw SQL is unavoidable, ensure it uses parameterized placeholders and document why the ORM abstraction is insufficient.",
        snippet:    m.snippet,
      }),
    ),
  );
}

function detectEagerLoadWithoutLimit(file: CodeFile): readonly DbSchemaIssue[] {
  const matches = matchAllPatterns(file.content, EAGER_LOAD_PATTERNS);
  const issues: DbSchemaIssue[] = [];

  for (const m of matches.slice(0, 8)) {
    const hasLimit = /limit\s*:|take\s*:|first\s*\(|\btop\b/i.test(file.content);
    if (!hasLimit) {
      issues.push(
        Object.freeze<DbSchemaIssue>({
          id:         nextId(),
          type:       "EAGER_LOAD_WITHOUT_LIMIT",
          severity:   "MEDIUM",
          filePath:   file.path,
          line:       m.line,
          column:     m.column,
          message:    "Eager load (include/relations/populate) used without a query limit. Loading unbounded related records can exhaust memory on large datasets.",
          rule:       "DB-ORM-005",
          suggestion: "Always pair eager loads with a limit / take clause, or switch to a paginated query strategy (e.g., cursor-based pagination) for collections.",
          snippet:    m.snippet,
        }),
      );
      break;
    }
  }

  return Object.freeze(issues);
}

export function detectOrmMisuse(
  files: readonly CodeFile[],
): OrmMisuseResult {
  const ormFiles   = files.filter((f) => isOrmFile(f) || !f.path.endsWith(".sql"));
  const allIssues: DbSchemaIssue[] = [];
  let n1RiskCount   = 0;
  let rawQueryCount = 0;

  for (const file of ormFiles) {
    const selectStarIssues  = detectSelectStar(file);
    const n1Issues          = detectN1Queries(file);
    const transactionIssues = detectMissingTransactions(file);
    const rawIssues         = detectRawQueries(file);
    const eagerLoadIssues   = detectEagerLoadWithoutLimit(file);

    n1RiskCount   += n1Issues.length;
    rawQueryCount += rawIssues.length;

    allIssues.push(
      ...selectStarIssues,
      ...n1Issues,
      ...transactionIssues,
      ...rawIssues,
      ...eagerLoadIssues,
    );
  }

  return Object.freeze({
    issues:       Object.freeze(allIssues),
    filesScanned: ormFiles.length,
    n1RiskCount,
    rawQueryCount,
  });
}
