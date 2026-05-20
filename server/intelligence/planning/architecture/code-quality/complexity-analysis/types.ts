export type ComplexityIssueType =
  | "HIGH_CYCLOMATIC_COMPLEXITY"
  | "EXTREME_CYCLOMATIC_COMPLEXITY"
  | "HIGH_COGNITIVE_COMPLEXITY"
  | "EXTREME_COGNITIVE_COMPLEXITY"
  | "LONG_FUNCTION"
  | "EXTREMELY_LONG_FUNCTION"
  | "LONG_FILE"
  | "DEEP_NESTING"
  | "EXTREME_NESTING"
  | "CALLBACK_HELL";

export type ComplexitySeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type ComplexityPhase =
  | "IDLE"
  | "CYCLOMATIC_SCORING"
  | "COGNITIVE_SCORING"
  | "FUNCTION_LENGTH_ANALYSIS"
  | "NESTING_DEPTH_ANALYSIS"
  | "REPORT_GENERATION"
  | "COMPLETE";

export type CodeLanguage = "typescript" | "javascript" | "unknown";

export interface CodeFile {
  readonly id:       string;
  readonly path:     string;
  readonly content:  string;
  readonly language: CodeLanguage;
}

export interface ComplexityIssue {
  readonly id:            string;
  readonly type:          ComplexityIssueType;
  readonly severity:      ComplexitySeverity;
  readonly filePath:      string;
  readonly functionName:  string | null;
  readonly line:          number | null;
  readonly column:        number | null;
  readonly metricValue:   number;
  readonly threshold:     number;
  readonly message:       string;
  readonly rule:          string;
  readonly suggestion:    string;
  readonly snippet:       string | null;
}

export interface FunctionInfo {
  readonly name:       string;
  readonly startLine:  number;
  readonly endLine:    number;
  readonly lineCount:  number;
  readonly body:       string;
}

export interface CyclomaticResult {
  readonly issues:          readonly ComplexityIssue[];
  readonly filesScanned:    number;
  readonly avgComplexity:   number;
  readonly maxComplexity:   number;
}

export interface CognitiveResult {
  readonly issues:         readonly ComplexityIssue[];
  readonly filesScanned:   number;
  readonly avgCognitive:   number;
  readonly maxCognitive:   number;
}

export interface FunctionLengthResult {
  readonly issues:          readonly ComplexityIssue[];
  readonly filesScanned:    number;
  readonly longFuncCount:   number;
  readonly avgFuncLength:   number;
}

export interface NestingDepthResult {
  readonly issues:         readonly ComplexityIssue[];
  readonly filesScanned:   number;
  readonly maxDepth:       number;
  readonly deepNestCount:  number;
}

export interface IntermediateComplexityIssues {
  readonly cyclomaticIssues:     readonly ComplexityIssue[];
  readonly cognitiveIssues:      readonly ComplexityIssue[];
  readonly functionLengthIssues: readonly ComplexityIssue[];
  readonly nestingIssues:        readonly ComplexityIssue[];
  readonly builtAt:              number;
}

export interface ComplexityReport {
  readonly reportId:                  string;
  readonly analyzedAt:                number;
  readonly totalFiles:                number;
  readonly totalIssues:               number;
  readonly issues:                    readonly ComplexityIssue[];
  readonly cyclomaticIssueCount:      number;
  readonly cognitiveIssueCount:       number;
  readonly functionLengthIssueCount:  number;
  readonly nestingIssueCount:         number;
  readonly criticalCount:             number;
  readonly highCount:                 number;
  readonly mediumCount:               number;
  readonly lowCount:                  number;
  readonly avgCyclomaticComplexity:   number;
  readonly maxCyclomaticComplexity:   number;
  readonly avgCognitiveComplexity:    number;
  readonly maxNestingDepth:           number;
  readonly overallScore:              number;
  readonly isHealthy:                 boolean;
  readonly summary:                   string;
}

export interface ComplexitySession {
  readonly sessionId: string;
  readonly phase:     ComplexityPhase;
  readonly startedAt: number;
  readonly fileCount: number;
}

export const COMPLEX_SCORE_START = 100;
export const MAX_COMPLEX_ISSUES  = 1000;

export const COMPLEX_DEDUCTIONS = Object.freeze<Record<ComplexitySeverity, number>>({
  CRITICAL: 30,
  HIGH:     20,
  MEDIUM:   10,
  LOW:       4,
});

export const CYCLOMATIC_THRESHOLDS = Object.freeze({
  MEDIUM:   11,
  HIGH:     21,
  CRITICAL: 51,
} as const);

export const COGNITIVE_THRESHOLDS = Object.freeze({
  MEDIUM:   16,
  HIGH:     31,
  CRITICAL: 51,
} as const);

export const FUNCTION_LENGTH_THRESHOLDS = Object.freeze({
  MEDIUM:   30,
  HIGH:     60,
  CRITICAL: 100,
} as const);

export const FILE_LENGTH_THRESHOLDS = Object.freeze({
  LOW:    301,
  MEDIUM: 501,
} as const);

export const NESTING_THRESHOLDS = Object.freeze({
  MEDIUM:   4,
  HIGH:     6,
  CRITICAL: 8,
} as const);

export const CYCLOMATIC_DECISION_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\bif\s*\(/g,
  /\belse\s+if\s*\(/g,
  /\bfor\s*\(/g,
  /\bfor\s+(?:const|let|var)\s+\w+\s+(?:of|in)\b/g,
  /\bwhile\s*\(/g,
  /\bdo\s*\{/g,
  /\bcase\s+[^:]+:/g,
  /\bcatch\s*\(/g,
  /\?\?/g,
  /\?\s*[^:]/g,
  /&&/g,
  /\|\|/g,
]);

export const CONTROL_FLOW_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\bif\b/g,
  /\belse\s+if\b/g,
  /\belse\b/g,
  /\bfor\b/g,
  /\bwhile\b/g,
  /\bdo\b/g,
  /\bswitch\b/g,
  /\bcatch\b/g,
  /\bbreak\b/g,
]);

export const FUNCTION_DEF_PATTERNS = Object.freeze<readonly RegExp[]>([
  /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm,
  /^\s*(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|\w+\s*=>)/gm,
  /^\s*(?:public|private|protected|static|async|override|\s)*(\w+)\s*\([^)]*\)\s*(?::\s*\S+\s*)?\{/gm,
  /^\s*(?:get|set)\s+(\w+)\s*\(/gm,
]);

export const CALLBACK_NEST_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\.then\s*\([^)]*=>/g,
  /\.then\s*\(function/g,
  /setTimeout\s*\(function/g,
  /setInterval\s*\(function/g,
  /\bcallback\s*\([^)]*\)\s*\{/g,
]);
