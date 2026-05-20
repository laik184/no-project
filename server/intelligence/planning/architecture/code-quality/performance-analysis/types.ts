export type PerformanceIssueType =
  | "N1_QUERY_PATTERN"
  | "MEMORY_LEAK_PATTERN"
  | "ASYNC_MISUSE"
  | "DB_CALL_HOTSPOT"
  | "UNRESOLVED_PROMISE"
  | "MISSING_AWAIT"
  | "EVENT_LISTENER_LEAK"
  | "UNBOUNDED_LOOP_QUERY"
  | "SEQUENTIAL_AWAIT_IN_LOOP"
  | "MISSING_CONNECTION_CLEANUP";

export type IssueSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type PerformancePhase =
  | "IDLE"
  | "N1_DETECTION"
  | "MEMORY_LEAK_DETECTION"
  | "ASYNC_ANALYSIS"
  | "DB_HOTSPOT_ANALYSIS"
  | "REPORT_GENERATION"
  | "COMPLETE";

export type CodeLanguage = "typescript" | "javascript" | "unknown";

export interface CodeFile {
  readonly id:       string;
  readonly path:     string;
  readonly content:  string;
  readonly language: CodeLanguage;
}

export interface PerformanceIssue {
  readonly id:         string;
  readonly type:       PerformanceIssueType;
  readonly severity:   IssueSeverity;
  readonly filePath:   string;
  readonly line:       number | null;
  readonly column:     number | null;
  readonly message:    string;
  readonly rule:       string;
  readonly suggestion: string;
  readonly snippet:    string | null;
}

export interface N1DetectionResult {
  readonly issues:       readonly PerformanceIssue[];
  readonly filesScanned: number;
}

export interface MemoryLeakResult {
  readonly issues:       readonly PerformanceIssue[];
  readonly filesScanned: number;
}

export interface AsyncMisuseResult {
  readonly issues:       readonly PerformanceIssue[];
  readonly filesScanned: number;
}

export interface DbHotspotResult {
  readonly issues:       readonly PerformanceIssue[];
  readonly filesScanned: number;
  readonly hotFiles:     readonly string[];
}

export interface IntermediateIssues {
  readonly n1Issues:         readonly PerformanceIssue[];
  readonly memoryIssues:     readonly PerformanceIssue[];
  readonly asyncIssues:      readonly PerformanceIssue[];
  readonly dbHotspotIssues:  readonly PerformanceIssue[];
  readonly builtAt:          number;
}

export interface PerformanceReport {
  readonly reportId:         string;
  readonly analyzedAt:       number;
  readonly totalFiles:       number;
  readonly totalIssues:      number;
  readonly issues:           readonly PerformanceIssue[];
  readonly n1Count:          number;
  readonly memoryLeakCount:  number;
  readonly asyncMisuseCount: number;
  readonly dbHotspotCount:   number;
  readonly criticalCount:    number;
  readonly highCount:        number;
  readonly mediumCount:      number;
  readonly lowCount:         number;
  readonly overallScore:     number;
  readonly isPerformant:     boolean;
  readonly summary:          string;
}

export interface PerformanceSession {
  readonly sessionId:  string;
  readonly phase:      PerformancePhase;
  readonly startedAt:  number;
  readonly fileCount:  number;
}

export const PERF_SCORE_START            = 100;
export const MAX_PERF_ISSUES             = 1000;

export const PERF_DEDUCTIONS = Object.freeze<Record<IssueSeverity, number>>({
  CRITICAL: 25,
  HIGH:     15,
  MEDIUM:    7,
  LOW:       3,
});

export const DB_CALL_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\.find\s*\(/g,
  /\.findOne\s*\(/g,
  /\.findById\s*\(/g,
  /\.findAll\s*\(/g,
  /\.query\s*\(/g,
  /\.execute\s*\(/g,
  /\.save\s*\(/g,
  /\.create\s*\(/g,
  /\.update\s*\(/g,
  /\.delete\s*\(/g,
  /\.remove\s*\(/g,
  /\.where\s*\(/g,
  /prisma\.\w+\.\w+\s*\(/g,
  /knex\s*\(/g,
  /db\.\w+\s*\(/g,
  /pool\.\w+\s*\(/g,
  /connection\.\w+\s*\(/g,
  /mongoose\.\w+\s*\(/g,
  /sequelize\.\w+\s*\(/g,
]);

export const MEMORY_LEAK_PATTERNS = Object.freeze<readonly RegExp[]>([
  /addEventListener\s*\(/g,
  /setInterval\s*\(/g,
  /setTimeout\s*\(\s*[^,]+,\s*0\s*\)/g,
  /new\s+Map\s*\(\s*\)/g,
  /new\s+Set\s*\(\s*\)/g,
  /\.on\s*\(\s*['"][^'"]+['"]/g,
  /global\s*\.\s*\w+\s*=/g,
  /process\s*\.\s*\w+\s*=/g,
  /cache\s*\[\s*\w+\s*\]\s*=/g,
  /cache\s*\.\s*set\s*\(/g,
]);

export const ASYNC_MISUSE_PATTERNS = Object.freeze<readonly RegExp[]>([
  /new\s+Promise\s*\(\s*\(resolve\s*,\s*reject\s*\)\s*=>/g,
  /\.then\s*\(\s*\(?\s*\)?\s*=>/g,
  /\.catch\s*\(\s*\(?\w*\)?\s*=>/g,
  /Promise\.resolve\s*\(/g,
  /Promise\.reject\s*\(/g,
]);

export const N1_LOOP_PATTERNS = Object.freeze<readonly RegExp[]>([
  /for\s*\(.*\)\s*\{[^}]*await[^}]*\.(find|query|execute|save|update|delete|remove)\s*\(/gs,
  /forEach\s*\([^)]*=>[^)]*await[^)]*\.(find|query|execute|save|update|delete)\s*\(/gs,
  /map\s*\([^)]*=>[^)]*await[^)]*\.(find|query|execute|save|update|delete)\s*\(/gs,
  /for\s+of[^{]*\{[^}]*await[^}]*db\./gs,
  /for\s+in[^{]*\{[^}]*await[^}]*\.(find|query)\s*\(/gs,
  /while\s*\([^)]*\)\s*\{[^}]*await[^}]*\.(find|query|execute)\s*\(/gs,
]);

export const DB_HOTSPOT_THRESHOLD = 5;
export const CRITICAL_HOTSPOT_THRESHOLD = 10;
