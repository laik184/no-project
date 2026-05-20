export type TestArchIssueType =
  | "NO_TEST_FILE_FOR_SOURCE"
  | "UNTESTED_MODULE"
  | "MISSING_EDGE_CASE_TEST"
  | "MISSING_ERROR_PATH_TEST"
  | "MISSING_UNIT_TEST_LAYER"
  | "MISSING_INTEGRATION_TEST_LAYER"
  | "MISSING_E2E_TEST_LAYER"
  | "NO_TEST_FRAMEWORK_DETECTED"
  | "MISSING_MOCK_LAYER"
  | "LOW_TEST_TO_CODE_RATIO"
  | "EMPTY_TEST_FILE"
  | "TEST_WITHOUT_ASSERTIONS"
  | "TESTS_ONLY_HAPPY_PATH";

export type TestSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type TestPhase =
  | "IDLE"
  | "COVERAGE_GAP_MAPPING"
  | "LAYER_ANALYSIS"
  | "RATIO_ANALYSIS"
  | "REPORT_GENERATION"
  | "COMPLETE";

export type CodeLanguage = "typescript" | "javascript" | "unknown";

export interface CodeFile {
  readonly id:       string;
  readonly path:     string;
  readonly content:  string;
  readonly language: CodeLanguage;
}

export interface TestArchIssue {
  readonly id:         string;
  readonly type:       TestArchIssueType;
  readonly severity:   TestSeverity;
  readonly filePath:   string;
  readonly line:       number | null;
  readonly column:     number | null;
  readonly message:    string;
  readonly rule:       string;
  readonly suggestion: string;
  readonly snippet:    string | null;
}

export interface CoverageGapResult {
  readonly issues:             readonly TestArchIssue[];
  readonly sourceFilesScanned: number;
  readonly testFilesFound:     number;
  readonly untestedFiles:      number;
}

export interface LayerAnalysisResult {
  readonly issues:                   readonly TestArchIssue[];
  readonly hasUnitLayer:             boolean;
  readonly hasIntegrationLayer:      boolean;
  readonly hasE2eLayer:              boolean;
  readonly hasMockLayer:             boolean;
}

export interface RatioAnalysisResult {
  readonly issues:            readonly TestArchIssue[];
  readonly testToCodeRatio:   number;
  readonly sourceLineCount:   number;
  readonly testLineCount:     number;
  readonly emptyTestCount:    number;
}

export interface IntermediateTestIssues {
  readonly coverageIssues: readonly TestArchIssue[];
  readonly layerIssues:    readonly TestArchIssue[];
  readonly ratioIssues:    readonly TestArchIssue[];
  readonly builtAt:        number;
}

export interface TestArchReport {
  readonly reportId:               string;
  readonly analyzedAt:             number;
  readonly totalFiles:             number;
  readonly totalIssues:            number;
  readonly issues:                 readonly TestArchIssue[];
  readonly coverageIssueCount:     number;
  readonly layerIssueCount:        number;
  readonly ratioIssueCount:        number;
  readonly criticalCount:          number;
  readonly highCount:              number;
  readonly mediumCount:            number;
  readonly lowCount:               number;
  readonly testToCodeRatio:        number;
  readonly overallScore:           number;
  readonly isHealthy:              boolean;
  readonly summary:                string;
}

export interface TestArchSession {
  readonly sessionId: string;
  readonly phase:     TestPhase;
  readonly startedAt: number;
  readonly fileCount: number;
}

export const TEST_SCORE_START = 100;
export const MAX_TEST_ISSUES  = 1000;

export const TEST_DEDUCTIONS = Object.freeze<Record<TestSeverity, number>>({
  CRITICAL: 25,
  HIGH:     15,
  MEDIUM:    7,
  LOW:       3,
});

export const MIN_TEST_TO_CODE_RATIO = 0.3;
export const LOW_RATIO_THRESHOLD    = 0.15;

