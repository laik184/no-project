/**
 * planning-types.ts
 *
 * Shared type contracts for the advanced planning intelligence engine.
 * Used by complexity-scorer, task-analyzer, dependency-detector, risk-estimator.
 */

export type ExecutionMode = "direct" | "planned" | "pipeline" | "multi-agent";
export type RiskLevel     = "low" | "medium" | "high" | "critical";
export type TaskCategory  =
  | "frontend" | "backend" | "database" | "auth" | "api"
  | "deployment" | "testing" | "infrastructure" | "refactor" | "unknown";

export interface GoalComponent {
  type:     TaskCategory;
  label:    string;
  weight:   number;     // 0.0–1.0, how central this component is
}

export interface TaskDependency {
  from:     string;     // component label
  to:       string;     // component label
  type:     "requires" | "blocks" | "optional";
  reason:   string;
}

export interface GoalAnalysis {
  raw:         string;
  wordCount:   number;
  components:  GoalComponent[];
  actionVerbs: string[];
  entities:    string[];
  isAmbiguous: boolean;
  estimatedFiles: number;
  estimatedCommands: number;
}

export interface ComplexityScore {
  score:          number;         // 0.0–1.0
  confidence:     number;         // 0.0–1.0
  suggestedMode:  ExecutionMode;
  estimatedSteps: number;
  reasoning:      string;
  factors:        Record<string, number>;   // factor name → contribution
}

export interface RiskAssessment {
  overall:   RiskLevel;
  score:     number;              // 0.0–1.0
  factors:   RiskFactor[];
  mitigations: string[];
}

export interface RiskFactor {
  name:        string;
  description: string;
  score:       number;            // 0.0–1.0
  level:       RiskLevel;
}

export interface PlanningResult {
  analysis:    GoalAnalysis;
  complexity:  ComplexityScore;
  risk:        RiskAssessment;
  dependencies: TaskDependency[];
  executionMode: ExecutionMode;
  shouldUseMultiAgent: boolean;
  shouldUsePlanner:    boolean;
}
