export type PlanningStage =
  | "idle"
  | "goal-analysis"
  | "task-decomposition"
  | "dependency-mapping"
  | "execution-sequencing"
  | "complete"
  | "failed";

export type TaskType =
  | "ANALYZE"
  | "CONFIGURE"
  | "CREATE"
  | "MODIFY"
  | "VALIDATE"
  | "TEST"
  | "DOCUMENT"
  | "DEPLOY"
  | "REVIEW"
  | "DELETE";

export type TaskCategory =
  | "infrastructure"
  | "data-modeling"
  | "business-logic"
  | "api-layer"
  | "testing"
  | "documentation"
  | "deployment"
  | "configuration";

export interface PlanResult<T = undefined> {
  readonly ok:     boolean;
  readonly error?: string;
  readonly code?:  string;
  readonly data?:  T;
  readonly stage?: PlanningStage;
}

export interface GoalInput {
  readonly goalId:               string;
  readonly primaryObjective:     string;
  readonly subObjectives:        readonly string[];
  readonly constraints:          readonly string[];
  readonly requiredCapabilities: readonly string[];
  readonly estimatedComplexity:  number;
  readonly sessionId?:           string;
}

export interface AnalyzedGoal {
  readonly goalId:              string;
  readonly primaryObjective:    string;
  readonly subObjectives:       readonly string[];
  readonly taskCategories:      readonly TaskCategory[];
  readonly estimatedComplexity: number;
  readonly constraints:         readonly string[];
  readonly scopeKeywords:       readonly string[];
}

export interface PlanTask {
  readonly id:              string;
  readonly type:            TaskType;
  readonly category:        TaskCategory;
  readonly label:           string;
  readonly description:     string;
  readonly inputs:          readonly string[];
  readonly outputs:         readonly string[];
  readonly estimatedEffort: number;
  readonly priority:        number;
  readonly optional:        boolean;
}

export interface TaskEdge {
  readonly fromTaskId: string;
  readonly toTaskId:   string;
}

export interface TaskGraph {
  readonly nodes:           readonly PlanTask[];
  readonly edges:           readonly TaskEdge[];
  readonly hasCircularDeps: boolean;
  readonly adjacency:       Readonly<Record<string, readonly string[]>>;
}

export interface ExecutionLevel {
  readonly level:          number;
  readonly taskIds:        readonly string[];
  readonly canParallelize: boolean;
}

export interface ExecutionPlan {
  readonly planId:           string;
  readonly sessionId:        string;
  readonly createdAt:        number;
  readonly goal:             GoalInput;
  readonly taskGraph:        TaskGraph;
  readonly executionLevels:  readonly ExecutionLevel[];
  readonly totalTasks:       number;
  readonly estimatedEffort:  number;
  readonly parallelizable:   boolean;
}

export interface IntermediateTaskGraph {
  readonly nodes: readonly PlanTask[];
  readonly edges: readonly TaskEdge[];
}

export interface PlanningSession {
  readonly sessionId:   string;
  readonly goal:        GoalInput;
  readonly stage:       PlanningStage;
  readonly createdAt:   number;
  readonly intermediate: Readonly<{
    analyzedGoal?:   AnalyzedGoal;
    taskGraph?:      IntermediateTaskGraph;
    executionLevels?: readonly ExecutionLevel[];
  }>;
}