export const TEST_FILE_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\.test\.(ts|js|tsx|jsx)$/i,
  /\.spec\.(ts|js|tsx|jsx)$/i,
  /__tests__\//i,
  /\/tests?\//i,
  /\/test\//i,
]);

export const SOURCE_FILE_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\.(ts|js|tsx|jsx)$/,
]);

export const SOURCE_EXCLUDE_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\.test\.(ts|js|tsx|jsx)$/i,
  /\.spec\.(ts|js|tsx|jsx)$/i,
  /__tests__\//i,
  /\/tests?\//i,
  /\/test\//i,
  /\.d\.ts$/i,
  /node_modules\//i,
  /dist\//i,
  /build\//i,
  /coverage\//i,
]);

export const UNIT_TEST_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\bdescribe\s*\(/g,
  /\bit\s*\(\s*['"`]/g,
  /\btest\s*\(\s*['"`]/g,
  /\bbeforeEach\s*\(/g,
  /\bafterEach\s*\(/g,
  /\bbeforeAll\s*\(/g,
  /\bafterAll\s*\(/g,
]);

export const INTEGRATION_TEST_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\bsupertest\b/gi,
  /\brequest\s*\(\s*app\b/g,
  /\baxios\b.*(?:test|spec|it\s*\()/gi,
  /app\.listen\s*\(/g,
  /createServer\s*\(/g,
  /\btestClient\b/gi,
  /\bhttpMocks\b/gi,
  /\bsuperagent\b/gi,
]);

export const E2E_TEST_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\bplaywright\b/gi,
  /\bcypress\b/gi,
  /\bpuppeteer\b/gi,
  /\bselenium\b/gi,
  /\bwebdriverio\b/gi,
  /\bpage\.goto\s*\(/gi,
  /\bcy\.(visit|get|click|type)\s*\(/gi,
  /\bdetox\b/gi,
]);

export const MOCK_PATTERNS = Object.freeze<readonly RegExp[]>([
  /jest\.mock\s*\(/g,
  /jest\.fn\s*\(\)/g,
  /jest\.spyOn\s*\(/g,
  /vi\.mock\s*\(/g,
  /vi\.fn\s*\(\)/g,
  /vi\.spyOn\s*\(/g,
  /sinon\.stub\s*\(/g,
  /sinon\.spy\s*\(/g,
  /sinon\.mock\s*\(/g,
  /td\.replace\s*\(/g,
  /nock\s*\(/g,
  /msw\b/g,
  /\bstub\s*\(/g,
]);

export const ASSERTION_PATTERNS = Object.freeze<readonly RegExp[]>([
  /\bexpect\s*\([^)]+\)\s*\./g,
  /\bassert\s*\.[a-zA-Z]+\s*\(/g,
  /\bassert\s*\(\s*/g,
  /\.should\s*\./g,
  /\.to\s*\.\s*(?:equal|deep|include|throw|be|have|match)\b/g,
]);

export const ERROR_PATH_TEST_PATTERNS = Object.freeze<readonly RegExp[]>([
  /(?:throw|reject|rejects|Error|error|fail|invalid|bad|wrong|missing)/gi,
  /toThrow\s*\(/g,
  /rejects\s*\(/g,
  /\.catch\s*\(/g,
  /expect\.assertions\s*\(/g,
]);

export const TEST_FRAMEWORK_PATTERNS = Object.freeze<ReadonlyArray<{ rx: RegExp; label: string }>>([
  { rx: /\bjest\b/gi,       label: "Jest" },
  { rx: /\bvitest\b/gi,     label: "Vitest" },
  { rx: /\bmocha\b/gi,      label: "Mocha" },
  { rx: /\bjasmine\b/gi,    label: "Jasmine" },
  { rx: /\bava\b/gi,        label: "AVA" },
  { rx: /\btap\b/gi,        label: "TAP" },
  { rx: /\buvu\b/gi,        label: "uvu" },
  { rx: /from\s*['"]vitest['"]/g, label: "Vitest" },
  { rx: /from\s*['"]@jest\/['"]/g, label: "Jest" },
]);
