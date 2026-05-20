export type PlanningPhase =
  | "idle"
  | "prompt-refinement"
  | "goal-analysis"
  | "task-decomposition"
  | "dependency-planning"
  | "strategy-building"
  | "risk-assessment"
  | "validation"
  | "complete"
  | "failed";

export type TaskType =
  | "ANALYZE"
  | "CONFIGURE"
  | "CREATE"
  | "MODIFY"
  | "DELETE"
  | "VALIDATE"
  | "DEPLOY"
  | "TEST"
  | "DOCUMENT"
  | "REVIEW";

export type RiskLevel  = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ExecutionMode  = "SEQUENTIAL" | "PARALLEL" | "MIXED";
export type RetryStrategy  = "NONE" | "FIXED" | "EXPONENTIAL";

export interface PlannerResult<T = undefined> {
  readonly ok:     boolean;
  readonly error?: string;
  readonly code?:  string;
  readonly data?:  T;
  readonly phase?: PlanningPhase;
}

export interface UserGoal {
  readonly rawInput:   string;
  readonly context?:   Readonly<Record<string, unknown>>;
  readonly sessionId?: string;
}

export interface RefinedPrompt {
  readonly normalized:     string;
  readonly keywords:       readonly string[];
  readonly constraints:    readonly string[];
  readonly intent:         string;
  readonly ambiguityScore: number;
}

export interface StructuredIntent {
  readonly primaryObjective:    string;
  readonly subObjectives:       readonly string[];
  readonly successCriteria:     readonly string[];
  readonly constraints:         readonly string[];
  readonly requiredCapabilities: readonly string[];
  readonly estimatedComplexity: number;
}

export interface AtomicTask {
  readonly id:              string;
  readonly type:            TaskType;
  readonly label:           string;
  readonly description:     string;
  readonly inputs:          readonly string[];
  readonly outputs:         readonly string[];
  readonly estimatedEffort: number;
  readonly priority:        number;
  readonly optional:        boolean;
}

export interface TaskDependency {
  readonly taskId:    string;
  readonly dependsOn: readonly string[];
}

export interface TaskDependencyMap {
  readonly tasks:           readonly AtomicTask[];
  readonly dependencies:    readonly TaskDependency[];
  readonly executionLevels: readonly (readonly string[])[];
  readonly hasCircularDeps: boolean;
}

export interface RetryConfig {
  readonly strategy:    RetryStrategy;
  readonly maxAttempts: number;
  readonly delayMs:     number;
}

export interface TaskExecutionUnit {
  readonly task:           AtomicTask;
  readonly executionLevel: number;
  readonly canParallelize: boolean;
  readonly retryConfig:    RetryConfig;
}

export interface ExecutionStrategy {
  readonly mode:              ExecutionMode;
  readonly units:             readonly TaskExecutionUnit[];
  readonly estimatedDuration: number;
  readonly totalTasks:        number;
  readonly parallelGroups:    number;
}

export interface RiskFactor {
  readonly category:    string;
  readonly description: string;
  readonly level:       RiskLevel;
  readonly mitigation:  string;
}

export interface RiskAssessment {
  readonly overallRisk:    RiskLevel;
  readonly factors:        readonly RiskFactor[];
  readonly blockingIssues: readonly string[];
  readonly warnings:       readonly string[];
  readonly approved:       boolean;
}

export interface ValidationIssue {
  readonly type:    "ERROR" | "WARNING";
  readonly message: string;
  readonly taskId?: string;
}

export interface PlanValidationReport {
  readonly valid:   boolean;
  readonly issues:  readonly ValidationIssue[];
  readonly score:   number;
  readonly summary: string;
}

export interface CapabilityRoute {
  readonly capability: string;
  readonly agentType:  string;
  readonly available:  boolean;
  readonly confidence: number;
}

export interface CapabilityMap {
  readonly routes:              readonly CapabilityRoute[];
  readonly missingCapabilities: readonly string[];
  readonly coverageScore:       number;
}

export interface ExecutionPlan {
  readonly planId:           string;
  readonly sessionId:        string;
  readonly createdAt:        number;
  readonly goal:             UserGoal;
  readonly refinedPrompt:    RefinedPrompt;
  readonly intent:           StructuredIntent;
  readonly capabilityMap:    CapabilityMap;
  readonly tasks:            readonly AtomicTask[];
  readonly dependencyMap:    TaskDependencyMap;
  readonly strategy:         ExecutionStrategy;
  readonly riskAssessment:   RiskAssessment;
  readonly validationReport: PlanValidationReport;
  readonly approved:         boolean;
}

export interface PlanningSession {
  readonly sessionId:    string;
  readonly goal:         UserGoal;
  readonly phase:        PlanningPhase;
  readonly createdAt:    number;
  readonly intermediates: Readonly<{
    refinedPrompt?:    RefinedPrompt;
    intent?:           StructuredIntent;
    capabilityMap?:    CapabilityMap;
    tasks?:            readonly AtomicTask[];
    dependencyMap?:    TaskDependencyMap;
    strategy?:         ExecutionStrategy;
    riskAssessment?:   RiskAssessment;
    validationReport?: PlanValidationReport;
  }>;
}
