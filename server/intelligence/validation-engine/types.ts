export type ValidationSource = "generation" | "execution" | "intelligence" | "unknown";

export type IssueSeverity = "low" | "medium" | "high" | "critical";

export type IssueType =
  | "syntax"
  | "contract"
  | "schema"
  | "logic"
  | "security"
  | "performance"
  | "consistency";

export interface ValidationInput {
  readonly source: ValidationSource;
  readonly code: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly schema?: Readonly<Record<string, unknown>>;
  readonly agentId?: string;
  readonly sessionId?: string;
}

export interface IssueLocation {
  readonly line?: number;
  readonly column?: number;
  readonly snippet?: string;
}

export interface ValidationIssue {
  readonly type: IssueType;
  readonly severity: IssueSeverity;
  readonly message: string;
  readonly location?: IssueLocation;
  readonly rule?: string;
}

export interface ValidationResult {
  readonly success: boolean;
  readonly issues: readonly ValidationIssue[];
  readonly score: number;
  readonly logs: readonly string[];
  readonly error?: string;
}

export interface ValidationRecord {
  readonly agentId?: string;
  readonly score: number;
  readonly issueCount: number;
  readonly success: boolean;
  readonly timestamp: number;
}

export interface ValidationState {
  readonly totalValidations: number;
  readonly failureCount: number;
  readonly lastScore: number;
  readonly history: readonly ValidationRecord[];
}
