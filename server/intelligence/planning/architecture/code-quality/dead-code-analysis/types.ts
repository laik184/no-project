export type DeadCodeIssueType =
  | "UNUSED_EXPORT"
  | "UNUSED_DEFAULT_EXPORT"
  | "EXPORTED_BUT_NEVER_IMPORTED"
  | "ORPHAN_FILE"
  | "UNREFERENCED_MODULE"
  | "DEAD_IMPORT_CHAIN"
  | "CODE_AFTER_RETURN"
  | "CODE_AFTER_THROW"
  | "UNREACHABLE_BRANCH"
  | "DEAD_CONDITIONAL"
  | "UNREACHABLE_CATCH"
  | "CODE_AFTER_PROCESS_EXIT";

export type DeadSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type DeadPhase =
  | "IDLE"
  | "UNUSED_EXPORTS_SCAN"
  | "ORPHAN_DETECTION"
  | "UNREACHABLE_CODE_SCAN"
  | "REPORT_GENERATION"
  | "COMPLETE";

export type CodeLanguage = "typescript" | "javascript" | "unknown";

export interface CodeFile {
  readonly id:       string;
  readonly path:     string;
  readonly content:  string;
  readonly language: CodeLanguage;
}

export interface DeadCodeIssue {
  readonly id:         string;
  readonly type:       DeadCodeIssueType;
  readonly severity:   DeadSeverity;
  readonly filePath:   string;
  readonly line:       number | null;
  readonly column:     number | null;
  readonly message:    string;
  readonly rule:       string;
  readonly suggestion: string;
  readonly snippet:    string | null;
}

export interface UnusedExportsResult {
  readonly issues:              readonly DeadCodeIssue[];
  readonly filesScanned:        number;
  readonly unusedExportCount:   number;
  readonly orphanedSymbols:     readonly string[];
}

export interface OrphanDetectionResult {
  readonly issues:          readonly DeadCodeIssue[];
  readonly filesScanned:    number;
  readonly orphanFileCount: number;
}

export interface UnreachableCodeResult {
  readonly issues:               readonly DeadCodeIssue[];
  readonly filesScanned:         number;
  readonly codeAfterReturnCount: number;
  readonly deadBranchCount:      number;
}

export interface IntermediateDeadIssues {
  readonly unusedExportIssues:   readonly DeadCodeIssue[];
  readonly orphanIssues:         readonly DeadCodeIssue[];
  readonly unreachableIssues:    readonly DeadCodeIssue[];
  readonly builtAt:              number;
}

export interface DeadCodeReport {
  readonly reportId:               string;
  readonly analyzedAt:             number;
  readonly totalFiles:             number;
  readonly totalIssues:            number;
  readonly issues:                 readonly DeadCodeIssue[];
  readonly unusedExportIssueCount: number;
  readonly orphanIssueCount:       number;
  readonly unreachableIssueCount:  number;
  readonly criticalCount:          number;
  readonly highCount:              number;
  readonly mediumCount:            number;
  readonly lowCount:               number;
  readonly overallScore:           number;
  readonly isHealthy:              boolean;
  readonly summary:                string;
}

export interface DeadCodeSession {
  readonly sessionId: string;
  readonly phase:     DeadPhase;
  readonly startedAt: number;
  readonly fileCount: number;
}

export const DEAD_SCORE_START = 100;
export const MAX_DEAD_ISSUES  = 1000;

export const DEAD_DEDUCTIONS = Object.freeze<Record<DeadSeverity, number>>({
  CRITICAL: 30,
  HIGH:     20,
  MEDIUM:   10,
  LOW:       4,
});

export const ENTRY_POINT_PATTERNS = Object.freeze<readonly RegExp[]>([
  /(?:^|\/)index\.(ts|js|tsx|jsx)$/i,
  /(?:^|\/)main\.(ts|js|tsx|jsx)$/i,
  /(?:^|\/)app\.(ts|js|tsx|jsx)$/i,
  /(?:^|\/)server\.(ts|js|tsx|jsx)$/i,
  /(?:^|\/)bootstrap\.(ts|js|tsx|jsx)$/i,
]);

export const NAMED_EXPORT_PATTERNS = Object.freeze<readonly RegExp[]>([
  /^\s*export\s+(?:async\s+)?function\s+(\w+)/gm,
  /^\s*export\s+(?:const|let|var)\s+(\w+)/gm,
  /^\s*export\s+class\s+(\w+)/gm,
  /^\s*export\s+(?:abstract\s+)?class\s+(\w+)/gm,
  /^\s*export\s+interface\s+(\w+)/gm,
  /^\s*export\s+type\s+(\w+)/gm,
  /^\s*export\s+enum\s+(\w+)/gm,
]);

export const DEFAULT_EXPORT_PATTERNS = Object.freeze<readonly RegExp[]>([
  /^\s*export\s+default\s+/gm,
  /^\s*module\.exports\s*=/gm,
]);

export const NAMED_EXPORT_BLOCK_PATTERN =
  /^\s*export\s*\{([^}]+)\}/gm;

export const IMPORT_PATTERNS = Object.freeze<readonly RegExp[]>([
  /import\s+\{([^}]+)\}\s+from\s+['"`]([^'"`]+)['"`]/g,
  /import\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`]/g,
  /import\s+\*\s+as\s+(\w+)\s+from\s+['"`]([^'"`]+)['"`]/g,
  /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g,
]);

export const BARREL_EXPORT_PATTERNS = Object.freeze<readonly RegExp[]>([
  /^\s*export\s+\*\s+from\s+['"`]([^'"`]+)['"`]/gm,
  /^\s*export\s+\{[^}]+\}\s+from\s+['"`]([^'"`]+)['"`]/gm,
]);

export const RETURN_STATEMENT_PATTERN  = /\breturn\b[^;{}\n]*/g;
export const THROW_STATEMENT_PATTERN   = /\bthrow\s+/g;
export const PROCESS_EXIT_PATTERN      = /\bprocess\.exit\s*\(/g;

export const DEAD_CONDITIONAL_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\bif\s*\(\s*false\s*\)/g,
  /\bif\s*\(\s*0\s*\)/g,
  /\bif\s*\(\s*null\s*\)/g,
  /\bif\s*\(\s*undefined\s*\)/g,
  /\bif\s*\(\s*['"]{2}\s*\)/g,
  /\bwhile\s*\(\s*false\s*\)/g,
  /\bif\s*\(\s*true\s*\)\s*\{[^}]*\}\s*else\s*\{/g,
]);

export const UNREACHABLE_CATCH_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\}\s*catch\s*\([^)]+\)\s*\{\s*return\b[^}]*\}\s*finally/g,
]);
