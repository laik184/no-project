import type {
  CodeFile,
  PerformanceIssue,
  DbHotspotResult,
} from "../types.js";
import {
  DB_CALL_PATTERNS,
  DB_HOTSPOT_THRESHOLD,
  CRITICAL_HOTSPOT_THRESHOLD,
} from "../types.js";
import { countPatternOccurrences, isTestFile, isTypeFile, matchPattern } from "../utils/pattern.matcher.util.js";
import { extractFileDomain } from "../utils/ast.util.js";

let _counter = 0;
function nextId(): string {
  _counter += 1;
  return `perf-db-${String(_counter).padStart(4, "0")}`;
}
export function resetDbHotspotCounter(): void { _counter = 0; }

interface FileDbProfile {
  readonly filePath:  string;
  readonly dbCalls:   number;
  readonly domain:    string;
  readonly isCritical: boolean;
  readonly isHot:      boolean;
}

function profileFile(file: Readonly<CodeFile>): FileDbProfile {
  const dbCalls   = countPatternOccurrences(file.content, [...DB_CALL_PATTERNS]);
  const domain    = extractFileDomain(file.path);
  return Object.freeze({
    filePath:   file.path,
    dbCalls,
    domain,
    isCritical: dbCalls >= CRITICAL_HOTSPOT_THRESHOLD,
    isHot:      dbCalls >= DB_HOTSPOT_THRESHOLD,
  });
}

function buildHotspotIssue(
  filePath: string,
  dbCalls:  number,
  line:     number | null,
  snippet:  string | null,
): PerformanceIssue {
  const isCritical = dbCalls >= CRITICAL_HOTSPOT_THRESHOLD;
  return Object.freeze({
    id:         nextId(),
    type:       "DB_CALL_HOTSPOT" as const,
    severity:   isCritical ? "CRITICAL" as const : "HIGH" as const,
    filePath,
    line,
    column:     null,
    message:    `DB call hotspot: ${dbCalls} database operations detected in a single file.`,
    rule:       isCritical ? "CRITICAL_DB_HOTSPOT" : "DB_HOTSPOT",
    suggestion: "Extract DB calls into a dedicated repository/data-access layer. Use batching or query caching.",
    snippet,
  });
}

function buildQuerySpreadIssue(
  filePath: string,
  domain:   string,
): PerformanceIssue {
  return Object.freeze({
    id:         nextId(),
    type:       "DB_CALL_HOTSPOT" as const,
    severity:   "MEDIUM" as const,
    filePath,
    line:       null,
    column:     null,
    message:    `DB calls spread across domain '${domain}' without centralized data layer.`,
    rule:       "SCATTERED_DB_CALLS",
    suggestion: "Centralize data access in a dedicated repository pattern to improve cohesion and enable query optimization.",
    snippet:    null,
  });
}

function detectRawQueryInBusinessLogic(file: Readonly<CodeFile>): readonly PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  const isBusinessFile =
    file.path.includes("/services/") ||
    file.path.includes("/controllers/") ||
    file.path.includes("/handlers/") ||
    file.path.includes("/use-cases/") ||
    file.path.includes("/orchestrator");

  if (!isBusinessFile) return Object.freeze([]);

  const rawQueryRx = /(?:knex|db)\s*\.\s*raw\s*\(/g;
  const hits = matchPattern(file.content, rawQueryRx);

  for (const hit of hits.slice(0, 5)) {
    issues.push(Object.freeze({
      id:         nextId(),
      type:       "DB_CALL_HOTSPOT" as const,
      severity:   "HIGH" as const,
      filePath:   file.path,
      line:       hit.line,
      column:     null,
      message:    "Raw SQL query in business logic layer — tightly couples DB schema to domain code.",
      rule:       "RAW_QUERY_IN_BUSINESS_LOGIC",
      suggestion: "Move raw queries to a repository or data-access layer. Use parameterized queries for safety.",
      snippet:    hit.snippet,
    }));
  }

  return Object.freeze(issues);
}

