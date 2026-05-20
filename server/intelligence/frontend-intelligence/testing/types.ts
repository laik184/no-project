export type IssueSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type OverallSeverity = "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ComponentType =
  | "page"
  | "layout"
  | "form"
  | "context"
  | "hook"
  | "ui"
  | "util";

export type TestFramework =
  | "jest"
  | "vitest"
  | "playwright"
  | "cypress"
  | "testing-library"
  | "unknown";

export type AnalysisStage =
  | "idle"
  | "presence"
  | "mapping"
  | "critical-detection"
  | "missing-tests"
  | "coverage-estimation"
  | "complete";

export interface ComponentDescriptor {
  readonly id: string;
  readonly name: string;
  readonly filePath: string;
  readonly type: ComponentType;
  readonly hasProps: boolean;
  readonly hasState: boolean;
  readonly hasEffects: boolean;
  readonly isExported: boolean;
}

export interface TestFileDescriptor {
  readonly id: string;
  readonly filePath: string;
  readonly testedComponentNames: readonly string[];
  readonly testFramework: TestFramework;
  readonly testCount: number;
}

export interface PresenceResult {
  readonly hasTests: boolean;
  readonly totalTestFiles: number;
  readonly frameworks: readonly TestFramework[];
  readonly testToSourceRatio: number;
}

export interface ComponentTestMapping {
  readonly componentId: string;
  readonly componentName: string;
  readonly filePath: string;
  readonly testedBy: readonly string[];
  readonly isTested: boolean;
}

export interface MissingTestIssue {
  readonly componentId: string;
  readonly componentName: string;
  readonly filePath: string;
  readonly severity: IssueSeverity;
  readonly reason: string;
  readonly suggestion: string;
}

export interface CriticalComponentResult {
  readonly componentId: string;
  readonly componentName: string;
  readonly filePath: string;
  readonly criticalityScore: number;
  readonly reasons: readonly string[];
  readonly isTested: boolean;
  readonly severity: IssueSeverity;
}

export interface CoverageScoreBreakdown {
  readonly presenceScore: number;
  readonly mappingScore: number;
  readonly criticalCoverageScore: number;
  readonly testQualityScore: number;
  readonly overall: number;
}

export interface TestingAnalysisReport {
  readonly sessionId: string;
  readonly analyzedAt: number;
  readonly presenceResult: PresenceResult;
  readonly componentMappings: readonly ComponentTestMapping[];
  readonly missingTestIssues: readonly MissingTestIssue[];
  readonly criticalComponents: readonly CriticalComponentResult[];
  readonly coverageScore: number;
  readonly scoreBreakdown: CoverageScoreBreakdown;
  readonly severity: OverallSeverity;
  readonly totalIssues: number;
  readonly summary: string;
}

export interface TestingAnalysisInput {
  readonly sessionId: string;
  readonly components: readonly ComponentDescriptor[];
  readonly testFiles: readonly TestFileDescriptor[];
}

export interface IntermediateMapping {
  readonly componentMappings: readonly ComponentTestMapping[];
  readonly criticalComponents: readonly CriticalComponentResult[];
}

export interface TestingSession {
  readonly input: TestingAnalysisInput;
  readonly stage: AnalysisStage;
  readonly intermediate: IntermediateMapping | null;
}
