export type ViolationSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface AnalysisViolation {
  readonly id: string;
  readonly type: string;
  readonly severity: ViolationSeverity;
  readonly message: string;
  readonly rule?: string;
  readonly file?: string;
  readonly source?: string;
  readonly from?: string;
  readonly to?: string;
  readonly importedFile?: string;
  readonly evidence?: readonly string[];
  readonly concerns?: readonly string[];
  readonly layer?: number | null;
  readonly fromLayer?: number;
  readonly toLayer?: number;
  readonly domain?: string | null;
}

export interface ArchitectureAnalysisReport {
  readonly reportId: string;
  readonly analyzedAt: number;
  readonly totalViolations: number;
  readonly violations: readonly AnalysisViolation[];
  readonly isCompliant?: boolean;
}

export type ViolationCategory = "boundary" | "dependency" | "hvp" | "responsibility";
export type PriorityLevel = "HIGH" | "MEDIUM" | "LOW";

export interface Decision {
  readonly id: string;
  readonly violationType: string;
  readonly severity: number;
  readonly impact: number;
  readonly risk: number;
  readonly priority: PriorityLevel;
  readonly strategy: string;
  readonly reason: string;
}


export interface DecisionState {
  readonly decisions: readonly Decision[];
  readonly lastRunAt: number;
}

export interface DecisionPlan {
  readonly totalIssues: number;
  readonly highPriority: number;
  readonly mediumPriority: number;
  readonly lowPriority: number;
  readonly decisions: readonly Decision[];
}

export interface ClassifiedViolation {
  readonly violation: Readonly<AnalysisViolation>;
  readonly category: ViolationCategory;
}

export interface DecisionBuildContext {
  readonly classified: Readonly<ClassifiedViolation>;
  readonly severity: number;
  readonly impact: number;
  readonly risk: number;
  readonly priority: PriorityLevel;
  readonly priorityScore: number;
  readonly urgent: boolean;
  readonly blocksDeployment: boolean;
}