function detectSelectStar(file: Readonly<CodeFile>): readonly PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  const selectStarRx = /SELECT\s+\*/gi;
  const hits = matchPattern(file.content, selectStarRx);

  for (const hit of hits.slice(0, 5)) {
    issues.push(Object.freeze({
      id:         nextId(),
      type:       "DB_CALL_HOTSPOT" as const,
      severity:   "MEDIUM" as const,
      filePath:   file.path,
      line:       hit.line,
      column:     null,
      message:    "SELECT * fetches all columns — unnecessary data transfer increases memory and network load.",
      rule:       "SELECT_STAR",
      suggestion: "Specify only required columns in SELECT statements to reduce payload size.",
      snippet:    hit.snippet,
    }));
  }

  return Object.freeze(issues);
}

function detectMissingPagination(file: Readonly<CodeFile>): readonly PerformanceIssue[] {
  const issues: PerformanceIssue[] = [];

  const findAllRx  = /\.(findAll|find\s*\(\s*\{[^}]*\})\s*\(/g;
  const findAllHits = matchPattern(file.content, findAllRx);

  for (const hit of findAllHits) {
    const lineContent = hit.snippet ?? "";
    const hasLimit    = /limit|take|skip|offset|paginate/.test(lineContent.toLowerCase());
    if (hasLimit) continue;

    const surroundingLines = file.content
      .split("\n")
      .slice(Math.max(0, (hit.line ?? 1) - 1), (hit.line ?? 1) + 3)
      .join("\n");

    if (/limit|take|skip|offset|paginate/i.test(surroundingLines)) continue;

    issues.push(Object.freeze({
      id:         nextId(),
      type:       "DB_CALL_HOTSPOT" as const,
      severity:   "HIGH" as const,
      filePath:   file.path,
      line:       hit.line,
      column:     null,
      message:    "findAll/find without pagination — may load entire table into memory.",
      rule:       "MISSING_PAGINATION",
      suggestion: "Add limit/take and skip/offset parameters to prevent full table scans.",
      snippet:    hit.snippet,
    }));
  }

  return Object.freeze(issues);
}

export function analyzeDbHotspots(files: readonly CodeFile[]): DbHotspotResult {
  const allIssues: PerformanceIssue[] = [];
  const hotFiles: string[] = [];
  let filesScanned = 0;

  const profiles: FileDbProfile[] = [];

  for (const file of files) {
    if (isTestFile(file.path) || isTypeFile(file.path)) continue;
    if (!file.content.trim()) continue;

    filesScanned += 1;

    const profile = profileFile(file);
    profiles.push(profile);

    if (profile.isHot) {
      hotFiles.push(file.path);

      const firstHit = matchPattern(file.content, DB_CALL_PATTERNS[0])[0] ?? null;
      allIssues.push(buildHotspotIssue(
        file.path,
        profile.dbCalls,
        firstHit?.line ?? null,
        firstHit?.snippet ?? null,
      ));
    }

    allIssues.push(
      ...detectRawQueryInBusinessLogic(file),
      ...detectSelectStar(file),
      ...detectMissingPagination(file),
    );
  }

  const domainMap = new Map<string, number>();
  for (const p of profiles) {
    if (!p.isHot) continue;
    domainMap.set(p.domain, (domainMap.get(p.domain) ?? 0) + 1);
  }
  for (const [domain, count] of domainMap.entries()) {
    if (count >= 3) {
      const firstFile = profiles.find((p) => p.domain === domain)?.filePath ?? "unknown";
      allIssues.push(buildQuerySpreadIssue(firstFile, domain));
    }
  }

  return Object.freeze({
    issues:       Object.freeze(allIssues),
    filesScanned,
    hotFiles:     Object.freeze(hotFiles),
  });
}

export function dbHotspotCount(result: Readonly<DbHotspotResult>): number {
  return result.issues.length;
}

export function criticalHotspots(
  result: Readonly<DbHotspotResult>,
): readonly PerformanceIssue[] {
  return Object.freeze(result.issues.filter((i) => i.severity === "CRITICAL"));
}
